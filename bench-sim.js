/* SSUNDAR — March Bench simulator (illustrative). Hand-rolled WebGL (CSP: no CDN).
   One 3D bar per week, stacked by who is on the floor; translucent block on top = hired but not yet proficient;
   white plane = seats needed; red line = 90% of need. Labels are HTML, projected from the 3D scene. */
(function () {
  'use strict';
  var stage = document.getElementById('stage'), cv = document.getElementById('gl'), lab = document.getElementById('labels');
  if (!stage || !cv) return;
  var $ = function (id) { return document.getElementById(id); };
  var S = { seats: 80, hires: 15, floor: 45, a30: 10, a60: 18, a90: 25, week: 13 };
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- model ---------------- */
  var WEEKS = 13, COHORT_GAP = 21, FLOOR_LOSS = 0.08, START_BENCH = 0.93, TEN_ATTR = 0.03, PROF_DAYS = 21;
  var M = null; // computed model
  function surv(age, p) { var a30 = p.a30 / 100, a60 = Math.max(p.a60 / 100, a30), a90 = Math.max(p.a90 / 100, a60);
    if (age <= 0) return 1; if (age <= 30) return 1 - a30 * age / 30; if (age <= 60) return 1 - a30 - (a60 - a30) * (age - 30) / 30;
    if (age <= 90) return 1 - a60 - (a90 - a60) * (age - 60) / 30; return 1 - a90; }
  function prof(age, p) { if (age < p.floor) return 0; var a = age - p.floor; return a >= PROF_DAYS ? 1 : 0.3 + 0.7 * a / PROF_DAYS; }
  function run(p, starts) {
    var weeks = [];
    for (var w = 1; w <= WEEKS; w++) {
      var d = w * 7, ten = p.seats * START_BENCH * (1 - TEN_ATTR * d / 30), segs = [ten], ramp = 0;
      starts.forEach(function (s) { var age = d - s; if (age < 0) { segs.push(0); return; }
        var alive = p.hires * (1 - FLOOR_LOSS) * surv(age, p), ready = alive * prof(age, p); segs.push(ready); ramp += alive - ready; });
      var tot = segs.reduce(function (a, b) { return a + b; }, 0);
      weeks.push({ w: w, day: d, segs: segs, total: tot, ramp: ramp, short: tot < 0.9 * p.seats });
    }
    var red = 0, lastRed = 0; weeks.forEach(function (x) { if (x.short) { if (!red) red = x.w; lastRed = x.w; } });
    return { weeks: weeks, red: red, lastRed: lastRed, starts: starts };
  }
  function compute() {
    var starts = []; for (var s = 0; s < 90; s += COHORT_GAP) starts.push(s);
    M = run(S, starts);
    // the action: pull the first cohort that lands after the red day forward two weeks; evaluate the counterfactual
    M.action = null;
    if (M.red) {
      var redDay = M.red * 7, k = -1;
      for (var i = 0; i < starts.length; i++) { if (starts[i] + S.floor > redDay) { k = i; break; } }
      if (k >= 0) {
        var alt = starts.slice(); alt[k] = Math.max(0, alt[k] - 14);
        var cf = run(S, alt);
        M.action = { k: k, text: 'Pull cohort ' + (k + 1) + ' forward two weeks (start day ' + alt[k] + ' instead of ' + starts[k] + ').', owner: 'Operations lead', cf: cf,
          lands: Math.round(S.hires * (1 - FLOOR_LOSS)) };
      } else if (S.a30 >= 15) {
        var p2 = Object.assign({}, S, { a30: Math.round(S.a30 * 0.6), a60: Math.round(S.a60 * 0.75), a90: Math.round(S.a90 * 0.85) });
        M.action = { k: -1, text: 'Shift two team leaders to new-hire coaching, one topic for six weeks. The leak is attrition in the first 30 days.', owner: 'Training lead', cf: run(p2, starts) };
      } else {
        var p3 = Object.assign({}, S, { hires: S.hires + Math.max(5, Math.round(S.hires * 0.25)) });
        M.action = { k: -1, text: 'Raise the next cohort by ' + Math.max(5, Math.round(S.hires * 0.25)) + ' and capture knowledge from notified leavers.', owner: 'HR and workforce planning', cf: run(p3, starts) };
      }
    }
  }

  /* ---------------- story + readout ---------------- */
  var readout = $('readout'), verdict = $('verdict'), story = $('story'), cta = $('simcta');
  function wk(n) { return 'week ' + n; }
  function renderText() {
    var cur = M.weeks[S.week - 1], r = Math.round(cur.total);
    readout.innerHTML = 'Week ' + S.week + ' &middot; day ' + cur.day + '<br><b>' + r + '</b> ready against <b>' + S.seats + '</b> needed'
      + (cur.ramp > 0.5 ? '<br>' + Math.round(cur.ramp) + ' hired, not yet proficient' : '') + (cur.short ? '<br><b>Short</b> &mdash; below 90% of need' : '');
    var first = M.weeks[0], last = M.weeks[WEEKS - 1];
    var landW = Math.ceil((M.starts[0] + S.floor) / 7), profW = Math.ceil((M.starts[0] + S.floor + PROF_DAYS) / 7);
    var lines = [];
    lines.push('<b>Week 1.</b> ' + Math.round(first.total) + ' of ' + S.seats + ' seats are delivery-ready. Tenured attrition erodes that by about ' + Math.round(S.seats * START_BENCH * TEN_ATTR) + ' a month, and nothing replaces them until the first cohort is proficient.');
    lines.push('<b>Cohort 1</b> (' + S.hires + ' hires, ' + Math.round(S.hires * FLOOR_LOSS) + ' never reach the floor) lands on day ' + S.floor + ' &mdash; ' + wk(landW) + ' &mdash; and is proficient by ' + wk(profW) + '. Until then they are paid seats that do not earn.');
    if (M.red) lines.push('<b>The bench falls below 90% in ' + wk(M.red) + (M.lastRed > M.red ? ' and stays short until ' + wk(M.lastRed) : '') + '.</b> That is the gap the client feels before you see it.');
    else lines.push('<b>The bench holds through week 13.</b> Re-run when the next hire plan or attrition number changes.');
    lines.push('<b>Week 13.</b> ' + Math.round(last.total) + ' ready against ' + S.seats + ' needed' + (last.ramp > 0.5 ? ', with ' + Math.round(last.ramp) + ' still in ramp' : '') + '.');
    story.innerHTML = lines.map(function (l) { return '<p>' + l + '</p>'; }).join('');
    if (M.red) {
      var a = M.action, after = a.cf.red ? 'short only from ' + wk(a.cf.red) + (a.cf.lastRed > a.cf.red ? ' to ' + wk(a.cf.lastRed) : '') : 'no week short';
      verdict.className = 'verdict';
      verdict.innerHTML = '<b>Your bench falls short in ' + wk(M.red) + '.</b><p><i>The first action the diagnosis would return</i>' + a.text + ' Owner: ' + a.owner + '. Date: before the current start.</p>'
        + '<p class="cf"><i>With that one action</i>' + after.charAt(0).toUpperCase() + after.slice(1) + '. Week 13: ' + Math.round(a.cf.weeks[WEEKS - 1].total) + ' ready.</p>';
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

  /* ---------------- analytics + haptics ---------------- */
  var firedRed = false, touched = false, lastShort = false;
  function signal() {
    var short = M.weeks[S.week - 1].short;
    if (short && !lastShort && touched) { try { if (navigator.vibrate) navigator.vibrate(18); } catch (e) {} }
    lastShort = short;
    if (M.red && touched && !firedRed) { firedRed = true; if (typeof window.gtag === 'function') window.gtag('event', 'bench_red_week', { week: M.red, seats: S.seats }); }
  }

  /* ---------------- WebGL ---------------- */
  var gl = null, prog, buf = {}, nIdx = 0, yaw = -0.42, pitch = 0.33, dragging = false, lx = 0, autoRot = !reduced, lastT = 0;
  var W = 1, H = 1, dpr = Math.min(2, window.devicePixelRatio || 1), MVP;
  function initGL() {
    try { gl = cv.getContext('webgl', { antialias: true, alpha: false, powerPreference: 'low-power' }); } catch (e) { gl = null; }
    if (!gl) return false;
    var vs = 'attribute vec3 p;attribute vec3 n;attribute vec4 c;uniform mat4 mvp;uniform vec3 L;varying vec4 vc;void main(){float d=max(dot(normalize(n),normalize(L)),0.0);vc=vec4(c.rgb*(0.5+0.5*d),c.a);gl_Position=mvp*vec4(p,1.0);}';
    var fs = 'precision mediump float;varying vec4 vc;void main(){gl_FragColor=vc;}';
    function sh(t, s) { var o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return o; }
    prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { gl = null; return false; }
    gl.useProgram(prog);
    buf.p = gl.createBuffer(); buf.n = gl.createBuffer(); buf.c = gl.createBuffer(); buf.i = gl.createBuffer();
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    return true;
  }
  // world units: x across weeks (-1.1..1.1), y = seats scaled so need = 0.8, z depth (-0.25..0.25)
  var YS; function Y(v) { return v / S.seats * 0.8; }
  var P = [], N = [], C = [], I = [];
  function box(x0, x1, y0, y1, z0, z1, r, g, b, a) {
    var base = P.length / 3;
    var f = [ // each face: 4 verts, normal
      [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0]],   // top
      [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]],   // front
      [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0]],   // right
      [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0]],  // left
      [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1]]   // back
    ];
    f.forEach(function (face, fi) {
      var s = base + fi * 4;
      for (var k = 0; k < 4; k++) { P.push(face[k][0], face[k][1], face[k][2]); N.push(face[4][0], face[4][1], face[4][2]); C.push(r, g, b, a); }
      I.push(s, s + 1, s + 2, s, s + 2, s + 3);
    });
  }
  var BAR = 2.2 / WEEKS, BW = BAR * 0.62, D = 0.26;
  function bx(w) { return -1.1 + (w - 0.5) * BAR; }
  function build() {
    P = []; N = []; C = []; I = [];
    var maxY = Y(S.seats * 1.3);
    M.weeks.forEach(function (x) {
      var x0 = bx(x.w) - BW / 2, x1 = bx(x.w) + BW / 2, y = 0, future = x.w > S.week, al = future ? 0.22 : 1;
      x.segs.forEach(function (v, si) {
        if (v <= 0.05) return;
        var h = Y(v), shade = si === 0 ? 0.42 : 0.62 + 0.09 * si; if (shade > 0.98) shade = 0.98;
        if (x.short) box(x0, x1, y, Math.min(maxY, y + h), -D / 2, D / 2, 0.93, 0.14 + 0.06 * si, 0.16, al);
        else box(x0, x1, y, Math.min(maxY, y + h), -D / 2, D / 2, shade, shade, shade, al);
        y += h;
      });
      if (x.ramp > 0.3) box(x0 + 0.004, x1 - 0.004, y, Math.min(maxY, y + Y(x.ramp)), -D / 2 + 0.004, D / 2 - 0.004, 0.9, 0.62, 0.25, future ? 0.12 : 0.35); // hired, not proficient
    });
    // floor
    box(-1.16, 1.16, -0.012, 0, -D, D, 0.16, 0.16, 0.16, 1);
    // need plane (white, faint) and 90% line (red)
    box(-1.16, 1.16, Y(S.seats) - 0.002, Y(S.seats) + 0.002, -D * 1.15, D * 1.15, 1, 1, 1, 0.18);
    box(-1.16, 1.16, Y(0.9 * S.seats) - 0.003, Y(0.9 * S.seats) + 0.003, -D * 1.15, D * 1.15, 0.93, 0.14, 0.16, 0.95);
    nIdx = I.length;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.p); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(P), gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.n); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(N), gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.c); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(C), gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf.i); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(I), gl.DYNAMIC_DRAW);
  }
  function mat() {
    var aspect = W / H, f = 1 / Math.tan(0.46), near = 0.1, far = 20;
    var proj = [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, 2 * far * near / (near - far), 0];
    var cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), dist = aspect < 1 ? 3.6 : 2.75, ty = 0.42;
    var ex = dist * sy * cp, ey = ty + dist * sp, ez = dist * cy * cp;
    var zx = ex, zy = ey - ty, zz = ez, zl = Math.sqrt(zx * zx + zy * zy + zz * zz); zx /= zl; zy /= zl; zz /= zl;
    var xx = zz, xy = 0, xz = -zx, xl = Math.sqrt(xx * xx + xz * xz) || 1; xx /= xl; xz /= xl;
    var yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    var view = [xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0, -(xx * ex + xy * ey + xz * ez), -(yx * ex + yy * ey + yz * ez), -(zx * ex + zy * ey + zz * ez), 1];
    var m = new Float32Array(16);
    for (var r = 0; r < 4; r++) for (var c = 0; c < 4; c++) { var s = 0; for (var k = 0; k < 4; k++) s += proj[k * 4 + c] * view[r * 4 + k]; m[r * 4 + c] = s; }
    return m;
  }
  function project(x, y, z) { var m = MVP, cx = m[0] * x + m[4] * y + m[8] * z + m[12], cy = m[1] * x + m[5] * y + m[9] * z + m[13], cw = m[3] * x + m[7] * y + m[11] * z + m[15];
    return [(cx / cw * 0.5 + 0.5) * W / dpr, (0.5 - cy / cw * 0.5) * H / dpr]; }
  function draw() {
    gl.viewport(0, 0, W, H); gl.clearColor(0.027, 0.027, 0.027, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    MVP = mat(); gl.uniformMatrix4fv(gl.getUniformLocation(prog, 'mvp'), false, MVP);
    gl.uniform3f(gl.getUniformLocation(prog, 'L'), 0.35, 1.0, 0.75);
    function attr(name, b, n) { var l = gl.getAttribLocation(prog, name); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, n, gl.FLOAT, false, 0, 0); }
    attr('p', buf.p, 3); attr('n', buf.n, 3); attr('c', buf.c, 4);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf.i); gl.drawElements(gl.TRIANGLES, nIdx, gl.UNSIGNED_SHORT, 0);
    labels3D();
  }
  function labels3D() {
    if (!lab) return;
    var h = '';
    M.weeks.forEach(function (x) {
      var p = project(bx(x.w), -0.02, D / 2 + 0.02), q = project(bx(x.w), Y(x.total) + 0.03, 0);
      h += '<span class="lw' + (x.w === S.week ? ' on' : '') + '" style="left:' + p[0] + 'px;top:' + p[1] + 'px">W' + x.w + '</span>';
      if (x.w <= S.week && (x.w === S.week || x.w === M.red || x.w === 1 || x.w === WEEKS || x.w % 3 === 0)) h += '<span class="lv' + (x.short ? ' red' : '') + '" style="left:' + q[0] + 'px;top:' + q[1] + 'px">' + Math.round(x.total) + '</span>';
    });
    var n = project(1.16, Y(S.seats), -D * 1.15), m = project(1.16, Y(0.9 * S.seats), -D * 1.15);
    h += '<span class="ln" style="left:' + n[0] + 'px;top:' + n[1] + 'px">' + S.seats + ' needed</span>';
    h += '<span class="ln red" style="left:' + m[0] + 'px;top:' + m[1] + 'px">90% &middot; ' + Math.round(0.9 * S.seats) + '</span>';
    lab.innerHTML = h;
  }
  function pick(px, py) { var best = -1, bd = 1e9; M.weeks.forEach(function (x) { var p = project(bx(x.w), Y(x.total) / 2, D / 2); var d = (p[0] - px) * (p[0] - px) + (p[1] - py) * (p[1] - py); if (d < bd) { bd = d; best = x.w; } }); return best; }
  function size() { var r = stage.getBoundingClientRect(); W = Math.max(1, Math.round(r.width * dpr)); H = Math.max(1, Math.round(r.height * dpr)); cv.width = W; cv.height = H; }

  /* ---------------- 2D fallback ---------------- */
  var ctx2 = null;
  function draw2D() {
    if (!ctx2) ctx2 = cv.getContext('2d'); var c = ctx2, w = W, h = H; c.fillStyle = '#070707'; c.fillRect(0, 0, w, h);
    var pad = 30 * dpr, gw = w - pad * 2, gh = h - pad * 2, maxV = S.seats * 1.3, bw = gw / WEEKS;
    function py(v) { return pad + gh - Math.min(v, maxV) / maxV * gh; }
    c.strokeStyle = 'rgba(255,255,255,.4)'; c.lineWidth = dpr; c.beginPath(); c.moveTo(pad, py(S.seats)); c.lineTo(pad + gw, py(S.seats)); c.stroke();
    c.strokeStyle = '#E31E24'; c.lineWidth = 2 * dpr; c.beginPath(); c.moveTo(pad, py(0.9 * S.seats)); c.lineTo(pad + gw, py(0.9 * S.seats)); c.stroke();
    c.font = (11 * dpr) + 'px JetBrains Mono, monospace'; c.textAlign = 'center';
    M.weeks.forEach(function (x) { var x0 = pad + (x.w - 1) * bw + bw * 0.2, fut = x.w > S.week;
      c.fillStyle = x.short ? 'rgba(227,30,36,' + (fut ? .25 : .9) + ')' : 'rgba(255,255,255,' + (fut ? .2 : .75) + ')';
      c.fillRect(x0, py(x.total), bw * 0.6, py(0) - py(x.total));
      if (x.ramp > 0.3) { c.fillStyle = 'rgba(230,160,64,' + (fut ? .12 : .35) + ')'; c.fillRect(x0, py(x.total + x.ramp), bw * 0.6, py(x.total) - py(x.total + x.ramp)); }
      c.fillStyle = 'rgba(255,255,255,.6)'; c.fillText('W' + x.w, x0 + bw * 0.3, h - pad / 3);
      if (!fut) { c.fillStyle = x.short ? '#E31E24' : '#fff'; c.fillText(Math.round(x.total), x0 + bw * 0.3, py(x.total) - 4 * dpr); } });
    if (lab) lab.innerHTML = '';
  }

  /* ---------------- inputs: slider + exact number, two-way ---------------- */
  var keys = ['seats', 'hires', 'floor', 'a30', 'a60', 'a90'];
  function clamp(k, v) { var r = $(k); v = Math.round(+v || 0); return Math.max(+r.min, Math.min(+r.max, v)); }
  function readAll() { keys.forEach(function (k) { S[k] = +$(k).value; }); S.week = +$('t').value;
    var o = $('o-att'); if (o) o.textContent = S.a30 + '% / ' + S.a60 + '% / ' + S.a90 + '%'; }
  function syncNum(k) { var n = $('n-' + k); if (n) n.value = $(k).value; }
  keys.forEach(function (k) {
    $(k).addEventListener('input', function () { syncNum(k); update(true); });
    var n = $('n-' + k); if (n) { n.addEventListener('change', function () { $(k).value = clamp(k, n.value); n.value = $(k).value; update(true); });
      n.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); n.blur(); } }); }
  });
  $('t').addEventListener('input', function () { update(true); });
  var useGL = !!initGL();
  function update(fromUser) {
    readAll(); compute(); renderText(); link();
    if (fromUser) { touched = true; signal(); }
    size(); if (useGL) { build(); draw(); } else draw2D();
  }
  window.addEventListener('resize', function () { update(false); });
  var moved = false, downX = 0;
  stage.addEventListener('pointerdown', function (e) { dragging = true; moved = false; lx = e.clientX; downX = e.clientX; autoRot = false; try { stage.setPointerCapture(e.pointerId); } catch (x) {} });
  stage.addEventListener('pointermove', function (e) { if (!dragging) return; var dx = e.clientX - lx; lx = e.clientX; if (Math.abs(e.clientX - downX) > 6) moved = true;
    if (useGL) { yaw = Math.max(-1.0, Math.min(0.35, yaw + dx * 0.006)); draw(); } });
  stage.addEventListener('pointerup', function (e) { dragging = false; touched = true;
    if (!moved) { var r = stage.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top, w;
      if (useGL) w = pick(px, py); else w = Math.max(1, Math.min(WEEKS, Math.ceil((px - 30) / ((r.width - 60) / WEEKS))));
      if (w > 0) { $('t').value = w; update(true); } } });
  stage.addEventListener('pointercancel', function () { dragging = false; });
  var ctl = $('ctl'), sheetbtn = $('sheetbtn'), closeSheet = $('closeSheet');
  if (sheetbtn) sheetbtn.addEventListener('click', function () { ctl.classList.add('open'); });
  if (closeSheet) closeSheet.addEventListener('click', function () { ctl.classList.remove('open'); });
  // very gentle sway until touched, so the 3D reads as 3D
  var t0 = 0; function loop(t) { if (useGL && autoRot && !document.hidden) { yaw = -0.42 + Math.sin(t / 4200) * 0.12; draw(); } requestAnimationFrame(loop); }
  keys.forEach(syncNum); update(false);
  if (!reduced) requestAnimationFrame(loop);
})();
