/* ================================================================
   ZEALANDIA GLOBE VIEW - NDC2011 "에버플래닛의 글로브뷰 렌더링"
   (김이선/Neople), designated by Han (2026-10-24) as the map view
   Zealandia mimics. Implemented the same day on Han's direct order.

   THE LAW (from the deck):
   - World data, physics, collision and game logic stay FLAT.
     The curve is a render-time distortion only.
   - Between World Space and View Space sits Globe Space: in the
     VERTEX SHADER the ground drops away from the pole as
         drop = K * d^2          (Quadratic - the game view;
                                  Spherical is NOT used)
     where d is the horizontal distance from the pole.
   - The pole FOLLOWS the player, so the drop is 0 underfoot.
   - The sky meets the curved horizon; the horizon-keeping camera
     applies its compensation at only 70% (CAM_RULE below).
   - Picking inverts the transform. In this engine, interaction is
     proximity-based (no raycast picking in the map), and every
     CPU-side placement already reads the same law through the
     engine's CPU mirror, window.__espilCurveProbe(x, z) - which is
     the inverse this module's sprite anchoring also uses.

   HOW IT RIDES THE ENGINE: the engine already bends its map world
   with this exact law (curveShader / curvePatch in index.html,
   one shared curveStrength read by every patched shader AND the
   CPU mirror). This module therefore does NOT add a second curve:
   1. it drives the ONE constant to the Zealandia value while a
      Zealandia instance is active (window.__espilSetCurveK), and
      restores the map world's own constant on exit;
   2. it sweeps the Zealandia scene graphs (town, villages, fields,
      dungeons, the Auckland quest set) and curve-patches every
      material the modules created on their own - GLB buildings,
      Lambert/Basic geometry - through the engine's own patcher
      (window.__ztownRefs.curve), so everything bends by one field;
   3. sprites cannot take the vertex patch (their shader has no
      project_vertex), so per the deck they are ANCHORED at their
      warped ground points on the CPU: each frame a registered
      sprite's local Y is offset by -curveDropAt(its world XZ);
   4. it feeds the follow camera its horizon compensation through
      window.__zglobeCamComp (radians), which the engine adds to
      the fixed camera pitch only while this module supplies it.

   TUNING (Han): GLOBE_K below is THE curvature knob - one place.
   Start value = the map room's reference peeks (0.00312, about
   7.8 m of drop at 50 m). Live from the console without reload:
       __zglobe.setK(0.002)      __zglobe.setCamRule(0.5)
   ================================================================ */
(function(){
  'use strict';

  /* ---------- Han's tuning points (one place) ---------- */
  var GLOBE_K   = 0.00312;  /* drop = GLOBE_K * d^2, metres */
  var CAM_RULE  = 0.7;      /* deck: horizon compensation applied at 70% */
  var CAM_FOCUS = 80;       /* m: ground focus distance for the compensation */
  var ENGINE_K  = 0.0014;   /* the map world's own constant (Han 2026-10-16) */

  var appliedK = null;      /* K currently written into the engine, or null */
  var camComp  = 0;         /* smoothed compensation, radians */
  var sprites  = [];        /* { sp, baseY } CPU-anchored sprites */
  var tmpV     = null;      /* THREE.Vector3, lazy (THREE loads before us) */

  window.__zglobeCamComp = 0;
  window.__zglobe = {
    k: function(){ return GLOBE_K; },
    setK: function(k){ if(k>0&&k<0.05){ GLOBE_K=k; appliedK=null; } return GLOBE_K; },
    camRule: function(){ return CAM_RULE; },
    setCamRule: function(r){ if(r>=0&&r<=1)CAM_RULE=r; return CAM_RULE; },
    sprites: sprites,
    state: function(){ return { k: GLOBE_K, appliedK: appliedK, camComp: camComp, spriteCount: sprites.length }; }
  };

  function refs(){ return window.__ztownRefs || {}; }
  function inZealandia(){ return window.__espilCityKey === 'zealandia'; }

  /* ---------- scene roots owned by the Zealandia modules ---------- */
  function roots(){
    var out = [];
    var Z = window.__ztown; if (Z && Z.group) out.push(Z.group);
    var V = window.__zvillages;
    if (V){
      if (V.groups) for (var key in V.groups){ if (V.groups[key]) out.push(V.groups[key]); }
      if (V.registry) for (var i=0;i<V.registry.length;i++){ if (V.registry[i].group) out.push(V.registry[i].group); }
    }
    var sc = refs().scene;
    if (sc && sc.getObjectByName){ var aq = sc.getObjectByName('auckland-quest'); if (aq) out.push(aq); }
    return out;
  }

  /* ---------- material sweep + sprite registry ---------- */
  function sweep(){
    var patch = refs().curve; if (!patch) return;
    roots().forEach(function(root){
      root.traverse(function(o){
        if (o.isSprite){
          for (var i=0;i<sprites.length;i++) if (sprites[i].sp === o) return;
          sprites.push({ sp: o, baseY: o.position.y });
        } else if (o.isMesh && o.material){
          var mats = Array.isArray(o.material) ? o.material : [o.material];
          for (var j=0;j<mats.length;j++){
            var m = mats[j];
            if (!m || m.isSpriteMaterial || m.isShaderMaterial) continue;
            try { patch(m); } catch(e){}
          }
        }
      });
    });
    /* forget sprites that left the world (scene rebuilt) */
    for (var k=sprites.length-1;k>=0;k--){
      var n = sprites[k].sp, alive = false;
      while (n){ if (n.isScene){ alive = true; break; } n = n.parent; }
      if (!alive) sprites.splice(k,1);
    }
  }

  /* ---------- per-frame: sprite anchoring + camera compensation ---------- */
  function frame(){
    requestAnimationFrame(frame);
    var probe = window.__espilCurveProbe;
    /* sprites: anchor at the warped ground point (deck) */
    if (probe && sprites.length){
      if (!tmpV && window.THREE) tmpV = new THREE.Vector3();
      if (tmpV){
        for (var i=0;i<sprites.length;i++){
          var r = sprites[i];
          r.sp.getWorldPosition(tmpV);
          var drop = probe(tmpV.x, tmpV.z);
          if (drop > 0.001 || r.sp.position.y !== r.baseY) r.sp.position.y = r.baseY - drop;
        }
      }
    }
    /* camera: compensation = CAM_RULE x the horizon-fall angle at the
       focus distance, read through the same law the shaders use, so
       it follows the entry-dive ramp and K changes automatically. */
    var target = 0;
    if (inZealandia() && probe){
      var a = refs().player && refs().player.pos;
      if (a){
        /* probe a point CAM_FOCUS metres from the pole: its drop over
           that distance is the horizon's fall angle */
        var anchor = window.__espilCurveAnchor ? window.__espilCurveAnchor() : { x: a.x, z: a.z };
        var fd = probe(anchor.x + CAM_FOCUS, anchor.z);
        target = CAM_RULE * Math.atan2(fd, CAM_FOCUS);
      }
    }
    camComp += (target - camComp) * 0.08;
    if (Math.abs(camComp) < 0.0004 && target === 0) camComp = 0;
    window.__zglobeCamComp = camComp;
  }

  /* ---------- K driver + sweep cadence ---------- */
  setInterval(function(){
    var setK = window.__espilSetCurveK; if (!setK) return;
    if (inZealandia()){
      if (appliedK !== GLOBE_K){ setK(GLOBE_K); appliedK = GLOBE_K; }
    } else if (appliedK !== null){
      setK(ENGINE_K); appliedK = null;
    }
    sweep();
  }, 600);

  requestAnimationFrame(frame);
})();
