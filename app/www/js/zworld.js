/* Zealandia world module for the espil.online engine (app build).
   Han's direction (2026-10-24): UI, the 3D character, game logic and
   hotkeys are espil.online's own - this module changes NONE of them.
   It only replaces the SCENERY once Auckland is entered with the swap
   armed: Auckland's generated city is hidden, and the Zealandia world
   is built in the same space from the village editor's data -
     - one continuous PAINTED ground (not a tile grid),
     - every placement a 2D sprite, cleanly cut out,
     - passability from the sprites' own alpha: where a sprite is
       transparent at its base (a gate's opening, a tree's canopy),
       the player walks through; only opaque base runs collide,
     - the Globe View bend (NDC2011 deck) applied to the module's
       world only. The pole is the player, so at the player the drop
       is zero - the engine's avatar and camera need no bend, and
       ground, sprites and character agree by construction. */
(function () {
  'use strict';
  if (window.__zworld) return;

  var EXTENT = 300;                 /* villages are 600 m across */
  var K = 0.00312;                  /* deck peek constant; Han tunes */
  var armed = false;
  try { armed = sessionStorage.getItem('espil_zswap') === '1'; } catch (e) {}
  if (!armed) { window.__zworld = { inactive: true }; return; }

  var Z = {
    active: false, building: false, group: null, ground: null,
    groundPos: null, sprites: [], shadows: [], map: null, palette: {},
    portal: null, promptOn: false, hidden: [], OX: 0, OZ: 0,
    settleT: 0, guardUntil: 0
  };

  function refs() { return window.__zrefs || null; }
  function dropAt(x, z) {
    var r = refs(); if (!r || !r.player) return 0;
    var dx = x - r.player.pos.x, dz = z - r.player.pos.z;
    return K * (dx * dx + dz * dz);
  }
  function rng(seed) {
    var t = seed >>> 0;
    return function () { t = (t * 1664525 + 1013904223) >>> 0; return t / 4294967296; };
  }
  function loadImage(src) {
    return new Promise(function (res, rej) {
      var im = new Image();
      im.onload = function () { res(im); };
      im.onerror = function () { rej(new Error(src)); };
      im.src = src;
    });
  }

  /* ---------- the painted ground (one continuous illustration) ---- */
  function paintGround(map) {
    var RES = 6, SIZE = EXTENT * 2 * RES;
    var cv = document.createElement('canvas');
    cv.width = cv.height = SIZE;
    var gg = cv.getContext('2d');
    var R = rng(90210);
    var S = map.tileSizeM || 10;
    gg.fillStyle = '#7c9a52'; gg.fillRect(0, 0, SIZE, SIZE);
    var tones = ['#86a657', '#74924a', '#8fae5e', '#6d8c46', '#93a95c', '#7f9c50'];
    for (var i = 0; i < 900; i++) {
      var bx = R() * SIZE, by = R() * SIZE, br = 60 + R() * 300;
      var rg = gg.createRadialGradient(bx, by, 0, bx, by, br);
      var c = tones[(R() * tones.length) | 0];
      rg.addColorStop(0, c + '2e'); rg.addColorStop(1, c + '00');
      gg.fillStyle = rg; gg.beginPath(); gg.arc(bx, by, br, 0, 7); gg.fill();
    }
    for (var j = 0; j < 26000; j++) {
      var gx = R() * SIZE, gy = R() * SIZE, gl = 2 + R() * 5;
      gg.strokeStyle = R() > 0.5 ? 'rgba(70,95,40,0.13)' : 'rgba(190,205,130,0.11)';
      gg.lineWidth = 1.4;
      gg.beginPath(); gg.moveTo(gx, gy); gg.lineTo(gx + (R() * 2 - 1), gy - gl); gg.stroke();
    }
    function pathTexture(kind) {
      var c2 = document.createElement('canvas'); c2.width = c2.height = 512;
      var x = c2.getContext('2d');
      var RR = rng(kind.length * 131 + 7);
      var palettes = {
        'village-road': ['#b3985e', '#a98f56', '#c0a468', '#9c814c'],
        'paved-road': ['#8d9094', '#83868b', '#979a9e', '#7a7d82'],
        'grass-road': ['#93a05e', '#8a9858', '#9da868', '#84924f'],
        'water': ['#5d84a6', '#557b9c', '#678fb2', '#4f7394']
      };
      var pal = palettes[kind] || palettes['village-road'];
      x.fillStyle = pal[0]; x.fillRect(0, 0, 512, 512);
      for (var i2 = 0; i2 < 240; i2++) {
        var px = RR() * 512, py = RR() * 512, pr = 14 + RR() * 62;
        var rg2 = x.createRadialGradient(px, py, 0, px, py, pr);
        var cc = pal[(RR() * pal.length) | 0];
        rg2.addColorStop(0, cc + '55'); rg2.addColorStop(1, cc + '00');
        x.fillStyle = rg2; x.beginPath(); x.arc(px, py, pr, 0, 7); x.fill();
      }
      for (var j2 = 0; j2 < 5200; j2++) {
        x.fillStyle = RR() > 0.5 ? 'rgba(60,48,28,0.10)' : 'rgba(255,246,220,0.09)';
        x.fillRect(RR() * 512, RR() * 512, 1.6, 1.6);
      }
      if (kind === 'paved-road') {
        x.strokeStyle = 'rgba(52,54,58,0.16)'; x.lineWidth = 2;
        for (var k2 = 0; k2 < 26; k2++) {
          x.beginPath();
          var sx = RR() * 512, sy = RR() * 512;
          x.moveTo(sx, sy); x.lineTo(sx + 30 + RR() * 70, sy + (RR() * 22 - 11)); x.stroke();
        }
      }
      return c2;
    }
    ['village-road', 'paved-road', 'grass-road', 'water'].forEach(function (kind) {
      var cells = Object.keys(map.tiles || {}).filter(function (k) { return map.tiles[k] === kind; });
      if (!cells.length) return;
      var layer = document.createElement('canvas'); layer.width = layer.height = SIZE;
      var lx = layer.getContext('2d');
      cells.forEach(function (k) {
        var parts = k.split(',');
        lx.fillRect((+parts[0] * S + EXTENT) * RES, (+parts[1] * S + EXTENT) * RES, S * RES, S * RES);
      });
      var edge = document.createElement('canvas'); edge.width = edge.height = SIZE;
      var ex = edge.getContext('2d');
      ex.filter = 'blur(7px)'; ex.drawImage(layer, 0, 0); ex.filter = 'none';
      ex.globalCompositeOperation = 'source-in';
      ex.fillStyle = kind === 'water' ? 'rgba(40,70,100,0.55)' : 'rgba(84,70,42,0.5)';
      ex.fillRect(0, 0, SIZE, SIZE);
      gg.drawImage(edge, 0, 0);
      var inner = document.createElement('canvas'); inner.width = inner.height = SIZE;
      var ix = inner.getContext('2d');
      ix.filter = 'blur(3px)'; ix.drawImage(layer, 0, 0); ix.filter = 'none';
      ix.globalCompositeOperation = 'source-in';
      ix.fillStyle = ix.createPattern(pathTexture(kind), 'repeat');
      ix.fillRect(0, 0, SIZE, SIZE);
      gg.drawImage(inner, 0, 0);
    });
    for (var u = 0; u < 200; u++) {
      var ux = R() * SIZE, uy = R() * SIZE, ur = 140 + R() * 420;
      var ug = gg.createRadialGradient(ux, uy, 0, ux, uy, ur);
      ug.addColorStop(0, R() > 0.5 ? 'rgba(216,198,142,0.05)' : 'rgba(80,104,54,0.055)');
      ug.addColorStop(1, 'rgba(0,0,0,0)');
      gg.fillStyle = ug; gg.beginPath(); gg.arc(ux, uy, ur, 0, 7); gg.fill();
    }
    return cv;
  }

  /* ---- alpha passability: opaque runs in the sprite's base band -- */
  function baseRuns(img) {
    var w = img.width, h = img.height;
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    var data;
    try { data = x.getImageData(0, 0, w, h).data; } catch (e) { return null; }
    var y0 = Math.floor(h * 0.80), runs = [], start = -1;
    for (var col = 0; col < w; col++) {
      var opaque = false;
      for (var row = y0; row < h; row += 2) {
        if (data[(row * w + col) * 4 + 3] > 128) { opaque = true; break; }
      }
      if (opaque && start < 0) start = col;
      if (!opaque && start >= 0) { if (col - start >= 3) runs.push([start / w, col / w]); start = -1; }
    }
    if (start >= 0 && w - start >= 3) runs.push([start / w, 1]);
    return runs;
  }

  /* ---------- build the world ------------------------------------- */
  /* Town music (BGM room delivery, 2026-10-24; Han's final rule the
     same day): ALL of Han's music loops as a SET at volume 0.3 -
     tracks play in order and the set repeats; no one-shot rule, no
     separate quiet track. Fades (4 s) and the music toggle behave as
     in the engine (the toggle is mirrored via currentTrack()). The
     engine's own city-theme slot is cancelled at build - it was
     armed for the borrowed city during entry. The Auckland track
     joins SET when its capture is delivered. */
  var SET = ['assets/zealandia/bgm/waitemata.mp3'];
  var MUSIC = { audio: null, idx: -1, started: false };
  function fadeAudio(a, target, done) {
    if (!a) return;
    if (a.__zfade) clearInterval(a.__zfade);
    var from = a.volume, t0 = performance.now();
    a.__zfade = setInterval(function () {
      var f = Math.min(1, (performance.now() - t0) / 4000);
      try { a.volume = from + (target - from) * f; } catch (e) {}
      if (f >= 1) { clearInterval(a.__zfade); a.__zfade = null; if (done) done(); }
    }, 100);
  }
  function playWithGestureFallback(a, after) {
    var pr = a.play();
    if (pr && pr.catch) pr.catch(function () {
      var retry = function () {
        window.removeEventListener('pointerdown', retry);
        window.removeEventListener('keydown', retry);
        var p2 = a.play(); if (p2 && p2.catch) p2.catch(function () {});
        if (after) after();
      };
      window.addEventListener('pointerdown', retry);
      window.addEventListener('keydown', retry);
      return;
    });
    if (after) after();
  }
  function musicNext() {
    if (!SET.length) return;
    MUSIC.idx = (MUSIC.idx + 1) % SET.length;
    var a = new Audio(SET[MUSIC.idx]);
    a.loop = false; a.volume = 0;
    MUSIC.audio = a;
    a.addEventListener('ended', function () { musicNext(); });
    playWithGestureFallback(a, function () { fadeAudio(a, 0.3); });
  }
  function themeArm() {
    try { if (window.EspilAudio && window.EspilAudio.onMapExit) window.EspilAudio.onMapExit(); } catch (e) {}
    if (!MUSIC.started) { MUSIC.started = true; musicNext(); }
    Z.music = MUSIC;
  }
  function themeMirrorToggle() {
    if (!MUSIC.audio || !window.EspilAudio || !window.EspilAudio.currentTrack) return;
    var muted = false;
    try { muted = !!window.EspilAudio.currentTrack().muted; } catch (e) { return; }
    var a = MUSIC.audio;
    if (muted && !a.paused) { try { a.pause(); } catch (e) {} }
    else if (!muted && MUSIC.started && a.paused && !a.ended) {
      var pr = a.play(); if (pr && pr.catch) pr.catch(function () {});
      if (a.volume < 0.29) fadeAudio(a, 0.3);
    }
  }

  /* the host page warns that no Mapbox token is configured - true
     and irrelevant here: the swapped world hides the map entirely,
     so the warning must not hang over the village */
  /* hidden-land rule: while the swapped world is live, no engine
     surface may name the borrowed city - the land is Unknown Land */
  function watchCityName(el) {
    if (!el || el.__zwatched) return;
    el.__zwatched = true;
    new MutationObserver(function () {
      if (el.textContent.indexOf('Auckland') >= 0)
        el.textContent = el.textContent.split('Auckland').join('Unknown Land');
    }).observe(el, { childList: true, characterData: true, subtree: true });
  }
  function scrubCityName() {
    ['city-phase-name', 'city-intro-name', 'city-message'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) {
        watchCityName(el);
        if (el.textContent.indexOf('Auckland') >= 0)
          el.textContent = el.textContent.split('Auckland').join('Unknown Land');
      }
    });
    var msgs = document.querySelectorAll('.chat-msg.sys');
    for (var i = 0; i < msgs.length; i++) {
      if (msgs[i].textContent.indexOf('Auckland') >= 0)
        msgs[i].textContent = msgs[i].textContent.split('Auckland').join('Unknown Land');
    }
  }

  function hideTokenBanner() {
    var ds = document.body ? document.body.querySelectorAll('div') : [];
    for (var i = 0; i < ds.length; i++) {
      var t = ds[i].textContent || '';
      if (t.indexOf('No Mapbox token') === 0 || t.indexOf('Could not load the Mapbox') === 0) ds[i].style.display = 'none';
    }
  }

  function build() {
    var r = refs(); if (!r || !r.scene || Z.building || Z.active) return;
    Z.building = true;
    Promise.all([
      fetch('assets/zealandia/maps/waitemata.json').then(function (x) { return x.json(); }),
      fetch('assets/zealandia/sprites.json').then(function (x) { return x.json(); })
    ]).then(function (res) {
      var map = res[0]; Z.map = map;
      var byId = {};
      (res[1].sprites || []).forEach(function (e) { byId[e.id] = e; });
      var need = {};
      (map.placements || []).forEach(function (p) { need[p.asset] = 1; });
      var jobs = Object.keys(need).map(function (id) {
        var e = byId[id]; if (!e) return Promise.resolve();
        var path = e.image ? e.image.replace(/^assets\//, 'assets/zealandia/')
          : (e.file ? 'assets/zealandia/' + e.file : null);
        if (!path) return Promise.resolve();
        return loadImage(path).then(function (im) {
          Z.palette[id] = { img: im, w: e.defaultW || 2, runs: baseRuns(im) };
        }).catch(function () {});
      });
      return Promise.all(jobs).then(function () { return map; });
    }).then(function (map) {
      var r2 = refs(); if (!r2) return;
      var scene = r2.scene;
      var THREE = window.THREE;
      /* Live cities live at their own world anchor (Auckland's spawn
         sits near (10303,-1002)), not at the origin. The Zealandia
         world is built AROUND that anchor: the map's own coordinates
         stay clean and the module translates by (OX, OZ). */
      Z.OX = Math.round(r2.player.pos.x);
      Z.OZ = Math.round(r2.player.pos.z);

      /* swap the engine into its own AABB collision mode, clear the
         city's collision state, and neutralize its water probe */
      if (window.__zSetP1) window.__zSetP1(false);
      if (window.__zClearCity) window.__zClearCity();
      r2.colliders.length = 0; /* the array object is the engine's own - emptying it in place leaves only this world's colliders */
      window.__espilCollisionProbe = function () { return null; };
      window.__zswapActive = true;
      document.body.classList.add('zswap');

      /* hide Auckland's scenery; keep lights, the sky dome and the
         avatar (group + shadow) */
      var keep = {};
      if (r2.player && r2.player.av) {
        if (r2.player.av.group) keep[r2.player.av.group.uuid] = 1;
        if (r2.player.av.shadow) keep[r2.player.av.shadow.uuid] = 1;
      }
      scene.traverse(function (o) { if (o.isLight) keep[o.uuid] = 1; });
      scene.children.slice().forEach(function (ch) {
        if (keep[ch.uuid] || ch === Z.group) return;
        Z.hidden.push(ch);
        ch.visible = false;
      });
      try { scene.background = new THREE.Color(0x9fc3e8); } catch (e) {}

      Z.group = new THREE.Group();
      Z.group.name = 'zealandia-world';
      scene.add(Z.group);

      /* ground: one painted plane, bent per-frame around the player */
      var tex = new THREE.CanvasTexture(paintGround(map));
      tex.anisotropy = 4;
      var geo = new THREE.PlaneGeometry(EXTENT * 2, EXTENT * 2, 120, 120);
      geo.rotateX(-Math.PI / 2);
      Z.groundPos = geo.attributes.position;
      Z.groundBase = new Float32Array(Z.groundPos.array);
      var gmat = new THREE.MeshLambertMaterial({ map: tex });
      Z.ground = new THREE.Mesh(geo, gmat);
      Z.ground.frustumCulled = false;
      Z.ground.position.set(Z.OX, 0, Z.OZ);
      Z.group.add(Z.ground);

      /* the map's own collision rects first (water, terrain) - the
         alpha pass below may supersede a full-footprint rect where
         the sprite itself is mostly open */
      (map.collisions || []).forEach(function (rc) {
        r2.colliders.push({ x0: Z.OX + rc.x, x1: Z.OX + rc.x + rc.w, z0: Z.OZ + rc.y, z1: Z.OZ + rc.y + rc.h, bottom: 0, top: 4, __zmap: true });
      });

      /* sprites + contact shadows + alpha colliders */
      var shadowGeo = new THREE.CircleGeometry(0.5, 18);
      shadowGeo.rotateX(-Math.PI / 2);
      (map.placements || []).forEach(function (p) {
        var pal = Z.palette[p.asset];
        if (!pal || !pal.img) return;
        var w = p.w || pal.w;
        var t = new THREE.Texture(pal.img);
        t.needsUpdate = true;
        var sm = new THREE.SpriteMaterial({ map: t, transparent: true });
        var sp = new THREE.Sprite(sm);
        sp.center.set(0.5, 0);
        sp.scale.set(w, w * pal.img.height / pal.img.width, 1);
        sp.position.set(Z.OX + p.x, 0, Z.OZ + p.y);
        Z.group.add(sp);
        var sh = new THREE.Mesh(shadowGeo, new THREE.MeshBasicMaterial({
          color: 0x14200c, transparent: true, opacity: 0.20, depthWrite: false }));
        sh.scale.set(w * 0.62, 1, w * 0.62 * 0.9);
        sh.position.set(Z.OX + p.x, 0.03, Z.OZ + p.y);
        Z.group.add(sh);
        Z.sprites.push({ sp: sp, sh: sh, x: Z.OX + p.x, z: Z.OZ + p.y, id: p.asset });
        if (p.asset === 'portal_city') Z.portal = { x: Z.OX + p.x, z: Z.OZ + p.y };
        /* colliders from the sprite's own opaque base runs */
        var runs = pal.runs;
        if (runs && runs.length) {
          var coverage = 0;
          runs.forEach(function (rn) {
            coverage += rn[1] - rn[0];
            r2.colliders.push({
              x0: Z.OX + p.x - w / 2 + rn[0] * w, x1: Z.OX + p.x - w / 2 + rn[1] * w,
              z0: Z.OZ + p.y - 0.35, z1: Z.OZ + p.y + 0.35, bottom: 0, top: 4, __zalpha: true
            });
          });
          /* a map rect that merely duplicates this placement's full
             footprint is dropped when the sprite itself is mostly
             open (a gate arch): the alpha runs are the finer truth */
          if (coverage > 0.02 && coverage < 0.7) {
            var px0 = Z.OX + p.x - w / 2 - 0.5, px1 = Z.OX + p.x + w / 2 + 0.5;
            var pzC = Z.OZ + p.y;
            for (var ci = r2.colliders.length - 1; ci >= 0; ci--) {
              var c = r2.colliders[ci];
              if (!c.__zmap) continue;
              /* the rect belongs to this placement when most of its
                 width sits inside the placement's span and it lives in
                 the shallow base band at/behind the base line - deep
                 bodies behind the placement keep their rects */
              var cw = c.x1 - c.x0;
              var ov = Math.max(0, Math.min(c.x1, px1) - Math.max(c.x0, px0));
              if (cw > 0 && ov / cw >= 0.6 &&
                  c.z0 >= pzC - 3.2 && c.z1 <= pzC + 0.8 && c.z1 >= pzC - 3.2) {
                r2.colliders.splice(ci, 1);
              }
            }
          }
        }
      });
      /* spawn: the player-zone centre (the well plaza) */
      var pz = (map.zones || []).filter(function (z) { return z.type === 'player'; })[0];
      /* the zone centre IS the well itself - spawn just south of it,
         on open plaza, as a respawn point should be */
      Z.spawn = pz ? { x: Z.OX + pz.x + pz.w / 2, z: Z.OZ + pz.y + pz.h / 2 + 3.4 } : { x: Z.OX, z: Z.OZ };
      if (r2.player) {
        r2.player.pos.set(Z.spawn.x, 0.4, Z.spawn.z);
        r2.player.velY = 0;
      }
      Z.guardUntil = performance.now() + 6000;
      hideTokenBanner();
      themeArm();
      scrubCityName();
      document.documentElement.classList.remove('z-cover');
      Z.active = true;
      Z.building = false;
    }).catch(function (e) {
      Z.building = false;
      if (window.console) console.warn('[zworld] build failed:', e);
    });
  }

  /* ---------- per-frame: bend the world around the player --------- */
  function bend() {
    if (!Z.active || !Z.ground) return;
    var r = refs(); if (!r || !r.player) return;
    var px = r.player.pos.x, pz = r.player.pos.z;
    var pos = Z.groundPos, base = Z.groundBase;
    for (var i = 0; i < pos.count; i++) {
      var x = base[i * 3] + Z.OX, z = base[i * 3 + 2] + Z.OZ;
      var dx = x - px, dz = z - pz;
      pos.array[i * 3 + 1] = -K * (dx * dx + dz * dz);
    }
    pos.needsUpdate = true;
    Z.ground.geometry.computeVertexNormals();
    for (var j = 0; j < Z.sprites.length; j++) {
      var s = Z.sprites[j];
      var d = dropAt(s.x, s.z);
      s.sp.position.y = -d;
      s.sh.position.y = -d + 0.03;
    }
    /* portal prompt */
    var el = document.getElementById('z-prompt');
    if (el && Z.portal) {
      var near = Math.hypot(Z.portal.x - px, Z.portal.z - pz) < 3.8;
      if (near !== Z.promptOn) {
        Z.promptOn = near;
        el.style.display = near ? 'block' : 'none';
      }
    }
  }

  window.addEventListener('keydown', function (e) {
    if (e.key === ' ' && Z.promptOn) {
      if (window.__espilToast) window.__espilToast('포탈은 다음 단계에서 연결됩니다.');
    }
  });

  window.__zmoduleTick = function (dt) {
    if (!Z.active && !Z.building) {
      var r = refs();
      if (r && window.__espilCityKey === 'auckland' &&
          document.body.classList.contains('in-map')) {
        /* wait until the entry dive has fully landed - building (and
           teleporting) mid-dive fights the engine's entry animation */
        if (r.player.onGround && Math.abs(r.player.velY || 0) < 0.15) {
          Z.settleT += dt || 0.016;
          if (Z.settleT > 0.8) build();
        } else Z.settleT = 0;
      }
    }
    if (Z.active && performance.now() < Z.guardUntil) {
      var rp = refs();
      if (rp && rp.player && Z.spawn) {
        var q = rp.player.pos;
        if (Math.abs(q.x - Z.OX) > EXTENT || Math.abs(q.z - Z.OZ) > EXTENT) {
          q.set(Z.spawn.x, 0.4, Z.spawn.z);
          rp.player.velY = 0;
        }
      }
    }
    if (Z.active && performance.now() - (Z.lastScrub || 0) > 800) {
      Z.lastScrub = performance.now();
      scrubCityName();
      themeMirrorToggle();
    }
    bend();
  };

  window.__zworld = Z;
  window.__zworldSetK = function (k) { K = k; };
})();
