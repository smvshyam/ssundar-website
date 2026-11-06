/* SSUNDAR — March Bench simulator: THE RESERVOIRS (global). Real 3D via self-hosted Three.js r128.
   One reservoir per selected geography. Water behind each dam = that geography's delivery-ready bench; gauge = seats needed
   (white) and 90% (red); tributaries = cohorts landing; seepage = attrition; holding pond = hired, not yet proficient.
   Geography starting points are illustrative, editable, and NOT benchmarks. */
(function () {
  'use strict';
  if (!document.getElementById('scorecards')) return;
  var $ = function (id) { return document.getElementById(id); };

  /* ---------------- geographies: illustrative starting points (editable; not benchmarks) ---------------- */
  var GEO = [
    { id: 'in', name: 'India', hubs: 'Bengaluru · Hyderabad · Pune · NCR', seats: 120, ready: 92, tattr: 3, hires: 25, floor: 45, prof: 21, a30: 10, a60: 18, a90: 25, loss: 8, watch: 'No-shows between offer and day one; a cohort can lose a tenth before it starts.' },
    { id: 'ph', name: 'Philippines', hubs: 'Manila · Cebu · Clark', seats: 100, ready: 74, tattr: 4, hires: 25, floor: 40, prof: 21, a30: 12, a60: 20, a90: 28, loss: 10, watch: 'First-30-day attrition on night shifts; transport and schedule fit decide who stays.' },
    { id: 'cn', name: 'China', hubs: 'Dalian · Chengdu · Shanghai', seats: 60, ready: 48, tattr: 2, hires: 15, floor: 50, prof: 28, a30: 8, a60: 14, a90: 20, loss: 6, watch: 'Proficiency speed on multilingual queues; graduation and floor-ready are not the same day.' },
    { id: 'me', name: 'MENA', hubs: 'Cairo · Dubai · Riyadh · Amman', seats: 60, ready: 50, tattr: 2, hires: 15, floor: 55, prof: 28, a30: 6, a60: 12, a90: 16, loss: 5, watch: 'Visa and onboarding lead time stretch offer-to-floor; the leak is late, not lost.' },
    { id: 'za', name: 'South Africa', hubs: 'Cape Town · Johannesburg · Durban', seats: 80, ready: 62, tattr: 3, hires: 20, floor: 42, prof: 21, a30: 9, a60: 16, a90: 22, loss: 8, watch: 'Shift and transport no-shows; dependable attendance is the proficiency gate.' },
    { id: 'eu', name: 'Europe', hubs: 'Warsaw · Dublin · Sofia · Lisbon', seats: 50, ready: 42, tattr: 2, hires: 12, floor: 60, prof: 25, a30: 6, a60: 11, a90: 15, loss: 4, watch: 'Notice periods make offer-to-floor slow; forecast two cohorts ahead or the bench is late.' },
    { id: 'na', name: 'North America', hubs: 'US · Canada', seats: 60, ready: 46, tattr: 4, hires: 15, floor: 35, prof: 18, a30: 14, a60: 24, a90: 32, loss: 12, watch: 'Fast to the floor, highest early attrition; the first 30 days decide the quarter.' },
    { id: 'la', name: 'Latin America', hubs: 'Bogotá · Mexico City · São Paulo · San José', seats: 80, ready: 62, tattr: 3, hires: 20, floor: 40, prof: 21, a30: 11, a60: 19, a90: 26, loss: 9, watch: 'Bilingual proficiency ramps slower than graduation suggests; measure at the seat, not the classroom.' },
    { id: 'anz', name: 'ANZ', hubs: 'Sydney · Melbourne · Auckland', seats: 40, ready: 34, tattr: 2, hires: 10, floor: 50, prof: 21, a30: 8, a60: 14, a90: 19, loss: 6, watch: 'Small cohorts and long floor time; one no-show is a visible gap.' }
  ];
  var geoById = {}; GEO.forEach(function (g) { geoById[g.id] = g; });
  var state = { selected: ['in', 'ph'], active: 'in', week: 13, params: {} };
  GEO.forEach(function (g) { state.params[g.id] = { seats: g.seats, ready: g.ready, tattr: g.tattr, hires: g.hires, floor: g.floor, prof: g.prof, a30: g.a30, a60: g.a60, a90: g.a90, loss: g.loss }; });

  /* ---------------- model ---------------- */
  var WEEKS = 13, COHORT_GAP = 21;
  function reachWeek(m) { var r = 0; m.weeks.forEach(function (x) { if (!r && !x.short) r = x.w; }); return r; }
  function surv(age, p) { var a30 = p.a30 / 100, a60 = Math.max(p.a60 / 100, a30), a90 = Math.max(p.a90 / 100, a60);
    if (age <= 0) return 1; if (age <= 30) return 1 - a30 * age / 30; if (age <= 60) return 1 - a30 - (a60 - a30) * (age - 30) / 30;
    if (age <= 90) return 1 - a60 - (a90 - a60) * (age - 60) / 30; return 1 - a90; }
  function prof(age, p) { if (age < p.floor) return 0; var a = age - p.floor, P = Math.max(1, p.prof); return a >= P ? 1 : 0.3 + 0.7 * a / P; }
  function run(p, starts) {
    var weeks = [], loss = p.loss / 100;
    for (var w = 1; w <= WEEKS; w++) {
      var d = Math.min(90, w * 7), ta = p.tattr / 100, ten = Math.max(0, p.ready * (1 - ta * d / 30)), tot = ten, ramp = 0, lost = p.ready - ten;
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
      var cands = [];
      starts.forEach(function (st, i) { if (i > 0 && st >= 14) { var alt = starts.slice(); alt[i] = st - 14;
        cands.push({ text: 'Pull cohort ' + (i + 1) + ' forward two weeks (start day ' + alt[i] + ' instead of ' + st + ').', owner: 'Operations lead', cf: run(p, alt) }); } });
      if (p.prof > 10) { var pp = Object.assign({}, p, { prof: Math.max(7, p.prof - 7) });
        cands.push({ text: 'Cut speed to proficiency after graduation from ' + p.prof + ' to ' + Math.max(7, p.prof - 7) + ' days: first live work under a coach from day one on the floor, one topic a week.', owner: 'Training lead with operations', cf: run(pp, starts) }); }
      if (p.floor > 24) { var cut = Math.min(14, p.floor - 10), pf = Object.assign({}, p, { floor: p.floor - cut });
        cands.push({ text: 'Compress offer-to-floor from ' + p.floor + ' to ' + (p.floor - cut) + ' days: pre-boarding before day one, classroom in two waves.', owner: 'Training lead with operations', cf: run(pf, starts) }); }
      if (p.a30 >= 8) { var p2 = Object.assign({}, p, { a30: Math.round(p.a30 * 0.6), a60: Math.round(p.a60 * 0.75), a90: Math.round(p.a90 * 0.85) });
        cands.push({ text: 'Shift two team leaders to new-hire coaching, one topic for six weeks. The leak is attrition in the first 30 days.', owner: 'Training lead', cf: run(p2, starts) }); }
      if (p.loss >= 6) { var pl = Object.assign({}, p, { loss: Math.round(p.loss / 2) });
        cands.push({ text: 'Halve no-shows between offer and day one: a named buddy call in the week before start and a confirmed shift before the offer letter.', owner: 'Recruitment with operations', cf: run(pl, starts) }); }
      var p3 = Object.assign({}, p, { hires: p.hires + Math.max(5, Math.round(p.hires * 0.25)) });
      cands.push({ text: 'Raise the next cohort by ' + Math.max(5, Math.round(p.hires * 0.25)) + ' and capture knowledge from notified leavers.', owner: 'HR and workforce planning', cf: run(p3, starts) });
      function score(c) { var r = c.cf.red ? (reachWeek(c.cf) || 99) : 0; return r * 1000 - c.cf.weeks[WEEKS - 1].total; }
      cands.sort(function (x, y) { return score(x) - score(y); });
      m.action = cands[0]; m.alternatives = cands.slice(1, 3);
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
      buildTabs(); loadInputs(); update(true);
    }); });
  }
  function buildTabs() {
    tabs.innerHTML = state.selected.map(function (id) { return '<button type="button" data-id="' + id + '"' + (id === state.active ? ' class="on"' : '') + '>' + geoById[id].name + '</button>'; }).join('');
    tabs.querySelectorAll('button').forEach(function (b) { b.addEventListener('click', function () { state.active = b.dataset.id; buildTabs(); loadInputs(); update(false); }); });
  }
  var keys = ['seats', 'ready', 'tattr', 'hires', 'floor', 'prof', 'a30', 'a60', 'a90', 'loss'];
  function loadInputs() { var p = state.params[state.active]; keys.forEach(function (k) { var r = $(k), n = $('n-' + k); if (r) r.value = p[k]; if (n) n.value = p[k]; });
    var o = $('o-att'); if (o) o.textContent = p.a30 + '% / ' + p.a60 + '% / ' + p.a90 + '%';
    if (watch) watch.innerHTML = '<b>' + geoById[state.active].name + ' &middot; what we watch first.</b> ' + geoById[state.active].watch + ' <em>Starting points are illustrative and editable, not benchmarks.</em>'; }
  function clamp(k, v) { var r = $(k); v = Math.round(+v || 0); return Math.max(+r.min, Math.min(+r.max, v)); }
  function readInputs() { var p = state.params[state.active]; keys.forEach(function (k) { var r = $(k); if (r) p[k] = +r.value; }); state.week = 13;
    var o = $('o-att'); if (o) o.textContent = p.a30 + '% / ' + p.a60 + '% / ' + p.a90 + '%'; }
  keys.forEach(function (k) { var r = $(k), n = $('n-' + k); if (!r) return;
    r.addEventListener('input', function () { if (n) n.value = r.value; update(true); });
    if (n) { n.addEventListener('change', function () { r.value = clamp(k, n.value); n.value = r.value; update(true); }); n.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); n.blur(); } }); } });
  var copyAll = $('copyall'); if (copyAll) copyAll.addEventListener('click', function () { var src = state.params[state.active]; state.selected.forEach(function (id) { if (id !== state.active) ['hires', 'floor', 'prof'].forEach(function (k) { state.params[id][k] = src[k]; }); }); update(true); });

  /* ---------------- scorecards: facts, figures, red/green, reasons ---------------- */
  var cards = $('scorecards'), summary = $('geosummary'), cta = $('simcta');
  function wk(n) { return 'week ' + n; }
  function esc(x) { return String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  // what each leak costs, in seats, by week 13
  function reasons(p, m) {
    var starts = m.starts, d = 90, out = [];
    var noShow = 0, early = 0, inRamp = 0, cohortsNotLanded = 0, tenLost = Math.max(0, p.ready - p.ready * (1 - p.tattr / 100 * d / 30));
    starts.forEach(function (s) { var age = d - s; if (age < 0) { cohortsNotLanded += p.hires; return; }
      noShow += p.hires * p.loss / 100; var alive = p.hires * (1 - p.loss / 100); early += alive * (1 - surv(age, p)); inRamp += alive * surv(age, p) * (1 - prof(age, p)); });
    var gapToday = Math.max(0, p.seats - p.ready);
    if (gapToday > 0) out.push({ k: 'Starting gap', v: gapToday, why: 'You need ' + p.seats + ' in March and are delivery-ready for ' + p.ready + ' today. Every lever below has to close this before it closes anything else.' });
    out.push({ k: 'Tenured attrition', v: tenLost, why: p.tattr + '% of the bench leaves every month. Over the quarter that is seats you had and lost, not seats you failed to hire.' });
    out.push({ k: 'Never reach the floor', v: noShow, why: p.loss + '% of offers do not become a day one. Paid recruiting, no seat.' });
    out.push({ k: 'Early attrition', v: early, why: 'Attrition at ' + p.a30 + '/' + p.a60 + '/' + p.a90 + '% by day 30/60/90 removes people who were trained and paid for.' });
    out.push({ k: 'Still in ramp at week 13', v: inRamp, why: 'Offer-to-floor ' + p.floor + ' days plus ' + p.prof + ' days to proficiency means these hires are on payroll but not yet countable.' });
    if (cohortsNotLanded > 0) out.push({ k: 'Cohorts after week 13', v: cohortsNotLanded, why: 'Hired for this quarter, delivery-ready next quarter. The client pays for March.' });
    out.sort(function (a, b) { return b.v - a.v; });
    return out;
  }
  function card(id) {
    var p = state.params[id], m = M[id], g = geoById[id], last = m.weeks[WEEKS - 1], first = m.weeks[0];
    var reach = reachWeek(m), status = !m.red ? 'green' : (m.red === 1 && reach ? 'amber' : 'red');
    var headline = !m.red ? 'Holds all quarter' : (m.red === 1 ? (reach ? 'Short until ' + wk(reach) : 'Never reaches the mark by March') : 'Falls short in ' + wk(m.red));
    var strip = m.weeks.map(function (x) { return '<span class="' + (x.short ? 'r' : 'g') + '" title="Week ' + x.w + ': ' + Math.round(x.total) + ' of ' + p.seats + '"><i>W' + x.w + '</i>' + Math.round(x.total) + '</span>'; }).join('');
    var rs = reasons(p, m).map(function (r) { return '<li><b>' + Math.round(r.v) + '</b><span><em>' + esc(r.k) + '.</em> ' + esc(r.why) + '</span></li>'; }).join('');
    var act = '';
    if (m.red) { var a = m.action, cfr = reachWeek(a.cf), after = a.cf.red ? (a.cf.red === 1 ? (cfr ? 'reaches the mark in ' + wk(cfr) : 'still short in March') : 'short only from ' + wk(a.cf.red) + (a.cf.lastRed > a.cf.red ? ' to ' + wk(a.cf.lastRed) : '')) : 'never below the mark';
      act = '<div class="act"><p class="lbl">First action the diagnosis would return</p><p>' + esc(a.text) + ' <b>Owner: ' + esc(a.owner) + '.</b></p><p class="lbl">With that one action</p><p>' + after.charAt(0).toUpperCase() + after.slice(1) + '. Week 13: <b>' + Math.round(a.cf.weeks[WEEKS - 1].total) + ' of ' + p.seats + '</b>.</p>'
        + (m.alternatives && m.alternatives.length ? '<p class="lbl">Next levers</p><p>' + m.alternatives.map(function (c) { var rr = c.cf.red ? (reachWeek(c.cf) ? 'mark in ' + wk(reachWeek(c.cf)) : 'still short') : 'holds'; return esc(c.text.split(':')[0].split('(')[0].trim()) + ' &rarr; ' + rr; }).join(' &middot; ') + '</p>' : '') + '</div>';
    } else act = '<div class="act"><p class="lbl">First action the diagnosis would return</p><p>No action. Flag the associates ready for harder work to workforce planning and re-run when the hire plan changes.</p></div>';
    return '<article class="sc ' + status + (id === state.active ? ' on' : '') + '" data-id="' + id + '">'
      + '<header><span class="dotst"></span><h3>' + esc(g.name) + '</h3><p class="hl">' + headline + '</p></header>'
      + '<div class="facts"><div><b>' + p.ready + '</b><span>delivery-ready today</span></div><div><b>' + p.seats + '</b><span>needed in March</span></div><div><b>' + Math.round(last.total) + '</b><span>forecast week 13</span></div><div><b>' + Math.round(last.ramp) + '</b><span>hired, not yet proficient at week 13</span></div><div><b>' + Math.round(last.lost) + '</b><span>seats lost over the quarter</span></div><div><b>' + Math.ceil((m.starts[0] + p.floor + p.prof) / 7) + '</b><span>week cohort 1 is proficient</span></div></div>'
      + '<div class="strip">' + strip + '</div><p class="striplbl">Delivery-ready seats by week &middot; red = below 90% of ' + p.seats + ' (' + Math.round(0.9 * p.seats) + ')</p>'
      + '<p class="lbl">Why, ranked by seats it costs</p><ol class="why">' + rs + '</ol>' + act + '</article>';
  }
  function renderAll() {
    cards.innerHTML = state.selected.map(card).join('');
    cards.querySelectorAll('.sc').forEach(function (el) { el.addEventListener('click', function (e) { if (state.active !== el.dataset.id) { state.active = el.dataset.id; buildTabs(); loadInputs(); update(false); } }); });
    if (summary) { var shortIds = state.selected.filter(function (x) { return M[x].red; }), worst = null;
      shortIds.forEach(function (x) { var rx = reachWeek(M[x]) || 99, rw = worst ? (reachWeek(M[worst]) || 99) : 0; if (!worst || rx > rw) worst = x; });
      summary.innerHTML = '<p>' + (shortIds.length ? '<span class="dotst r"></span><b>' + shortIds.length + ' of ' + state.selected.length + ' geographies fall short.</b> Worst: ' + geoById[worst].name + ' &mdash; ' + (reachWeek(M[worst]) ? 'short until ' + wk(reachWeek(M[worst])) : 'never reaches the mark by March') + '.' : '<span class="dotst g"></span><b>Every selected bench holds through March.</b>') + '</p>'; }
  }
  function link() {
    var p = state.params[state.active], m = M[state.active];
    var q = '?geos=' + state.selected.join(',') + '&geo=' + state.active + '&seats=' + p.seats + '&ready=' + p.ready + '&hires=' + p.hires + '&floor=' + p.floor + '&prof=' + p.prof + '&a30=' + p.a30 + '&a60=' + p.a60 + '&a90=' + p.a90 + (m.red ? '&red=' + m.red : '') + '&sector=' + (window.__sector || 'ramp');
    window.__simHref = '/engage' + q; if (cta) cta.href = window.__simHref;
    var go = document.getElementById('goBtn'); if (go && (go.getAttribute('href') || '').indexOf('/engage') === 0) go.setAttribute('href', window.__simHref);
  }
  window.__simLink = link;
  var firedRed = false, touched = false;
  function signal() { if (M[state.active].red && touched && !firedRed) { firedRed = true; if (typeof window.gtag === 'function') window.gtag('event', 'bench_red_week', { week: M[state.active].red, geo: state.active, geos: state.selected.length }); } }
  function update(fromUser) { readInputs(); computeAll(); renderAll(); link(); if (fromUser) { touched = true; signal(); } }
  try { var q = new URLSearchParams(location.search), gs = (q.get('geos') || '').split(',').filter(function (x) { return geoById[x]; }); if (gs.length) { state.selected = gs.slice(0, 5); state.active = geoById[q.get('geo')] && gs.indexOf(q.get('geo')) >= 0 ? q.get('geo') : gs[0]; } } catch (e) {}
  buildPicker(); buildTabs(); loadInputs(); update(false);
})();
