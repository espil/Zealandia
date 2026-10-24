/* Zealandia rebuild - S1 engine core (2026-10-24).
   EverPlanet method: flat logical maps from the village editor's
   village-map.json; every actor is a 2D sprite anchored at its base
   point; the Globe View transform (quadratic drop from the player
   pole, NDC2011 deck) is applied at render time only. Logic, movement
   and collision stay flat; collisions are the map data's own rects,
   consumed as-is - the engine derives no second collision system. */
(function () {
  'use strict';

  var PX_M = 38;          /* pixels per metre at scale 1 - EverPlanet framing is close: actors are large on screen */
  var TILT = 0.74;        /* vertical compression of the ground plane */
  var GLOBE_K = 0.00312;  /* deck peek constant; Han tunes the look */
  var PERSP = 0.0035;     /* gentle depth perspective */
  var MAP_EXTENT = 300;   /* village maps are 600 m across */

  var cv = document.getElementById('game');
  var g = cv.getContext('2d');
  var W = 0, H = 0;
  function resize() {
    W = cv.width = window.innerWidth;
    H = cv.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  /* ---------- data ---------- */
  var palette = {};       /* id -> {img, w} */
  var mapData = null;
  var groundCv = null;    /* pre-rendered ground, 5 px per metre */
  var GROUND_PX = 5;
  var drawables = [];     /* placements as sprites */
  var ready = false;

  function loadImage(src) {
    return new Promise(function (res, rej) {
      var im = new Image();
      im.onload = function () { res(im); };
      im.onerror = function () { rej(new Error('img ' + src)); };
      im.src = src;
    });
  }

  function spritePath(entry) {
    if (entry.image) return entry.image.replace(/^assets\//, 'assets/');
    if (entry.file) return 'assets/' + entry.file;
    return null;
  }

  function buildGround() {
    /* ONE continuous PAINTED ground - the EverPlanet way. The map's
       ground is a single illustration, not a grid of tiles: grass is
       painted in broad strokes across the whole canvas, and roads
       are painted INTO it as continuous paths. The tile data still
       decides WHERE roads run (the editor contract is unchanged),
       but the texture flows across cell boundaries with no lattice,
       and path edges are soft, like brushwork. The Globe transform
       then bends this one plane at render time. */
    var RES = 6;
    GROUND_PX = RES;
    var SIZE = MAP_EXTENT * 2 * RES;
    groundCv = document.createElement('canvas');
    groundCv.width = groundCv.height = SIZE;
    var gg = groundCv.getContext('2d');
    var R = rng(90210);
    var S = mapData.tileSizeM || 10;

    /* --- painted grass base: broad tonal strokes + fine grain --- */
    gg.fillStyle = '#7c9a52';
    gg.fillRect(0, 0, SIZE, SIZE);
    var tones = ['#86a657', '#74924a', '#8fae5e', '#6d8c46', '#93a95c', '#7f9c50'];
    for (var i = 0; i < 900; i++) {
      var bx = R() * SIZE, by = R() * SIZE, br = 60 + R() * 300;
      var rg = gg.createRadialGradient(bx, by, 0, bx, by, br);
      var c = tones[(R() * tones.length) | 0];
      rg.addColorStop(0, c + '2e');
      rg.addColorStop(1, c + '00');
      gg.fillStyle = rg;
      gg.beginPath(); gg.arc(bx, by, br, 0, 7); gg.fill();
    }
    for (var j = 0; j < 26000; j++) {
      var gx = R() * SIZE, gy = R() * SIZE, gl = 2 + R() * 5;
      gg.strokeStyle = R() > 0.5 ? 'rgba(70,95,40,0.13)' : 'rgba(190,205,130,0.11)';
      gg.lineWidth = 1.4;
      gg.beginPath(); gg.moveTo(gx, gy); gg.lineTo(gx + (R() * 2 - 1), gy - gl); gg.stroke();
    }

    /* --- continuous path textures, generated across the plane --- */
    function pathTexture(kind) {
      var c = document.createElement('canvas');
      c.width = c.height = 512;
      var x = c.getContext('2d');
      var RR = rng(kind.length * 131 + 7);
      var palettes = {
        'village-road': ['#b3985e', '#a98f56', '#c0a468', '#9c814c'],
        'paved-road': ['#8d9094', '#83868b', '#979a9e', '#7a7d82'],
        'grass-road': ['#93a05e', '#8a9858', '#9da868', '#84924f'],
        'water': ['#5d84a6', '#557b9c', '#678fb2', '#4f7394']
      };
      var pal = palettes[kind] || palettes['village-road'];
      x.fillStyle = pal[0]; x.fillRect(0, 0, 512, 512);
      for (var i = 0; i < 240; i++) {
        var bx = RR() * 512, by = RR() * 512, br = 14 + RR() * 62;
        var rg = x.createRadialGradient(bx, by, 0, bx, by, br);
        var cc = pal[(RR() * pal.length) | 0];
        rg.addColorStop(0, cc + '55'); rg.addColorStop(1, cc + '00');
        x.fillStyle = rg;
        x.beginPath(); x.arc(bx, by, br, 0, 7); x.fill();
      }
      for (var j = 0; j < 5200; j++) {
        x.fillStyle = RR() > 0.5 ? 'rgba(60,48,28,0.10)' : 'rgba(255,246,220,0.09)';
        x.fillRect(RR() * 512, RR() * 512, 1.6, 1.6);
      }
      if (kind === 'paved-road') {
        x.strokeStyle = 'rgba(52,54,58,0.16)';
        x.lineWidth = 2;
        for (var k = 0; k < 26; k++) {
          x.beginPath();
          var sx = RR() * 512, sy = RR() * 512;
          x.moveTo(sx, sy);
          x.lineTo(sx + 30 + RR() * 70, sy + (RR() * 22 - 11));
          x.stroke();
        }
      }
      return c;
    }

    /* --- paint each road kind as one continuous path --- */
    ['village-road', 'paved-road', 'grass-road', 'water'].forEach(function (kind) {
      var cells = Object.keys(mapData.tiles || {}).filter(function (k) { return mapData.tiles[k] === kind; });
      if (!cells.length) return;
      var layer = document.createElement('canvas');
      layer.width = layer.height = SIZE;
      var lx = layer.getContext('2d');
      cells.forEach(function (k) {
        var parts = k.split(',');
        lx.fillRect((+parts[0] * S + MAP_EXTENT) * RES, (+parts[1] * S + MAP_EXTENT) * RES, S * RES, S * RES);
      });
      /* soft painted edge: blur the mask, tint its silhouette as a
         border, then fill the inside with the flowing texture */
      var edge = document.createElement('canvas');
      edge.width = edge.height = SIZE;
      var ex = edge.getContext('2d');
      ex.filter = 'blur(7px)';
      ex.drawImage(layer, 0, 0);
      ex.filter = 'none';
      ex.globalCompositeOperation = 'source-in';
      ex.fillStyle = kind === 'water' ? 'rgba(40,70,100,0.55)' : 'rgba(84,70,42,0.5)';
      ex.fillRect(0, 0, SIZE, SIZE);
      gg.drawImage(edge, 0, 0);
      var inner = document.createElement('canvas');
      inner.width = inner.height = SIZE;
      var ix = inner.getContext('2d');
      ix.filter = 'blur(3px)';
      ix.drawImage(layer, 0, 0);
      ix.filter = 'none';
      ix.globalCompositeOperation = 'source-in';
      ix.fillStyle = ix.createPattern(pathTexture(kind), 'repeat');
      ix.fillRect(0, 0, SIZE, SIZE);
      gg.drawImage(inner, 0, 0);
    });

    /* --- unifying grade over the whole painting --- */
    for (var u = 0; u < 200; u++) {
      var ux = R() * SIZE, uy = R() * SIZE, ur = 140 + R() * 420;
      var ug = gg.createRadialGradient(ux, uy, 0, ux, uy, ur);
      var uwarm = R() > 0.5;
      ug.addColorStop(0, uwarm ? 'rgba(216,198,142,0.05)' : 'rgba(80,104,54,0.055)');
      ug.addColorStop(1, 'rgba(0,0,0,0)');
      gg.fillStyle = ug;
      gg.beginPath(); gg.arc(ux, uy, ur, 0, 7); gg.fill();
    }
    return Promise.resolve();
  }

  /* deterministic rng for the painting passes */
  function rng(seed) {
    var t = seed >>> 0;
    return function () {
      t = (t * 1664525 + 1013904223) >>> 0;
      return t / 4294967296;
    };
  }

  function loadMap() {
    return fetch('assets/maps/waitemata.json').then(function (r) { return r.json(); })
      .then(function (d) {
        mapData = d;
        return fetch('assets/sprites.json').then(function (r) { return r.json(); });
      })
      .then(function (pj) {
        var entries = pj.sprites || [];
        var byId = {};
        entries.forEach(function (e) { byId[e.id] = e; });
        var need = {};
        (mapData.placements || []).forEach(function (p) { need[p.asset] = 1; });
        need['wm_c01_traveller_m'] = 1; /* S1 player sprite */
        var jobs = Object.keys(need).map(function (id) {
          var e = byId[id];
          if (!e) return Promise.resolve();
          var path = spritePath(e);
          if (!path) return Promise.resolve();
          return loadImage(path).then(function (im) {
            palette[id] = { img: im, w: e.defaultW || 2 };
          }).catch(function () {});
        });
        return Promise.all(jobs);
      })
      .then(buildGround)
      .then(function () {
        drawables = (mapData.placements || []).map(function (p) {
          var pal = palette[p.asset];
          return { id: p.asset, x: p.x, y: p.y, w: p.w || (pal ? pal.w : 2), img: pal ? pal.img : null };
        });
        /* spawn: centre of the player zone */
        var pz = (mapData.zones || []).filter(function (z) { return z.type === 'player'; })[0];
        if (pz) { player.x = pz.x + pz.w / 2; player.y = pz.y + pz.h / 2; }
        resolveCollisions(player); /* the spawn point is the well plaza - start outside the well's own rect */
        cam.x = player.x; cam.y = player.y;
        ready = true;
        document.getElementById('boot').classList.add('done');
        var tc = document.getElementById('title-card');
        tc.classList.add('show');
        setTimeout(function () { tc.classList.remove('show'); }, 2600);
      });
  }

  /* ---------- world state ---------- */
  var player = { x: 0, y: 0, r: 0.45, face: 1, moving: false };
  var cam = { x: 0, y: 0 };
  var keys = {};
  var promptPortal = null;   /* portal placement in range */
  var toastTimer = 0;

  window.addEventListener('keydown', function (e) {
    keys[e.key.toLowerCase()] = true;
    if (e.key === ' ') {
      e.preventDefault();
      if (promptPortal) showToast('포탈은 다음 슬라이스에서 연결됩니다. 지금은 골격만 서 있습니다.');
    }
  });
  window.addEventListener('keyup', function (e) { keys[e.key.toLowerCase()] = false; });

  function showToast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.style.display = 'block';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.style.display = 'none'; }, 3400);
  }

  /* collisions: the map's own rects {x, y (NW corner), w, h} */
  function resolveCollisions(p) {
    var rects = mapData.collisions || [];
    for (var pass = 0; pass < 2; pass++) {
      for (var i = 0; i < rects.length; i++) {
        var r = rects[i];
        var nx = Math.max(r.x, Math.min(p.x, r.x + r.w));
        var ny = Math.max(r.y, Math.min(p.y, r.y + r.h));
        var dx = p.x - nx, dy = p.y - ny;
        var d2 = dx * dx + dy * dy;
        if (d2 > p.r * p.r) continue;
        if (d2 > 1e-9) {
          var d = Math.sqrt(d2);
          p.x = nx + (dx / d) * p.r;
          p.y = ny + (dy / d) * p.r;
        } else {
          /* centre inside the rect: push out along the smallest exit */
          var left = p.x - r.x, right = r.x + r.w - p.x;
          var top = p.y - r.y, bot = r.y + r.h - p.y;
          var m = Math.min(left, right, top, bot);
          if (m === left) p.x = r.x - p.r;
          else if (m === right) p.x = r.x + r.w + p.r;
          else if (m === top) p.y = r.y - p.r;
          else p.y = r.y + r.h + p.r;
        }
      }
    }
    /* keep the player inside the map extent */
    var lim = MAP_EXTENT - 2;
    p.x = Math.max(-lim, Math.min(lim, p.x));
    p.y = Math.max(-lim, Math.min(lim, p.y));
  }

  function update(dt) {
    var run = keys['shift'] ? 1 : 0;
    var sp = run ? 9.2 : 5.2;
    var vx = 0, vy = 0;
    if (keys['a'] || keys['arrowleft']) vx -= 1;
    if (keys['d'] || keys['arrowright']) vx += 1;
    if (keys['w'] || keys['arrowup']) vy -= 1;
    if (keys['s'] || keys['arrowdown']) vy += 1;
    var len = Math.hypot(vx, vy);
    player.moving = len > 0;
    if (len > 0) {
      vx /= len; vy /= len;
      if (vx !== 0) player.face = vx > 0 ? 1 : -1;
      player.x += vx * sp * dt;
      player.y += vy * sp * dt;
      resolveCollisions(player);
    }
    cam.x += (player.x - cam.x) * Math.min(1, dt * 5);
    cam.y += (player.y - cam.y) * Math.min(1, dt * 5);
    /* portal proximity */
    promptPortal = null;
    for (var i = 0; i < drawables.length; i++) {
      var d = drawables[i];
      if (d.id === 'portal_city' && Math.hypot(d.x - player.x, d.y - player.y) < 3.6) {
        promptPortal = d;
        break;
      }
    }
    var pr = document.getElementById('prompt');
    if (promptPortal) {
      document.getElementById('prompt-text').textContent = '도시 포탈';
      pr.style.display = 'block';
    } else pr.style.display = 'none';
  }

  /* ---------- projection (Globe View, render only) ---------- */
  function project(wx, wy) {
    var rx = wx - cam.x, ry = wy - cam.y;
    var ahead = -ry;
    var dist = Math.hypot(rx, ry);
    var s = 1 / (1 + Math.max(ahead, -40) * PERSP);
    var drop = GLOBE_K * dist * dist;         /* metres, the deck's law */
    return {
      x: W / 2 + rx * PX_M * s,
      y: H * 0.56 + ((-ahead * TILT) + drop) * PX_M * s,
      s: s, dist: dist
    };
  }

  /* ---------- render ---------- */
  function drawGround() {
    /* sky above the horizon line, then the ground in depth bands so
       the strips follow the same bent projection as the sprites */
    var horizon = H * 0.56 - 190;
    var sky = g.createLinearGradient(0, 0, 0, horizon + 60);
    sky.addColorStop(0, '#79a6d8');
    sky.addColorStop(0.75, '#bcd3e8');
    sky.addColorStop(1, '#dfe9dd');
    g.fillStyle = sky;
    g.fillRect(0, 0, W, horizon + 60);
    if (!groundCv) return;
    var BAND = 1;                     /* metres per strip - fine enough that the bend reads continuous */
    var AHEAD_FAR = 300, AHEAD_NEAR = -70;
    var halfWm = (W / 2) / PX_M + 30; /* metres of margin each side */
    for (var a1 = AHEAD_FAR; a1 > AHEAD_NEAR; a1 -= BAND) {
      var a0 = a1 - BAND;
      var wyC = cam.y - (a0 + a1) / 2;
      var pTop = project(cam.x, cam.y - a1);
      var pBot = project(cam.x, cam.y - a0);
      var srcY = (wyC - BAND / 2 + MAP_EXTENT) * GROUND_PX;
      var srcH = BAND * GROUND_PX;
      var srcX = (cam.x - halfWm + MAP_EXTENT) * GROUND_PX;
      var srcW = halfWm * 2 * GROUND_PX;
      var dstX = W / 2 - halfWm * PX_M * pTop.s;
      var dstW = halfWm * 2 * PX_M * pTop.s;
      var y0 = Math.min(pTop.y, pBot.y), y1 = Math.max(pTop.y, pBot.y);
      if (y1 < 0 || y0 > H) continue;
      g.drawImage(groundCv, srcX, srcY, srcW, srcH, dstX, y0, dstW, Math.max(1, y1 - y0));
    }
  }

  function drawSprite(im, wx, wy, wM, flip) {
    var p = project(wx, wy);
    if (p.x < -260 || p.x > W + 260 || p.y < -420 || p.y > H + 120) return false;
    var wPx = wM * PX_M * p.s;
    var hPx = wPx * (im.height / im.width);
    g.save();
    if (flip) { g.translate(p.x, 0); g.scale(-1, 1); g.translate(-p.x, 0); }
    g.drawImage(im, p.x - wPx / 2, p.y - hPx, wPx, hPx);
    g.restore();
    return true;
  }

  var frame = 0;
  function render() {
    g.clearRect(0, 0, W, H);
    drawGround();
    if (!ready) return;
    var items = drawables.slice();
    items.push({ id: '__player', x: player.x, y: player.y, w: 1.35, img: palette['wm_c01_traveller_m'] ? palette['wm_c01_traveller_m'].img : null, player: true });
    items.sort(function (a, b) { return a.y - b.y; });
    var drawn = 0;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (!it.img) continue;
      /* contact shadow first: the soft ellipse baked under every
         actor is what makes EverPlanet objects sit inside the
         painting instead of floating on top of it */
      var bp = project(it.x, it.y);
      var sw = it.w * PX_M * bp.s * 0.62;
      g.fillStyle = 'rgba(24,32,16,0.20)';
      g.beginPath();
      g.ellipse(bp.x, bp.y, sw / 2, sw * 0.16, 0, 0, 7);
      g.fill();
      var bob = it.player && player.moving ? Math.abs(Math.sin(frame * 0.32)) * 0.09 : 0;
      if (drawSprite(it.img, it.x, it.y - bob, it.w, it.player && player.face < 0)) drawn++;
    }
    render.drawn = drawn;
  }

  /* ---------- main loop ---------- */
  var last = 0;
  function loop(ts) {
    var dt = Math.min(0.05, last ? (ts - last) / 1000 : 0.016);
    last = ts;
    frame++;
    if (ready) update(dt);
    render();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  loadMap().catch(function (e) {
    document.getElementById('boot').textContent = 'LOAD FAILED - ' + e.message;
  });

  /* verification hooks */
  window.__rebuild = {
    state: function () {
      return { ready: ready, player: { x: +player.x.toFixed(2), y: +player.y.toFixed(2) },
        drawables: drawables.length, drawn: render.drawn || 0,
        collisions: mapData ? (mapData.collisions || []).length : 0,
        portalPrompt: !!promptPortal, globeK: GLOBE_K };
    },
    setK: function (k) { GLOBE_K = k; },
    teleport: function (x, y) { player.x = x; player.y = y; cam.x = x; cam.y = y; },
    press: function (k, down) { keys[k] = !!down; }
  };
})();
