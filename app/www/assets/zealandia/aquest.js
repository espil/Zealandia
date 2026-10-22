/* Auckland quest dressing - app payload only (Zealandia room, Han 2026-10-22).
   Places the Time Stone at the measured fall point (Auckland local 382,-1018,
   world 10382,-1018), a ring of monsters prowling around it, and Lunaris
   beside the stone, lost in thought: she gazes at the stone, paces slowly
   between two spots, and now and then tries a time cast that fades - a
   goddess worrying over a stone she cannot read.
   Lifecycle mirrors ztown.js: build once, visible only while the current
   city is Auckland. Assets are the delivered finals, meshopt/WebP-optimized
   to the asset-size standard (timestone.glb 1.05 MB, lunaris.glb 1.17 MB). */
(function(){
  'use strict';
  var OX=10000, OZ=0;                       /* Auckland world slot */
  var STONE={x:OX+382, z:OZ-1018};          /* fall point, Map room measurement */
  var A={built:false, active:false, group:null, monsters:[], lunaris:null, stone:null, stoneLight:null, ring:null, bubble:null};
  window.__aquest=A;
  var SELF_SRC=(document.currentScript&&document.currentScript.src)||'';
  var DECODER_URL=SELF_SRC?SELF_SRC.replace(/[^/]*$/,'meshopt_decoder.js'):'./assets/zealandia/meshopt_decoder.js';

  function refs(){ return window.__ztownRefs||{}; }
  function mat(c,o){ return new THREE.MeshLambertMaterial(Object.assign({color:c},o||{})); }
  function rng(seed){ var a=seed>>>0; return function(){ a|=0; a=a+0x6D2B79F5|0; var t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  var rand=rng(20261022);

  function textSprite(text, opts){
    opts=opts||{};
    var fs=opts.fontSize||44, pad=18;
    var cv=document.createElement('canvas'); var cx=cv.getContext('2d');
    cx.font='700 '+fs+'px Manrope, sans-serif';
    var w=Math.ceil(cx.measureText(text).width)+pad*2;
    cv.width=w; cv.height=fs+pad*2;
    cx=cv.getContext('2d');
    cx.font='700 '+fs+'px Manrope, sans-serif'; cx.textAlign='center'; cx.textBaseline='middle';
    if(opts.bg){ cx.fillStyle=opts.bg; cx.beginPath(); cx.roundRect(0,0,cv.width,cv.height,16); cx.fill(); }
    cx.fillStyle=opts.color||'#eafffb'; cx.fillText(text, cv.width/2, cv.height/2+2);
    var tx=new THREE.CanvasTexture(cv); tx.anisotropy=4;
    var sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tx, transparent:true, depthWrite:false}));
    var h=opts.height||0.62; sp.scale.set(h*cv.width/cv.height, h, 1);
    return sp;
  }

  /* ---------- Time Stone ---------- */
  function proceduralStone(){
    var g=new THREE.Group();
    var rock=new THREE.Mesh(new THREE.CylinderGeometry(1.95,2.35,0.8,7), mat(0x4a4a52));
    rock.position.y=0.4; rock.scale.z=0.88; g.add(rock);
    var slab=new THREE.Mesh(new THREE.BoxGeometry(1.15,4.6,0.55), mat(0x5d5d68));
    slab.position.y=3.05; slab.rotation.y=0.2; g.add(slab);
    var core=new THREE.Mesh(new THREE.OctahedronGeometry(0.34),
      new THREE.MeshBasicMaterial({color:0x2affd8}));
    core.position.set(0.18,3.3,0.33); g.add(core);
    g.position.set(STONE.x,0,STONE.z);
    return g;
  }
  function buildStone(loader){
    var done=function(obj){ A.stone=obj; A.group.add(obj); };
    if(loader){
      loader.load('assets/zealandia/timestone.glb', function(gltf){
        var s=gltf.scene; s.position.set(STONE.x,0,STONE.z); A.stoneGLB=true; done(s);
      }, undefined, function(){ done(proceduralStone()); });
    } else done(proceduralStone());
    /* glow ring + light + label (engine-side dressing, as the quest spec allows) */
    var ring=new THREE.Mesh(new THREE.RingGeometry(2.5,3.3,40),
      new THREE.MeshBasicMaterial({color:0x2affd8, transparent:true, opacity:0.16, side:THREE.DoubleSide, depthWrite:false}));
    ring.rotation.x=-Math.PI/2; ring.position.set(STONE.x,0.06,STONE.z); A.ring=ring; A.group.add(ring);
    var li=new THREE.PointLight(0x2affd8, 0.9, 20, 1.6); li.position.set(STONE.x,2.8,STONE.z); A.stoneLight=li; A.group.add(li);
    var label=textSprite('Time Stone',{height:0.55, color:'#bafff2'});
    label.position.set(STONE.x,6.6,STONE.z); A.group.add(label);
  }

  /* ---------- Monsters (Strayer-kind prowlers) ---------- */
  function monsterMesh(){
    var g=new THREE.Group();
    var body=new THREE.Mesh(new THREE.SphereGeometry(0.62,10,8), mat(0x3d4450));
    body.scale.set(1.25,0.82,1.7); body.position.y=0.78; g.add(body);
    var head=new THREE.Mesh(new THREE.SphereGeometry(0.34,9,7), mat(0x454e5c));
    head.position.set(0,0.92,0.95); g.add(head);
    var eyeM=new THREE.MeshBasicMaterial({color:0xffb340});
    [-0.13,0.13].forEach(function(x){
      var e=new THREE.Mesh(new THREE.SphereGeometry(0.05,6,5), eyeM);
      e.position.set(x,0.98,1.24); g.add(e);
    });
    var spike=new THREE.Mesh(new THREE.ConeGeometry(0.11,0.5,5), mat(0x2c313a));
    spike.position.set(0,1.32,-0.25); spike.rotation.x=-0.5; g.add(spike);
    var legs=[];
    [[-0.34,0.52],[0.34,0.52],[-0.34,-0.55],[0.34,-0.55]].forEach(function(p){
      var leg=new THREE.Group(); leg.position.set(p[0],0.62,p[1]);
      var seg=new THREE.Mesh(new THREE.BoxGeometry(0.13,0.66,0.13), mat(0x31363f));
      seg.position.y=-0.31; leg.add(seg); g.add(leg); legs.push(leg);
    });
    g.userData.legs=legs; g.userData.body=body;
    return g;
  }
  function buildMonsters(){
    var defs=[
      {dx:16,dz:-8},{dx:-19,dz:6},{dx:9,dz:20},{dx:-11,dz:-21},
      {dx:27,dz:13},{dx:-30,dz:-14},{dx:4,dz:-33},{dx:38,dz:-24}
    ];
    defs.forEach(function(d,i){
      var m=monsterMesh();
      var ax=STONE.x+d.dx, az=STONE.z+d.dz;
      m.position.set(ax,0,az);
      A.group.add(m);
      A.monsters.push({obj:m, ax:ax, az:az, r:5+rand()*4.5, speed:0.55+rand()*0.4,
        ang:rand()*Math.PI*2, heading:rand()*Math.PI*2, mode:'pause', t:1+rand()*3, phase:rand()*6.28});
    });
  }

  /* ---------- Lunaris, lost in thought ---------- */
  function buildLunaris(loader){
    var home={x:STONE.x+3.1, z:STONE.z+3.6};
    var other={x:STONE.x-3.5, z:STONE.z+2.7};
    var L={obj:null, mixer:null, clips:{}, state:'gaze', t:0, dur:5,
           from:home, to:other, at:home, cycle:0, bubble:null};
    A.lunaris=L;
    var fallback=function(){
      var g=new THREE.Group();
      var dress=new THREE.Mesh(new THREE.ConeGeometry(0.42,1.15,10), mat(0xf2f0fa));
      dress.position.y=0.58; g.add(dress);
      var torso=new THREE.Mesh(new THREE.SphereGeometry(0.21,8,7), mat(0xfbf9ff));
      torso.position.y=1.28; torso.scale.y=1.25; g.add(torso);
      var head=new THREE.Mesh(new THREE.SphereGeometry(0.16,8,7), mat(0xffe9d6));
      head.position.y=1.62; g.add(head);
      var hair=new THREE.Mesh(new THREE.SphereGeometry(0.175,8,7), mat(0xe8e6f5));
      hair.position.set(0,1.65,-0.03); hair.scale.set(1,1.25,1); g.add(hair);
      g.position.set(home.x,0,home.z); g.lookAt(STONE.x,0,STONE.z);
      A.group.add(g); L.obj=g; L.procedural=true;
    };
    if(loader){
      loader.load('assets/zealandia/lunaris.glb', function(gltf){
        var o=gltf.scene;
        o.position.set(home.x,0,home.z); o.rotation.y=Math.atan2(STONE.x-home.x, STONE.z-home.z);
        o.traverse(function(n){ if(n.isMesh){ n.frustumCulled=false; } }); L.glb=true;
        A.group.add(o); L.obj=o;
        if(gltf.animations&&gltf.animations.length){
          L.mixer=new THREE.AnimationMixer(o);
          gltf.animations.forEach(function(c){ L.clips[c.name]=L.mixer.clipAction(c); });
          if(L.clips.Idle){ L.clips.Idle.play(); L.current='Idle'; }
        }
      }, undefined, fallback);
    } else fallback();
    var b=textSprite('…', {height:0.5, color:'#dfe9ff', bg:'rgba(30,36,64,.45)'});
    b.position.set(home.x,2.25,home.z); b.material.opacity=0; A.bubble=b; A.group.add(b);
    var label=textSprite('Lunaris', {height:0.5, color:'#eef2ff'});
    label.position.set(home.x,2.02,home.z); A.group.add(label); L.label=label;
  }
  function lunarisPlay(L, name, fade){
    if(!L.mixer||!L.clips[name]||L.current===name)return;
    var next=L.clips[name];
    if(L.current&&L.clips[L.current])L.clips[L.current].fadeOut(fade||0.35);
    next.reset().fadeIn(fade||0.35).play(); L.current=name;
  }
  function faceToward(o, tx, tz, dt, rate){
    var want=Math.atan2(tx-o.position.x, tz-o.position.z);
    var d=((want-o.rotation.y+Math.PI*3)%(Math.PI*2))-Math.PI;
    o.rotation.y+=d*Math.min(1,(rate||3)*dt);
    return Math.abs(d);
  }
  function lunarisTick(L, dt){
    if(!L.obj)return;
    L.t+=dt;
    var o=L.obj;
    var bubbleTarget=0;
    if(L.state==='gaze'){
      faceToward(o, STONE.x, STONE.z, dt);
      bubbleTarget=0.55+0.3*Math.sin(L.t*2.1);
      if(L.t>=L.dur){
        L.t=0; L.cycle++;
        if(L.cycle%3===0&&L.clips&&L.clips.TimeCast){ L.state='cast'; L.dur=2.7; lunarisPlay(L,'TimeCast',0.3); if(L.clips.TimeCast)L.clips.TimeCast.setLoop(THREE.LoopOnce); }
        else { L.state='walk'; L.to=(L.at===L.from)?L.otherRef:L.from; lunarisPlay(L,'Walk',0.3); }
      }
    } else if(L.state==='walk'){
      var dx=L.to.x-o.position.x, dz=L.to.z-o.position.z, dist=Math.hypot(dx,dz);
      if(dist<0.15){ L.at=L.to; L.state='gaze'; L.t=0; L.dur=3.5+rand()*3; lunarisPlay(L,'Idle',0.3); }
      else {
        o.rotation.y=Math.atan2(dx,dz);
        var sp=0.55*dt; o.position.x+=dx/dist*sp; o.position.z+=dz/dist*sp;
      }
    } else if(L.state==='cast'){
      faceToward(o, STONE.x, STONE.z, dt);
      if(L.t>=L.dur){ L.t=0; L.state='gaze'; L.dur=4+rand()*3; lunarisPlay(L,'Idle',0.4); }
    }
    if(A.bubble&&L.obj){
      A.bubble.position.set(o.position.x, 2.3, o.position.z);
      A.bubble.material.opacity+= (bubbleTarget-A.bubble.material.opacity)*Math.min(1,dt*4);
    }
    if(L.label)L.label.position.set(o.position.x, 2.04, o.position.z);
    if(L.mixer)L.mixer.update(dt);
  }

  /* ---------- build + lifecycle ---------- */
  function build(){
    if(A.buildStarted)return; A.buildStarted=true;
    var wait=setInterval(function(){
      var R=refs();
      if(!R.scene)return;
      clearInterval(wait);
      A.group=new THREE.Group(); A.group.name='auckland-quest';
      R.scene.add(A.group);
      var start=function(loader){
        buildStone(loader);
        buildMonsters();
        buildLunaris(loader);
        A.built=true;
        console.log('[AucklandQuest] stone + '+A.monsters.length+' monsters + Lunaris placed at local (382,-1018)');
      };
      if(THREE.GLTFLoader){
        var loader=new THREE.GLTFLoader();
        if(window.MeshoptDecoder){ try{ loader.setMeshoptDecoder(window.MeshoptDecoder); }catch(e){} start(loader); }
        else {
          import(DECODER_URL).then(function(m){
            window.MeshoptDecoder=m.MeshoptDecoder;
            return window.MeshoptDecoder.ready;
          }).then(function(){ try{ loader.setMeshoptDecoder(window.MeshoptDecoder); }catch(e){} start(loader); })
          .catch(function(){ start(loader); });
        }
      } else start(null);
    },200);
  }

  A._vt=0;
  function stepWorld(dt, t){
    if(A.ring)A.ring.material.opacity=0.12+0.07*Math.sin(t*1.7);
    if(A.stoneLight)A.stoneLight.intensity=0.8+0.35*Math.sin(t*1.7);
    /* monsters: prowl their anchors, watch the player up close */
    var P=null; try{ P=refs().player; }catch(e){}
    var pp=(P&&P.position)?P.position:null;
    A.monsters.forEach(function(mn){
      mn.t-=dt;
      var o=mn.obj;
      if(mn.mode==='pause'){
        if(mn.t<=0){ mn.mode='move'; mn.t=2.5+rand()*3;
          var a=rand()*Math.PI*2, rr=rand()*mn.r;
          mn.tx=mn.ax+Math.cos(a)*rr; mn.tz=mn.az+Math.sin(a)*rr; }
      } else {
        var dx=mn.tx-o.position.x, dz=mn.tz-o.position.z, d=Math.hypot(dx,dz);
        if(d<0.2){ mn.mode='pause'; mn.t=1.5+rand()*3.5; }
        else {
          o.rotation.y=Math.atan2(dx,dz);
          var sp=mn.speed*dt; o.position.x+=dx/d*sp; o.position.z+=dz/d*sp;
          var sw=Math.sin(t*7+mn.phase)*0.5;
          o.userData.legs.forEach(function(leg,i){ leg.rotation.x=(i%2? -sw: sw); });
          o.userData.body.position.y=0.78+Math.abs(Math.sin(t*7+mn.phase))*0.03;
        }
      }
      if(pp){
        var pd=Math.hypot(pp.x-o.position.x, pp.z-o.position.z);
        if(pd<7){ o.rotation.y=Math.atan2(pp.x-o.position.x, pp.z-o.position.z); }
      }
    });
    if(A.lunaris)lunarisTick(A.lunaris, dt);
    /* keep the player out of the stone's footprint */
    if(pp){
      var ex=(pp.x-STONE.x)/2.45, ez=(pp.z-STONE.z)/2.15, e=ex*ex+ez*ez;
      if(e<1&&e>0.0001){ var s=1/Math.sqrt(e); pp.x=STONE.x+ex*2.45*s; pp.z=STONE.z+ez*2.15*s; }
    }
  }
  function tick(now){
    requestAnimationFrame(tick);
    if(!A.built||!A.active)return;
    var dt=Math.min(0.05, A.last? (now-A.last)/1000 : 0.016); A.last=now;
    A._vt+=dt; stepWorld(dt, A._vt);
  }
  requestAnimationFrame(tick);
  A.drive=function(sec){ if(!A.built)return 0; var n=0; for(var e=0;e<sec;e+=1/30){ A._vt+=1/30; stepWorld(1/30, A._vt); n++; } return n; };

  setInterval(function(){
    var on=(typeof window.__espilCityKey!=='undefined'&&window.__espilCityKey==='auckland');
    A.active=on;
    if(A.group)A.group.visible=on;
    if(on)build();
  },400);

  A.state=function(){
    var L=A.lunaris;
    return { built:!!A.built, active:A.active, monsters:A.monsters.length,
      stone:!!A.stone, stoneGLB:!!A.stoneGLB, lunarisGLB:!!(L&&L.glb), decoder:typeof window.MeshoptDecoder,
      groupChildren:A.group?A.group.children.length:0,
      lunarisState:L?L.state:null, lunarisClip:L?L.current:null,
      lunarisPos:(L&&L.obj)?{x:+L.obj.position.x.toFixed(1), z:+L.obj.position.z.toFixed(1)}:null };
  };
  /* pace targets linked after L exists (from/to/other ring) */
  var link=setInterval(function(){
    if(A.lunaris&&!A.lunaris.otherRef){
      A.lunaris.otherRef={x:STONE.x-3.5, z:STONE.z+2.7};
      A.lunaris.from={x:STONE.x+3.1, z:STONE.z+3.6};
      A.lunaris.at=A.lunaris.from; A.lunaris.to=A.lunaris.otherRef;
    }
    if(A.lunaris&&A.lunaris.otherRef)clearInterval(link);
  },300);
})();
