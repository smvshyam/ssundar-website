/* SSUNDAR — March Bench simulator: THE RESERVOIR. Real 3D via self-hosted Three.js r128 (/vendor/three.min.js; CSP blocks CDNs).
   Water behind the dam = delivery-ready bench. Gauge on the dam = seats needed (white) and 90% (red).
   Tributaries start flowing on each cohort's landing week. Seepage on the dam face = attrition.
   The gated holding pond upstream = hired, not yet proficient. The town below the dam = the client. */
(function () {
  'use strict';
  var stage = document.getElementById('stage'), cv = document.getElementById('gl'), lab = document.getElementById('labels');
  if (!stage || !cv) return;
  var $ = function (id) { return document.getElementById(id); };
  var S = { seats: 80, hires: 15, floor: 45, a30: 10, a60: 18, a90: 25, week: 13 };
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isMobile = Math.min(window.innerWidth, window.innerHeight) < 700;

  /* ---------------- model (unchanged) ---------------- */
  var WEEKS = 13, COHORT_GAP = 21, FLOOR_LOSS = 0.08, START_BENCH = 0.93, TEN_ATTR = 0.03, PROF_DAYS = 21;
  var M = null;
  function surv(age, p) { var a30 = p.a30 / 100, a60 = Math.max(p.a60 / 100, a30), a90 = Math.max(p.a90 / 100, a60);
    if (age <= 0) return 1; if (age <= 30) return 1 - a30 * age / 30; if (age <= 60) return 1 - a30 - (a60 - a30) * (age - 30) / 30;
    if (age <= 90) return 1 - a60 - (a90 - a60) * (age - 60) / 30; return 1 - a90; }
  function prof(age, p) { if (age < p.floor) return 0; var a = age - p.floor; return a >= PROF_DAYS ? 1 : 0.3 + 0.7 * a / PROF_DAYS; }
  function run(p, starts) {
    var weeks = [];
    for (var w = 1; w <= WEEKS; w++) {
      var d = Math.min(90, w * 7), ten = p.seats * START_BENCH * (1 - TEN_ATTR * d / 30), segs = [ten], ramp = 0, lost = p.seats * START_BENCH * TEN_ATTR * d / 30;
      starts.forEach(function (s) { var age = d - s; if (age < 0) { segs.push(0); return; }
        var alive = p.hires * (1 - FLOOR_LOSS) * surv(age, p), ready = alive * prof(age, p); segs.push(ready); ramp += alive - ready; lost += p.hires * (1 - FLOOR_LOSS) * (1 - surv(age, p)); });
      var tot = segs.reduce(function (a, b) { return a + b; }, 0);
      weeks.push({ w: w, day: d, segs: segs, total: tot, ramp: ramp, lost: lost, short: tot < 0.9 * p.seats });
    }
    var red = 0, lastRed = 0; weeks.forEach(function (x) { if (x.short) { if (!red) red = x.w; lastRed = x.w; } });
    return { weeks: weeks, red: red, lastRed: lastRed, starts: starts };
  }
  function compute() {
    var starts = []; for (var s = 0; s < 90; s += COHORT_GAP) starts.push(s);
    M = run(S, starts); M.action = null;
    if (M.red) {
      var redDay = M.red * 7, k = -1;
      for (var i = 0; i < starts.length; i++) { if (starts[i] + S.floor > redDay) { k = i; break; } }
      if (k > 0 && starts[k] >= 14) { var alt = starts.slice(); alt[k] = starts[k] - 14;
        M.action = { text: 'Pull cohort ' + (k + 1) + ' forward two weeks (start day ' + alt[k] + ' instead of ' + starts[k] + ').', owner: 'Operations lead', cf: run(S, alt) }; }
      else if (k === 0 && S.floor > 24) { var cut = Math.min(14, S.floor - 10), pf = Object.assign({}, S, { floor: S.floor - cut });
        M.action = { text: 'Compress offer-to-floor for cohort 1 from ' + S.floor + ' to ' + (S.floor - cut) + ' days: pre-boarding before day one, classroom in two waves, first live calls under a coach.', owner: 'Training lead with operations', cf: run(pf, starts) }; }
      else if (S.a30 >= 15) { var p2 = Object.assign({}, S, { a30: Math.round(S.a30 * 0.6), a60: Math.round(S.a60 * 0.75), a90: Math.round(S.a90 * 0.85) });
        M.action = { text: 'Shift two team leaders to new-hire coaching, one topic for six weeks. The leak is attrition in the first 30 days.', owner: 'Training lead', cf: run(p2, starts) }; }
      else { var p3 = Object.assign({}, S, { hires: S.hires + Math.max(5, Math.round(S.hires * 0.25)) });
        M.action = { text: 'Raise the next cohort by ' + Math.max(5, Math.round(S.hires * 0.25)) + ' and capture knowledge from notified leavers.', owner: 'HR and workforce planning', cf: run(p3, starts) }; }
    }
  }

  /* ---------------- story + readout ---------------- */
  var readout = $('readout'), verdict = $('verdict'), story = $('story'), cta = $('simcta');
  function wk(n) { return 'week ' + n; }
  function renderText() {
    var cur = M.weeks[S.week - 1], r = Math.round(cur.total);
    readout.innerHTML = 'Week ' + S.week + ' &middot; day ' + cur.day + '<br>Reservoir: <b>' + r + '</b> of <b>' + S.seats + '</b> seats'
      + (cur.ramp > 0.5 ? '<br>Holding pond: ' + Math.round(cur.ramp) + ' hired, not yet proficient' : '') + '<br>Seepage so far: ' + Math.round(cur.lost) + (cur.short ? '<br><b>Below the red mark</b> &mdash; under 90% of need' : '');
    var first = M.weeks[0], last = M.weeks[WEEKS - 1];
    var landW = Math.ceil((M.starts[0] + S.floor) / 7), profW = Math.ceil((M.starts[0] + S.floor + PROF_DAYS) / 7);
    var lines = [];
    lines.push('<b>Week 1.</b> The reservoir holds ' + Math.round(first.total) + ' of the ' + S.seats + ' seats the town needs. Seepage through the dam &mdash; tenured attrition &mdash; drains about ' + Math.round(S.seats * START_BENCH * TEN_ATTR) + ' a month, and no tributary is flowing yet.');
    lines.push('<b>Cohort 1</b> (' + S.hires + ' hires; ' + Math.round(S.hires * FLOOR_LOSS) + ' never reach the floor) sits in the holding pond until day ' + S.floor + ' &mdash; ' + wk(landW) + ' &mdash; then its tributary opens, at full flow by ' + wk(profW) + '. Until then it is water you have paid for that cannot reach the town.');
    if (M.red) lines.push('<b>The level drops below the red mark in ' + wk(M.red) + (M.lastRed > M.red ? ' and stays there until ' + wk(M.lastRed) : '') + '.</b> That is the gap the client feels before you see it.');
    else lines.push('<b>The level stays above the red mark through week 13.</b> Re-run when the next hire plan or attrition number changes.');
    lines.push('<b>Week 13.</b> ' + Math.round(last.total) + ' of ' + S.seats + ' seats' + (last.ramp > 0.5 ? ', with ' + Math.round(last.ramp) + ' still in the holding pond' : '') + '.');
    story.innerHTML = lines.map(function (l) { return '<p>' + l + '</p>'; }).join('');
    if (M.red) {
      var a = M.action, after = a.cf.red ? 'below the mark only from ' + wk(a.cf.red) + (a.cf.lastRed > a.cf.red ? ' to ' + wk(a.cf.lastRed) : '') : 'never below the mark';
      verdict.className = 'verdict';
      verdict.innerHTML = '<b>Your bench falls short in ' + wk(M.red) + '.</b><p><i>The first action the diagnosis would return</i>' + a.text + ' Owner: ' + a.owner + '. Date: before the current start.</p>'
        + '<p class="cf"><i>With that one action</i>' + after.charAt(0).toUpperCase() + after.slice(1) + '. Week 13: ' + Math.round(a.cf.weeks[WEEKS - 1].total) + ' of ' + S.seats + '.</p>';
    } else {
      verdict.className = 'verdict ok';
      verdict.innerHTML = '<b>Your bench holds through week 13.</b><p><i>The first action the diagnosis would return</i>No action. Flag the associates ready for harder work to workforce planning.</p>';
    }
  }
  function link() {
    var q = '?seats=' + S.seats + '&hires=' + S.hires + '&floor=' + S.floor + '&a30=' + S.a30 + '&a60=' + S.a60 + '&a90=' + S.a90 + (M.red ? '&red=' + M.red : '') + '&sector=' + (window.__sector || 'ramp');
    window.__simHref = '/engage' + q; if (cta) cta.href = window.__simHref;
    var go = document.getElementById('goBtn'); if (go && (go.getAttribute('href') || '').indexOf('/engage') === 0) go.setAttribute('href', window.__simHref);
  }
  window.__simLink = link;
  var firedRed = false, touched = false, lastShort = false;
  function signal() { var short = M.weeks[S.week - 1].short;
    if (short && !lastShort && touched) { try { if (navigator.vibrate) navigator.vibrate(18); } catch (e) {} } lastShort = short;
    if (M.red && touched && !firedRed) { firedRed = true; if (typeof window.gtag === 'function') window.gtag('event', 'bench_red_week', { week: M.red, seats: S.seats }); } }

  /* ---------------- THREE scene ---------------- */
  var T = window.THREE, renderer, scene, camera, water, waterMat, holdWater, gaugeTex, gaugeCtx, lamp, tribs = [], seeps = [], town = [], pondGate;
  var levelCur = 0.9, levelTgt = 0.9, pondCur = 0, pondTgt = 0, yaw = 0.62, yawTgt = 0.62, dragging = false, lx = 0, clock = null, ok = false;
  // world: dam at z=0 facing -z (town side). Reservoir behind (z>0). Water surface y = 0..H
  var H = 2.6, RW = 7.0, RL = 9.0;      // reservoir water max height, width, length
  function levelFor(seats) { return Math.min(1.25, seats / S.seats) * 0.8; } // fraction of H
  function noise(x, z) { return Math.sin(x * 0.9) * Math.cos(z * 0.7) * 0.5 + Math.sin(x * 2.3 + 1.7) * Math.cos(z * 1.9) * 0.25 + Math.sin(x * 5.1) * Math.sin(z * 4.3) * 0.08; }
  function initGL() {
    if (!T) return false;
    try { renderer = new T.WebGLRenderer({ canvas: cv, antialias: !isMobile, alpha: false, powerPreference: 'high-performance' }); } catch (e) { return false; }
    renderer.setPixelRatio(Math.min(isMobile ? 1.5 : 2, window.devicePixelRatio || 1));
    renderer.shadowMap.enabled = !isMobile; renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.outputEncoding = T.sRGBEncoding; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    scene = new T.Scene(); scene.background = new T.Color(0x0b0f16); scene.fog = new T.Fog(0x0b0f16, 22, 48);
    camera = new T.PerspectiveCamera(34, 1, 0.1, 100);
    // light: low sun from the town side so the dam face and water read
    var hemi = new T.HemisphereLight(0x8fb3ff, 0x1a1410, 0.55); scene.add(hemi);
    var sun = new T.DirectionalLight(0xffe2b8, 1.35); sun.position.set(-6, 9, -7); sun.castShadow = !isMobile;
    sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -10; sun.shadow.camera.right = 10; sun.shadow.camera.top = 10; sun.shadow.camera.bottom = -10; sun.shadow.camera.far = 40; sun.shadow.bias = -0.0005;
    scene.add(sun);
    var fill = new T.DirectionalLight(0x6f8fd8, 0.35); fill.position.set(6, 4, 8); scene.add(fill);

    // terrain (valley): displaced plane with a trough along z, basin behind the dam
    var tg = new T.PlaneGeometry(26, 30, isMobile ? 48 : 90, isMobile ? 54 : 100); tg.rotateX(-Math.PI / 2);
    var pa = tg.attributes.position;
    for (var i = 0; i < pa.count; i++) {
      var x = pa.getX(i), z = pa.getZ(i), ax = Math.abs(x);
      var wall = Math.pow(Math.max(0, ax - RW / 2) / 5.5, 1.7) * 5;              // valley sides
      var basin = z > 0.2 ? -1.1 : 0;                                            // reservoir bed behind the dam
      var downstream = z < -0.2 ? -0.35 - Math.max(0, -z - 0.2) * 0.06 : 0;     // gentle fall to the town
      var y = wall + basin + downstream + noise(x * 0.6, z * 0.6) * 0.25 * (0.3 + Math.min(1, ax / 5));
      pa.setY(i, y);
    }
    tg.computeVertexNormals();
    var terrain = new T.Mesh(tg, new T.MeshStandardMaterial({ color: 0x3b3a33, roughness: 0.95, metalness: 0.0, flatShading: false }));
    terrain.receiveShadow = true; scene.add(terrain);
    // subtle tree clumps on the slopes
    var treeG = new T.ConeGeometry(0.22, 0.7, 6), treeM = new T.MeshStandardMaterial({ color: 0x1f3a22, roughness: 1 });
    for (var t = 0; t < (isMobile ? 70 : 160); t++) { var tx = (Math.random() < 0.5 ? -1 : 1) * (RW / 2 + 0.6 + Math.random() * 4.5), tz = -12 + Math.random() * 24;
      var ty = Math.pow(Math.max(0, Math.abs(tx) - RW / 2) / 5.5, 1.7) * 5 + (tz > 0.2 ? -1.1 : 0) + (tz < -0.2 ? -0.35 : 0);
      if (tz < -4 && Math.abs(tx) < 7) continue; var tr = new T.Mesh(treeG, treeM); tr.position.set(tx, ty + 0.25, tz); tr.scale.setScalar(0.45 + Math.random() * 0.5); tr.castShadow = !isMobile; scene.add(tr); }

    // the dam: slightly curved concrete wall at z≈0, crest at y=H+0.25
    var damShape = new T.Shape(); damShape.moveTo(-RW / 2 - 0.4, -1.3); damShape.lineTo(RW / 2 + 0.4, -1.3); damShape.lineTo(RW / 2 + 0.4, H + 0.25); damShape.lineTo(-RW / 2 - 0.4, H + 0.25); damShape.closePath();
    var damGeo = new T.ExtrudeGeometry(damShape, { depth: 0.9, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 2 });
    var concrete = new T.MeshStandardMaterial({ color: 0x8e8b84, roughness: 0.78, metalness: 0.05 });
    var dam = new T.Mesh(damGeo, concrete); dam.position.z = -0.45; dam.castShadow = !isMobile; dam.receiveShadow = true; scene.add(dam);
    // crest road + rail
    var crest = new T.Mesh(new T.BoxGeometry(RW + 0.9, 0.08, 1.0), new T.MeshStandardMaterial({ color: 0x55534e, roughness: 0.9 })); crest.position.set(0, H + 0.29, 0); scene.add(crest);
    for (var r = -3; r <= 3; r++) { var post = new T.Mesh(new T.CylinderGeometry(0.02, 0.02, 0.3, 6), concrete); post.position.set(r * (RW / 6), H + 0.45, -0.9); scene.add(post); }
    // gauge painted on the downstream face (canvas texture)
    var gc = document.createElement('canvas'); gc.width = 256; gc.height = 1024; gaugeCtx = gc.getContext('2d'); gaugeTex = new T.CanvasTexture(gc); gaugeTex.encoding = T.sRGBEncoding;
    var gauge = new T.Mesh(new T.PlaneGeometry(1.25, 3.55), new T.MeshStandardMaterial({ map: gaugeTex, transparent: true, roughness: 0.7 }));
    gauge.position.set(0.9, (H + 0.25 - 1.3) / 2, -0.95 - 0.08 - 0.01); gauge.rotation.y = Math.PI; scene.add(gauge);
    // warning lamp on the crest
    lamp = new T.Mesh(new T.SphereGeometry(0.12, 12, 12), new T.MeshStandardMaterial({ color: 0x330000, emissive: 0xE31E24, emissiveIntensity: 0.0 })); lamp.position.set(0.9, H + 0.62, -0.9); scene.add(lamp);
    var lampPost = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 0.3, 6), concrete); lampPost.position.set(0.9, H + 0.45, -0.9); scene.add(lampPost);

    // water surface (reservoir): animated vertex waves, translucent, reflective-ish
    var wg = new T.PlaneGeometry(RW, RL, isMobile ? 40 : 80, isMobile ? 50 : 100); wg.rotateX(-Math.PI / 2);
    waterMat = new T.MeshPhysicalMaterial({ color: 0x1b4f8a, roughness: 0.12, metalness: 0.0, transparent: true, opacity: 0.86, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1, side: T.DoubleSide });
    water = new T.Mesh(wg, waterMat); water.position.set(0, 0, RL / 2 + 0.1); water.receiveShadow = !isMobile; scene.add(water);
    water.userData.base = wg.attributes.position.array.slice();
    // reservoir "body" (dark volume so the level reads from the side)
    var body = new T.Mesh(new T.BoxGeometry(RW - 0.02, 1, RL - 0.02), new T.MeshStandardMaterial({ color: 0x08203a, transparent: true, opacity: 0.55, roughness: 1 })); body.position.set(0, 0, RL / 2 + 0.1); scene.add(body); water.userData.body = body;

    // holding pond upstream behind a gate
    var pondW = 2.4, pondL = 2.2, px = 0, pz = RL + 1.9;
    var pondWall = new T.MeshStandardMaterial({ color: 0x6f6c66, roughness: 0.9 });
    [[-pondW / 2 - 0.1, pz, 0.2, pondL + 0.4], [pondW / 2 + 0.1, pz, 0.2, pondL + 0.4], [px, pz + pondL / 2 + 0.1, pondW + 0.4, 0.2]].forEach(function (b) {
      var m = new T.Mesh(new T.BoxGeometry(b[2], 1.2, b[3]), pondWall); m.position.set(b[0], 0.1, b[1]); m.castShadow = !isMobile; scene.add(m); });
    pondGate = new T.Mesh(new T.BoxGeometry(pondW + 0.4, 1.3, 0.14), new T.MeshStandardMaterial({ color: 0xb04a1f, roughness: 0.6, metalness: 0.3 })); pondGate.position.set(px, 0.15, pz - pondL / 2 - 0.05); scene.add(pondGate);
    holdWater = new T.Mesh(new T.PlaneGeometry(pondW, pondL), new T.MeshPhysicalMaterial({ color: 0xc98a2a, roughness: 0.25, transparent: true, opacity: 0.85, clearcoat: 0.6 }));
    holdWater.rotation.x = -Math.PI / 2; holdWater.position.set(px, -0.4, pz); scene.add(holdWater);
    // tributaries: one channel per cohort, from the valley sides into the reservoir; flow = animated translucent ribbon
    var starts = []; for (var s0 = 0; s0 < 90; s0 += COHORT_GAP) starts.push(s0);
    starts.forEach(function (st, i) {
      var side = i % 2 === 0 ? 1 : -1, zz = 2.2 + i * 1.35;
      var chan = new T.Mesh(new T.BoxGeometry(3.2, 0.12, 0.42), new T.MeshStandardMaterial({ color: 0x4a4a44, roughness: 1 })); chan.position.set(side * (RW / 2 + 1.3), 0.95 + i * 0.12, zz); chan.rotation.z = side * -0.32; scene.add(chan);
      var flow = new T.Mesh(new T.BoxGeometry(3.1, 0.08, 0.3), new T.MeshPhysicalMaterial({ color: 0x3d8fd6, roughness: 0.15, transparent: true, opacity: 0.0, clearcoat: 1 })); flow.position.copy(chan.position); flow.position.y += 0.1; flow.rotation.z = chan.rotation.z; scene.add(flow);
      tribs.push({ flow: flow, start: st, side: side, z: zz, i: i });
    });
    // seepage streams on the downstream face
    for (var q = 0; q < 5; q++) { var sp = new T.Mesh(new T.PlaneGeometry(0.06, 2.4), new T.MeshBasicMaterial({ color: 0x9fd3ff, transparent: true, opacity: 0.0, side: T.DoubleSide }));
      sp.position.set(-RW / 2 + 0.9 + q * (RW - 1.8) / 4, 0.3, -0.95 - 0.1); sp.rotation.z = (Math.random() - 0.5) * 0.08; scene.add(sp); seeps.push(sp); }
    // the town below the dam
    var winMat = new T.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.6, emissive: 0xffc46b, emissiveIntensity: 0.6 });
    for (var b2 = 0; b2 < (isMobile ? 26 : 48); b2++) { var bw = 0.3 + Math.random() * 0.5, bh = 0.3 + Math.random() * 0.9, bd = 0.3 + Math.random() * 0.5;
      var bx = (Math.random() - 0.5) * 6.5, bz = -3.2 - Math.random() * 7;
      var bm = new T.Mesh(new T.BoxGeometry(bw, bh, bd), Math.random() < 0.35 ? winMat : new T.MeshStandardMaterial({ color: 0x3a3a3e, roughness: 0.8 }));
      bm.position.set(bx, -0.35 - Math.max(0, -bz - 0.2) * 0.06 + bh / 2, bz); bm.castShadow = !isMobile; bm.receiveShadow = true; scene.add(bm); town.push(bm); }
    clock = new T.Clock(); ok = true; return true;
  }
  function paintGauge(short) {
    var c = gaugeCtx, w = 256, h = 1024; c.clearRect(0, 0, w, h);
    c.fillStyle = 'rgba(245,245,240,0.92)'; c.fillRect(0, 0, w, h);
    // map seats -> y: level fraction f = min(1.25, seats/S)*0.8 of H; gauge spans y from -1.3 to H+0.25 (3.55 units)
    function yFor(seats) { var yWorld = levelFor(seats) * H; return h - ((yWorld + 1.3) / 3.55) * h; }
    c.strokeStyle = '#333'; c.lineWidth = 3; c.font = 'bold 34px JetBrains Mono, monospace'; c.fillStyle = '#222'; c.textAlign = 'left';
    for (var v = 0; v <= S.seats * 1.25; v += Math.max(5, Math.round(S.seats / 8 / 5) * 5)) { var y = yFor(v); c.beginPath(); c.moveTo(0, y); c.lineTo(v % (S.seats / 4) < 1 ? 60 : 30, y); c.stroke(); if (v % Math.max(10, Math.round(S.seats / 4 / 10) * 10) === 0) c.fillText(String(v), 70, y + 12); }
    var yN = yFor(S.seats), yR = yFor(0.9 * S.seats);
    c.fillStyle = 'rgba(227,30,36,0.28)'; c.fillRect(0, yR, w, h - yR);
    c.strokeStyle = '#E31E24'; c.lineWidth = 8; c.beginPath(); c.moveTo(0, yR); c.lineTo(w, yR); c.stroke();
    c.strokeStyle = '#111'; c.lineWidth = 6; c.beginPath(); c.moveTo(0, yN); c.lineTo(w, yN); c.stroke();
    c.fillStyle = '#111'; c.font = 'bold 30px Inter Tight, Arial, sans-serif'; c.textAlign = 'right'; c.fillText('NEED ' + S.seats, w - 10, yN - 10);
    c.fillStyle = '#E31E24'; c.fillText('90%', w - 10, yR + 36);
    gaugeTex.needsUpdate = true;
  }
  function size() { var r = stage.getBoundingClientRect(); var w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height)); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  function setTargets() { var cur = M.weeks[S.week - 1]; levelTgt = levelFor(cur.total); pondTgt = Math.min(1, cur.ramp / Math.max(1, S.hires)); paintGauge(cur.short); }
  function proj(x, y, z) { var v = new T.Vector3(x, y, z).project(camera); var r = stage.getBoundingClientRect(); return [(v.x * 0.5 + 0.5) * r.width, (0.5 - v.y * 0.5) * r.height]; }
  function labels3D() {
    if (!lab) return; var cur = M.weeks[S.week - 1], h = '';
    var p = proj(0.9, H + 0.85, -0.9); h += '<span class="ln' + (cur.short ? ' red' : '') + '" style="left:' + p[0] + 'px;top:' + p[1] + 'px">' + Math.round(cur.total) + ' / ' + S.seats + ' seats</span>';
    var hp = proj(0, 0.9, RL + 1.9); h += '<span class="lw" style="left:' + hp[0] + 'px;top:' + hp[1] + 'px">Holding pond &middot; ' + Math.round(cur.ramp) + ' not yet proficient</span>';
    tribs.forEach(function (tb) { var landW = Math.ceil((tb.start + S.floor) / 7); if (landW > 14) return; var tp = proj(tb.side * (RW / 2 + 2.4), 1.5 + tb.i * 0.12, tb.z);
      h += '<span class="lw' + (S.week >= landW ? ' on' : '') + '" style="left:' + tp[0] + 'px;top:' + tp[1] + 'px">Cohort ' + (tb.i + 1) + ' &middot; ' + (S.week >= landW ? 'flowing' : 'lands wk ' + landW) + '</span>'; });
    var sp = proj(0, -1.0, -1.3); h += '<span class="lw" style="left:' + sp[0] + 'px;top:' + sp[1] + 'px">Seepage &middot; attrition ' + S.a30 + '/' + S.a60 + '/' + S.a90 + '% &middot; ' + Math.round(cur.lost) + ' lost so far</span>';
    var tn = proj(0, 0.9, -8.5); h += '<span class="lw" style="left:' + tn[0] + 'px;top:' + tn[1] + 'px">The client &middot; needs ' + S.seats + ' seats</span>';
    lab.innerHTML = h;
  }
  function frame() {
    var dt = Math.min(0.05, clock.getDelta()), t = clock.elapsedTime;
    levelCur += (levelTgt - levelCur) * Math.min(1, dt * 2.2); pondCur += (pondTgt - pondCur) * Math.min(1, dt * 2.2);
    if (!dragging) { if (!reduced && !touched) yawTgt = 0.62 + Math.sin(t * 0.16) * 0.14; yaw += (yawTgt - yaw) * Math.min(1, dt * 3); }
    var cur = M.weeks[S.week - 1], short = cur.short;
    // water
    var y = levelCur * H; water.position.y = y;
    water.userData.body.scale.y = Math.max(0.02, y + 1.1); water.userData.body.position.y = (y - 1.1) / 2;
    var pa = water.geometry.attributes.position, base = water.userData.base;
    for (var i = 0; i < pa.count; i++) { var bx = base[i * 3], bz = base[i * 3 + 2]; pa.setY(i, Math.sin(bx * 1.8 + t * 1.3) * 0.025 + Math.cos(bz * 1.4 - t * 1.1) * 0.03 + Math.sin((bx + bz) * 3.1 + t * 2.0) * 0.012); }
    pa.needsUpdate = true; water.geometry.computeVertexNormals();
    waterMat.color.setHex(short ? 0x6b2a2e : 0x1b4f8a); waterMat.opacity = 0.86;
    // holding pond
    holdWater.position.y = -0.45 + pondCur * 0.9; holdWater.visible = pondCur > 0.03; pondGate.position.y = 0.15 + (cur.ramp < 0.5 && S.week > 1 ? 0.5 : 0);
    // tributaries
    tribs.forEach(function (tb) { var landW = Math.ceil((tb.start + S.floor) / 7); var on = S.week >= landW; var tgt = on ? 0.9 : 0; var m = tb.flow.material; m.opacity += (tgt - m.opacity) * Math.min(1, dt * 3);
      tb.flow.position.x = tb.side * (RW / 2 + 1.3) + Math.sin(t * 6 + tb.i) * 0.01; m.color.setHex(0x3d8fd6); });
    // seepage: opacity scales with attrition
    var seepAmt = Math.min(1, (S.a30 + S.a60 + S.a90) / 90);
    seeps.forEach(function (sp, i) { sp.material.opacity = 0.15 + seepAmt * 0.5 * (0.6 + 0.4 * Math.sin(t * 3 + i)); sp.scale.y = 0.6 + seepAmt * 0.6; sp.position.y = 0.3 - (1 - sp.scale.y) * 1.2; });
    lamp.material.emissiveIntensity = short ? 1.6 + Math.sin(t * 7) * 1.2 : 0.0;
    // camera orbit around the dam
    var R = isMobile ? 17 : 14.5, cx = Math.sin(yaw) * R, cz = -Math.cos(yaw) * R + 0.8;
    camera.position.set(cx, isMobile ? 9 : 7.6, cz); camera.lookAt(0, 0.5, 1.2);
    renderer.render(scene, camera); labels3D();
    requestAnimationFrame(frame);
  }

  /* ---------------- 2D fallback (no WebGL): tank cross-section ---------------- */
  var ctx2 = null;
  function draw2D() {
    if (!ctx2) ctx2 = cv.getContext('2d'); var r = stage.getBoundingClientRect(), dpr = window.devicePixelRatio || 1; cv.width = r.width * dpr; cv.height = r.height * dpr; var c = ctx2, w = cv.width, h = cv.height;
    c.fillStyle = '#0b0f16'; c.fillRect(0, 0, w, h); var cur = M.weeks[S.week - 1], pad = 40 * dpr, tw = w * 0.5, th = h - pad * 2, x0 = pad, y0 = pad;
    c.strokeStyle = '#8e8b84'; c.lineWidth = 6 * dpr; c.strokeRect(x0, y0, tw, th);
    var lvl = levelFor(cur.total) / 1.0, yw = y0 + th - th * Math.min(1, lvl / 1.0 * 0.8 / 0.8) * 0.8;
    c.fillStyle = cur.short ? 'rgba(227,30,36,.55)' : 'rgba(27,79,138,.85)'; c.fillRect(x0 + 3 * dpr, yw, tw - 6 * dpr, y0 + th - yw);
    var yN = y0 + th - th * 0.8 * 0.8, yR = y0 + th - th * 0.72 * 0.8;
    c.strokeStyle = '#fff'; c.lineWidth = 2 * dpr; c.beginPath(); c.moveTo(x0, yN); c.lineTo(x0 + tw, yN); c.stroke();
    c.strokeStyle = '#E31E24'; c.beginPath(); c.moveTo(x0, yR); c.lineTo(x0 + tw, yR); c.stroke();
    c.fillStyle = '#fff'; c.font = (12 * dpr) + 'px JetBrains Mono, monospace'; c.fillText('NEED ' + S.seats, x0 + tw + 8 * dpr, yN + 4 * dpr); c.fillStyle = '#E31E24'; c.fillText('90%', x0 + tw + 8 * dpr, yR + 4 * dpr);
    c.fillStyle = '#fff'; c.fillText(Math.round(cur.total) + ' of ' + S.seats + ' seats · week ' + S.week, x0, y0 - 12 * dpr);
    if (lab) lab.innerHTML = '';
  }

  /* ---------------- inputs ---------------- */
  var keys = ['seats', 'hires', 'floor', 'a30', 'a60', 'a90'];
  function clamp(k, v) { var r = $(k); v = Math.round(+v || 0); return Math.max(+r.min, Math.min(+r.max, v)); }
  function readAll() { keys.forEach(function (k) { S[k] = +$(k).value; }); S.week = +$('t').value; var o = $('o-att'); if (o) o.textContent = S.a30 + '% / ' + S.a60 + '% / ' + S.a90 + '%'; }
  function syncNum(k) { var n = $('n-' + k); if (n) n.value = $(k).value; }
  keys.forEach(function (k) { $(k).addEventListener('input', function () { syncNum(k); update(true); });
    var n = $('n-' + k); if (n) { n.addEventListener('change', function () { $(k).value = clamp(k, n.value); n.value = $(k).value; update(true); }); n.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); n.blur(); } }); } });
  $('t').addEventListener('input', function () { update(true); });
  var useGL = initGL();
  function update(fromUser) { readAll(); compute(); renderText(); link(); if (fromUser) { touched = true; signal(); } if (useGL) { size(); setTargets(); } else draw2D(); }
  window.addEventListener('resize', function () { if (useGL) size(); else draw2D(); });
  var moved = false, downX = 0;
  stage.addEventListener('pointerdown', function (e) { dragging = true; moved = false; lx = e.clientX; downX = e.clientX; touched = true; try { stage.setPointerCapture(e.pointerId); } catch (x) {} });
  stage.addEventListener('pointermove', function (e) { if (!dragging) return; var dx = e.clientX - lx; lx = e.clientX; if (Math.abs(e.clientX - downX) > 6) moved = true; if (useGL) { yaw = Math.max(-1.0, Math.min(1.0, yaw - dx * 0.006)); yawTgt = yaw; } });
  stage.addEventListener('pointerup', function (e) { dragging = false; if (!moved && !useGL) { var r = stage.getBoundingClientRect(); $('t').value = Math.max(1, Math.min(WEEKS, Math.ceil((e.clientX - r.left) / r.width * WEEKS))); update(true); } });
  stage.addEventListener('pointercancel', function () { dragging = false; });
  var ctl = $('ctl'), sheetbtn = $('sheetbtn'), closeSheet = $('closeSheet');
  if (sheetbtn) sheetbtn.addEventListener('click', function () { ctl.classList.add('open'); });
  if (closeSheet) closeSheet.addEventListener('click', function () { ctl.classList.remove('open'); });
  keys.forEach(syncNum); update(false);
  if (useGL) { levelCur = levelTgt; pondCur = pondTgt; requestAnimationFrame(frame); }
})();
