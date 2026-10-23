/* ================================================================
   Zealandia villages + instance travel (2026-10-23, Han's direction).
   Villages stand around South Pacific ruin sites. Travel is NOT an
   open world: between one village and the next, by distance, one or
   two additional instanced field maps are generated, and the player
   teleports between instances (fade + scene swap), the way classic
   instance-based games do it. This is Zealandia-only; the Espil
   Online web cities keep their open-world form.
   Addresses: Zealandia/<VillageName> (the registry slug);
   field instances sit on the segments between stops.
   Each ruin carries a main quest (elder's story -> guardians -> the
   ruin heart). Clearing all six villages' stories brings Espil into
   the story for the first time.
   Scene monsters register into the town's monster list while their
   scene is active, so the player's real combat applies everywhere.
   ================================================================ */
(function(){
  'use strict';
  var CX=0, CZ=10000, HC=52;
  var V={scene:'town', built:false, groups:{}, promptFor:null, promptAction:null,
         dialog:null, pinPos:null, espil:null, espilPlaced:false, sceneMonsters:[]};
  window.__zvillages=V;
  window.__zscene='town';

  var VILLAGES=[
    { slug:'nan-madol', name:'Nan Madol', ruin:'canal', elder:'Elder Nahla', guardianCount:4, tint:0x8fa583,
      intro:['You stand where the stone city stood, traveller. Nan Madol - whole walls of basalt logs, raised on the water by hands no one now remembers.',
             'When the balance broke, the things that unmake creation nested in its canals. They sit on the heart of this place and will not move for words.',
             'Drive them off, then lay your hand on the heart stone. Let this ruin breathe again.'],
      clear:'The canals are quiet. Nan Madol breathes again - one anchor of the world holds fast.' },
    { slug:'haamonga', name:"Ha'amonga", ruin:'trilithon', elder:'Elder Tui', guardianCount:3, tint:0xa5916d,
      intro:["Ha'amonga - the burden of Maui. Three stones, and the seasons turn through them like a gate.",
             'The unmakers coil around the trilithon and drag at its shadow. The gate of seasons must not fall crooked.',
             'Clear them from the stones, and set your hand to the heart. The seasons will remember their road.'],
      clear:'The trilithon stands true again. Ha\u2019amonga keeps the seasons - one anchor of the world holds fast.' },
    { slug:'taputapuatea', name:'Taputapuatea', ruin:'marae', elder:'Elder Arii', guardianCount:4, tint:0x93a86f,
      intro:['Taputapuatea - the great marae, where the voyagers of all the islands once came to speak with the gods.',
             'What nests here now answers no prayers. It gnaws the platform stones and waits for the balance to fail.',
             'Take the marae back from them. Then wake its heart, and let the old road of the canoes open in the sky again.'],
      clear:'The marae is silent and clean. Taputapuatea listens again - one anchor of the world holds fast.' },
    { slug:'ahu-tongariki', name:'Ahu Tongariki', ruin:'ahu', elder:'Elder Hotu', guardianCount:5, tint:0xa8836d,
      intro:['Ahu Tongariki - fifteen moai once stood on this platform and watched the sunrise for their people.',
             'The unmakers have climbed the ahu. Stone that watched the dawn should not be a nest for the things that end the world.',
             'Sweep them from the platform. Wake the heart, and the watchers will face the morning again.'],
      clear:'The ahu stands clear under the sky. Ahu Tongariki watches again - one anchor of the world holds fast.' },
    { slug:'leluh', name:'Leluh', ruin:'city', elder:'Elder Sra', guardianCount:4, tint:0x87a08e,
      intro:['Leluh - a city of stone on the lagoon, courts and walls for kings whose names the water keeps.',
             'The canals are choked with what the broken balance let in. They unmake a little more of it every day.',
             'Clear the courts, traveller. Wake the heart of Leluh, and let the city remember it was a city.'],
      clear:'The courts of Leluh are open to the sky. The stone city stands again - one anchor of the world holds fast.' },
    { slug:'pulemelei', name:'Pulemelei', ruin:'mound', elder:'Elder Fale', guardianCount:3, tint:0x97a468,
      intro:['Pulemelei - the great mound, raised step by step toward the gods of the old islands.',
             'Something heavy sits on its summit and presses the whole mound down, the way a weight presses on the air of the world.',
             'Climb and clear it. Wake the heart at the top, and let Pulemelei lift its head again.'],
      clear:'The mound breathes from its summit. Pulemelei stands tall again - one anchor of the world holds fast.' }
  ];
  var BY_SLUG={}; VILLAGES.forEach(function(v){ BY_SLUG[v.slug]=v; v.guardians=[]; });
  V.registry=VILLAGES;

  /* The route: stops in order; between neighbours, by distance, 1-2
     instanced field maps (teleport hops, never open-world walking). */
  var ROUTE=['town','nan-madol','haamonga','taputapuatea','ahu-tongariki','leluh','pulemelei'];
  var HOPS={ 'town>nan-madol':1, 'nan-madol>haamonga':2, 'haamonga>taputapuatea':1,
             'taputapuatea>ahu-tongariki':2, 'ahu-tongariki>leluh':1, 'leluh>pulemelei':2 };
  function stopName(id){ return id==='town' ? 'Waitematā' : BY_SLUG[id].name; }
  function hopsBetween(a, b){ return HOPS[a+'>'+b] || HOPS[b+'>'+a] || 0; }
  function neighbours(id){
    var i=ROUTE.indexOf(id);
    return { prev: i>0 ? ROUTE[i-1] : null, next: i>=0 && i<ROUTE.length-1 ? ROUTE[i+1] : null };
  }
  function fieldId(a, b, k){ return 'field:'+a+'>'+b+'#'+k; }
  function chainNext(fromScene, towardStop){
    if(fromScene.indexOf('field:')===0){
      var seg=fromScene.slice(6), hash=seg.indexOf('#');
      var ab=seg.slice(0,hash), k=parseInt(seg.slice(hash+1),10);
      var parts=ab.split('>'), a=parts[0], b=parts[1];
      var total=hopsBetween(a,b);
      if(towardStop===b) return k<total ? fieldId(a,b,k+1) : b;
      return k>1 ? fieldId(a,b,k-1) : a;
    }
    var total2=hopsBetween(fromScene, towardStop);
    if(total2>0){
      var ri=ROUTE.indexOf(fromScene), rj=ROUTE.indexOf(towardStop);
      if(rj>ri)return fieldId(fromScene, towardStop, 1);
      return fieldId(towardStop, fromScene, total2);
    }
    return towardStop;
  }
  V.chainNext=chainNext; V.route=ROUTE; V.hops=HOPS;

  /* ---------- persistence ---------- */
  function loadQ(){
    try{ var q=JSON.parse(localStorage.getItem('espil_zquests')||'{}'); if(q&&q.cleared)return q; }catch(e){}
    return {cleared:{}, espil:false, debutSeen:false};
  }
  var Q=loadQ(); V.quest=Q;
  function saveQ(){ try{ localStorage.setItem('espil_zquests', JSON.stringify(Q)); }catch(e){} }
  function clearedCount(){ var n=0; for(var k in Q.cleared)if(Q.cleared[k])n++; return n; }
  V.clearedCount=clearedCount;

  /* ---------- helpers ---------- */
  function refs(){ return window.__ztownRefs||{}; }
  function ztown(){ return window.__ztown||null; }
  function mat(c,o){ return new THREE.MeshLambertMaterial(Object.assign({color:c},o||{})); }
  var _rand=987654321;
  function rand(){ _rand|=0; _rand=_rand+0x6D2B79F5|0; var t=Math.imul(_rand^_rand>>>15,1|_rand); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }
  function textSprite(text, scale, fg){
    var cv=document.createElement('canvas'); cv.width=512; cv.height=112;
    var c=cv.getContext('2d');
    c.font='bold 46px Georgia,serif'; c.textAlign='center'; c.textBaseline='middle';
    c.lineWidth=8; c.strokeStyle='rgba(20,12,4,.85)'; c.strokeText(text,256,58);
    c.fillStyle=fg||'#fff'; c.fillText(text,256,58);
    var tex=new THREE.CanvasTexture(cv);
    var sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthWrite:false}));
    sp.scale.set(scale||4.6,(scale||4.6)*112/512,1);
    return sp;
  }
  function box(w,h,d,c,x,y,z){ var m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(c)); m.position.set(x,y,z); m.castShadow=true; return m; }
  function toast(msg){ if(window.__espilToast)window.__espilToast(msg); }
  function groundAt(wx,wz){ var Z=ztown(); return Z&&Z.groundAt?Z.groundAt(wx,wz):HC; }
  var _strayerTex={};
  function strayerTex(set, i){
    var key=set+'_'+i;
    if(!_strayerTex[key])_strayerTex[key]=new THREE.TextureLoader().load('assets/zealandia/sprites/strayer/strayer_'+set+'_'+i+'.png');
    return _strayerTex[key];
  }
  var _blobTex=null;
  function blobTex(){
    if(_blobTex)return _blobTex;
    var cv=document.createElement('canvas'); cv.width=cv.height=64;
    var c=cv.getContext('2d');
    var gr=c.createRadialGradient(32,32,4,32,32,30);
    gr.addColorStop(0,'rgba(0,0,0,0.34)'); gr.addColorStop(1,'rgba(0,0,0,0)');
    c.fillStyle=gr; c.fillRect(0,0,64,64);
    _blobTex=new THREE.CanvasTexture(cv); return _blobTex;
  }
  function makeBar(){
    var cv=document.createElement('canvas'); cv.width=96; cv.height=14;
    var tex=new THREE.CanvasTexture(cv);
    var sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthWrite:false}));
    sp.scale.set(1.9,0.28,1);
    var bar={sp:sp, cv:cv, tex:tex};
    var c=cv.getContext('2d'); c.fillStyle='rgba(10,10,10,.72)'; c.fillRect(0,0,96,14);
    c.fillStyle='#57d95e'; c.fillRect(2,3,92,8); tex.needsUpdate=true;
    return bar;
  }
  function strayMesh(){
    var g=new THREE.Group();
    var bodyM=new THREE.SpriteMaterial({map:strayerTex('idle',1), transparent:true});
    var sp=new THREE.Sprite(bodyM);
    sp.scale.set(1.93,2.0,1); sp.position.y=1.02; g.add(sp);
    var sh=new THREE.Mesh(new THREE.PlaneGeometry(1.7,1.7),
      new THREE.MeshBasicMaterial({map:blobTex(), transparent:true, depthWrite:false}));
    sh.rotation.x=-Math.PI/2; sh.position.y=0.04; g.add(sh);
    return {grp:g, bodyM:bodyM, sprite:sp};
  }
  function registerMonster(slugOrField, grp, bodyM, sprite, wx, wz){
    var Z=ztown(); if(!Z)return null;
    var bar=makeBar(); bar.sp.position.y=2.35; grp.add(bar.sp);
    var m={grp:grp, bodyM:bodyM, sprite:sprite||null, bar:bar, hp:30, maxhp:30, alive:true,
           spawnX:wx, spawnZ:wz, lx:wx-CX, lz:wz-CZ, atkCd:0, flashT:0, animT:rand()*0.6, animSet:'', animIdx:-1, atkT:0,
           state:'idle', timer:1+rand()*3, tx:wx, tz:wz, deathT:0, respawnAt:0, fallK:0, village:true, slug:slugOrField};
    Z.monsters.push(m);
    V.sceneMonsters.push(m);
    return m;
  }
  function clearSceneMonsters(){
    var Z=ztown(); if(!Z)return;
    V.sceneMonsters.forEach(function(m){
      var ix=Z.monsters.indexOf(m);
      if(ix>=0)Z.monsters.splice(ix,1);
      if(m.grp&&m.grp.parent)m.grp.parent.remove(m.grp);
    });
    V.sceneMonsters=[];
    VILLAGES.forEach(function(v){ v.guardians=[]; });
  }

  /* ---------- DOM ---------- */
  function styles(){
    if(document.getElementById('zv-style'))return;
    var st=document.createElement('style'); st.id='zv-style';
    st.textContent=
    '#zv-prompt{position:fixed;left:50%;bottom:19vh;transform:translateX(-50%);z-index:9400;background:rgba(10,16,26,.78);border:1px solid rgba(150,220,255,.55);color:#eaf7ff;font:600 13px/1.3 system-ui,sans-serif;padding:8px 14px;border-radius:999px;cursor:pointer;display:none;backdrop-filter:blur(6px)}'+
    '#zv-prompt b{color:#8fe3ff}'+
    '#zv-dialog{position:fixed;left:50%;bottom:5vh;transform:translateX(-50%);width:min(620px,92vw);z-index:9500;background:linear-gradient(180deg,rgba(16,22,34,.92),rgba(8,12,20,.94));border:1px solid rgba(170,200,230,.4);border-radius:14px;padding:14px 18px 12px;color:#eef4ff;font:400 15px/1.55 system-ui,sans-serif;display:none;cursor:pointer;box-shadow:0 10px 40px rgba(0,0,0,.5)}'+
    '#zv-dialog .who{font-weight:700;color:#bcd8ff;letter-spacing:.06em;font-size:12px;text-transform:uppercase;margin-bottom:4px}'+
    '#zv-dialog .next{text-align:right;color:#8fa3c9;font-size:11px;margin-top:6px}'+
    '#zv-fade{position:fixed;inset:0;z-index:9600;background:#000;opacity:0;pointer-events:none;transition:opacity .5s ease}'+
    '#zv-story{position:fixed;left:14px;top:64px;z-index:9300;background:rgba(10,16,26,.66);border:1px solid rgba(150,220,255,.35);color:#dcefff;font:600 12px/1.3 system-ui,sans-serif;padding:6px 11px;border-radius:999px;display:none;backdrop-filter:blur(5px)}';
    document.head.appendChild(st);
  }
  function el(id, tag){
    var e=document.getElementById(id);
    if(!e){ e=document.createElement(tag||'div'); e.id=id; document.body.appendChild(e); }
    return e;
  }
  function showPrompt(html, action, key){
    styles();
    var chip=el('zv-prompt');
    chip.innerHTML=html;
    chip.style.display='block';
    V.promptFor=key; V.promptAction=action;
    chip.onclick=function(){ if(V.promptAction)V.promptAction(); };
  }
  function hidePrompt(){ var chip=document.getElementById('zv-prompt'); if(chip)chip.style.display='none'; V.promptFor=null; V.promptAction=null; }
  function openDialog(who, lines, onDone){
    styles();
    var P=refs().player;
    V.dialog={lines:lines, i:0, onDone:onDone||null};
    if(P&&P.pos)V.pinPos={x:P.pos.x, z:P.pos.z};
    var bx=el('zv-dialog');
    bx.innerHTML='<div class="who"></div><div class="line"></div><div class="next">E / tap \u25B8</div>';
    bx.querySelector('.who').textContent=who;
    bx.style.display='block';
    bx.onclick=function(){ advanceDialog(); };
    paintDialog();
  }
  function paintDialog(){
    var bx=document.getElementById('zv-dialog');
    if(!bx||!V.dialog)return;
    bx.querySelector('.line').textContent=V.dialog.lines[V.dialog.i];
  }
  function advanceDialog(){
    if(!V.dialog)return;
    V.dialog.i++;
    if(V.dialog.i>=V.dialog.lines.length){ var cb=V.dialog.onDone; closeDialog(); if(cb)cb(); return; }
    paintDialog();
  }
  function closeDialog(){
    V.dialog=null; V.pinPos=null;
    var bx=document.getElementById('zv-dialog');
    if(bx)bx.style.display='none';
    window.__espilCamFocus=null;
  }
  function focusPair(tx, tz, zoom){
    var P=refs().player; if(!P||!P.pos)return;
    P.faceY=Math.atan2(-(tx-P.pos.x), -(tz-P.pos.z));
    window.__espilCamFocus={x:(P.pos.x+tx)/2, z:(P.pos.z+tz)/2, zoom:zoom||20.5};
  }
  function fade(cb){
    styles();
    var f=el('zv-fade'); f.style.opacity='1';
    setTimeout(function(){ cb(); f.style.opacity='0'; }, 540);
  }
  function paintStoryChip(){
    styles();
    var chip=el('zv-story');
    if(V.scene==='town'&&document.body.classList.contains('in-map')){
      chip.textContent='Ruins restored '+clearedCount()+' / '+VILLAGES.length;
      chip.style.display='block';
    } else chip.style.display='none';
  }

  /* ---------- shared scene pieces ---------- */
  function portalMesh(label, sub){
    var g=new THREE.Group();
    var stone=0x4a4a52;
    g.add(box(1.0,5.8,1.0,stone, -2.4, 2.9, 0));
    g.add(box(1.0,5.8,1.0,stone, 2.4, 2.9, 0));
    g.add(box(6.0,1.0,1.2,stone, 0, 6.2, 0));
    var glow=new THREE.Mesh(new THREE.PlaneGeometry(4.2,5.2),
      new THREE.MeshBasicMaterial({color:0x69d8f2, transparent:true, opacity:0.14, depthWrite:false, side:THREE.DoubleSide}));
    glow.position.set(0,2.9,0); g.add(glow);
    var lab=textSprite(label, 4.6, '#cfeeff'); lab.position.set(0,7.6,0); g.add(lab);
    return g;
  }
  function discGround(r, tint, ring){
    var g=new THREE.Group();
    var ground=new THREE.Mesh(new THREE.CircleGeometry(r, 40), mat(tint));
    ground.rotation.x=-Math.PI/2; ground.position.set(CX, HC+0.03, CZ); ground.receiveShadow=true; g.add(ground);
    var skirt=new THREE.Mesh(new THREE.CylinderGeometry(r,r-4,16,40,1,true), mat(0x5d5648,{side:THREE.DoubleSide}));
    skirt.position.set(CX, HC-8, CZ); g.add(skirt);
    if(ring){
      for(var i=0;i<26;i++){
        var a=(i/26)*Math.PI*2;
        g.add(box(1.2,2.2,0.8,0x55555e, CX+Math.cos(a)*(r-9), HC+1.1, CZ+Math.sin(a)*(r-9)));
      }
    }
    return g;
  }

  /* ---------- the town instance's edge: a fog ring, not open world ---------- */
  var TOWN_CAP=1200;
  function buildTownExtras(){
    var g=new THREE.Group(); g.name='zealandia-town-edge';
    var cv=document.createElement('canvas'); cv.width=128; cv.height=64;
    var c=cv.getContext('2d');
    var gr=c.createRadialGradient(64,32,6,64,32,60);
    gr.addColorStop(0,'rgba(225,238,245,0.55)'); gr.addColorStop(1,'rgba(225,238,245,0)');
    c.fillStyle=gr; c.fillRect(0,0,128,64);
    var tex=new THREE.CanvasTexture(cv);
    for(var i=0;i<44;i++){
      var a=(i/44)*Math.PI*2;
      var sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex, transparent:true, depthWrite:false, opacity:0.75}));
      sp.scale.set(150,34,1);
      sp.position.set(CX+Math.cos(a)*TOWN_CAP, HC+9, CZ+Math.sin(a)*TOWN_CAP);
      g.add(sp);
    }
    refs().scene.add(g);
    V.groups.__edge=g;
    var gate=portalMesh('To '+BY_SLUG['nan-madol'].name, null);
    gate.position.set(CX, groundAt(CX, CZ-272), CZ-272);
    refs().scene.add(gate);
    V.groups.__roadgate=gate;
    V.roadGate={x:CX, z:CZ-272};
  }

  /* ---------- village scenes ---------- */
  function buildRuin(g, kind){
    var S=0x55555e, D=0x3d3d45, cx=CX, cz=CZ-40;
    if(kind==='trilithon'){
      g.add(box(1.3,7.2,1.3,S, cx-2.4, HC+3.6, cz));
      g.add(box(1.3,7.2,1.3,S, cx+2.4, HC+3.6, cz));
      g.add(box(6.4,1.3,1.5,D, cx, HC+7.8, cz));
    } else if(kind==='canal'){
      for(var i=0;i<4;i++){
        var a=i*Math.PI/2, wall=new THREE.Group();
        for(var r2=0;r2<3;r2++){
          var log=new THREE.Mesh(new THREE.CylinderGeometry(0.32,0.32,11,7), mat(D));
          log.rotation.z=Math.PI/2; log.position.y=0.35+r2*0.62; wall.add(log);
        }
        wall.position.set(cx+Math.cos(a)*7, HC, cz+Math.sin(a)*7);
        wall.rotation.y=-a+Math.PI/2; g.add(wall);
      }
      g.add(box(9,0.7,9,S, cx, HC+0.35, cz));
    } else if(kind==='marae'){
      g.add(box(18,1.1,11,S, cx, HC+0.55, cz));
      g.add(box(13,1.1,8,S, cx, HC+1.65, cz));
      g.add(box(8,1.1,5.5,S, cx, HC+2.75, cz));
      for(var j=-2;j<=2;j++)g.add(box(0.7,2.6+((j+2)%2)*0.7,0.7,D, cx+j*1.7, HC+4.4, cz));
    } else if(kind==='ahu'){
      g.add(box(24,2.2,4.5,S, cx, HC+1.1, cz));
      for(var k2=-2;k2<=2;k2++){
        g.add(box(1.5,3.4,1.3,D, cx+k2*4.4, HC+3.9, cz));
        g.add(box(1.1,1.5,1.1,D, cx+k2*4.4, HC+6.3, cz));
      }
    } else if(kind==='city'){
      g.add(box(15,2.6,1.1,S, cx, HC+1.3, cz-7));
      g.add(box(15,2.6,1.1,S, cx, HC+1.3, cz+7));
      g.add(box(1.1,2.6,15,S, cx-7, HC+1.3, cz));
      g.add(box(1.1,2.6,15,S, cx+7, HC+1.3, cz));
      g.add(box(2.2,4.6,2.2,D, cx-7, HC+2.3, cz-7));
      g.add(box(2.2,4.6,2.2,D, cx+7, HC+2.3, cz+7));
    } else if(kind==='mound'){
      g.add(box(20,1.7,20,S, cx, HC+0.85, cz));
      g.add(box(14,1.7,14,S, cx, HC+2.55, cz));
      g.add(box(8.5,1.7,8.5,S, cx, HC+4.25, cz));
    }
  }
  function buildHouseAt(g, lx, lz, wallC, roofC){
    var grp=new THREE.Group();
    grp.add(box(6.4,3.1,5.4,wallC, 0,1.55,0));
    var roof=new THREE.Mesh(new THREE.ConeGeometry(5.1,2.2,4), mat(roofC));
    roof.position.y=4.2; roof.rotation.y=Math.PI/4; roof.castShadow=true; grp.add(roof);
    grp.position.set(CX+lx, HC, CZ+lz);
    g.add(grp);
  }
  function figureMesh(robeC, trimC){
    var g=new THREE.Group();
    var robe=new THREE.Mesh(new THREE.ConeGeometry(0.46,1.3,9), mat(robeC)); robe.position.y=0.65; robe.castShadow=true; g.add(robe);
    var head=new THREE.Mesh(new THREE.SphereGeometry(0.17,8,7), mat(0xffe9d6)); head.position.y=1.5; g.add(head);
    var staff=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,1.7,5), mat(trimC)); staff.position.set(0.42,0.85,0.1); g.add(staff);
    return g;
  }
  var GATE_W={x:-150, z:120}, GATE_E={x:150, z:120};
  function buildVillage(v){
    var g=new THREE.Group(); g.name='village-'+v.slug;
    g.add(discGround(255, v.tint, true));
    buildRuin(g, v.ruin);
    buildHouseAt(g, -52, 44, 0xd8c9a3, 0x74553a);
    buildHouseAt(g, 48, 58, 0xcbb59a, 0x74553a);
    var heart=new THREE.Mesh(new THREE.OctahedronGeometry(0.85),
      Q.cleared[v.slug] ? mat(0xd8b34a,{emissive:0x8a6a14}) : mat(0x87353d,{emissive:0x5f1218}));
    heart.position.set(CX, HC+2.0, CZ-40); g.add(heart);
    var elder=figureMesh(0x6d5a8f, 0x8a6a3a);
    elder.position.set(CX+6, HC, CZ-26); g.add(elder);
    var eLabel=textSprite(v.elder, 3.2, '#e6dcff'); eLabel.position.set(CX+6, HC+2.15, CZ-26); g.add(eLabel);
    var nLabel=textSprite(v.name, 6.2, '#ffe9a8'); nLabel.position.set(CX, HC+9.5, CZ-40); g.add(nLabel);
    var nb=neighbours(v.slug);
    if(nb.prev){
      var gw=portalMesh('To '+stopName(nb.prev), null);
      gw.position.set(CX+GATE_W.x, HC, CZ+GATE_W.z); g.add(gw);
    }
    if(nb.next){
      var ge=portalMesh('To '+stopName(nb.next), null);
      ge.position.set(CX+GATE_E.x, HC, CZ+GATE_E.z); g.add(ge);
    }
    g.visible=false;
    refs().scene.add(g);
    v.group=g; v.heart=heart; v.elderObj=elder;
    v.introDone=!!Q.cleared[v.slug];
    return g;
  }
  function spawnGuardians(v){
    if(Q.cleared[v.slug])return;
    for(var i=0;i<v.guardianCount;i++){
      var a=(i/v.guardianCount)*Math.PI*2+0.7;
      var wx=CX+Math.cos(a)*19, wz=CZ-40+Math.sin(a)*19;
      var built=strayMesh();
      built.grp.position.set(wx, HC, wz);
      v.group.add(built.grp);
      var m=registerMonster(v.slug, built.grp, built.bodyM, built.sprite, wx, wz);
      if(m)v.guardians.push(m);
    }
  }

  /* ---------- field instances (additional maps between stops) ---------- */
  var FIELD_TINTS=[0x8a9a68, 0x9aa06b, 0x87976a, 0x93a468];
  function buildField(fid){
    var seg=fid.slice(6), hash=seg.indexOf('#');
    var ab=seg.slice(0,hash), k=parseInt(seg.slice(hash+1),10);
    var parts=ab.split('>'), a=parts[0], b=parts[1];
    var g=new THREE.Group(); g.name='zealandia-'+fid;
    var tint=FIELD_TINTS[(k+ab.length)%FIELD_TINTS.length];
    g.add(discGround(190, tint, false));
    for(var i=0;i<14;i++){
      var ang=rand()*Math.PI*2, rr=42+rand()*128;
      var tx=CX+Math.cos(ang)*rr, tz=CZ+Math.sin(ang)*rr;
      if(Math.abs(tz-(CZ+128))<12 && Math.abs(tx-CX)<16) continue;
      if(Math.abs(tz-(CZ-128))<12 && Math.abs(tx-CX)<16) continue;
      var trunk=new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.3,1.6,6), mat(0x6b4a33));
      trunk.position.set(tx, HC+0.8, tz); g.add(trunk);
      var top=new THREE.Mesh(new THREE.ConeGeometry(1.7+rand()*0.8, 3.4, 7), mat(0x3f6136));
      top.position.set(tx, HC+3.2, tz); top.castShadow=true; g.add(top);
    }
    for(var j=0;j<7;j++){
      var rx=CX+(rand()*2-1)*150, rz=CZ+(rand()*2-1)*150;
      g.add(box(0.9+rand()*1.2, 0.7+rand()*0.7, 0.9+rand()*1.2, 0x6e6e66, rx, HC+0.4, rz));
    }
    var pS=portalMesh('To '+stopName(a), null); pS.position.set(CX, HC, CZ+150); g.add(pS);
    var pN=portalMesh('To '+stopName(b), null); pN.position.set(CX, HC, CZ-150); g.add(pN);
    g.visible=false;
    refs().scene.add(g);
    V.groups[fid]=g;
    return {id:fid, a:a, b:b, k:k, group:g, pS:{x:CX, z:CZ+150}, pN:{x:CX, z:CZ-150}};
  }
  function spawnFieldMonsters(f){
    for(var i=0;i<3;i++){
      var wx=CX+(rand()*2-1)*80, wz=CZ+(rand()*2-1)*80;
      var built=strayMesh();
      built.grp.position.set(wx, HC, wz);
      f.group.add(built.grp);
      registerMonster(f.id, built.grp, built.bodyM, built.sprite, wx, wz);
    }
  }

  /* ---------- Espil: first story appearance, after all six ruins ---------- */
  function buildEspilFigure(){
    var g=new THREE.Group();
    var robe=new THREE.Mesh(new THREE.ConeGeometry(0.5,1.45,9), mat(0x2e4a4f)); robe.position.y=0.72; robe.castShadow=true; g.add(robe);
    var hood=new THREE.Mesh(new THREE.ConeGeometry(0.34,0.62,8), mat(0x244046)); hood.position.y=1.62; g.add(hood);
    var h1=new THREE.Mesh(new THREE.SphereGeometry(0.075,7,6), mat(0xf7e3c8)); h1.position.set(0.16,0.78,0.28); g.add(h1);
    var h2=new THREE.Mesh(new THREE.SphereGeometry(0.075,7,6), mat(0xf7e3c8)); h2.position.set(0.3,0.72,0.16); g.add(h2);
    var lab=textSprite('Espil', 3.4, '#a8e6e2'); lab.position.set(0,2.3,0); g.add(lab);
    g.position.set(CX, groundAt(CX, CZ-16), CZ-16);
    refs().scene.add(g);
    V.espil=g; V.espilPlaced=true;
    return g;
  }
  function maybeEspilDebut(){
    if(clearedCount()<VILLAGES.length || Q.espil)return;
    Q.espil=true; saveQ();
    if(!V.espil)buildEspilFigure();
    if(!Q.debutSeen){
      Q.debutSeen=true; saveQ();
      setTimeout(function(){
        if(V.scene!=='town')return;
        var P=refs().player; if(!P||!P.pos)return;
        P.pos.set(CX+3.5, P.pos.y, CZ-11);
        focusPair(CX, CZ-16, 21.0);
        openDialog('Espil', [
          'So the six anchors hold again. You did what the keepers only prayed for.',
          'I am Espil. I shape this cauldron - and until today, I have kept out of its stories.',
          'But a world whose anchors were failing needs more than a maker watching. Walk with me a while, traveller. There is much to tell.'
        ]);
      }, 900);
    }
  }
  V.maybeEspilDebut=maybeEspilDebut;

  /* ---------- scene switching (teleport between instances) ---------- */
  function groupOf(sceneId){
    if(sceneId==='town'){ var Z0=ztown(); return Z0?Z0.group:null; }
    if(sceneId.indexOf('field:')===0)return V.groups[sceneId]||null;
    var v=BY_SLUG[sceneId]; return v?v.group:null;
  }
  function setScene(next, spawnAt, faceY){
    if(next!=='town'&&next.indexOf('field:')!==0){
      var vb=BY_SLUG[next];
      if(vb&&!vb.group)buildVillage(vb);
    }
    clearSceneMonsters();
    hidePrompt(); closeDialog();
    var R=refs();
    for(var key in V.groups){ if(V.groups[key])V.groups[key].visible=false; }
    VILLAGES.forEach(function(v){ if(v.group)v.group.visible=false; });
    var Z1=ztown(); if(Z1&&Z1.group)Z1.group.visible=(next==='town');
    if(V.groups.__edge)V.groups.__edge.visible=(next==='town');
    if(V.groups.__roadgate)V.groups.__roadgate.visible=(next==='town');
    var g=groupOf(next);
    if(g)g.visible=true;
    V.scene=next; window.__zscene=next;
    if(next!=='town'&&next.indexOf('field:')!==0){
      var v2=BY_SLUG[next];
      if(v2)spawnGuardians(v2);
    }
    if(next.indexOf('field:')===0){
      var f=V.fields&&V.fields[next];
      if(f)spawnFieldMonsters(f);
    }
    var P=R.player;
    if(P&&P.pos&&spawnAt){
      P.pos.set(spawnAt.x, HC+0.05, spawnAt.z);
      P.velY=0;
      if(typeof faceY==='number')P.faceY=faceY;
    }
    if(next==='town')maybeEspilDebut();
    paintStoryChip();
  }
  function travel(getTarget){
    fade(function(){
      var t=getTarget();
      setScene(t.scene, t.spawn, t.faceY);
    });
  }
  /* arrival spawn when ENTERING `scene` coming FROM `fromScene` */
  function arrivalSpawn(scene, fromScene){
    if(scene==='town')return {x:CX, z:CZ-252, faceY:Math.PI};
    if(scene.indexOf('field:')===0){
      var f=V.fields[scene];
      var total=hopsBetween(f.a, f.b);
      function chainPos(sc){
        if(sc===f.a)return 0;
        if(sc===f.b)return total+1;
        if(sc.indexOf('field:')===0)return parseInt(sc.slice(sc.indexOf('#')+1),10);
        return -1;
      }
      var pf=chainPos(fromScene), pm=chainPos(scene);
      if(pf>=0&&pf<pm)return {x:f.pS.x, z:f.pS.z-14, faceY:Math.PI};
      return {x:f.pN.x, z:f.pN.z+14, faceY:0};
    }
    var nb=neighbours(scene);
    if(fromScene.indexOf('field:')===0){
      var seg=scene, fparts=fromScene.slice(6, fromScene.indexOf('#')).split('>');
      if(fparts[1]===scene)return {x:CX+GATE_W.x+10, z:CZ+GATE_W.z, faceY:-Math.PI/2};
      if(fparts[0]===scene)return {x:CX+GATE_E.x-10, z:CZ+GATE_E.z, faceY:Math.PI/2};
    }
    if(fromScene===nb.prev)return {x:CX+GATE_W.x+10, z:CZ+GATE_W.z, faceY:-Math.PI/2};
    if(fromScene===nb.next)return {x:CX+GATE_E.x-10, z:CZ+GATE_E.z, faceY:Math.PI/2};
    return {x:CX, z:CZ+218, faceY:Math.PI};
  }
  function hopTo(towardStop){
    var from=V.scene;
    var nxt=chainNext(from, towardStop);
    travel(function(){
      var sp=arrivalSpawn(nxt, from);
      return {scene:nxt, spawn:sp, faceY:sp.faceY};
    });
  }

  /* direct entry seam (kept): enter a village scene straight away */
  V.enterVillage=function(slug){
    var v=BY_SLUG[slug]; if(!v)return;
    if(!v.group)buildVillage(v);
    travel(function(){ return {scene:slug, spawn:{x:CX, z:CZ+218}, faceY:Math.PI}; });
  };

  /* ---------- the quest core ---------- */
  function guardiansAlive(v){ return v.guardians.filter(function(m){ return m.alive; }).length; }
  function clearVillage(v){
    Q.cleared[v.slug]=true; saveQ();
    if(v.heart){
      v.heart.material=mat(0xd8b34a,{emissive:0x8a6a14});
    }
    toast(v.name+' restored - '+clearedCount()+' / '+VILLAGES.length);
    paintStoryChip();
    openDialog(v.elder, [v.clear]);
  }
  V.clearVillage=clearVillage;

  /* ---------- prompt scan + the town instance cap ---------- */
  function near(x1,z1,x2,z2,d){ var dx=x1-x2, dz=z1-z2; return dx*dx+dz*dz<d*d; }
  function scanTown(P){
    if(V.espil&&near(P.pos.x,P.pos.z,CX,CZ-16,4.5)){
      showPrompt('<b>E</b> · Talk - Espil', function(){
        focusPair(CX, CZ-16, 21.0);
        openDialog('Espil', ['The anchors hold, and the story goes on. There is more of this world to mend - and I will not watch from outside it any longer.']);
      }, 'espil');
      return true;
    }
    if(V.roadGate&&near(P.pos.x,P.pos.z,V.roadGate.x,V.roadGate.z,6)){
      showPrompt('<b>E</b> · To '+BY_SLUG['nan-madol'].name+' (via 1 field)',
        function(){ hopTo('nan-madol'); }, 'roadgate');
      return true;
    }
    return false;
  }
  function scanVillage(P, slug){
    var v=BY_SLUG[slug]; if(!v)return false;
    if(near(P.pos.x,P.pos.z,CX+6,CZ-26,4.5)){
      showPrompt('<b>E</b> · Talk - '+v.elder, function(){
        focusPair(CX+6, CZ-26, 20.5);
        if(Q.cleared[slug]){
          openDialog(v.elder, [v.clear]);
        } else if(!v.introDone){
          openDialog(v.elder, v.intro, function(){ v.introDone=true; });
        } else if(guardiansAlive(v)>0){
          openDialog(v.elder, ['They still nest on the heart. '+guardiansAlive(v)+' remain - drive them off.']);
        } else {
          openDialog(v.elder, ['The way to the heart is clear. Lay your hand on it.']);
        }
      }, 'elder');
      return true;
    }
    if(near(P.pos.x,P.pos.z,CX,CZ-40,4.5)){
      if(!Q.cleared[slug]&&v.introDone&&guardiansAlive(v)===0){
        showPrompt('<b>E</b> · Touch the ruin heart', function(){ clearVillage(v); }, 'heart');
        return true;
      }
      if(!Q.cleared[slug]){
        showPrompt(v.introDone ? 'The heart is guarded' : 'Speak with '+v.elder+' first', null, 'heart-locked');
        return true;
      }
    }
    var nb=neighbours(slug);
    if(nb.prev&&near(P.pos.x,P.pos.z,CX+GATE_W.x,CZ+GATE_W.z,6)){
      showPrompt('<b>E</b> · To '+stopName(nb.prev)+(hopsBetween(slug,nb.prev)>0?' (via '+hopsBetween(slug,nb.prev)+' field'+(hopsBetween(slug,nb.prev)>1?'s':'')+')':''),
        function(){ hopTo(nb.prev); }, 'gate-w');
      return true;
    }
    if(nb.next&&near(P.pos.x,P.pos.z,CX+GATE_E.x,CZ+GATE_E.z,6)){
      showPrompt('<b>E</b> · To '+stopName(nb.next)+' (via '+hopsBetween(slug,nb.next)+' field'+(hopsBetween(slug,nb.next)>1?'s':'')+')',
        function(){ hopTo(nb.next); }, 'gate-e');
      return true;
    }
    return false;
  }
  function scanField(P){
    var f=V.fields&&V.fields[V.scene]; if(!f)return false;
    if(near(P.pos.x,P.pos.z,f.pS.x,f.pS.z,6)){
      showPrompt('<b>E</b> · To '+stopName(f.a), function(){ hopTo(f.a); }, 'portal-s');
      return true;
    }
    if(near(P.pos.x,P.pos.z,f.pN.x,f.pN.z,6)){
      showPrompt('<b>E</b> · To '+stopName(f.b), function(){ hopTo(f.b); }, 'portal-n');
      return true;
    }
    return false;
  }
  function capAndBounds(P){
    var dx=P.pos.x-CX, dz=P.pos.z-CZ;
    var r=Math.sqrt(dx*dx+dz*dz);
    if(V.scene==='town'){
      if(r>TOWN_CAP){ var s=TOWN_CAP/r; P.pos.x=CX+dx*s; P.pos.z=CZ+dz*s; }
    } else {
      var cap=V.scene.indexOf('field:')===0?182:250;
      if(r>cap){ var s2=cap/r; P.pos.x=CX+dx*s2; P.pos.z=CZ+dz*s2; }
    }
  }
  setInterval(function(){
    try{
      if(window.__espilCityKey!=='zealandia')return;
      var R=refs(), P=R.player;
      if(!P||!P.pos)return;
      if(!V.built){
        var Zg=ztown(); if(Zg&&Zg.group&&R.scene){
          V.built=true;
          V.fields={};
          ROUTE.forEach(function(s, i){
            if(i>=ROUTE.length-1)return;
            var n=ROUTE[i+1], total=hopsBetween(s,n);
            for(var k=1;k<=total;k++){ var fid=fieldId(s,n,k); V.fields[fid]=buildField(fid); }
          });
          buildTownExtras();
          if(Q.espil&&!V.espil)buildEspilFigure();
          if(V.scene==='town')maybeEspilDebut();
          paintStoryChip();
        }
        return;
      }
      capAndBounds(P);
      /* village heart idle motion */
      if(V.scene!=='town'&&V.scene.indexOf('field:')!==0){
        var v=BY_SLUG[V.scene];
        if(v&&v.heart){ v.heart.rotation.y+=0.012; v.heart.position.y=HC+2.0+Math.sin(Date.now()*0.0016)*0.18; }
      }
      if(V.pinPos&&V.dialog){ P.pos.x=V.pinPos.x; P.pos.z=V.pinPos.z; }
      if(document.hidden)return;
      if(V.dialog){ hidePrompt(); return; }
      var handled=false;
      if(V.scene==='town')handled=scanTown(P);
      else if(V.scene.indexOf('field:')===0)handled=scanField(P);
      else handled=scanVillage(P, V.scene);
      if(!handled)hidePrompt();
    }catch(e){}
  }, 200);

  /* E advances dialogue or fires the standing prompt */
  document.addEventListener('keydown', function(e){
    if(window.__espilCityKey!=='zealandia')return;
    if(e.code!=='KeyE')return;
    if(V.dialog){ advanceDialog(); return; }
    if(V.promptAction)V.promptAction();
  });

  V.state=function(){
    return { built:V.built, scene:V.scene, gates:'instance-route', chip:(document.getElementById('zv-story')||{}).textContent||'',
             cleared:clearedCount(), espilPlaced:V.espilPlaced,
             dialogOpen:!!V.dialog, promptFor:V.promptFor,
             fieldCount:V.fields?Object.keys(V.fields).length:0 };
  };
})();
