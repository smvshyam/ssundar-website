/* SSUNDAR — March Bench simulator: THE RESERVOIRS (global). Real 3D via self-hosted Three.js r128.
   One reservoir per selected geography. Water behind each dam = that geography's delivery-ready bench; gauge = seats needed
   (white) and 90% (red); tributaries = cohorts landing; seepage = attrition; holding pond = hired, not yet proficient.
   Geography starting points are illustrative, editable, and NOT benchmarks. */
(function () {
  'use strict';
  var stage = document.getElementById('stage'), cv = document.getElementById('gl'), lab = document.getElementById('labels');
  if (!stage || !cv) return;
  var $ = function (id) { return document.getElementById(id); };
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isMobile = Math.min(window.innerWidth, window.innerHeight) < 700;

  /* ---------------- geographies: illustrative starting points (editable; not benchmarks) ---------------- */
  var GEO = [
    { id: 'in', name: 'India', hubs: 'Bengaluru · Hyderabad · Pune · NCR', seats: 120, hires: 25, floor: 45, prof: 21, a30: 10, a60: 18, a90: 25, loss: 8, watch: 'No-shows between offer and day one; a cohort can lose a tenth before it starts.' },
    { id: 'ph', name: 'Philippines', hubs: 'Manila · Cebu · Clark', seats: 100, hires: 25, floor: 40, prof: 21, a30: 12, a60: 20, a90: 28, loss: 10, watch: 'First-30-day attrition on night shifts; transport and schedule fit decide who stays.' },
    { id: 'cn', name: 'China', hubs: 'Dalian · Chengdu · Shanghai', seats: 60, hires: 15, floor: 50, prof: 28, a30: 8, a60: 14, a90: 20, loss: 6, watch: 'Proficiency speed on multilingual queues; graduation and floor-ready are not the same day.' },
    { id: 'me', name: 'MENA', hubs: 'Cairo · Dubai · Riyadh · Amman', seats: 60, hires: 15, floor: 55, prof: 28, a30: 6, a60: 12, a90: 16, loss: 5, watch: 'Visa and onboarding lead time stretch offer-to-floor; the leak is late, not lost.' },
    { id: 'za', name: 'South Africa', hubs: 'Cape Town · Johannesburg · Durban', seats: 80, hires: 20, floor: 42, prof: 21, a30: 9, a60: 16, a90: 22, loss: 8, watch: 'Shift and transport no-shows; dependable attendance is the proficiency gate.' },
    { id: 'eu', name: 'Europe', hubs: 'Warsaw · Dublin · Sofia · Lisbon', seats: 50, hires: 12, floor: 60, prof: 25, a30: 6, a60: 11, a90: 15, loss: 4, watch: 'Notice periods make offer-to-floor slow; forecast two cohorts ahead or the bench is late.' },
    { id: 'na', name: 'North America', hubs: 'US · Canada', seats: 60, hires: 15, floor: 35, prof: 18, a30: 14, a60: 24, a90: 32, loss: 12, watch: 'Fast to the floor, highest early attrition; the first 30 days decide the quarter.' },
    { id: 'la', name: 'Latin America', hubs: 'Bogotá · Mexico City · São Paulo · San José', seats: 80, hires: 20, floor: 40, prof: 21, a30: 11, a60: 19, a90: 26, loss: 9, watch: 'Bilingual proficiency ramps slower than graduation suggests; measure at the seat, not the classroom.' },
    { id: 'anz', name: 'ANZ', hubs: 'Sydney · Melbourne · Auckland', seats: 40, hires: 10, floor: 50, prof: 21, a30: 8, a60: 14, a90: 19, loss: 6, watch: 'Small cohorts and long floor time; one no-show is a visible gap.' }
  ];
  var geoById = {}; GEO.forEach(function (g) { geoById[g.id] = g; });
  var state = { selected: ['in', 'ph'], active: 'in', week: 13, params: {} };
  GEO.forEach(function (g) { state.params[g.id] = { seats: g.seats, hires: g.hires, floor: g.floor, prof: g.prof, a30: g.a30, a60: g.a60, a90: g.a90, loss: g.loss }; });

  /* ---------------- model ---------------- */
  var WEEKS = 13, COHORT_GAP = 21, START_BENCH = 0.93, TEN_ATTR = 0.03;
  function surv(age, p) { var a30 = p.a30 / 100, a60 = Math.max(p.a60 / 100, a30), a90 = Math.max(p.a90 / 100, a60);
    if (age <= 0) return 1; if (age <= 30) return 1 - a30 * age / 30; if (age <= 60) return 1 - a30 - (a60 - a30) * (age - 30) / 30;
    if (age <= 90) return 1 - a60 - (a90 - a60) * (age - 60) / 30; return 1 - a90; }
  function prof(age, p) { if (age < p.floor) return 0; var a = age - p.floor, P = Math.max(1, p.prof); return a >= P ? 1 : 0.3 + 0.7 * a / P; }
  function run(p, starts) {
    var weeks = [], loss = p.loss / 100;
    for (var w = 1; w <= WEEKS; w++) {
      var d = Math.min(90, w * 7), ten = p.seats * START_BENCH * (1 - TEN_ATTR * d / 30), tot = ten, ramp = 0, lost = p.seats * START_BENCH * TEN_ATTR * d / 30;
      starts.forEach(function (s) { var age = d - s; if (age < 0) return; var alive = p.hires * (1 - loss) * surv(age, p), ready = alive * prof(age, p); tot += ready; ramp += alive - ready; lost += p.hires * (1 - loss) * (1 - surv(age, p)); });
      weeks.push({ w: w, day: d, total: tot, ramp: ramp, lost: lost, short: tot < 0.9 * p.seats });
    }
    var red = 0, lastRed = 0; weeks.forEach(function (x) { if (x.short) { if (!red) red = x.w; lastRed = x.w; } });
    return { weeks: weeks, red: red, lastRed: lastRed, starts: starts };
  }
  function computeOne(id) {
    var p = state.params[id], starts = []; for (var s = 0; s < 90; s += COHORT_GAP) starts.push(s);
    var m = run(p, starts); m.action = null;
    if (m.red) {
      var redDay = m.red * 7, k = -1;
      for (var i = 0; i < starts.length; i++) { if (starts[i] + p.floor > redDay) { k = i; break; } }
      if (k > 0 && starts[k] >= 14) { var alt = starts.slice(); alt[k] = starts[k] - 14;
        m.action = { text: 'Pull cohort ' + (k + 1) + ' forward two weeks (start day ' + alt[k] + ' instead of ' + starts[k] + ').', owner: 'Operations lead', cf: run(p, alt) }; }
      else if (k === 0 && p.prof > 14) { var pp = Object.assign({}, p, { prof: Math.max(7, p.prof - 7) });
        m.action = { text: 'Cut speed to proficiency after graduation from ' + p.prof + ' to ' + Math.max(7, p.prof - 7) + ' days: first live work under a coach from day one on the floor, one topic a week.', owner: 'Training lead with operations', cf: run(pp, starts) }; }
      else if (k === 0 && p.floor > 24) { var cut = Math.min(14, p.floor - 10), pf = Object.assign({}, p, { floor: p.floor - cut });
        m.action = { text: 'Compress offer-to-floor for cohort 1 from ' + p.floor + ' to ' + (p.floor - cut) + ' days: pre-boarding before day one, classroom in two waves.', owner: 'Training lead with operations', cf: run(pf, starts) }; }
      else if (p.a30 >= 12) { var p2 = Object.assign({}, p, { a30: Math.round(p.a30 * 0.6), a60: Math.round(p.a60 * 0.75), a90: Math.round(p.a90 * 0.85) });
        m.action = { text: 'Shift two team leaders to new-hire coaching, one topic for six weeks. The leak is attrition in the first 30 days.', owner: 'Training lead', cf: run(p2, starts) }; }
      else { var p3 = Object.assign({}, p, { hires: p.hires + Math.max(5, Math.round(p.hires * 0.25)) });
        m.action = { text: 'Raise the next cohort by ' + Math.max(5, Math.round(p.hires * 0.25)) + ' and capture knowledge from notified leavers.', owner: 'HR and workforce planning', cf: run(p3, starts) }; }
    }
    return m;
  }
  var M = {};
  function computeAll() { state.selected.forEach(function (id) { M[id] = computeOne(id); }); }

  /* ---------------- UI: geography picker, tabs, inputs ---------------- */
  var picker = $('geos'), tabs = $('geotabs'), watch = $('geowatch');
  function buildPicker() {
    picker.innerHTML = GEO.map(function (g) { var on = state.selected.indexOf(g.id) >= 0; return '<label class="geo' + (on ? ' on' : '') + '"><input type="checkbox" value="' + g.id + '"' + (on ? ' checked' : '') + '><b>' + g.name + '</b><span>' + g.hubs + '</span></label>'; }).join('');
    picker.querySelectorAll('input').forEach(function (cb) { cb.addEventListener('change', function () {
      var id = cb.value, i = state.selected.indexOf(id);
      if (cb.checked && i < 0) { if (state.selected.length >= 5) { cb.checked = false; return; } state.selected.push(id); state.active = id; }
      if (!cb.checked && i >= 0) { if (state.selected.length === 1) { cb.checked = true; return; } state.selected.splice(i, 1); if (state.active === id) state.active = state.selected[0]; }
      cb.closest('label').classList.toggle('on', cb.checked);
      buildTabs(); loadInputs(); rebuildScene(); update(true);
    }); });
  }
  function buildTabs() {
    tabs.innerHTML = state.selected.map(function (id) { return '<button type="button" data-id="' + id + '"' + (id === state.active ? ' class="on"' : '') + '>' + geoById[id].name + '</button>'; }).join('');
    tabs.querySelectorAll('button').forEach(function (b) { b.addEventListener('click', function () { state.active = b.dataset.id; buildTabs(); loadInputs(); update(false); }); });
  }
  var keys = ['seats', 'hires', 'floor', 'prof', 'a30', 'a60', 'a90', 'loss'];
  function loadInputs() { var p = state.params[state.active]; keys.forEach(function (k) { var r = $(k), n = $('n-' + k); if (r) r.value = p[k]; if (n) n.value = p[k]; });
    var o = $('o-att'); if (o) o.textContent = p.a30 + '% / ' + p.a60 + '% / ' + p.a90 + '%';
    if (watch) watch.innerHTML = '<b>' + geoById[state.active].name + ' &middot; what we watch first.</b> ' + geoById[state.active].watch + ' <em>Starting points are illustrative and editable, not benchmarks.</em>'; }
  function clamp(k, v) { var r = $(k); v = Math.round(+v || 0); return Math.max(+r.min, Math.min(+r.max, v)); }
  function readInputs() { var p = state.params[state.active]; keys.forEach(function (k) { var r = $(k); if (r) p[k] = +r.value; }); state.week = +$('t').value;
    var o = $('o-att'); if (o) o.textContent = p.a30 + '% / ' + p.a60 + '% / ' + p.a90 + '%'; }
  keys.forEach(function (k) { var r = $(k), n = $('n-' + k); if (!r) return;
    r.addEventListener('input', function () { if (n) n.value = r.value; update(true); });
    if (n) { n.addEventListener('change', function () { r.value = clamp(k, n.value); n.value = r.value; update(true); }); n.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); n.blur(); } }); } });
  $('t').addEventListener('input', function () { update(true); });
  var copyAll = $('copyall'); if (copyAll) copyAll.addEventListener('click', function () { var src = state.params[state.active]; state.selected.forEach(function (id) { if (id !== state.active) ['hires', 'floor', 'prof'].forEach(function (k) { state.params[id][k] = src[k]; }); }); update(true); });

  /* ---------------- story + readout ---------------- */
  var readout = $('readout'), verdict = $('verdict'), story = $('story'), cta = $('simcta'), summary = $('geosummary');
  function wk(n) { return 'week ' + n; }
  function renderText() {
    var id = state.active, p = state.params[id], m = M[id], g = geoById[id], cur = m.weeks[state.week - 1];
    readout.innerHTML = '<b>' + g.name + '</b> &middot; week ' + state.week + ' &middot; day ' + cur.day + '<br>Reservoir: <b>' + Math.round(cur.total) + '</b> of <b>' + p.seats + '</b> seats'
      + (cur.ramp > 0.5 ? '<br>Holding pond: ' + Math.round(cur.ramp) + ' hired, not yet proficient' : '') + '<br>Seepage so far: ' + Math.round(cur.lost) + (cur.short ? '<br><b>Below the red mark</b> &mdash; under 90% of need' : '');
    var first = m.weeks[0], last = m.weeks[WEEKS - 1], landW = Math.ceil((m.starts[0] + p.floor) / 7), profW = Math.ceil((m.starts[0] + p.floor + p.prof) / 7), lines = [];
    lines.push('<b>' + g.name + ', week 1.</b> The reservoir holds ' + Math.round(first.total) + ' of the ' + p.seats + ' seats the client needs. Seepage &mdash; tenured attrition &mdash; drains about ' + Math.round(p.seats * START_BENCH * TEN_ATTR) + ' a month, and no tributary is flowing yet.');
    lines.push('<b>Cohort 1</b> (' + p.hires + ' hires; ' + Math.round(p.hires * p.loss / 100) + ' never reach the floor) graduates to the floor on day ' + p.floor + ' &mdash; ' + wk(landW) + ' &mdash; and takes another ' + p.prof + ' days to be proficient, so its tributary is at full flow only by ' + wk(profW) + '. Until then it is water you have paid for that cannot reach the town.');
    if (m.red) lines.push('<b>The level drops below the red mark in ' + wk(m.red) + (m.lastRed > m.red ? ' and stays there until ' + wk(m.lastRed) : '') + '.</b> That is the gap the client feels before you see it.');
    else lines.push('<b>The level stays above the red mark through week 13.</b>');
    lines.push('<b>Week 13.</b> ' + Math.round(last.total) + ' of ' + p.seats + ' seats' + (last.ramp > 0.5 ? ', with ' + Math.round(last.ramp) + ' still in the holding pond' : '') + '.');
    story.innerHTML = lines.map(function (l) { return '<p>' + l + '</p>'; }).join('');
    if (m.red) { var a = m.action, after = a.cf.red ? 'below the mark only from ' + wk(a.cf.red) + (a.cf.lastRed > a.cf.red ? ' to ' + wk(a.cf.lastRed) : '') : 'never below the mark';
      verdict.className = 'verdict';
      verdict.innerHTML = '<b>' + g.name + ': the bench falls short in ' + wk(m.red) + '.</b><p><i>The first action the diagnosis would return</i>' + a.text + ' Owner: ' + a.owner + '. Date: before the current start.</p><p class="cf"><i>With that one action</i>' + after.charAt(0).toUpperCase() + after.slice(1) + '. Week 13: ' + Math.round(a.cf.weeks[WEEKS - 1].total) + ' of ' + p.seats + '.</p>';
    } else { verdict.className = 'verdict ok'; verdict.innerHTML = '<b>' + g.name + ': the bench holds through week 13.</b><p><i>The first action the diagnosis would return</i>No action. Flag the associates ready for harder work to workforce planning.</p>'; }
    if (summary) {
      var shortIds = state.selected.filter(function (x) { return M[x].red; }), worst = null;
      shortIds.forEach(function (x) { if (!worst || M[x].red < M[worst].red) worst = x; });
      var rows = state.selected.map(function (x) { var mm = M[x], pp = state.params[x]; return '<li' + (mm.red ? ' class="red"' : '') + (x === state.active ? ' data-on="1"' : '') + '><b>' + geoById[x].name + '</b> ' + (mm.red ? 'short from ' + wk(mm.red) : 'holds') + ' &middot; week 13: ' + Math.round(mm.weeks[WEEKS - 1].total) + ' / ' + pp.seats + (mm.red ? ' &middot; first action: ' + mm.action.owner : '') + '</li>'; }).join('');
      summary.innerHTML = '<p>Across ' + state.selected.length + ' geograph' + (state.selected.length === 1 ? 'y' : 'ies') + (shortIds.length ? ': <b>' + shortIds.length + ' fall' + (shortIds.length === 1 ? 's' : '') + ' short</b>, worst ' + geoById[worst].name + ' in ' + wk(M[worst].red) : ': every bench holds') + '.</p><ul>' + rows + '</ul>';
    }
  }
  function link() {
    var p = state.params[state.active], m = M[state.active];
    var q = '?geos=' + state.selected.join(',') + '&geo=' + state.active + '&seats=' + p.seats + '&hires=' + p.hires + '&floor=' + p.floor + '&prof=' + p.prof + '&a30=' + p.a30 + '&a60=' + p.a60 + '&a90=' + p.a90 + (m.red ? '&red=' + m.red : '') + '&sector=' + (window.__sector || 'ramp');
    window.__simHref = '/engage' + q; if (cta) cta.href = window.__simHref;
    var go = document.getElementById('goBtn'); if (go && (go.getAttribute('href') || '').indexOf('/engage') === 0) go.setAttribute('href', window.__simHref);
  }
  window.__simLink = link;
  var firedRed = false, touched = false, lastShort = false;
  function signal() { var short = M[state.active].weeks[state.week - 1].short;
    if (short && !lastShort && touched) { try { if (navigator.vibrate) navigator.vibrate(18); } catch (e) {} } lastShort = short;
    if (M[state.active].red && touched && !firedRed) { firedRed = true; if (typeof window.gtag === 'function') window.gtag('event', 'bench_red_week', { week: M[state.active].red, geo: state.active, geos: state.selected.length }); } }

  /* ---------------- THREE scene ---------------- */
  var T = window.THREE, renderer, scene, camera, sun, terrain, clock, ok = false, res = {};
  var yaw = 0.55, yawTgt = 0.55, dragging = false, lx = 0, SP = 10.5;
  var H = 2.6, RW = 7.0, RL = 9.0;
  function levelFor(seats, need) { return Math.min(1.25, seats / need) * 0.8; }
  function noise(x, z) { return Math.sin(x * 0.9) * Math.cos(z * 0.7) * 0.5 + Math.sin(x * 2.3 + 1.7) * Math.cos(z * 1.9) * 0.25 + Math.sin(x * 5.1) * Math.sin(z * 4.3) * 0.08; }
  var concrete, treeG, treeM, pondWall, winMat, bldMat;
  function initGL() {
    if (!T) return false;
    try { renderer = new T.WebGLRenderer({ canvas: cv, antialias: !isMobile, alpha: false, powerPreference: 'high-performance' }); } catch (e) { return false; }
    renderer.setPixelRatio(Math.min(isMobile ? 1.5 : 2, window.devicePixelRatio || 1));
    renderer.shadowMap.enabled = !isMobile; renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.outputEncoding = T.sRGBEncoding; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    scene = new T.Scene(); scene.background = new T.Color(0x0b0f16); scene.fog = new T.Fog(0x0b0f16, 26, 70);
    camera = new T.PerspectiveCamera(34, 1, 0.1, 200);
    scene.add(new T.HemisphereLight(0x8fb3ff, 0x1a1410, 0.55));
    sun = new T.DirectionalLight(0xffe2b8, 1.35); sun.position.set(-8, 12, -9); sun.castShadow = !isMobile;
    sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.far = 80; sun.shadow.bias = -0.0005; scene.add(sun);
    var fill = new T.DirectionalLight(0x6f8fd8, 0.35); fill.position.set(6, 4, 8); scene.add(fill);
    concrete = new T.MeshStandardMaterial({ color: 0x8e8b84, roughness: 0.78, metalness: 0.05 });
    treeG = new T.ConeGeometry(0.22, 0.7, 6); treeM = new T.MeshStandardMaterial({ color: 0x1f3a22, roughness: 1 });
    pondWall = new T.MeshStandardMaterial({ color: 0x6f6c66, roughness: 0.9 });
    winMat = new T.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.6, emissive: 0xffc46b, emissiveIntensity: 0.6 });
    bldMat = new T.MeshStandardMaterial({ color: 0x3a3a3e, roughness: 0.8 });
    clock = new T.Clock(); ok = true; return true;
  }
  function buildTerrain(n) {
    if (terrain) { scene.remove(terrain); terrain.geometry.dispose(); }
    var width = SP * n + 18, tg = new T.PlaneGeometry(width, 34, isMobile ? 40 + 30 * n : 70 + 50 * n, isMobile ? 50 : 100); tg.rotateX(-Math.PI / 2);
    var pa = tg.attributes.position, centers = []; for (var i = 0; i < n; i++) centers.push((i - (n - 1) / 2) * SP);
    for (var v = 0; v < pa.count; v++) { var x = pa.getX(v), z = pa.getZ(v), dmin = 1e9; centers.forEach(function (c) { dmin = Math.min(dmin, Math.abs(x - c)); });
      var wall = Math.pow(Math.max(0, dmin - RW / 2) / 5.5, 1.7) * 5, basin = z > 0.2 ? -1.1 : 0, down = z < -0.2 ? -0.35 - Math.max(0, -z - 0.2) * 0.06 : 0;
      pa.setY(v, wall + basin + down + noise(x * 0.6, z * 0.6) * 0.25 * (0.3 + Math.min(1, dmin / 5))); }
    tg.computeVertexNormals(); terrain = new T.Mesh(tg, new T.MeshStandardMaterial({ color: 0x3b3a33, roughness: 0.95 })); terrain.receiveShadow = true; scene.add(terrain);
    var d = sun.shadow.camera, e = width / 2 + 4; d.left = -e; d.right = e; d.top = e; d.bottom = -e; d.updateProjectionMatrix();
  }
  function buildReservoir(id, cx) {
    var g = new T.Group(); g.position.x = cx; var R = { group: g, tribs: [], seeps: [], levelCur: 0.9, levelTgt: 0.9, pondCur: 0, pondTgt: 0 };
    var damShape = new T.Shape(); damShape.moveTo(-RW / 2 - 0.4, -1.3); damShape.lineTo(RW / 2 + 0.4, -1.3); damShape.lineTo(RW / 2 + 0.4, H + 0.25); damShape.lineTo(-RW / 2 - 0.4, H + 0.25); damShape.closePath();
    var dam = new T.Mesh(new T.ExtrudeGeometry(damShape, { depth: 0.9, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 2 }), concrete); dam.position.z = -0.45; dam.castShadow = !isMobile; dam.receiveShadow = true; g.add(dam);
    var crest = new T.Mesh(new T.BoxGeometry(RW + 0.9, 0.08, 1.0), new T.MeshStandardMaterial({ color: 0x55534e, roughness: 0.9 })); crest.position.set(0, H + 0.29, 0); g.add(crest);
    for (var r = -3; r <= 3; r++) { var post = new T.Mesh(new T.CylinderGeometry(0.02, 0.02, 0.3, 6), concrete); post.position.set(r * (RW / 6), H + 0.45, -0.9); g.add(post); }
    var gc = document.createElement('canvas'); gc.width = 256; gc.height = 1024; R.gctx = gc.getContext('2d'); R.gtex = new T.CanvasTexture(gc); R.gtex.encoding = T.sRGBEncoding;
    var gauge = new T.Mesh(new T.PlaneGeometry(1.25, 3.55), new T.MeshStandardMaterial({ map: R.gtex, transparent: true, roughness: 0.7 })); gauge.position.set(0.9, (H + 0.25 - 1.3) / 2, -0.95 - 0.08 - 0.01); gauge.rotation.y = Math.PI; g.add(gauge);
    var nc = document.createElement('canvas'); nc.width = 1024; nc.height = 256; var nctx = nc.getContext('2d'); nctx.fillStyle = 'rgba(20,20,20,0.85)'; nctx.fillRect(0, 0, 1024, 256); nctx.fillStyle = '#fff'; nctx.font = 'bold 150px Chakra Petch, Impact, Arial Black, sans-serif'; nctx.textAlign = 'center'; nctx.fillText(geoById[id].name.toUpperCase(), 512, 185);
    var ntex = new T.CanvasTexture(nc); ntex.encoding = T.sRGBEncoding; var plate = new T.Mesh(new T.PlaneGeometry(3.2, 0.8), new T.MeshStandardMaterial({ map: ntex, roughness: 0.6 })); plate.position.set(-1.4, H - 0.55, -0.95 - 0.08 - 0.01); plate.rotation.y = Math.PI; g.add(plate);
    R.lamp = new T.Mesh(new T.SphereGeometry(0.12, 12, 12), new T.MeshStandardMaterial({ color: 0x330000, emissive: 0xE31E24, emissiveIntensity: 0 })); R.lamp.position.set(0.9, H + 0.62, -0.9); g.add(R.lamp);
    var lp = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 0.3, 6), concrete); lp.position.set(0.9, H + 0.45, -0.9); g.add(lp);
    var wg = new T.PlaneGeometry(RW, RL, isMobile ? 30 : 60, isMobile ? 40 : 80); wg.rotateX(-Math.PI / 2);
    R.waterMat = new T.MeshPhysicalMaterial({ color: 0x1b4f8a, roughness: 0.12, metalness: 0, transparent: true, opacity: 0.86, clearcoat: 1, clearcoatRoughness: 0.08, side: T.DoubleSide });
    R.water = new T.Mesh(wg, R.waterMat); R.water.position.set(0, 0, RL / 2 + 0.1); R.water.receiveShadow = !isMobile; g.add(R.water); R.base = wg.attributes.position.array.slice();
    R.body = new T.Mesh(new T.BoxGeometry(RW - 0.02, 1, RL - 0.02), new T.MeshStandardMaterial({ color: 0x08203a, transparent: true, opacity: 0.55, roughness: 1 })); R.body.position.set(0, 0, RL / 2 + 0.1); g.add(R.body);
    var pondW = 2.4, pondL = 2.2, pz = RL + 1.9;
    [[-pondW / 2 - 0.1, pz, 0.2, pondL + 0.4], [pondW / 2 + 0.1, pz, 0.2, pondL + 0.4], [0, pz + pondL / 2 + 0.1, pondW + 0.4, 0.2]].forEach(function (b) { var m = new T.Mesh(new T.BoxGeometry(b[2], 1.2, b[3]), pondWall); m.position.set(b[0], 0.1, b[1]); g.add(m); });
    R.gate = new T.Mesh(new T.BoxGeometry(pondW + 0.4, 1.3, 0.14), new T.MeshStandardMaterial({ color: 0xb04a1f, roughness: 0.6, metalness: 0.3 })); R.gate.position.set(0, 0.15, pz - pondL / 2 - 0.05); g.add(R.gate);
    R.pond = new T.Mesh(new T.PlaneGeometry(pondW, pondL), new T.MeshPhysicalMaterial({ color: 0xc98a2a, roughness: 0.25, transparent: true, opacity: 0.85, clearcoat: 0.6 })); R.pond.rotation.x = -Math.PI / 2; R.pond.position.set(0, -0.4, pz); g.add(R.pond);
    var starts = []; for (var s0 = 0; s0 < 90; s0 += COHORT_GAP) starts.push(s0);
    starts.forEach(function (st, i) { var side = i % 2 === 0 ? 1 : -1, zz = 2.2 + i * 1.35;
      var chan = new T.Mesh(new T.BoxGeometry(3.2, 0.12, 0.42), new T.MeshStandardMaterial({ color: 0x4a4a44, roughness: 1 })); chan.position.set(side * (RW / 2 + 1.3), 0.95 + i * 0.12, zz); chan.rotation.z = side * -0.32; g.add(chan);
      var flow = new T.Mesh(new T.BoxGeometry(3.1, 0.08, 0.3), new T.MeshPhysicalMaterial({ color: 0x3d8fd6, roughness: 0.15, transparent: true, opacity: 0, clearcoat: 1 })); flow.position.copy(chan.position); flow.position.y += 0.1; flow.rotation.z = chan.rotation.z; g.add(flow);
      R.tribs.push({ flow: flow, start: st, side: side, z: zz, i: i }); });
    for (var q = 0; q < 5; q++) { var sp = new T.Mesh(new T.PlaneGeometry(0.06, 2.4), new T.MeshBasicMaterial({ color: 0x9fd3ff, transparent: true, opacity: 0, side: T.DoubleSide })); sp.position.set(-RW / 2 + 0.9 + q * (RW - 1.8) / 4, 0.3, -1.05); g.add(sp); R.seeps.push(sp); }
    for (var b2 = 0; b2 < (isMobile ? 18 : 34); b2++) { var bw = 0.3 + Math.random() * 0.5, bh = 0.3 + Math.random() * 0.9, bd = 0.3 + Math.random() * 0.5, bx = (Math.random() - 0.5) * 6, bz = -3.2 - Math.random() * 6;
      var bm = new T.Mesh(new T.BoxGeometry(bw, bh, bd), Math.random() < 0.35 ? winMat : bldMat); bm.position.set(bx, -0.35 - Math.max(0, -bz - 0.2) * 0.06 + bh / 2, bz); bm.castShadow = !isMobile; bm.receiveShadow = true; g.add(bm); }
    for (var t = 0; t < (isMobile ? 24 : 50); t++) { var tx = (Math.random() < 0.5 ? -1 : 1) * (RW / 2 + 0.8 + Math.random() * 3.5), tz = -2 + Math.random() * 14;
      var ty = Math.pow(Math.max(0, Math.abs(tx) - RW / 2) / 5.5, 1.7) * 5 + (tz > 0.2 ? -1.1 : 0) + (tz < -0.2 ? -0.35 : 0); var tr = new T.Mesh(treeG, treeM); tr.position.set(tx, ty + 0.25, tz); tr.scale.setScalar(0.45 + Math.random() * 0.5); g.add(tr); }
    scene.add(g); return R;
  }
  function rebuildScene() {
    if (!ok) return;
    Object.keys(res).forEach(function (id) { scene.remove(res[id].group); }); res = {};
    var n = state.selected.length; buildTerrain(n);
    state.selected.forEach(function (id, i) { res[id] = buildReservoir(id, (i - (n - 1) / 2) * SP); });
  }
  function paintGauge(R, p) {
    var c = R.gctx, w = 256, h = 1024; c.clearRect(0, 0, w, h); c.fillStyle = 'rgba(245,245,240,0.92)'; c.fillRect(0, 0, w, h);
    function yFor(seats) { return h - ((levelFor(seats, p.seats) * H + 1.3) / 3.55) * h; }
    c.strokeStyle = '#333'; c.lineWidth = 3; c.font = 'bold 34px JetBrains Mono, monospace'; c.fillStyle = '#222'; c.textAlign = 'left';
    var step = Math.max(5, Math.round(p.seats / 8 / 5) * 5);
    for (var v = 0; v <= p.seats * 1.25; v += step) { var y = yFor(v); c.beginPath(); c.moveTo(0, y); c.lineTo(30, y); c.stroke(); if ((v / step) % 2 === 0) c.fillText(String(v), 44, y + 12); }
    var yN = yFor(p.seats), yR = yFor(0.9 * p.seats);
    c.fillStyle = 'rgba(227,30,36,0.28)'; c.fillRect(0, yR, w, h - yR);
    c.strokeStyle = '#E31E24'; c.lineWidth = 8; c.beginPath(); c.moveTo(0, yR); c.lineTo(w, yR); c.stroke();
    c.strokeStyle = '#111'; c.lineWidth = 6; c.beginPath(); c.moveTo(0, yN); c.lineTo(w, yN); c.stroke();
    c.fillStyle = '#111'; c.font = 'bold 30px Inter Tight, Arial, sans-serif'; c.textAlign = 'right'; c.fillText('NEED ' + p.seats, w - 10, yN - 10); c.fillStyle = '#E31E24'; c.fillText('90%', w - 10, yR + 36);
    R.gtex.needsUpdate = true;
  }
  function size() { var r = stage.getBoundingClientRect(); renderer.setSize(Math.max(1, Math.round(r.width)), Math.max(1, Math.round(r.height)), false); camera.aspect = r.width / r.height; camera.updateProjectionMatrix(); }
  function setTargets() { state.selected.forEach(function (id) { var R = res[id], p = state.params[id], cur = M[id].weeks[state.week - 1]; if (!R) return; R.levelTgt = levelFor(cur.total, p.seats); R.pondTgt = Math.min(1, cur.ramp / Math.max(1, p.hires)); paintGauge(R, p); }); }
  function proj(x, y, z) { var v = new T.Vector3(x, y, z).project(camera); var r = stage.getBoundingClientRect(); return [(v.x * 0.5 + 0.5) * r.width, (0.5 - v.y * 0.5) * r.height]; }
  function labels3D() {
    if (!lab) return; var h = '';
    state.selected.forEach(function (id) { var R = res[id]; if (!R) return; var p = state.params[id], cur = M[id].weeks[state.week - 1], cx = R.group.position.x, act = id === state.active;
      var pt = proj(cx + 0.9, H + 0.85, -0.9); h += '<span class="ln' + (cur.short ? ' red' : '') + (act ? ' on' : '') + '" style="left:' + pt[0] + 'px;top:' + pt[1] + 'px">' + geoById[id].name + ' &middot; ' + Math.round(cur.total) + ' / ' + p.seats + '</span>';
      if (act) { var hp = proj(cx, 0.9, RL + 1.9); h += '<span class="lw" style="left:' + hp[0] + 'px;top:' + hp[1] + 'px">Holding pond &middot; ' + Math.round(cur.ramp) + ' not yet proficient</span>';
        R.tribs.forEach(function (tb) { var landW = Math.ceil((tb.start + p.floor) / 7); if (landW > 14) return; var tp = proj(cx + tb.side * (RW / 2 + 2.4), 1.5 + tb.i * 0.12, tb.z);
          h += '<span class="lw' + (state.week >= landW ? ' on' : '') + '" style="left:' + tp[0] + 'px;top:' + tp[1] + 'px">Cohort ' + (tb.i + 1) + ' &middot; ' + (state.week >= landW ? 'flowing' : 'lands wk ' + landW) + '</span>'; });
        var sp = proj(cx, -1.0, -1.3); h += '<span class="lw" style="left:' + sp[0] + 'px;top:' + sp[1] + 'px">Seepage &middot; attrition ' + p.a30 + '/' + p.a60 + '/' + p.a90 + '%</span>';
        var tn = proj(cx, 0.9, -8.2); h += '<span class="lw" style="left:' + tn[0] + 'px;top:' + tn[1] + 'px">The client &middot; needs ' + p.seats + ' seats</span>'; } });
    lab.innerHTML = h;
  }
  function frame() {
    var dt = Math.min(0.05, clock.getDelta()), t = clock.elapsedTime, n = state.selected.length;
    if (!dragging) { if (!reduced && !touched) yawTgt = 0.55 + Math.sin(t * 0.16) * 0.12; yaw += (yawTgt - yaw) * Math.min(1, dt * 3); }
    state.selected.forEach(function (id) { var R = res[id]; if (!R) return; var p = state.params[id], cur = M[id].weeks[state.week - 1], short = cur.short;
      R.levelCur += (R.levelTgt - R.levelCur) * Math.min(1, dt * 2.2); R.pondCur += (R.pondTgt - R.pondCur) * Math.min(1, dt * 2.2);
      var y = R.levelCur * H; R.water.position.y = y; R.body.scale.y = Math.max(0.02, y + 1.1); R.body.position.y = (y - 1.1) / 2;
      var pa = R.water.geometry.attributes.position, base = R.base;
      for (var i = 0; i < pa.count; i++) { var bx = base[i * 3], bz = base[i * 3 + 2]; pa.setY(i, Math.sin(bx * 1.8 + t * 1.3) * 0.025 + Math.cos(bz * 1.4 - t * 1.1) * 0.03 + Math.sin((bx + bz) * 3.1 + t * 2.0) * 0.012); }
      pa.needsUpdate = true; R.water.geometry.computeVertexNormals();
      R.waterMat.color.setHex(short ? 0x6b2a2e : 0x1b4f8a);
      R.pond.position.y = -0.45 + R.pondCur * 0.9; R.pond.visible = R.pondCur > 0.03; R.gate.position.y = 0.15 + (cur.ramp < 0.5 && state.week > 1 ? 0.5 : 0);
      R.tribs.forEach(function (tb) { var landW = Math.ceil((tb.start + p.floor) / 7), m = tb.flow.material; m.opacity += ((state.week >= landW ? 0.9 : 0) - m.opacity) * Math.min(1, dt * 3); });
      var seepAmt = Math.min(1, (p.a30 + p.a60 + p.a90) / 90);
      R.seeps.forEach(function (sp, i) { sp.material.opacity = 0.15 + seepAmt * 0.5 * (0.6 + 0.4 * Math.sin(t * 3 + i)); sp.scale.y = 0.6 + seepAmt * 0.6; sp.position.y = 0.3 - (1 - sp.scale.y) * 1.2; });
      R.lamp.material.emissiveIntensity = short ? 1.6 + Math.sin(t * 7) * 1.2 : 0; });
    var span = SP * (n - 1) + RW, R0 = (isMobile ? 17 : 14.5) + span * (isMobile ? 0.95 : 0.78), cx = Math.sin(yaw) * R0, cz = -Math.cos(yaw) * R0 + 0.8;
    camera.position.set(cx, (isMobile ? 9 : 7.6) + span * 0.25, cz); camera.lookAt(0, 0.5, 1.2);
    renderer.render(scene, camera); labels3D(); requestAnimationFrame(frame);
  }

  /* ---------------- 2D fallback ---------------- */
  var ctx2 = null;
  function draw2D() {
    if (!ctx2) ctx2 = cv.getContext('2d'); var r = stage.getBoundingClientRect(), dpr = window.devicePixelRatio || 1; cv.width = r.width * dpr; cv.height = r.height * dpr; var c = ctx2, w = cv.width, h = cv.height, n = state.selected.length;
    c.fillStyle = '#0b0f16'; c.fillRect(0, 0, w, h); var pad = 30 * dpr, tw = (w - pad * (n + 1)) / n, th = h - pad * 2;
    state.selected.forEach(function (id, i) { var p = state.params[id], cur = M[id].weeks[state.week - 1], x0 = pad + i * (tw + pad), y0 = pad, lvl = levelFor(cur.total, p.seats);
      c.strokeStyle = '#8e8b84'; c.lineWidth = 4 * dpr; c.strokeRect(x0, y0, tw, th); var yw = y0 + th - th * lvl; c.fillStyle = cur.short ? 'rgba(227,30,36,.55)' : 'rgba(27,79,138,.85)'; c.fillRect(x0 + 2 * dpr, yw, tw - 4 * dpr, y0 + th - yw);
      var yN = y0 + th - th * 0.8, yR = y0 + th - th * 0.72; c.strokeStyle = '#fff'; c.lineWidth = 2 * dpr; c.beginPath(); c.moveTo(x0, yN); c.lineTo(x0 + tw, yN); c.stroke(); c.strokeStyle = '#E31E24'; c.beginPath(); c.moveTo(x0, yR); c.lineTo(x0 + tw, yR); c.stroke();
      c.fillStyle = '#fff'; c.font = (12 * dpr) + 'px JetBrains Mono, monospace'; c.fillText(geoById[id].name + ' · ' + Math.round(cur.total) + '/' + p.seats, x0, y0 - 10 * dpr); });
    if (lab) lab.innerHTML = '';
  }

  /* ---------------- wiring ---------------- */
  var useGL = initGL();
  function update(fromUser) { readInputs(); computeAll(); renderText(); link(); if (fromUser) { touched = true; signal(); } if (useGL) { size(); setTargets(); } else draw2D(); }
  window.addEventListener('resize', function () { if (useGL) size(); else draw2D(); });
  var moved = false, downX = 0;
  stage.addEventListener('pointerdown', function (e) { dragging = true; moved = false; lx = e.clientX; downX = e.clientX; touched = true; try { stage.setPointerCapture(e.pointerId); } catch (x) {} });
  stage.addEventListener('pointermove', function (e) { if (!dragging) return; var dx = e.clientX - lx; lx = e.clientX; if (Math.abs(e.clientX - downX) > 6) moved = true; if (useGL) { yaw = Math.max(-1.0, Math.min(1.0, yaw - dx * 0.006)); yawTgt = yaw; } });
  stage.addEventListener('pointerup', function () { dragging = false; });
  stage.addEventListener('pointercancel', function () { dragging = false; });
  var ctl = $('ctl'), sheetbtn = $('sheetbtn'), closeSheet = $('closeSheet');
  if (sheetbtn) sheetbtn.addEventListener('click', function () { ctl.classList.add('open'); });
  if (closeSheet) closeSheet.addEventListener('click', function () { ctl.classList.remove('open'); });
  try { var q = new URLSearchParams(location.search), gs = (q.get('geos') || '').split(',').filter(function (x) { return geoById[x]; }); if (gs.length) { state.selected = gs.slice(0, 5); state.active = geoById[q.get('geo')] && gs.indexOf(q.get('geo')) >= 0 ? q.get('geo') : gs[0]; } } catch (e) {}
  buildPicker(); buildTabs(); loadInputs(); if (useGL) rebuildScene();
  update(false);
  if (useGL) { Object.keys(res).forEach(function (id) { res[id].levelCur = res[id].levelTgt; res[id].pondCur = res[id].pondTgt; }); requestAnimationFrame(frame); }
})();
