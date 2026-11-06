/* SSUNDAR — March Bench simulator. Illustrative model, hand-rolled WebGL (CSP: no CDN).
   Surface = delivery-ready seats across 90 days, stacked by cohort; line = need. */
(function () {
  'use strict';
  var stage = document.getElementById('stage'), cv = document.getElementById('gl');
  if (!stage || !cv) return;
  var $ = function (id) { return document.getElementById(id); };
  var inp = { seats: $('seats'), hires: $('hires'), floor: $('floor'), a30: $('a30'), a60: $('a60'), a90: $('a90'), t: $('t') };
  var out = { seats: $('o-seats'), hires: $('o-hires'), floor: $('o-floor'), att: $('o-att') };
  var readout = $('readout'), verdict = $('verdict'), cta = $('simcta');
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- model ---------------- */
  var DAYS = 90, STEP = 2, NX = DAYS / STEP + 1;           // 46 columns
  var COHORT_GAP = 21, FLOOR_LOSS = 0.08, START_BENCH = 0.93, TENURED_ATTR_30D = 0.03, PROF_DAYS = 21;
  var P = {}, rows = [], total = [], redWeek = 0, redDay = -1, cohortStarts = [];

  function readInputs() {
    P.S = +inp.seats.value; P.h = +inp.hires.value; P.F = +inp.floor.value;
    P.a30 = +inp.a30.value / 100; P.a60 = Math.max(+inp.a60.value / 100, P.a30); P.a90 = Math.max(+inp.a90.value / 100, P.a60);
    P.week = +inp.t.value;
    out.seats.textContent = P.S; out.hires.textContent = P.h; out.floor.textContent = P.F;
    out.att.textContent = Math.round(P.a30 * 100) + '% / ' + Math.round(P.a60 * 100) + '% / ' + Math.round(P.a90 * 100) + '%';
  }
  function surv(age) { // cumulative new-hire attrition, piecewise linear
    if (age <= 0) return 1;
    if (age <= 30) return 1 - P.a30 * age / 30;
    if (age <= 60) return 1 - P.a30 - (P.a60 - P.a30) * (age - 30) / 30;
    if (age <= 90) return 1 - P.a60 - (P.a90 - P.a60) * (age - 60) / 30;
    return 1 - P.a90;
  }
  function prof(age) { if (age < P.F) return 0; var a = age - P.F; return a >= PROF_DAYS ? 1 : 0.3 + 0.7 * a / PROF_DAYS; }
  function compute() {
    cohortStarts = []; for (var s = 0; s < DAYS; s += COHORT_GAP) cohortStarts.push(s);
    rows = []; total = [];
    var tenured = [], x, d;
    for (x = 0; x < NX; x++) { d = x * STEP; tenured.push(P.S * START_BENCH * (1 - TENURED_ATTR_30D * d / 30)); }
    rows.push(tenured);
    cohortStarts.forEach(function (s) {
      var r = []; for (x = 0; x < NX; x++) { d = x * STEP; var age = d - s; r.push(age < 0 ? 0 : P.h * (1 - FLOOR_LOSS) * surv(age) * prof(age)); }
      rows.push(r);
    });
    for (x = 0; x < NX; x++) { var t = 0; rows.forEach(function (r) { t += r[x]; }); total.push(t); }
    redWeek = 0; redDay = -1;
    for (var w = 1; w <= 13; w++) { var dd = Math.min(DAYS, w * 7); if (readyAt(dd) < 0.9 * P.S) { redWeek = w; redDay = dd; break; } }
  }
  function readyAt(day) { var x = day / STEP, i = Math.floor(x), f = x - i; if (i >= NX - 1) return total[NX - 1]; return total[i] * (1 - f) + total[i + 1] * f; }
  function action() {
    if (!redWeek) return { h: 'Your bench holds through week 13.', i: 'The kind of action the diagnosis returns', p: 'No action. Flag the associates ready for harder work to workforce planning, and re-run the forecast when the next cohort is confirmed.' };
    var k = -1; for (var i = 0; i < cohortStarts.length; i++) { if (cohortStarts[i] + P.F > redDay) { k = i; break; } }
    var p;
    if (k >= 0 && k < cohortStarts.length) p = 'Pull cohort ' + (k + 1) + ' forward two weeks. Owner: operations lead. Date: before its current start on day ' + cohortStarts[k] + '. That lands ' + Math.round(P.h * (1 - FLOOR_LOSS)) + ' seats on the floor 14 days earlier.';
    else if (P.a30 >= 0.15) p = 'Shift two team leaders to new-hire coaching, one topic, for six weeks. Owner: training lead. Date: next Monday. Attrition in the first 30 days is the leak.';
    else p = 'Capture knowledge from notified leavers and raise the next cohort by ' + Math.max(5, Math.round(P.h * 0.2)) + '. Owner: HR and workforce planning. Date: before the next intake.';
    return { h: 'Your bench falls short in week ' + redWeek + '.', i: 'The kind of action the diagnosis returns', p: p };
  }
  function renderText() {
    var day = Math.min(DAYS, P.week * 7), r = Math.round(readyAt(day));
    readout.innerHTML = 'Week ' + P.week + ' &middot; day ' + day + '<br><b>' + r + '</b> ready against <b>' + P.S + '</b> needed' + (r < 0.9 * P.S ? '<br><b>Short</b> &mdash; below 90% of need' : '');
    var a = action();
    verdict.className = 'verdict' + (redWeek ? '' : ' ok');
    verdict.innerHTML = '<b>' + a.h + '</b><p><i>' + a.i + '</i>' + a.p + '</p>';
  }
  function link() {
    var q = '?seats=' + P.S + '&hires=' + P.h + '&floor=' + P.F + '&a30=' + Math.round(P.a30 * 100) + '&a60=' + Math.round(P.a60 * 100) + '&a90=' + Math.round(P.a90 * 100) + (redWeek ? '&red=' + redWeek : '') + '&sector=' + (window.__sector || 'ramp');
    window.__simHref = '/engage' + q; if (cta) cta.href = window.__simHref;
    var go = document.getElementById('goBtn'); if (go && go.getAttribute('href').indexOf('/engage') === 0) go.setAttribute('href', window.__simHref);
  }
  window.__simLink = link;

  /* ---------------- analytics + haptics ---------------- */
  var firedRed = false, touched = false, lastRedShown = false;
  function signal() {
    var day = Math.min(DAYS, P.week * 7), short = readyAt(day) < 0.9 * P.S;
    if (short && !lastRedShown && touched) { try { if (navigator.vibrate) navigator.vibrate(18); } catch (e) {} }
    lastRedShown = short;
    if (redWeek && touched && !firedRed) { firedRed = true; if (typeof window.gtag === 'function') window.gtag('event', 'bench_red_week', { week: redWeek, seats: P.S }); }
  }

  /* ---------------- WebGL ---------------- */
  var gl = null, prog, buf = {}, nTri = 0, yaw = -0.62, pitch = 0.40, dragging = false, lx = 0, autoRot = !reduced, lastT = 0;
  var W = 1, H = 1, dpr = Math.min(2, window.devicePixelRatio || 1);
  function initGL() {
    try { gl = cv.getContext('webgl', { antialias: true, alpha: false, powerPreference: 'low-power' }); } catch (e) { gl = null; }
    if (!gl) return false;
    var vs = 'attribute vec3 p;attribute vec3 n;attribute vec4 c;uniform mat4 mvp;uniform vec3 L;varying vec4 vc;void main(){float d=max(dot(normalize(n),normalize(L)),0.0);vc=vec4(c.rgb*(0.42+0.58*d),c.a);gl_Position=mvp*vec4(p,1.0);}';
    var fs = 'precision mediump float;varying vec4 vc;void main(){gl_FragColor=vc;}';
    function sh(t, s) { var o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return o; }
    prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { gl = null; return false; }
    gl.useProgram(prog);
    buf.p = gl.createBuffer(); buf.n = gl.createBuffer(); buf.c = gl.createBuffer(); buf.i = gl.createBuffer();
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    return true;
  }
  // world: x = day (0..90) -> -1..1 ; z = row (0..R) -> -0.6..0.6 ; y = seats/need -> 0..0.9
  function X(d) { return d / DAYS * 2 - 1; }
  function Z(r, R) { return (r / R) * 1.2 - 0.6; }
  function Y(v) { return Math.min(1.25, v / P.S) * 0.8; }
  var pos, nor, col, idx;
  function build() {
    var R = rows.length, day = Math.min(DAYS, P.week * 7);
    var verts = NX * R, i, x, r;
    pos = new Float32Array(verts * 3 + 12 + 12 + 12); nor = new Float32Array(pos.length); col = new Float32Array(verts * 4 + 16 + 16 + 16);
    var cum = []; for (r = 0; r < R; r++) { cum.push([]); for (x = 0; x < NX; x++) cum[r].push((r ? cum[r - 1][x] : 0) + rows[r][x]); }
    for (r = 0; r < R; r++) for (x = 0; x < NX; x++) {
      i = r * NX + x; var d = x * STEP, v = cum[r][x];
      pos[i * 3] = X(d); pos[i * 3 + 1] = Y(v); pos[i * 3 + 2] = Z(r, R - 1);
      var short = total[x] < 0.9 * P.S, future = d > day, top = r === R - 1;
      var cr, cg, cb, ca;
      if (short) { cr = 0.95; cg = 0.14; cb = 0.16; } else { cr = 0.72 + (top ? 0.28 : 0); cg = cr; cb = cr; }
      if (!top) { cr *= 0.55; cg *= 0.55; cb *= 0.55; }
      ca = future ? 0.22 : 1.0;
      col[i * 4] = cr; col[i * 4 + 1] = cg; col[i * 4 + 2] = cb; col[i * 4 + 3] = ca;
    }
    // normals via finite differences on the stacked top of each row
    for (r = 0; r < R; r++) for (x = 0; x < NX; x++) {
      i = r * NX + x;
      var xl = Math.max(0, x - 1), xr = Math.min(NX - 1, x + 1), rl = Math.max(0, r - 1), rr = Math.min(R - 1, r + 1);
      var dx = (pos[(r * NX + xr) * 3 + 1] - pos[(r * NX + xl) * 3 + 1]) / (pos[(r * NX + xr) * 3] - pos[(r * NX + xl) * 3] || 1);
      var dz = (pos[(rr * NX + x) * 3 + 1] - pos[(rl * NX + x) * 3 + 1]) / (pos[(rr * NX + x) * 3 + 2] - pos[(rl * NX + x) * 3 + 2] || 1);
      var nx = -dx, ny = 1, nz = -dz, len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      nor[i * 3] = nx / len; nor[i * 3 + 1] = ny / len; nor[i * 3 + 2] = nz / len;
    }
    var tris = [];
    for (r = 0; r < R - 1; r++) for (x = 0; x < NX - 1; x++) { var a = r * NX + x, b = a + 1, c = a + NX, dd = c + 1; tris.push(a, c, b, b, c, dd); }
    // need plane (translucent, at 100% of need) and 90% threshold line as a thin quad
    var base = verts, k = base;
    function quad(y, z0, z1, rr, gg, bb, aa) {
      var pts = [[-1, y, z0], [1, y, z0], [-1, y, z1], [1, y, z1]], s = k;
      pts.forEach(function (p) { pos[k * 3] = p[0]; pos[k * 3 + 1] = p[1]; pos[k * 3 + 2] = p[2]; nor[k * 3] = 0; nor[k * 3 + 1] = 1; nor[k * 3 + 2] = 0; col[k * 4] = rr; col[k * 4 + 1] = gg; col[k * 4 + 2] = bb; col[k * 4 + 3] = aa; k++; });
      tris.push(s, s + 2, s + 1, s + 1, s + 2, s + 3);
    }
    quad(Y(P.S), -0.62, 0.62, 1.0, 1.0, 1.0, 0.10);              // need plane (white, faint)
    quad(Y(0.9 * P.S), 0.60, 0.63, 0.89, 0.12, 0.14, 0.9);     // 90% line along the front edge
    // scrub plane at current day
    var sx = X(day), s2 = k;
    [[sx, 0, -0.62], [sx, 1.0, -0.62], [sx, 0, 0.62], [sx, 1.0, 0.62]].forEach(function (p) { pos[k * 3] = p[0]; pos[k * 3 + 1] = p[1]; pos[k * 3 + 2] = p[2]; nor[k * 3] = 1; nor[k * 3 + 1] = 0; nor[k * 3 + 2] = 0; col[k * 4] = 1; col[k * 4 + 1] = 1; col[k * 4 + 2] = 1; col[k * 4 + 3] = 0.12; k++; });
    tris.push(s2, s2 + 2, s2 + 1, s2 + 1, s2 + 2, s2 + 3);
    idx = new Uint16Array(tris); nTri = tris.length;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.p); gl.bufferData(gl.ARRAY_BUFFER, pos, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.n); gl.bufferData(gl.ARRAY_BUFFER, nor, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.c); gl.bufferData(gl.ARRAY_BUFFER, col, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf.i); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.DYNAMIC_DRAW);
  }
  function mat() {
    var aspect = W / H, f = 1 / Math.tan(0.5), near = 0.1, far = 20;
    var proj = [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, 2 * far * near / (near - far), 0];
    var cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), dist = 2.15;
    // camera orbit around (0,0.35,0)
    var ex = dist * sy * cp, ey = 0.35 + dist * sp, ez = dist * cy * cp;
    var zx = ex, zy = ey - 0.35, zz = ez, zl = Math.sqrt(zx * zx + zy * zy + zz * zz); zx /= zl; zy /= zl; zz /= zl;
    var xx = zz, xy = 0, xz = -zx, xl = Math.sqrt(xx * xx + xz * xz) || 1; xx /= xl; xz /= xl;
    var yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    var view = [xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0, -(xx * ex + xy * ey + xz * ez), -(yx * ex + yy * ey + yz * ez), -(zx * ex + zy * ey + zz * ez), 1];
    var m = new Float32Array(16);
    for (var r = 0; r < 4; r++) for (var c = 0; c < 4; c++) { var s = 0; for (var k = 0; k < 4; k++) s += proj[k * 4 + c] * view[r * 4 + k]; m[r * 4 + c] = s; }
    return m;
  }
  var MVP;
  function draw() {
    gl.viewport(0, 0, W, H); gl.clearColor(0.027, 0.027, 0.027, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    MVP = mat(); gl.uniformMatrix4fv(gl.getUniformLocation(prog, 'mvp'), false, MVP);
    gl.uniform3f(gl.getUniformLocation(prog, 'L'), 0.4, 1.0, 0.6);
    function attr(name, b, n) { var l = gl.getAttribLocation(prog, name); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, n, gl.FLOAT, false, 0, 0); }
    attr('p', buf.p, 3); attr('n', buf.n, 3); attr('c', buf.c, 4);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf.i); gl.drawElements(gl.TRIANGLES, nTri, gl.UNSIGNED_SHORT, 0);
  }
  function project(x, y, z) { // world -> css px
    var m = MVP, cx = m[0] * x + m[4] * y + m[8] * z + m[12], cy = m[1] * x + m[5] * y + m[9] * z + m[13], cw = m[3] * x + m[7] * y + m[11] * z + m[15];
    return [(cx / cw * 0.5 + 0.5) * W / dpr, (0.5 - cy / cw * 0.5) * H / dpr];
  }
  function pick(px, py) { // nearest top-edge point in screen space -> day
    var R = rows.length, best = -1, bd = 1e9;
    for (var x = 0; x < NX; x++) { var i = (R - 1) * NX + x, p = project(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]); var d = (p[0] - px) * (p[0] - px) + (p[1] - py) * (p[1] - py); if (d < bd) { bd = d; best = x; } }
    return best < 0 ? -1 : best * STEP;
  }
  function size() { var r = stage.getBoundingClientRect(); W = Math.max(1, Math.round(r.width * dpr)); H = Math.max(1, Math.round(r.height * dpr)); cv.width = W; cv.height = H; }

  /* ---------------- 2D fallback ---------------- */
  var ctx2 = null;
  function draw2D() {
    if (!ctx2) ctx2 = cv.getContext('2d');
    var c = ctx2, w = W, h = H; c.clearRect(0, 0, w, h); c.fillStyle = '#070707'; c.fillRect(0, 0, w, h);
    var pad = 28 * dpr, gw = w - pad * 2, gh = h - pad * 2, maxY = P.S * 1.25, day = Math.min(DAYS, P.week * 7);
    function px(d) { return pad + d / DAYS * gw; } function py(v) { return pad + gh - Math.min(v, maxY) / maxY * gh; }
    c.strokeStyle = 'rgba(227,30,36,.9)'; c.lineWidth = 2 * dpr; c.beginPath(); c.moveTo(px(0), py(P.S)); c.lineTo(px(DAYS), py(P.S)); c.stroke();
    c.setLineDash([4 * dpr, 4 * dpr]); c.strokeStyle = 'rgba(227,30,36,.5)'; c.beginPath(); c.moveTo(px(0), py(0.9 * P.S)); c.lineTo(px(DAYS), py(0.9 * P.S)); c.stroke(); c.setLineDash([]);
    for (var x = 0; x < NX - 1; x++) { var d0 = x * STEP, d1 = d0 + STEP, short = total[x] < 0.9 * P.S;
      c.fillStyle = short ? 'rgba(227,30,36,' + (d0 > day ? .25 : .8) + ')' : 'rgba(255,255,255,' + (d0 > day ? .18 : .7) + ')';
      c.beginPath(); c.moveTo(px(d0), py(0)); c.lineTo(px(d0), py(total[x])); c.lineTo(px(d1), py(total[x + 1])); c.lineTo(px(d1), py(0)); c.closePath(); c.fill(); }
    c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 1 * dpr; c.beginPath(); c.moveTo(px(day), pad); c.lineTo(px(day), pad + gh); c.stroke();
  }

  /* ---------------- wiring ---------------- */
  var useGL = !!initGL();
  function update(fromUser) {
    readInputs(); compute(); renderText(); link();
    if (fromUser) { touched = true; signal(); }
    size(); if (useGL) { build(); draw(); } else draw2D();
  }
  Object.keys(inp).forEach(function (k) { inp[k].addEventListener('input', function () { update(true); }); });
  window.addEventListener('resize', function () { update(false); });
  // drag to turn, tap to read
  var moved = false, downX = 0, downY = 0;
  stage.addEventListener('pointerdown', function (e) { dragging = true; moved = false; lx = e.clientX; downX = e.clientX; downY = e.clientY; autoRot = false; stage.setPointerCapture && stage.setPointerCapture(e.pointerId); });
  stage.addEventListener('pointermove', function (e) { if (!dragging) return; var dx = e.clientX - lx; lx = e.clientX; if (Math.abs(e.clientX - downX) > 6) moved = true; if (useGL) { yaw += dx * 0.008; draw(); } else { inp.t.value = Math.max(1, Math.min(13, +inp.t.value + (dx > 0 ? 1 : dx < 0 ? -1 : 0))); update(true); } });
  stage.addEventListener('pointerup', function (e) {
    dragging = false; touched = true;
    if (!moved) { var r = stage.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top, d;
      if (useGL) d = pick(px, py); else d = Math.round(Math.max(0, Math.min(DAYS, (px - 28) / (r.width - 56) * DAYS)));
      if (d >= 0) { inp.t.value = Math.max(1, Math.min(13, Math.round(d / 7))); update(true); } }
  });
  stage.addEventListener('pointercancel', function () { dragging = false; });
  // mobile bottom sheet
  var ctl = $('ctl'), sheetbtn = $('sheetbtn'), closeSheet = $('closeSheet');
  if (sheetbtn) sheetbtn.addEventListener('click', function () { ctl.classList.add('open'); });
  if (closeSheet) closeSheet.addEventListener('click', function () { ctl.classList.remove('open'); });
  // gentle auto-rotation until touched
  function loop(t) { if (useGL && autoRot && !document.hidden) { yaw += 0.0025 * Math.min(32, t - lastT) / 16; draw(); } lastT = t; requestAnimationFrame(loop); }
  update(false);
  if (!reduced) requestAnimationFrame(loop);
})();
