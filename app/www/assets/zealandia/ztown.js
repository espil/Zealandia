/* ================================================================
   ZEALANDIA TOWN (Zealandia app, 2026-10-20) - the first crafted
   place in Zealandia: a 5 km-radius disc of REAL Auckland-isthmus
   landscape (Zealandia days, drained: the harbour channels are dry
   plains) with a small fenced town at its centre.

   World slot: centre (0, +10000) - the free slot north of the city
   offsets (Vancouver 0, Tokyo +5000, Auckland +10000, New York
   -5000, Paris -10000, London (0,-10000)); the whole disc stays
   inside the build's 15 km world bound (max centre distance
   10000 + 5000 rim = 15000).

   The module reuses the build's player controller, camera, HUD,
   entry flow and skill state (skillState / MOVES / moveStats). It
   only engages when window.__espilCityKey === 'zealandia'. Ground
   law is window.__ztownGroundAt (the same height function the
   terrain mesh is built from), wired into the build by two small
   patches in the app copy's index (support + espilOwnSurfaceY)
   and the per-frame town tick by a third (after espilInteriorTick).
   ================================================================ */
(function(){
  'use strict';
  var SELF_SRC=(document.currentScript&&document.currentScript.src)||'';
  var DECODER_URL=SELF_SRC.replace(/ztown\.js(\?.*)?$/, 'meshopt_decoder.js');
  var CX=0, CZ=10000;                 /* town world centre */
  var FENCE_R=250, GATE_HALF=4.0;     /* fence circle + gate half width (m) */
  var HOME_LOCAL={x:0,z:-70};         /* Espil House centre (town-local) */
  var SPAWN_LOCAL={x:0,z:232};        /* just inside the south gate */

  var Z={
    active:false, buildStarted:false, built:false,
    heights:null, hC:52, group:null,
    walls:[], buildings:[], villagers:[], animals:[], monsters:[],
    fencePosts:0, fenceRails:0, trees:0,
    savedPoint:null, prevPlayerR:null, hintDone:false,
    atkCd:{punch:0,kick:0,throw:0}, time:0
  };
  window.__ztown=Z;

  /* ---------- terrain height function (single ground law) ---------- */
  function heightBilinear(lx,lz){
    var H=Z.heights; if(!H)return Z.hC;
    var fx=(lx+5000)/100, fz=(lz+5000)/100;
    fx=Math.max(0,Math.min(100,fx)); fz=Math.max(0,Math.min(100,fz));
    var x0=Math.min(99,Math.floor(fx)), z0=Math.min(99,Math.floor(fz));
    var tx=fx-x0, tz=fz-z0;
    var i00=z0*101+x0, i10=i00+1, i01=i00+101, i11=i01+1;
    return H[i00]*(1-tx)*(1-tz)+H[i10]*tx*(1-tz)+H[i01]*(1-tx)*tz+H[i11]*tx*tz;
  }
  function groundLocal(lx,lz){
    var r=Math.sqrt(lx*lx+lz*lz);
    if(r<=260)return Z.hC; /* town disc: analytically flat. The baked grid is flat at cell centres, but bilinear sampling bled the blend ring's heights up to ~9 m into the fence line and the spawn - posts floated or sank and the ground waved under flat-placed buildings. */
    var h=heightBilinear(lx,lz);
    if(r<360)h=Z.hC+(h-Z.hC)*smoothstep(260,360,r);
    if(r>5000){ h-=(r-5000)*0.06; if(h<-60)h=-60; } /* island shelf falloff past the rim */
    return h;
  }
  function groundAt(wx,wz){ return groundLocal(wx-CX,wz-CZ); }
  Z.groundAt=groundAt; Z.groundLocal=groundLocal;
  window.__ztownGroundAt=groundAt;

  /* ---------- small helpers ---------- */
  /* The build's engine (mapScene, walkPlayer, skillState, MOVES...)
     lives inside the main script's closure; the app copy's index
     publishes the handles this module needs on window.__ztownRefs
     from inside updateWalkMap (see the tick patch). */
  function refs(){ return window.__ztownRefs||{}; }
  function applyCurve(m){ var r=refs(); if(r&&r.curve){ try{ r.curve(m); }catch(e){} } return m; }
  function rng(seed){ var a=seed>>>0; return function(){ a|=0; a=a+0x6D2B79F5|0; var t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  var rand=rng(20261020);
  function mat(color,opts){
    var m=new THREE.MeshLambertMaterial(Object.assign({color:color},opts||{}));
    applyCurve(m);
    return m;
  }
  function box(w,h,d,color,x,y,z,ry){
    var ms=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(color));
    ms.position.set(x,y,z); if(ry)ms.rotation.y=ry;
    ms.castShadow=true; ms.receiveShadow=true;
    return ms;
  }
  function toast(msg){ if(window.__espilToast)window.__espilToast(msg); }
  function smoothstep(a,b,x){ var u=Math.max(0,Math.min(1,(x-a)/(b-a))); return u*u*(3-2*u); }

  /* ---------- terrain mesh ---------- */
  function bandColor(h,r,out){
    var stops=[[-20,0xa79b78],[0,0x7fa653],[15,0x749c4e],[45,0x5d8a46],[90,0x557f43],[140,0x8a7f72]];
    var c0=stops[0][1], c1=stops[stops.length-1][1], t=0;
    for(var i=0;i<stops.length-1;i++){
      if(h>=stops[i][0]&&h<=stops[i+1][0]){ c0=stops[i][1]; c1=stops[i+1][1]; t=(h-stops[i][0])/Math.max(1,(stops[i+1][0]-stops[i][0])); break; }
      if(h>stops[stops.length-1][0]){ c0=c1=stops[stops.length-1][1]; t=0; }
    }
    var A=new THREE.Color(c0), B=new THREE.Color(c1); A.lerp(B,t);
    if(r<255){ var town=new THREE.Color(0x86aa58); A.lerp(town,(1-smoothstep(225,255,r))*.55); }
    out.push(A.r,A.g,A.b);
  }
  /* Procedural ground texture (Han, 2026-10-24: the ground must read
     as game ground, not a bare coloured plane). A speckled grass/dirt
     canvas, near-neutral in luminance so the vertex-colour bands keep
     carrying the place's palette; world-scale UV repeats (28 m fine,
     56 m coarse) tile it without a visible grid. Generated once. */
  var _groundTex=null;
  function groundTexture(){
    if(_groundTex)return _groundTex;
    var cv=document.createElement('canvas'); cv.width=cv.height=256;
    var g=cv.getContext('2d');
    g.fillStyle='#c9cfba'; g.fillRect(0,0,256,256);
    var R=rng(777);
    for(var i=0;i<5200;i++){
      var x=R()*256, y=R()*256, l=2+R()*5, gr=R();
      g.strokeStyle=gr<.55?'rgba(96,116,62,.35)':(gr<.85?'rgba(140,150,96,.30)':'rgba(168,152,104,.28)');
      g.lineWidth=1;
      g.beginPath(); g.moveTo(x,y); g.lineTo(x+(R()*2-1), y-l); g.stroke();
    }
    for(var j=0;j<260;j++){
      var dx=R()*256, dy=R()*256, dr=3+R()*11;
      var rg=g.createRadialGradient(dx,dy,0,dx,dy,dr);
      rg.addColorStop(0,'rgba(146,124,84,.13)'); rg.addColorStop(1,'rgba(146,124,84,0)');
      g.fillStyle=rg; g.beginPath(); g.arc(dx,dy,dr,0,7); g.fill();
    }
    var tex=new THREE.CanvasTexture(cv);
    tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
    tex.anisotropy=4;
    _groundTex=tex;
    return tex;
  }
  function buildTerrain(){
    var N=100, size=10000, pos=[], col=[], idx=[], uv=[];
    for(var r=0;r<=N;r++)for(var c=0;c<=N;c++){
      var lx=-5000+c*100, lz=-5000+r*100;
      pos.push(CX+lx, groundLocal(lx,lz), CZ+lz);
      uv.push((lx+5000)/56, (5000-lz)/56);
      bandColor(groundLocal(lx,lz), Math.sqrt(lx*lx+lz*lz), col);
    }
    for(var r2=0;r2<N;r2++)for(var c2=0;c2<N;c2++){
      /* The inner +/-1200 m is cut out: buildTerrainFine lays a 10 m
         mesh there (Han, 2026-10-24). On this 100 m grid the Globe
         bend's chord error reached ~8 m, so buildings bent by the
         true curve floated or sank against the chorded ground. */
      var fcx=-5000+c2*100+50, fcz=-5000+r2*100+50;
      if(Math.abs(fcx)<1200&&Math.abs(fcz)<1200)continue;
      var a=r2*101+c2, b=a+1, d=a+101, e=d+1;
      idx.push(a,d,b, b,d,e);
    }
    var g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
    g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
    g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    g.setIndex(idx); g.computeVertexNormals();
    var m=new THREE.MeshLambertMaterial({vertexColors:true, map:groundTexture()});
    applyCurve(m);
    var mesh=new THREE.Mesh(g,m);
    mesh.receiveShadow=true; mesh.frustumCulled=false;
    Z.group.add(mesh);
    Z.terrainMesh=mesh;
    buildTerrainFine();
    /* No satellite ground (Han, 2026-10-23): Waitematā is a built
       village, not a photo of Auckland. The terrain keeps its crafted
       vertex-colour bands and the village dressing carries the place. */
  }

  /* Fine inner terrain (Han, 2026-10-24): a 10 m mesh over the inner
     +/-1300 m. Two jobs: the rolling heightfield actually reads as
     terrain (the 100 m backdrop facets read as one flat plane), and
     the Globe bend's chord error inside a 10 m cell is ~0.08 m, so
     bent buildings meet bent ground instead of floating over chords.
     Heights come from the same groundLocal law as physics - one law
     for feet, buildings and pixels. The rim lifts up to 6 cm across
     the overlap band so the seam with the coarse backdrop never gaps;
     inside the village the lift is 0 and plaza/paths sit as before. */
  function buildTerrainFine(){
    var N=200, half=1300, step=(half*2)/N, pos=[], col=[], idx=[], uv=[];
    for(var r=0;r<=N;r++)for(var c=0;c<=N;c++){
      var lx=-half+c*step, lz=-half+r*step;
      var h=groundLocal(lx,lz), rr=Math.sqrt(lx*lx+lz*lz);
      var lift=0.06*smoothstep(1220,1300,rr);
      pos.push(CX+lx, h+lift, CZ+lz);
      uv.push((lx+half)/28, (half-lz)/28);
      bandColor(h, rr, col);
    }
    for(var r2=0;r2<N;r2++)for(var c2=0;c2<N;c2++){
      var a=r2*(N+1)+c2, b=a+1, d=a+N+1, e=d+1;
      idx.push(a,d,b, b,d,e);
    }
    var g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
    g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
    g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    g.setIndex(idx); g.computeVertexNormals();
    var m=new THREE.MeshLambertMaterial({vertexColors:true, map:groundTexture()});
    applyCurve(m);
    var mesh=new THREE.Mesh(g,m);
    mesh.receiveShadow=true; mesh.frustumCulled=false;
    Z.group.add(mesh);
    Z.terrainFineMesh=mesh;
  }

  /* ---------- plaza + paths (inside the flat town disc) ---------- */
  function buildPlazaPaths(){
    var y=Z.hC+0.03;
    var plaza=new THREE.Mesh(new THREE.CircleGeometry(26,36),mat(0xbfae8d));
    plaza.rotation.x=-Math.PI/2; plaza.position.set(CX,y,CZ); plaza.receiveShadow=true;
    Z.group.add(plaza);
    var dirs=[[0,-1],[0,1],[1,0],[-1,0]];
    for(var i=0;i<4;i++){
      var len=FENCE_R-24, p=box(5,0.06,len,0xa68a64, CX+dirs[i][0]*(24+len/2), y-0.005, CZ+dirs[i][1]*(24+len/2), dirs[i][0]!==0?Math.PI/2:0);
      p.castShadow=false; Z.group.add(p);
    }
  }

  /* ---------- the circular wooden fence + 4 gates ---------- */
  function gateAngularDist(a){
    var card=[0,Math.PI/2,Math.PI,Math.PI*1.5], best=1e9;
    for(var i=0;i<4;i++){ var d=Math.abs(a-card[i]); d=Math.min(d,Math.PI*2-d); if(d<best)best=d; }
    return best;
  }
  function buildFence(){
    var postGeo=new THREE.BoxGeometry(0.18,1.5,0.18);
    var postMat=mat(0x7a5a36);
    var step=Math.PI*2/360, gateHalfA=Math.asin((GATE_HALF+0.6)/FENCE_R);
    var posts=[];
    for(var i=0;i<360;i++){
      var a=i*step;
      if(gateAngularDist(a)<gateHalfA)continue;
      posts.push(a);
    }
    var postInst=new THREE.InstancedMesh(postGeo,postMat,posts.length);
    var m4=new THREE.Matrix4();
    for(var pi=0;pi<posts.length;pi++){
      var pa=posts[pi], px=Math.cos(pa)*FENCE_R, pz=Math.sin(pa)*FENCE_R;
      m4.makeTranslation(CX+px, Z.hC+0.75, CZ+pz);
      postInst.setMatrixAt(pi,m4);
    }
    postInst.castShadow=true; postInst.frustumCulled=false;
    Z.group.add(postInst); Z.fencePosts=posts.length;
    /* rails: chords between consecutive posts, two heights */
    var railGeo=new THREE.BoxGeometry(1,0.09,0.15);
    var railMat=mat(0x8a6a42);
    var rails=[];
    for(var ri=0;ri<posts.length;ri++){
      var a1=posts[ri], a2=posts[(ri+1)%posts.length];
      var da=a2-a1; if(da<0)da+=Math.PI*2;
      if(da>step*1.6)continue; /* gate gap: no rail */
      rails.push([a1,a2]);
    }
    var railInst=new THREE.InstancedMesh(railGeo,railMat,rails.length*2);
    var q=new THREE.Quaternion(), up=new THREE.Vector3(0,1,0), sc=new THREE.Vector3(), pv=new THREE.Vector3();
    var idx2=0;
    for(var rj=0;rj<rails.length;rj++){
      var b1=rails[rj][0], b2=rails[rj][1];
      var x1=Math.cos(b1)*FENCE_R, z1=Math.sin(b1)*FENCE_R;
      var x2=Math.cos(b2)*FENCE_R, z2=Math.sin(b2)*FENCE_R;
      var mx=(x1+x2)/2, mz=(z1+z2)/2, dx=x2-x1, dz=z2-z1;
      var len=Math.sqrt(dx*dx+dz*dz)+0.24;
      q.setFromAxisAngle(up,Math.atan2(-dz,dx));
      for(var hh=0;hh<2;hh++){
        pv.set(CX+mx, Z.hC+(hh===0?0.55:1.08), CZ+mz); sc.set(len,1,1);
        m4.compose(pv,q,sc); railInst.setMatrixAt(idx2++,m4);
      }
    }
    railInst.count=idx2; railInst.castShadow=true; railInst.frustumCulled=false;
    Z.group.add(railInst); Z.fenceRails=idx2;
    /* gate posts: taller pairs at the 4 gaps */
    var gdirs=[[0,-1],[0,1],[1,0],[-1,0]];
    for(var gi=0;gi<4;gi++){
      var gd=gdirs[gi], gx=gd[0]*FENCE_R, gz=gd[1]*FENCE_R;
      var latx=gd[1]!==0?1:0, latz=gd[0]!==0?1:0;
      for(var s=-1;s<=1;s+=2){
        var gp=box(0.3,2.3,0.3,0x6e4e2c, CX+gx+latx*s*(GATE_HALF+0.4), Z.hC+1.15, CZ+gz+latz*s*(GATE_HALF+0.4));
        Z.group.add(gp);
      }
      var beam=box(gd[1]!==0?(GATE_HALF*2+1.1):0.24, 0.22, gd[0]!==0?(GATE_HALF*2+1.1):0.24, 0x6e4e2c, CX+gx, Z.hC+2.32, CZ+gz);
      Z.group.add(beam);
    }
  }

  /* ---------- buildings: every one enterable ----------
     Walls are built (and collided) as segments; the door wall is
     split around a real opening with a lintel above it. The roof
     fades while the player is inside that building. */
  function addWallSeg(lx1,lz1,lx2,lz2){ Z.walls.push({ax:CX+lx1,az:CZ+lz1,bx:CX+lx2,bz:CZ+lz2}); }
  function wallBox(lx1,lz1,lx2,lz2,h,color,baseY){
    var dx=lx2-lx1, dz=lz2-lz1, len=Math.sqrt(dx*dx+dz*dz);
    var b=box(len, h, 0.3, color, CX+(lx1+lx2)/2, baseY+h/2, CZ+(lz1+lz2)/2, Math.atan2(-dz,dx));
    return b;
  }
  var HOUSE_DEFS=[
    {x:-55,z:-35,w:9,d:8,h:4.0,door:'S',wall:0xe8dcc4,roof:0x9a5a3c},
    {x:58,z:-40,w:10,d:8,h:4.5,door:'S',wall:0xdfc9a8,roof:0x7a4a34},
    {x:-70,z:25,w:8,d:9,h:3.8,door:'E',wall:0xd9b48c,roof:0x8a5a40},
    {x:72,z:30,w:9,d:7,h:4.2,door:'W',wall:0xead9c0,roof:0x9a5a3c},
    {x:-38,z:68,w:10,d:9,h:4.6,door:'N',wall:0xe3d0ae,roof:0x6e4a34},
    {x:40,z:72,w:8,d:8,h:4.0,door:'N',wall:0xdcc19a,roof:0x8a5a40},
    {x:-105,z:-80,w:11,d:9,h:5.0,door:'E',wall:0xe8dcc4,roof:0x7a4a34},
    {x:108,z:-75,w:9,d:10,h:4.4,door:'W',wall:0xdfc9a8,roof:0x9a5a3c},
    {x:-15,z:-125,w:8,d:7,h:3.6,door:'S',wall:0xd9b48c,roof:0x8a5a40},
    {x:95,z:120,w:10,d:8,h:4.8,door:'W',wall:0xead9c0,roof:0x6e4a34},
    {x:-95,z:125,w:9,d:9,h:4.1,door:'E',wall:0xe3d0ae,roof:0x9a5a3c}
  ];
  function buildHouse(def,isEspil){
    var g=new THREE.Group(), baseY=Z.hC;
    var cx=def.x, cz=def.z, hw=def.w/2, hd=def.d/2, h=def.h, doorW=1.9, doorH=2.45;
    /* floor */
    var fl=box(def.w+0.7,0.08,def.d+0.7,0x9a7648, CX+cx, baseY+0.04, CZ+cz); fl.castShadow=false; g.add(fl);
    /* four walls; the door wall is two segments + lintel */
    var sides=[
      {side:'N',x1:cx-hw,z1:cz-hd,x2:cx+hw,z2:cz-hd},
      {side:'S',x1:cx-hw,z1:cz+hd,x2:cx+hw,z2:cz+hd},
      {side:'W',x1:cx-hw,z1:cz-hd,x2:cx-hw,z2:cz+hd},
      {side:'E',x1:cx+hw,z1:cz-hd,x2:cx+hw,z2:cz+hd}
    ];
    for(var i=0;i<4;i++){
      var s=sides[i];
      if(s.side===def.door){
        var alongX=(s.side==='N'||s.side==='S');
        var mid=alongX?cx:cz, half=alongX?hw:hd;
        var g0=mid-doorW/2, g1=mid+doorW/2, e0=mid-half, e1=mid+half;
        function seg(a,b){
          if(b-a<0.05)return;
          if(alongX){ addWallSeg(a,s.z1,b,s.z1); g.add(wallBox(a,s.z1,b,s.z1,h,def.wall,baseY)); }
          else{ addWallSeg(s.x1,a,s.x1,b); g.add(wallBox(s.x1,a,s.x1,b,h,def.wall,baseY)); }
        }
        seg(e0,g0); seg(g1,e1);
        /* lintel above the doorway (visual only, head height clears) */
        if(alongX) g.add(box(doorW, h-doorH, 0.3, def.wall, CX+mid, baseY+doorH+(h-doorH)/2, CZ+s.z1));
        else g.add(box(0.3, h-doorH, doorW, def.wall, CX+s.x1, baseY+doorH+(h-doorH)/2, CZ+mid));
        /* doorstep marker */
        var stepOut=(s.side==='S')?1:(s.side==='N'?-1:0), stepOutX=(s.side==='E')?1:(s.side==='W'?-1:0);
        var stp=box(alongX?2.4:0.5, 0.1, alongX?0.5:2.4, 0x8a7a5e, CX+cx+stepOutX*(hw+0.35), baseY+0.05, CZ+cz+stepOut*(hd+0.35));
        stp.castShadow=false; g.add(stp);
      }else{
        addWallSeg(s.x1,s.z1,s.x2,s.z2);
        g.add(wallBox(s.x1,s.z1,s.x2,s.z2,h,def.wall,baseY));
      }
    }
    /* windows: small dark panes on two walls (visual) */
    var winMat=mat(0x2c3e50,{emissive:0x1a2c3e});
    function win(x,z,ry){ var w=new THREE.Mesh(new THREE.BoxGeometry(1.0,1.15,0.08),winMat); w.position.set(CX+x,baseY+1.9,CZ+z); w.rotation.y=ry||0; g.add(w); }
    win(cx-hw/2, cz-hd-0.17); win(cx+hw/2, cz-hd-0.17);
    win(cx-hw-0.17, cz, Math.PI/2); win(cx+hw+0.17, cz, Math.PI/2);
    /* pyramid roof (4-sided cone), fades while the player is inside */
    var roofH=2.1+def.h*0.22;
    var roofMat=mat(def.roof,{transparent:true});
    var roof=new THREE.Mesh(new THREE.ConeGeometry(Math.sqrt(hw*hw+hd*hd)*1.14, roofH, 4), roofMat);
    roof.position.set(CX+cx, baseY+h+roofH/2-0.04, CZ+cz);
    roof.rotation.y=Math.PI/4;
    roof.scale.set(def.w/(Math.sqrt(hw*hw+hd*hd)*2)*1.02, 1, def.d/(Math.sqrt(hw*hw+hd*hd)*2)*1.02);
    roof.castShadow=true;
    g.add(roof);
    Z.group.add(g);
    var rec={def:def, roofMat:roofMat, cx:cx, cz:cz, w:def.w, d:def.d, espil:!!isEspil};
    Z.buildings.push(rec);
    return rec;
  }
  function textSprite(text,scale,fg,bg){
    var cv=document.createElement('canvas'); cv.width=512; cv.height=112;
    var c=cv.getContext('2d');
    if(bg){ c.fillStyle=bg; c.fillRect(0,0,512,112); }
    c.font='bold 52px Georgia,serif'; c.textAlign='center'; c.textBaseline='middle';
    c.lineWidth=8; c.strokeStyle='rgba(20,12,4,.85)'; c.strokeText(text,256,58);
    c.fillStyle=fg||'#fff'; c.fillText(text,256,58);
    var tex=new THREE.CanvasTexture(cv);
    var sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthWrite:false}));
    sp.scale.set(scale||4.6,(scale||4.6)*112/512,1);
    return sp;
  }
  function buildEspilHouse(){
    var def={x:HOME_LOCAL.x,z:HOME_LOCAL.z,w:13,d:11,h:5.2,door:'S',wall:0xf0e6d2,roof:0x2e7f86};
    buildHouse(def,true);
    /* sign board over the south door + a floating name */
    var sign=box(4.6,1.0,0.18,0x54381e, CX+def.x, Z.hC+3.1, CZ+def.z+def.d/2+0.28);
    Z.group.add(sign);
    var cv=document.createElement('canvas'); cv.width=512; cv.height=112;
    var c=cv.getContext('2d'); c.fillStyle='#54381e'; c.fillRect(0,0,512,112);
    c.font='bold 54px Georgia,serif'; c.textAlign='center'; c.textBaseline='middle';
    c.fillStyle='#ffd76e'; c.fillText('ESPIL HOUSE',256,58);
    var face=new THREE.Mesh(new THREE.PlaneGeometry(4.5,0.98), new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(cv)}));
    face.position.set(CX+def.x, Z.hC+3.1, CZ+def.z+def.d/2+0.39);
    Z.group.add(face);
    var label=textSprite('Espil House',5.2,'#ffe9a8');
    label.position.set(CX+def.x, Z.hC+8.6, CZ+def.z);
    Z.group.add(label);
    /* a welcome mat marks the interior home point */
    var rug=box(2.6,0.05,1.8,0x7a3b2e, CX+def.x, Z.hC+0.1, CZ+def.z+1.4); rug.castShadow=false;
    Z.group.add(rug);
    Z.homePoint={x:CX+def.x, z:CZ+def.z+1.2};
  }
  function buildStalls(){
    var spots=[[-20,16,0.4],[19,17,-0.3],[2,-25,0]];
    for(var i=0;i<spots.length;i++){
      var sx=spots[i][0], sz=spots[i][1], ry=spots[i][2], g=new THREE.Group();
      var offs=[[-1.15,-0.8],[1.15,-0.8],[-1.15,0.8],[1.15,0.8]];
      for(var j=0;j<4;j++){ var p=box(0.1,2.2,0.1,0x6e4e2c, offs[j][0],1.1,offs[j][1]); g.add(p); }
      var canopy=box(2.9,0.12,2.2, i%2?0xc9563c:0x3c78c9, 0,2.32,0); g.add(canopy);
      var counter=box(2.5,0.85,0.7,0x8a6a42, 0,0.43,0.55); g.add(counter);
      var crate=box(0.55,0.55,0.55,0xa8842f, -0.8,0.28,-0.5); g.add(crate);
      g.position.set(CX+sx, Z.hC, CZ+sz); g.rotation.y=ry;
      g.traverse(function(o){ if(o.isMesh){o.castShadow=true;} });
      Z.group.add(g);
    }
  }
  function buildPens(){
    var pens=[
      {x:-150,z:92,w:38,d:26,gapSide:'E'},
      {x:152,z:62,w:32,d:24,gapSide:'W'}
    ];
    Z.pens=pens;
    for(var pi=0;pi<pens.length;pi++){
      var P=pens[pi], hw=P.w/2, hd=P.d/2;
      var sides=[
        {side:'N',x1:P.x-hw,z1:P.z-hd,x2:P.x+hw,z2:P.z-hd},
        {side:'S',x1:P.x-hw,z1:P.z+hd,x2:P.x+hw,z2:P.z+hd},
        {side:'W',x1:P.x-hw,z1:P.z-hd,x2:P.x-hw,z2:P.z+hd},
        {side:'E',x1:P.x+hw,z1:P.z-hd,x2:P.x+hw,z2:P.z+hd}
      ];
      for(var si=0;si<4;si++){
        var s=sides[si], alongX=(s.side==='N'||s.side==='S');
        var mid=alongX?P.x:P.z, half=alongX?hw:hd;
        var segs=[[mid-half,mid+half]];
        if(s.side===P.gapSide) segs=[[mid-half,mid-1.4],[mid+1.4,mid+half]];
        for(var gi2=0;gi2<segs.length;gi2++){
          var a=segs[gi2][0], b=segs[gi2][1]; if(b-a<0.4)continue;
          var lx1,lz1,lx2,lz2;
          if(alongX){ lx1=a; lz1=s.z1; lx2=b; lz2=s.z1; } else { lx1=s.x1; lz1=a; lx2=s.x1; lz2=b; }
          addWallSeg(lx1,lz1,lx2,lz2);
          var seg1=box(Math.abs(lx2-lx1)||0.08, 0.09, Math.abs(lz2-lz1)||0.08, 0x8a6a42, CX+(lx1+lx2)/2, Z.hC+0.5, CZ+(lz1+lz2)/2);
          var seg2=box(Math.abs(lx2-lx1)||0.08, 0.09, Math.abs(lz2-lz1)||0.08, 0x8a6a42, CX+(lx1+lx2)/2, Z.hC+0.95, CZ+(lz1+lz2)/2);
          Z.group.add(seg1); Z.group.add(seg2);
          /* posts along the segment */
          var L=Math.max(Math.abs(lx2-lx1),Math.abs(lz2-lz1)), n=Math.max(2,Math.round(L/3));
          for(var pj=0;pj<=n;pj++){
            var px=lx1+(lx2-lx1)*pj/n, pz=lz1+(lz2-lz1)*pj/n;
            Z.group.add(box(0.12,1.05,0.12,0x7a5a36, CX+px, Z.hC+0.52, CZ+pz));
          }
        }
      }
      /* hay bale dressing */
      Z.group.add(box(1.1,0.7,0.7,0xd8b84a, CX+P.x+3, Z.hC+0.35, CZ+P.z-2, 0.4));
    }
  }
  function buildTrees(){
    var spots=[];
    var guard=function(x,z){
      if(Math.sqrt(x*x+z*z)<40)return false;
      for(var i=0;i<HOUSE_DEFS.length;i++){ var d=HOUSE_DEFS[i]; if(Math.abs(x-d.x)<d.w/2+4&&Math.abs(z-d.z)<d.d/2+4)return false; }
      if(Math.abs(x-HOME_LOCAL.x)<11&&Math.abs(z-HOME_LOCAL.z)<9)return false;
      return true;
    };
    var tries=0;
    while(spots.length<10&&tries++<300){ var a=rand()*Math.PI*2, r=45+rand()*185, x=Math.cos(a)*r, z=Math.sin(a)*r; if(guard(x,z))spots.push([x,z,Z.hC]); }
    tries=0;
    while(spots.length<82&&tries++<900){
      var a2=rand()*Math.PI*2, r2=340+rand()*2800, x2=Math.cos(a2)*r2, z2=Math.sin(a2)*r2;
      spots.push([x2,z2,groundLocal(x2,z2)]);
    }
    var trunkG=new THREE.CylinderGeometry(0.16,0.26,1.7,6), trunkM=mat(0x6e4e2c);
    var canG=new THREE.IcosahedronGeometry(1.7,1), canM=mat(0x4e7d3a);
    var ti=new THREE.InstancedMesh(trunkG,trunkM,spots.length);
    var ci=new THREE.InstancedMesh(canG,canM,spots.length);
    var m4=new THREE.Matrix4(), q=new THREE.Quaternion(), pv=new THREE.Vector3(), sv=new THREE.Vector3();
    var cc=new THREE.Color();
    for(var i=0;i<spots.length;i++){
      var s=0.8+rand()*0.9;
      pv.set(CX+spots[i][0], spots[i][2]+0.85*s, CZ+spots[i][1]); sv.set(s,s,s); q.identity();
      m4.compose(pv,q,sv); ti.setMatrixAt(i,m4);
      pv.set(CX+spots[i][0], spots[i][2]+(1.7+1.2)*s, CZ+spots[i][1]); sv.set(s,s*(0.85+rand()*0.3),s);
      m4.compose(pv,q,sv); ci.setMatrixAt(i,m4);
      ci.setColorAt(i, cc.setHSL(0.29+rand()*0.05, 0.42, 0.3+rand()*0.12));
    }
    ti.frustumCulled=false; ci.frustumCulled=false; ci.castShadow=true;
    Z.group.add(ti); Z.group.add(ci); Z.trees=spots.length;
  }

  /* ---------- villagers ---------- */
  var VILLAGERS=[
    ['Aroha',0xc9563c],['Tama',0x3c78c9],['Hine',0x53a06a],['Rangi',0xd8a03c],
    ['Mia',0x8a5fb0],['Noah',0x4a90a4],['Kiri',0xc9748a],['Eli',0x7a9a4a],['Sana',0xb06a3c]
  ];
  function humanoid(shirt){
    var g=new THREE.Group();
    var body=new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.38,1.02,8),mat(shirt));
    body.position.y=0.86; body.castShadow=true; g.add(body);
    var head=new THREE.Mesh(new THREE.SphereGeometry(0.26,10,8),mat(0xe8b88a));
    head.position.y=1.66; head.castShadow=true; g.add(head);
    var skirt=new THREE.Mesh(new THREE.CylinderGeometry(0.38,0.44,0.36,8),mat(0x5a4632));
    skirt.position.y=0.2; g.add(skirt);
    return g;
  }
  function pointInBuilding(lx,lz,pad){
    for(var i=0;i<Z.buildings.length;i++){
      var b=Z.buildings[i];
      if(Math.abs(lx-b.def.x)<b.def.w/2+pad&&Math.abs(lz-b.def.z)<b.def.d/2+pad)return true;
    }
    return false;
  }
  function buildVillagers(){
    for(var i=0;i<VILLAGERS.length;i++){
      var g=humanoid(VILLAGERS[i][1]);
      var a=rand()*Math.PI*2, r=20+rand()*180;
      var lx=Math.cos(a)*r, lz=Math.sin(a)*r;
      if(pointInBuilding(lx,lz,3)){ lx=20+i*8; lz=30-i*6; }
      g.position.set(CX+lx, Z.hC, CZ+lz);
      var label=textSprite(VILLAGERS[i][0],2.6,'#ffffff');
      label.position.y=2.25; g.add(label);
      Z.group.add(g);
      Z.villagers.push({grp:g, lx:lx, lz:lz, tx:lx, tz:lz, state:'idle', timer:rand()*3, speed:1.05+rand()*0.3, name:VILLAGERS[i][0]});
    }
  }
  /* ---------- farm animals ---------- */
  function animalMesh(kind){
    var g=new THREE.Group();
    var bodyM, headM;
    if(kind==='cow'){
      bodyM=mat(rand()>0.5?0xf0ead8:0x8a5a38);
      var body=box(1.5,0.85,0.85,0,0,0,0); body.material=bodyM; body.position.y=0.98; g.add(body);
      headM=box(0.52,0.5,0.5,0,0,0,0); headM.material=bodyM; headM.position.set(0,1.12,-0.95); g.add(headM);
      var legG=new THREE.BoxGeometry(0.13,0.62,0.13), legM=mat(0x4a3826);
      [[-0.55,-0.28],[0.55,-0.28],[-0.55,0.28],[0.55,0.28]].forEach(function(o){ var l=new THREE.Mesh(legG,legM); l.position.set(o[0],0.31,o[1]); g.add(l); });
    }else if(kind==='pig'){
      bodyM=mat(0xe8a0a8);
      var pb=box(0.95,0.6,0.6,0,0,0,0); pb.material=bodyM; pb.position.y=0.55; g.add(pb);
      headM=box(0.4,0.38,0.38,0,0,0,0); headM.material=bodyM; headM.position.set(0,0.62,-0.62); g.add(headM);
      var legG2=new THREE.BoxGeometry(0.09,0.3,0.09), legM2=mat(0xc97f88);
      [[-0.32,-0.18],[0.32,-0.18],[-0.32,0.18],[0.32,0.18]].forEach(function(o){ var l=new THREE.Mesh(legG2,legM2); l.position.set(o[0],0.15,o[1]); g.add(l); });
    }else{ /* sheep */
      bodyM=mat(0xe8e4da);
      var sb=new THREE.Mesh(new THREE.SphereGeometry(0.55,9,7),bodyM); sb.scale.set(1.25,0.95,1); sb.position.y=0.72; sb.castShadow=true; g.add(sb);
      headM=box(0.34,0.34,0.4,0x3a3230, 0,0,0); headM.position.set(0,0.78,-0.68); g.add(headM);
      var legG3=new THREE.BoxGeometry(0.09,0.42,0.09), legM3=mat(0x3a3230);
      [[-0.35,-0.2],[0.35,-0.2],[-0.35,0.2],[0.35,0.2]].forEach(function(o){ var l=new THREE.Mesh(legG3,legM3); l.position.set(o[0],0.21,o[1]); g.add(l); });
    }
    g.userData.head=headM;
    return g;
  }
  function buildAnimals(){
    var defs=[];
    var penA=Z.pens[0], penB=Z.pens[1];
    for(var i=0;i<4;i++)defs.push({kind:'cow', area:{x0:penA.x-penA.w/2+3,x1:penA.x+penA.w/2-3,z0:penA.z-penA.d/2+3,z1:penA.z+penA.d/2-3}});
    for(var j=0;j<3;j++)defs.push({kind:'pig', area:{x0:penB.x-penB.w/2+3,x1:penB.x+penB.w/2-3,z0:penB.z-penB.d/2+3,z1:penB.z+penB.d/2-3}});
    for(var k=0;k<5;k++)defs.push({kind:'sheep', area:{x0:118,x1:196,z0:118,z1:196}});
    for(var n=0;n<defs.length;n++){
      var d=defs[n], g=animalMesh(d.kind);
      var lx=d.area.x0+rand()*(d.area.x1-d.area.x0), lz=d.area.z0+rand()*(d.area.z1-d.area.z0);
      g.position.set(CX+lx, Z.hC, CZ+lz);
      g.rotation.y=rand()*Math.PI*2;
      var sc=d.kind==='cow'?1:0.85+rand()*0.3; g.scale.set(sc,sc,sc);
      Z.group.add(g);
      Z.animals.push({grp:g, head:g.userData.head, lx:lx, lz:lz, tx:lx, tz:lz, area:d.area, state:'idle', timer:rand()*4, speed:0.4+rand()*0.2, phase:rand()*6.28, kind:d.kind});
    }
  }

  /* ---------- monsters (outside the fence) + combat ---------- */
  var MONSTER_COLORS=[0x33262e,0x26302a,0x2c2438,0x38262a];
  /* The town's Strayers wear the produced sprite sheets (files/monster-sprites):
     state-driven frame sets on camera billboards, EverPlanet-style. */
  var STRAYER_SETS={idle:4, walk_front:4, walk_back:4, walk_left:6, walk_right:6, aggro:4, attack:4, hit:4};
  var _strayerTex={};
  function strayerTex(set, i){
    var key=set+'_'+i;
    if(!_strayerTex[key]){
      _strayerTex[key]=new THREE.TextureLoader().load('assets/zealandia/sprites/strayer/strayer_'+set+'_'+i+'.png');
    }
    return _strayerTex[key];
  }
  var _shadowTex=null;
  function shadowTex(){
    if(_shadowTex)return _shadowTex;
    var cv=document.createElement('canvas'); cv.width=cv.height=64;
    var c=cv.getContext('2d');
    var gr=c.createRadialGradient(32,32,4,32,32,30);
    gr.addColorStop(0,'rgba(0,0,0,0.34)'); gr.addColorStop(1,'rgba(0,0,0,0)');
    c.fillStyle=gr; c.fillRect(0,0,64,64);
    _shadowTex=new THREE.CanvasTexture(cv); return _shadowTex;
  }
  function monsterMesh(color){
    var g=new THREE.Group();
    var bodyM=new THREE.SpriteMaterial({map:strayerTex('idle',1), transparent:true});
    var sp=new THREE.Sprite(bodyM);
    sp.scale.set(1.93,2.0,1); sp.position.y=1.02; g.add(sp);
    var sh=new THREE.Mesh(new THREE.PlaneGeometry(1.7,1.7),
      new THREE.MeshBasicMaterial({map:shadowTex(), transparent:true, depthWrite:false}));
    sh.rotation.x=-Math.PI/2; sh.position.y=0.04; g.add(sh);
    return {grp:g, bodyM:bodyM, sprite:sp};
  }
  function makeHpBar(){
    var cv=document.createElement('canvas'); cv.width=96; cv.height=14;
    var tex=new THREE.CanvasTexture(cv);
    var sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthWrite:false}));
    sp.scale.set(1.9,0.28,1);
    return {sp:sp, cv:cv, tex:tex};
  }
  function drawHpBar(m){
    var c=m.bar.cv.getContext('2d');
    c.clearRect(0,0,96,14);
    c.fillStyle='rgba(10,10,10,.72)'; c.fillRect(0,0,96,14);
    var f=Math.max(0,m.hp/30);
    c.fillStyle=f>0.5?'#57d95e':(f>0.25?'#e8c53c':'#e84c3c');
    c.fillRect(2,3,92*f,8);
    m.bar.tex.needsUpdate=true;
  }
  function buildMonsters(){
    var N=14;
    for(var i=0;i<N;i++){
      var a=(i/N)*Math.PI*2+rand()*0.35;
      var r=330+rand()*540;
      var lx=Math.cos(a)*r, lz=Math.sin(a)*r;
      var built=monsterMesh(MONSTER_COLORS[i%MONSTER_COLORS.length]);
      var g=built.grp;
      var wx=CX+lx, wz=CZ+lz;
      g.position.set(wx, groundAt(wx,wz), wz);
      var bar=makeHpBar();
      bar.sp.position.y=2.35; g.add(bar.sp);
      Z.group.add(g);
      var m={grp:g, bodyM:built.bodyM, sprite:built.sprite, bar:bar, hp:30, maxhp:30, alive:true, animT:rand()*0.5, animSet:'', animIdx:-1, atkT:0,
             spawnX:wx, spawnZ:wz, lx:lx, lz:lz, atkCd:0, flashT:0,
             state:'idle', timer:rand()*5, tx:wx, tz:wz, deathT:0, respawnAt:0, fallK:0};
      drawHpBar(m);
      Z.monsters.push(m);
    }
  }
  function damageMonster(m,dmg,src){
    if(!m.alive)return;
    m.hp-=dmg; m.flashT=0.18;
    spawnBurst(m.grp.position.x, m.grp.position.y+1.2, m.grp.position.z);
    drawHpBar(m);
    if(m.hp<=0){
      m.alive=false; m.deathT=Z.time; m.respawnAt=Z.time+20; m.fallK=0;
      var R=refs(); if(R.state){ R.state.exp=(R.state.exp||0)+12; if(R.paint)R.paint(); if(R.save)R.save(); }
      if(window.__ztownLog)window.__ztownLog('monster down ('+src+') +12 EXP');
    }
  }
  function damagePlayer(d){
    var R=refs(), p=R.player;
    if(!R.state||!p)return;
    if(p.guarding>0)d=1;
    R.state.hp=Math.max(0,R.state.hp-d);
    if(R.paint)R.paint();
    if(R.state.hp<=0){
      toast('You fell - the town takes you back to the south gate');
      p.pos.set(CX+SPAWN_LOCAL.x, Z.hC, CZ+SPAWN_LOCAL.z);
      p.velY=0; p.onGround=true;
      if(p.av&&p.av.group)p.av.group.position.copy(p.pos);
      R.state.hp=R.state.maxhp;
      if(R.paint)R.paint();
    }
  }
  function playerFacing(){
    var p=refs().player; if(!p)return {x:0,z:-1};
    return {x:-Math.sin(p.faceY), z:-Math.cos(p.faceY)};
  }
  function doAttack(id){
    if(!Z.active||!Z.built)return;
    var R=refs();
    if(!R.player||(R.phase&&!R.phase()))return;
    if(R.treeOpen&&R.treeOpen())return;
    if(Z.atkCd[id]>0)return;
    var st=null;
    try{ st=R.moveStats?R.moveStats(id):null; }catch(e){}
    if(!st&&R.moves)st={dmg:R.moves[id].dmg,range:R.moves[id].range,cd:R.moves[id].cd,m:R.moves[id]};
    if(!st)return;
    Z.atkCd[id]=st.cd;
    var p=R.player, f=playerFacing();
    var arc=(st.m&&st.m.arc)?st.m.arc:1.9;
    var applyHit=function(){
      for(var i=0;i<Z.monsters.length;i++){
        var m=Z.monsters[i]; if(!m.alive)continue;
        var dx=m.grp.position.x-p.pos.x, dz=m.grp.position.z-p.pos.z;
        var dist=Math.sqrt(dx*dx+dz*dz);
        if(dist>st.range+0.7)continue;
        var dot=(dx*f.x+dz*f.z)/Math.max(0.001,dist);
        var ang=Math.acos(Math.max(-1,Math.min(1,dot)));
        if(ang<=arc/2+0.35){ damageMonster(m, st.dmg, id); if(window.__ztownLog)window.__ztownLog(id+' hit for '+st.dmg+' (hp '+Math.max(0,m.hp)+')'); }
      }
    };
    if(id==='throw'){ setTimeout(applyHit,300); } else { applyHit(); }
  }
  Z.doAttack=doAttack; Z.damageMonster=damageMonster; Z.damagePlayer=damagePlayer;

  /* ---------- B key: home / return toggle ---------- */
  function isTyping(){
    var a=document.activeElement;
    return a&&(a.id==='chat-input'||a.tagName==='INPUT'||a.tagName==='TEXTAREA'||a.tagName==='SELECT');
  }
  function atEspilHouse(p){
    return Math.abs(p.pos.x-(CX+HOME_LOCAL.x))<10 && Math.abs(p.pos.z-(CZ+HOME_LOCAL.z))<9;
  }
  function pressB(){
    var R=refs();
    if(!Z.active||!Z.built||!R.player)return;
    if(R.phase&&!R.phase())return;
    var p=R.player;
    if(atEspilHouse(p)){
      if(Z.savedPoint){
        var s=Z.savedPoint; Z.savedPoint=null;
        p.pos.set(s.x,s.y,s.z); p.faceY=s.faceY; p.velY=0; p.onGround=true;
        if(p.av&&p.av.group){ p.av.group.position.copy(p.pos); p.av.group.rotation.y=s.faceY; }
        toast('Returned');
      }else{
        toast('No return point saved');
      }
    }else{
      Z.savedPoint={x:p.pos.x, y:p.pos.y, z:p.pos.z, faceY:p.faceY};
      p.pos.set(Z.homePoint.x, groundAt(Z.homePoint.x,Z.homePoint.z), Z.homePoint.z);
      p.faceY=Math.PI; p.velY=0; p.onGround=true;
      if(p.av&&p.av.group){ p.av.group.position.copy(p.pos); p.av.group.rotation.y=Math.PI; }
      toast('Home - press B to return');
    }
  }
  Z.pressB=pressB; Z.atEspilHouse=atEspilHouse;

  /* ---------- collision: fence circle + wall segments ---------- */
  function inGateCorridor(lx,lz){
    if(Math.abs(lx)<GATE_HALF&&(lz>200||lz<-200))return true;   /* N / S gates */
    if(Math.abs(lz)<GATE_HALF&&(lx>200||lx<-200))return true;   /* E / W gates */
    return false;
  }
  function resolveFence(p){
    var lx=p.pos.x-CX, lz=p.pos.z-CZ;
    var r=Math.sqrt(lx*lx+lz*lz);
    if(r>230&&r<272&&!inGateCorridor(lx,lz)){
      var prev=Z.prevPlayerR;
      var target=null;
      if(prev!==null&&prev<=FENCE_R)target=FENCE_R-0.62;
      else if(prev!==null&&prev>=FENCE_R)target=FENCE_R+0.62;
      else target=(r<FENCE_R)?FENCE_R-0.62:FENCE_R+0.62;
      if((prev!==null&&prev<=FENCE_R&&r>target)||(prev!==null&&prev>=FENCE_R&&r<target)||(prev===null&&Math.abs(r-FENCE_R)<0.62)){
        var s=target/Math.max(0.001,r);
        p.pos.x=CX+lx*s; p.pos.z=CZ+lz*s;
        lx=p.pos.x-CX; lz=p.pos.z-CZ; r=target;
      }
    }
    Z.prevPlayerR=Math.sqrt((p.pos.x-CX)*(p.pos.x-CX)+(p.pos.z-CZ)*(p.pos.z-CZ));
  }
  function resolveWalls(p){
    var R=0.55;
    for(var pass=0;pass<2;pass++){
      for(var i=0;i<Z.walls.length;i++){
        var w=Z.walls[i];
        var ex=w.bx-w.ax, ez=w.bz-w.az, L2=ex*ex+ez*ez;
        var t=L2>0?((p.pos.x-w.ax)*ex+(p.pos.z-w.az)*ez)/L2:0; t=Math.max(0,Math.min(1,t));
        var qx=w.ax+ex*t, qz=w.az+ez*t;
        var dx=p.pos.x-qx, dz=p.pos.z-qz, d2=dx*dx+dz*dz;
        if(d2<R*R){
          var d=Math.sqrt(d2);
          if(d>1e-5){ p.pos.x=qx+dx/d*R; p.pos.z=qz+dz/d*R; }
          else{ var el=Math.sqrt(L2)||1; p.pos.x=qx+(ez/el)*R; p.pos.z=qz+(-ex/el)*R; }
        }
      }
    }
  }
  /* ---------- per-frame town tick (hooked into updateWalkMap) ---------- */
  function moveNpc(e,dt,speed){
    var dx=e.tx-e.lx, dz=e.tz-e.lz, d=Math.sqrt(dx*dx+dz*dz);
    if(d<0.4)return true;
    var step=Math.min(d,speed*dt);
    e.lx+=dx/d*step; e.lz+=dz/d*step;
    e.grp.position.set(CX+e.lx, groundLocal(e.lx,e.lz), CZ+e.lz);
    e.grp.rotation.y=Math.atan2(-(dx/d),-(dz/d));
    return d-step<0.4;
  }
  function tickNPCs(dt){
    for(var i=0;i<Z.villagers.length;i++){
      var v=Z.villagers[i];
      v.timer-=dt;
      if(v.state==='idle'){ if(v.timer<=0){
        for(var k=0;k<8;k++){ var a=rand()*Math.PI*2, r=15+rand()*215, nx=Math.cos(a)*r, nz=Math.sin(a)*r;
          if(!pointInBuilding(nx,nz,2.5)){ v.tx=nx; v.tz=nz; break; } }
        v.state='walk';
      } }else{
        if(moveNpc(v,dt,v.speed)||v.timer<-25){ v.state='idle'; v.timer=1.5+rand()*3.5; }
      }
      v.grp.position.y=groundLocal(v.lx,v.lz);
    }
    for(var j=0;j<Z.animals.length;j++){
      var an=Z.animals[j];
      an.timer-=dt;
      if(an.state==='idle'){ if(an.timer<=0){
        an.tx=an.area.x0+rand()*(an.area.x1-an.area.x0);
        an.tz=an.area.z0+rand()*(an.area.z1-an.area.z0);
        an.state='walk';
      } }else{
        if(moveNpc(an,dt,an.speed)||an.timer<-30){ an.state='idle'; an.timer=2+rand()*4; }
      }
      if(an.head)an.head.rotation.x=Math.sin(Z.time*1.7+an.phase)*0.13;
      an.grp.position.y=Z.hC;
    }
  }
  function tickMonsters(dt){
    var p=refs().player; if(!p)return;
    for(var i=0;i<Z.monsters.length;i++){
      var m=Z.monsters[i];
      if(m.atkCd>0)m.atkCd-=dt;
      if(m.flashT>0){ m.flashT-=dt; m.bodyM.color.setHex(0xff9a8a); if(m.flashT<=0)m.bodyM.color.setHex(0xffffff); }
      if(m.atkT>0)m.atkT-=dt;
      if(!m.alive){
        if(m.fallK<1){ m.fallK=Math.min(1,m.fallK+dt*2.6); m.grp.rotation.x=-Math.PI/2*m.fallK*0.92;
          setMonsterFrame(m,'hit',Math.min(3,Math.floor(m.fallK*4)));
          m.bodyM.transparent=true; m.bodyM.opacity=1-m.fallK*0.85; }
        else m.grp.visible=false;
        if(Z.time>=m.respawnAt){
          m.alive=true; m.hp=m.maxhp; m.grp.visible=true; m.grp.rotation.x=0;
          m.bodyM.opacity=1; m.bodyM.transparent=false;
          m.grp.position.set(m.spawnX, groundAt(m.spawnX,m.spawnZ), m.spawnZ);
          drawHpBar(m);
        }
        continue;
      }
      var dx=p.pos.x-m.grp.position.x, dz=p.pos.z-m.grp.position.z;
      var dist=Math.sqrt(dx*dx+dz*dz);
      var lx=m.grp.position.x-CX, lz=m.grp.position.z-CZ;
      if(dist<25&&dist>0.01){
        /* chase */
        var sp=Math.min(dist,3.1*dt);
        var nx=m.grp.position.x+dx/dist*sp, nz=m.grp.position.z+dz/dist*sp;
        var nlx=nx-CX, nlz=nz-CZ, nr=Math.sqrt(nlx*nlx+nlz*nlz);
        if(nr<258&&!m.village){ var s=258/Math.max(0.001,nr); nx=CX+nlx*s; nz=CZ+nlz*s; }
        m.grp.position.set(nx, groundAt(nx,nz), nz);
        m.grp.rotation.y=Math.atan2(-(dx/dist),-(dz/dist));
        if(dist<1.7&&m.atkCd<=0){ m.atkCd=1.0; m.atkT=0.42; damagePlayer(5); if(window.__ztownLog)window.__ztownLog('monster hit player (hp '+Math.max(0,(refs().state||{}).hp)+')'); }
      }else{
        m.timer-=dt;
        if(m.timer<=0){ m.timer=5+rand()*5; var a=rand()*Math.PI*2, rr=rand()*14; m.tx=m.spawnX+Math.cos(a)*rr; m.tz=m.spawnZ+Math.sin(a)*rr; }
        var wx2=m.tx-m.grp.position.x, wz2=m.tz-m.grp.position.z, wd=Math.sqrt(wx2*wx2+wz2*wz2);
        if(wd>0.5){
          var sp2=Math.min(wd,0.7*dt);
          var nx2=m.grp.position.x+wx2/wd*sp2, nz2=m.grp.position.z+wz2/wd*sp2;
          var rx=nx2-CX, rz=nz2-CZ, rr2=Math.sqrt(rx*rx+rz*rz);
          if(rr2>=258||m.village){ m.grp.position.set(nx2, groundAt(nx2,nz2), nz2); m.grp.rotation.y=Math.atan2(-(wx2/wd),-(wz2/wd)); }
        }
      }
      /* sprite frame selection: attack > chase (toward the player reads
         as walk_front) > wander by heading vs the player > idle */
      var set='idle';
      if(m.atkT>0)set='attack';
      else if(dist<25)set='walk_front';
      else if(wd>0.5){
        var mvx=wx2/wd, mvz=wz2/wd, tvx=-dx/Math.max(0.01,dist), tvz=-dz/Math.max(0.01,dist);
        var dot=mvx*tvx+mvz*tvz, cross=mvx*tvz-mvz*tvx;
        set=dot>0.5?'walk_back':(dot<-0.5?'walk_front':(cross>0?'walk_left':'walk_right'));
      }
      m.animT+=dt;
      setMonsterFrame(m, set, Math.floor(m.animT*(set==='idle'?3:7))%STRAYER_SETS[set]);
    }
  }
  function setMonsterFrame(m, set, idx){
    if(!m.sprite||(m.animSet===set&&m.animIdx===idx))return;
    m.animSet=set; m.animIdx=idx;
    m.bodyM.map=strayerTex(set, idx+1); m.bodyM.needsUpdate=true;
  }
  function tickRoofs(p){
    var lx=p.pos.x-CX, lz=p.pos.z-CZ;
    for(var i=0;i<Z.buildings.length;i++){
      var b=Z.buildings[i];
      var inside=Math.abs(lx-b.def.x)<b.def.w/2-0.1&&Math.abs(lz-b.def.z)<b.def.d/2-0.1;
      var target=inside?0.12:1;
      var cur=b.roofMat.opacity;
      if(Math.abs(cur-target)>0.02)b.roofMat.opacity=cur+(target-cur)*0.25;
    }
  }
  window.__ztownTick=function(p,dt){
    if(!Z.active||!Z.built||!p)return;
    dt=Math.min(0.05,dt||0.016);
    Z.time+=dt;
    for(var k in Z.atkCd)if(Z.atkCd[k]>0)Z.atkCd[k]-=dt;
    if(window.__zscene&&window.__zscene!=='town'){ tickMonsters(dt); tickFx(dt); return; }
    resolveFence(p);
    resolveWalls(p);
    tickNPCs(dt);
    tickMonsters(dt);
    tickFigures(dt);
    tickFx(dt);
    tickRoofs(p);
    if(!Z.hintDone&&document.body.classList.contains('in-map')){
      Z.hintDone=true;
      var hint=document.getElementById('map-hint');
      if(hint&&hint.textContent.indexOf('B home')<0)hint.textContent+=' \u00B7 B home / return';
    }
  };

  /* ---------- input ---------- */
  document.addEventListener('keydown',function(e){
    if(!Z.active||!Z.built||isTyping())return;
    if(window.__zscene&&window.__zscene!=='town')return;
    if(e.code==='KeyB'){ pressB(); return; }
    var map={KeyQ:'punch',KeyW:'kick',KeyE:'throw'};
    if(map[e.code])doAttack(map[e.code]);
  });
  document.addEventListener('pointerdown',function(e){
    if(!Z.active||!Z.built)return;
    var t=e.target;
    if(t&&t.id&&/^slot-[qwe]$/.test(t.id)){ doAttack({q:'punch',w:'kick',e:'throw'}[t.id.slice(5)]); }
  },true);

  /* ================================================================
     THE BUILT VILLAGE - KayKit Medieval Hexagon Pack (CC0)
     (Han, 2026-10-23: no satellite map - build a village, with the
     assets sourced from itch.io.) Models by Kay Lousberg, KayKit
     Medieval Hexagon Pack 1.0, CC0 - free for any use, no
     attribution required. The pack was chosen on its itch.io page;
     after itch.io's own download endpoint refused direct fetches,
     the files came from the author's official GitHub mirror of the
     same pack and were converted glTF -> GLB for this payload.
     Landmarks join the town's enterable homes: a well by the plaza,
     a market, the blacksmith, a chapel, a tavern, a windmill, a
     lumbermill, two more homes and a watchtower over the south
     gate, dressed with the pack's trees, rocks and props.
     ================================================================ */
  var VILLAGE_BUILDINGS=[
    {f:'village_well',       x:-14,  z:-14,  w:4.5, ry:0.4,  label:'Well'},
    {f:'village_market',     x:38,   z:-8,   w:9,   ry:-1.2, label:'Market'},
    {f:'village_blacksmith', x:-46,  z:-118, w:10,  ry:0.15, label:'Blacksmith'},
    {f:'village_chapel',     x:185,  z:-30,  w:12,  ry:-0.5, label:'Chapel'},
    {f:'village_tavern',     x:-150, z:60,   w:11,  ry:0.9,  label:'Tavern'},
    {f:'village_windmill',   x:-155, z:-150, w:9,   ry:0.7,  label:'Windmill'},
    {f:'village_lumbermill', x:120,  z:-150, w:11,  ry:-0.3, label:'Lumbermill'},
    {f:'village_home_a',     x:-120, z:170,  w:9,   ry:0.2},
    {f:'village_home_b',     x:60,   z:175,  w:9,   ry:-0.15},
    {f:'village_tower',      x:16,   z:222,  w:7,   ry:3.14, label:'Watchtower'}
  ];
  var VILLAGE_NATURE=[
    {f:'village_tree_a', x:30,   z:42,   w:3.4},{f:'village_tree_b', x:-34,  z:58,   w:3.0},
    {f:'village_tree_a', x:88,   z:-22,  w:3.8},{f:'village_tree_b', x:-88,  z:-48,  w:3.2},
    {f:'village_tree_a', x:24,   z:-44,  w:3.0},{f:'village_tree_b', x:-18,  z:108,  w:3.6},
    {f:'village_tree_a', x:132,  z:18,   w:3.4},{f:'village_tree_b', x:-138, z:-18,  w:3.0},
    {f:'village_tree_a', x:48,   z:132,  w:3.8},{f:'village_tree_b', x:-64,  z:-188, w:3.4},
    {f:'village_tree_a', x:172,  z:-64,  w:3.2},{f:'village_tree_b', x:-186, z:112,  w:3.6},
    {f:'village_rock_a', x:95,   z:205,  w:2.6},{f:'village_rock_b', x:-95,  z:215,  w:3.0},
    {f:'village_rock_a', x:205,  z:95,   w:2.8},{f:'village_rock_b', x:-215, z:-95,  w:2.6}
  ];
  var VILLAGE_PROPS=[
    {f:'village_barrel', x:-40, z:-112, w:1.15},{f:'village_barrel', x:-52.5, z:-112, w:1.15},
    {f:'village_crate',  x:33,  z:-1,   w:1.3}, {f:'village_crate',  x:43,   z:-15,  w:1.3},
    {f:'village_sack',   x:35.5,z:-15,  w:1.0}, {f:'village_wheelbarrow', x:113, z:-143, w:1.7},
    {f:'village_tent',   x:205, z:-120, w:4.2, ry:0.8},
    {f:'village_weaponrack', x:9, z:216, w:2.2, ry:3.14}
  ];
  function villagePlace(loader, def, collide){
    loader.load('assets/zealandia/'+def.f+'.glb', function(gltf){
      var o=gltf.scene;
      var bb=new THREE.Box3().setFromObject(o);
      var sx=bb.max.x-bb.min.x, sz=bb.max.z-bb.min.z, sy=bb.max.y-bb.min.y;
      var s=def.w/Math.max(sx,sz);
      o.scale.setScalar(s);
      o.rotation.y=def.ry||0;
      o.position.set(CX+def.x, Z.hC-(bb.min.y*s), CZ+def.z);
      o.traverse(function(n){ if(n.isMesh){ n.frustumCulled=false; n.castShadow=true; } });
      Z.group.add(o);
      Z.villageCount=(Z.villageCount||0)+1;
      if(def.label){
        var lb=textSprite(def.label, 4.2, '#ffe9c9');
        lb.position.set(CX+def.x, Z.hC+sy*s+0.9, CZ+def.z);
        Z.group.add(lb);
      }
      if(collide){
        var hw=sx*s/2*0.92, hd=sz*s/2*0.92, ry=def.ry||0, c=Math.cos(ry), sn=Math.sin(ry);
        var cs=[[-hw,-hd],[hw,-hd],[hw,hd],[-hw,hd]];
        for(var i=0;i<4;i++){
          var a=cs[i], b=cs[(i+1)%4];
          addWallSeg(def.x+a[0]*c+a[1]*sn, def.z-a[0]*sn+a[1]*c, def.x+b[0]*c+b[1]*sn, def.z-b[0]*sn+b[1]*c);
        }
      }
    }, undefined, function(){});
  }
  function buildVillageAssets(){
    if(Z.villageStarted)return; Z.villageStarted=true;
    figureLoader(function(loader){
      if(!loader)return;
      VILLAGE_BUILDINGS.forEach(function(d){ villagePlace(loader, d, true); });
      VILLAGE_NATURE.forEach(function(d){ villagePlace(loader, d, false); });
      VILLAGE_PROPS.forEach(function(d){ villagePlace(loader, d, false); });
    });
  }

  /* ================================================================
     Produced figures in the town: the two masters at the Espil House
     yard (Ahi = the fire master's model, Huka = the ice master's),
     and Hermes roaming the continent at giant scale, never aggroed.
     Plus the skill-burst hit FX (produced ability frames).
     ================================================================ */
  var FIG={masters:[], hermes:null, hermesA:2.2, loaded:false};
  Z.figures=FIG;
  function figureLoader(cb){
    if(!THREE.GLTFLoader){ cb(null); return; }
    var loader=new THREE.GLTFLoader();
    if(window.MeshoptDecoder){ try{ loader.setMeshoptDecoder(window.MeshoptDecoder); }catch(e){} cb(loader); }
    else {
      import(DECODER_URL).then(function(m){
        window.MeshoptDecoder=m.MeshoptDecoder;
        return window.MeshoptDecoder.ready;
      }).then(function(){ try{ loader.setMeshoptDecoder(window.MeshoptDecoder); }catch(e){} cb(loader); })
      .catch(function(){ cb(loader); });
    }
  }
  function buildFigures(){
    if(FIG.loaded)return; FIG.loaded=true;
    figureLoader(function(loader){
      if(!loader)return;
      var masters=[
        {f:'ahi',  name:'Ahi · Master of Fire', lx:-13, lz:-52, ry:0.12},
        {f:'huka', name:'Huka · Master of Ice', lx:13,  lz:-52, ry:-0.12}
      ];
      masters.forEach(function(md){
        loader.load('assets/zealandia/'+md.f+'.glb', function(gltf){
          var o=gltf.scene;
          o.position.set(CX+md.lx, Z.hC, CZ+md.lz);
          o.rotation.y=md.ry;
          o.traverse(function(n){ if(n.isMesh)n.frustumCulled=false; });
          Z.group.add(o);
          var label=textSprite(md.name, 3.4, '#ffe9c9');
          label.position.set(CX+md.lx, Z.hC+2.05, CZ+md.lz);
          Z.group.add(label);
          FIG.masters.push({obj:o, baseRy:md.ry, phase:rand()*6.28});
        }, undefined, function(){});
      });
      loader.load('assets/zealandia/hermes.glb', function(gltf){
        var o=gltf.scene;
        o.scale.setScalar(6);
        o.traverse(function(n){ if(n.isMesh)n.frustumCulled=false; });
        Z.group.add(o);
        var H={obj:o, mixer:null, clips:{}};
        if(gltf.animations&&gltf.animations.length){
          H.mixer=new THREE.AnimationMixer(o);
          gltf.animations.forEach(function(c){ H.clips[c.name]=H.mixer.clipAction(c); });
          if(H.clips.Walk)H.clips.Walk.play();
          else if(H.clips.Idle)H.clips.Idle.play();
        }
        FIG.hermes=H;
      }, undefined, function(){});
    });
  }
  function tickFigures(dt){
    for(var i=0;i<FIG.masters.length;i++){
      var m=FIG.masters[i];
      m.obj.rotation.y=m.baseRy+Math.sin(Z.time*0.55+m.phase)*0.05;
    }
    var H=FIG.hermes;
    if(H&&H.obj){
      FIG.hermesA+=dt*(16/1050);
      var hx=CX+Math.cos(FIG.hermesA)*1050, hz=CZ+Math.sin(FIG.hermesA)*1050;
      H.obj.position.set(hx, groundAt(hx,hz), hz);
      H.obj.rotation.y=Math.atan2(-Math.sin(FIG.hermesA), Math.cos(FIG.hermesA));
      if(H.mixer)H.mixer.update(dt);
    }
  }

  /* ---------- hit FX: produced Ice Burst frames ---------- */
  var _burstTex=null;
  function burstTex(i){
    if(!_burstTex){ _burstTex=[]; for(var k=1;k<=9;k++)_burstTex.push(new THREE.TextureLoader().load('assets/zealandia/fx/burst/'+k+'.png')); }
    return _burstTex[i];
  }
  Z.fx=[];
  function spawnBurst(x,y,z){
    if(!Z.group)return;
    var m=new THREE.SpriteMaterial({map:burstTex(0), transparent:true, depthWrite:false});
    var sp=new THREE.Sprite(m);
    sp.position.set(x,y,z); sp.scale.set(1.4,1.4,1);
    Z.group.add(sp);
    Z.fx.push({sp:sp, life:0});
    if(Z.fx.length>24){ var old=Z.fx.shift(); Z.group.remove(old.sp); old.sp.material.dispose(); }
  }
  function tickFx(dt){
    for(var i=Z.fx.length-1;i>=0;i--){
      var f=Z.fx[i]; f.life+=dt;
      var k=f.life/0.45;
      if(k>=1){ Z.group.remove(f.sp); f.sp.material.dispose(); Z.fx.splice(i,1); continue; }
      f.sp.material.map=burstTex(Math.min(8, Math.floor(k*9)));
      f.sp.material.needsUpdate=true;
      var sc=1.4+k*1.5; f.sp.scale.set(sc,sc,1);
      f.sp.material.opacity=1-k*0.7;
    }
  }

  /* ---------- minimap: 3D terrain view (replaces the Leaflet map in town) ---------- */
  var MM={on:false, ready:false, renderer:null, scene:null, cam:null, patch:null, arrow:null, canvas:null, raf:0, cx:1e9, cz:1e9};
  var MM_WIN=680, MM_SEG=44;
  function minimapBuild(){
    var leaf=document.getElementById('minimap');
    if(!leaf||!leaf.parentElement)return false;
    var cv=document.createElement('canvas');
    cv.id='ztown-minimap';
    cv.style.cssText='position:absolute;inset:0;width:100%;height:100%;display:none;z-index:5;';
    if(getComputedStyle(leaf.parentElement).position==='static')leaf.parentElement.style.position='relative';
    leaf.parentElement.appendChild(cv);
    MM.canvas=cv;
    MM.renderer=new THREE.WebGLRenderer({canvas:cv,antialias:true,alpha:true});
    MM.scene=new THREE.Scene();
    MM.cam=new THREE.PerspectiveCamera(52,1,1,4000);
    MM.scene.add(new THREE.AmbientLight(0xffffff,1.2));
    var dl=new THREE.DirectionalLight(0xffffff,0.6); dl.position.set(120,260,60); MM.scene.add(dl);
    var g=new THREE.BufferGeometry();
    var n=(MM_SEG+1)*(MM_SEG+1);
    g.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(n*3),3));
    g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(n*2),2));
    var idx=[];
    for(var r=0;r<MM_SEG;r++)for(var c=0;c<MM_SEG;c++){ var a=r*(MM_SEG+1)+c,b=a+1,d=a+MM_SEG+1,e=d+1; idx.push(a,d,b,b,d,e); }
    g.setIndex(idx);
    MM.patch=new THREE.Mesh(g,new THREE.MeshLambertMaterial({color:0x87995f}));
    MM.patch.frustumCulled=false;
    MM.scene.add(MM.patch);
    var ringPts=[];
    for(var i=0;i<=72;i++){ var a2=i/72*Math.PI*2; ringPts.push(new THREE.Vector3(CX+Math.cos(a2)*FENCE_R,Z.hC+2.5,CZ+Math.sin(a2)*FENCE_R)); }
    var ring=new THREE.Line(new THREE.BufferGeometry().setFromPoints(ringPts),new THREE.LineBasicMaterial({color:0xffd76e}));
    ring.frustumCulled=false;
    MM.scene.add(ring);
    var coneGeo=new THREE.ConeGeometry(7,22,4); coneGeo.rotateX(-Math.PI/2);
    MM.arrow=new THREE.Mesh(coneGeo,new THREE.MeshBasicMaterial({color:0xffe23c}));
    MM.arrow.frustumCulled=false;
    MM.scene.add(MM.arrow);
    MM.ready=true;
    return true;
  }
  function minimapPatch(cx,cz){
    var posA=MM.patch.geometry.attributes.position, uvA=MM.patch.geometry.attributes.uv;
    var half=MM_WIN/2, step=MM_WIN/MM_SEG, k=0, k2=0;
    for(var r=0;r<=MM_SEG;r++)for(var c=0;c<=MM_SEG;c++){
      var wx=cx-half+c*step, wz=cz-half+r*step;
      posA.array[k++]=wx; posA.array[k++]=groundAt(wx,wz)+0.4; posA.array[k++]=wz;
      uvA.array[k2++]=(wx-CX+5000)/10000; uvA.array[k2++]=(5000-(wz-CZ))/10000;
    }
    posA.needsUpdate=true; uvA.needsUpdate=true;
    MM.patch.geometry.computeVertexNormals();
    MM.cx=cx; MM.cz=cz;
  }
  function minimapFrame(){
    if(!MM.on)return;
    MM.raf=requestAnimationFrame(minimapFrame);
    var R=refs(), p=R.player; if(!p||!p.pos)return;
    var host=MM.canvas.parentElement;
    var w=(host&&host.clientWidth)||160, h=(host&&host.clientHeight)||w;
    if(MM.canvas.width!==Math.round(w*1.5)||MM.canvas.height!==Math.round(h*1.5)){
      MM.renderer.setPixelRatio(1.5); MM.renderer.setSize(w,h,false);
      MM.cam.aspect=w/h; MM.cam.updateProjectionMatrix();
    }
    if(Math.abs(p.pos.x-MM.cx)>40||Math.abs(p.pos.z-MM.cz)>40)minimapPatch(p.pos.x,p.pos.z);
    var gy=p.pos.y||groundAt(p.pos.x,p.pos.z);
    MM.arrow.position.set(p.pos.x,gy+13,p.pos.z);
    MM.arrow.rotation.y=p.faceY||0;
    MM.cam.position.set(p.pos.x,gy+330,p.pos.z+225);
    MM.cam.lookAt(p.pos.x,gy,p.pos.z);
    MM.renderer.render(MM.scene,MM.cam);
  }
  function minimapSync(on){
    var leaf=document.getElementById('minimap');
    if(on){
      if(!MM.ready&&!minimapBuild())return;
      if(leaf)leaf.style.visibility='hidden';
      MM.canvas.style.display='block';
      if(!MM.on){ MM.on=true; MM.cx=1e9; minimapFrame(); }
    }else{
      if(leaf)leaf.style.visibility='';
      if(MM.canvas)MM.canvas.style.display='none';
      MM.on=false;
      if(MM.raf)cancelAnimationFrame(MM.raf);
    }
  }
  Z.minimap=MM; Z.minimapSync=minimapSync;

  /* ---------- build orchestration ---------- */
  function build(){
    if(Z.buildStarted)return; Z.buildStarted=true;
    fetch('assets/zealandia/auckland_heights.json').then(function(r){return r.json();}).then(function(doc){
      Z.heights=Float32Array.from(doc.heights);
      Z.hC=doc.townCenterHeightM;
      var wait=setInterval(function(){
        var R=refs();
        if(!R.scene)return; /* published from inside the engine closure by the index tick patch */
        clearInterval(wait);
        Z.group=new THREE.Group(); Z.group.name='zealandia-town';
        R.scene.add(Z.group);
        buildTerrain();
        buildPlazaPaths();
        buildFence();
        for(var i=0;i<HOUSE_DEFS.length;i++)buildHouse(HOUSE_DEFS[i],false);
        buildEspilHouse();
        buildStalls();
        buildPens();
        buildVillageAssets();
        buildTrees();
        buildVillagers();
        buildAnimals();
        buildMonsters();
        buildFigures();
        Z.built=true;
        console.log('[Zealandia] town built: '+Z.buildings.length+' buildings, fence posts '+Z.fencePosts+', rails '+Z.fenceRails+', trees '+Z.trees+', villagers '+Z.villagers.length+', animals '+Z.animals.length+', monsters '+Z.monsters.length+', terrain centre '+Z.hC+' m');
      },200);
    }).catch(function(e){ console.warn('[Zealandia] heights load failed',e); });
  }
  Z.build=build;
  Z.refs=refs;
  Z.player=function(){ return refs().player||null; };
  window.__ztownEnsure=build;
  Z.homeLocal=HOME_LOCAL; Z.spawnLocal=SPAWN_LOCAL; Z.center={x:CX,z:CZ};
  setInterval(function(){
    var on=(typeof window.__espilCityKey!=='undefined'&&window.__espilCityKey==='zealandia');
    Z.active=on;
    window.__ztownActive=on&&Z.built;
    if(on)build();
    if(on&&Z.built){
      var R=refs(), p=R.player;
      if(p&&p.pos){
        var dx=p.pos.x-CX, dz=p.pos.z-CZ;
        if(Math.sqrt(dx*dx+dz*dz)>4900){
          /* a stale save or a wrong-place entry left the player outside
             the town disc (standing in the Auckland map, character lost):
             bring them to the town spawn, grounded and visible. */
          p.pos.set(CX+SPAWN_LOCAL.x, groundAt(CX+SPAWN_LOCAL.x,CZ+SPAWN_LOCAL.z), CZ+SPAWN_LOCAL.z);
          p.velY=0; p.onGround=true;
          if(p.av&&p.av.group)p.av.group.position.copy(p.pos);
        }
      }
      minimapSync(true);
    }else{
      minimapSync(false);
    }
  },400);
})();
