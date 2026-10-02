// M17 dated seed snapshot (read-only, GET only, >= 400 ms between requests). Returns NON-PERSONAL values only.
// Load: browser_run_code_unsafe: async (page) => page.addScriptTag({ path: '<abs>/docs/discovery/tools/jobs/M17-snapshot.js' })
// Run:  browser_evaluate: async () => await window.__m17snap()   (save with filename → inventory/M17/_snapshot-<date>.json)
// - Pages are fetched with fetch() + DOMParser (no navigation, no script execution). JSON endpoints are the same GETs the
//   pages poll themselves.
// - Person names / e-mails are NEVER returned: JSON person keys → '<name>', person rows → '<student:n>' / '<teacher:n>' tokens
//   numbered inside this capture, e-mail → domain class only. School, class and subject names are kept (public anchors).
// - Never requested: /admin/export/*, /admin/monitoring/export/*, POST /admin/laporan-eksekutif/clear-cache.
(function () {
  function T(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  async function doc(u) { await sleep(450); var r = await fetch(u, { credentials: 'same-origin' }); var t = await r.text(); return { status: r.status, len: t.length, raw: t, d: new DOMParser().parseFromString(t, 'text/html') }; }
  var PKEY = /^(name|student|student_name|teacher_name|reason|full_name|email)$/;
  function scrub(o) { if (Array.isArray(o)) return o.map(scrub); if (o && typeof o === 'object') { Object.keys(o).forEach(function (k) { if (PKEY.test(k) && typeof o[k] === 'string' && o[k]) o[k] = '<name>'; else if (/^(student_id|id|teacher_id|user_id)$/.test(k) && typeof o[k] === 'number') o[k] = '<id>'; else o[k] = scrub(o[k]); }); } return o; }
  async function json(u) { await sleep(450); var r = await fetch(u, { credentials: 'same-origin', headers: { Accept: 'application/json' } }); var j = null; try { j = await r.json(); } catch (e) {} return { status: r.status, data: scrub(j) }; }
  function leafPairs(root) { // label → value pairs of stat cards: every element with exactly 2+ leaf texts, first = label
    var out = []; root.querySelectorAll('*').forEach(function (el) { if (el.children.length) return; var t = T(el.textContent); if (t) out.push(t); }); return out; }
  function mainText(d) { var m = d.querySelector('main') || d.body; return leafPairs(m); }
  function tableRows(tb, personCols) {
    var heads = Array.from(tb.querySelectorAll('thead th')).map(function (th) { return T(th.textContent); });
    var rows = Array.from(tb.querySelectorAll('tbody tr')).map(function (tr) { return Array.from(tr.children).map(function (td, i) { return personCols.indexOf(i) >= 0 ? '<person>' : T(td.textContent); }); });
    return { heads: heads, rows: rows };
  }
  window.__m17snap = async function () {
    var out = { capturedAt: new Date().toISOString(), note: 'M17 seed snapshot; GET only; no personal data (person names tokenised / masked, ids of persons removed).' };
    // ---- S1 dashboard ----
    var s1 = await doc('/admin');
    out.S1_dashboard = { status: s1.status, leaves: mainText(s1.d), latestQuestions: tableRows(s1.d.querySelector('main table'), []) };
    // ---- S2 command center ----
    var s2 = await doc('/admin/command-center'); out.S2_commandCenter = { status: s2.status, staticLeaves: leafPairs(s2.d.body).slice(0, 80) };
    out.S2_liveData = await json('/admin/command-center/live-data');
    // ---- S3 daily activity ----
    out.S3_dailyActivity = {};
    for (var p of ['today', 'week', 'month']) { out.S3_dailyActivity[p] = await json('/api/command-center/daily-activity?period=' + p); }
    var sch = (out.S3_dailyActivity.today.data && out.S3_dailyActivity.today.data.schools || []).map(function (s) { return s.school_id; });
    out.S3_drill = {};
    for (var i = 0; i < Math.min(sch.length, 2); i++) out.S3_drill[sch[i]] = await json('/api/command-center/daily-activity/school/' + sch[i] + '?period=today');
    out.S3_dailyActivity.bogus = await json('/api/command-center/daily-activity?period=bogus');
    // ---- S4–S7 drill-downs (aggregates only) ----
    out.S4_school = {};
    for (var sid of [8082, 8080]) {
      var d4 = await doc('/admin/command-center/school/' + sid); var tb = d4.d.querySelector('table');
      var t4 = tableRows(tb, [1]); var teacherIds = Array.from(tb.querySelectorAll('tbody tr')).map(function (tr) { var m = (tr.getAttribute('onclick') || '').match(/teacher\/(\d+)/); return m ? +m[1] : null; });
      out.S4_school[sid] = { status: d4.status, title: T(d4.d.title), stats: Array.from(d4.d.querySelectorAll('.stat-card, .stats-row > div')).map(function (c) { return T(c.textContent); }), panelTitles: Array.from(d4.d.querySelectorAll('.panel-title')).map(function (x) { return T(x.textContent); }), teacherTable: t4, teacherIdsKnown: teacherIds.filter(Boolean).length };
    }
    out.S5_teacher = {};
    for (var tu of ['8080/teacher/1919', '8082/teacher/4402', '8082/teacher/4418']) {
      var d5 = await doc('/admin/command-center/school/' + tu); var tb5 = d5.d.querySelector('table');
      out.S5_teacher[tu.replace(/teacher\/\d+/, 'teacher/{t' + Object.keys(out.S5_teacher).length + '}')] = { status: d5.status, panelTitles: Array.from(d5.d.querySelectorAll('.panel-title')).map(function (x) { return T(x.textContent); }), classTable: tb5 ? tableRows(tb5, []) : null, emptyText: T((d5.d.querySelector('.panel .empty, .panel div[style*="muted"]') || {}).textContent || ''), classIds: tb5 ? Array.from(tb5.querySelectorAll('tbody tr')).map(function (tr) { var m = (tr.getAttribute('onclick') || '').match(/classroom\/(\d+)/); return m ? +m[1] : null; }) : [] };
    }
    var d6 = await doc('/admin/command-center/classroom/370'); var tb6 = d6.d.querySelector('table');
    out.S6_classroom = { id: 370, status: d6.status, title: T(d6.d.title), info: Array.from(d6.d.querySelectorAll('.info-item')).map(function (x) { return /Guru:/.test(x.textContent) ? 'Guru: <teacher>' : T(x.textContent); }), pupilTable: tableRows(tb6, [1]) };
    out.S6_classroom.pupilTable.rows.forEach(function (r, i) { r[1] = '<student:' + (i + 1) + '>'; });
    var d7 = await doc('/admin/command-center/student/2022');
    out.S7_student = { note: 'student = <student:1> of class 370', status: d7.status, stats: Array.from(d7.d.querySelectorAll('.stat-card')).map(function (x) { return T(x.textContent); }), subjects: Array.from(d7.d.querySelectorAll('.subject-row')).map(function (x) { return T(x.textContent) + ' | onclick=' + x.getAttribute('onclick'); }), weeks: Array.from(d7.d.querySelectorAll('.week-bar')).map(function (x) { return T(x.textContent) + ' | ' + x.getAttribute('onclick'); }), headcount: tableRows(d7.d.querySelector('.hc-table'), []), insight: T((d7.d.querySelector('.ai-insight') || {}).textContent || ''), panelTitles: Array.from(d7.d.querySelectorAll('.panel-title')).map(function (x) { return T(x.textContent); }) };
    out.S7_api = { allSessions: await json('/api/command-center/student/2022/week?start=2020-01-01&end=2030-12-31'), subject: await json('/api/command-center/student/2022/subject?code=UMUM'), headcount617: await json('/api/command-center/headcount/617') };
    try { var sess = out.S7_api.allSessions.data.sessions; if (sess && sess.length) { var raw = await fetch('/api/command-center/student/2022/week?start=2020-01-01&end=2030-12-31').then(function (r) { return r.json(); }); out.S7_api.session = await json('/api/command-center/session/' + raw.sessions[0].id); } } catch (e) { out.S7_api.sessionErr = String(e); }
    // ---- S8 laporan eksekutif ----
    out.S8_eksekutif = {};
    for (var y of ['', '2025', '2024', '2027']) { var d8 = await doc('/admin/laporan-eksekutif' + (y ? '?year=' + y : '')); out.S8_eksekutif[y || 'default'] = { status: d8.status, title: T(d8.d.title), leaves: mainText(d8.d), headcount: d8.d.querySelector('main table') ? tableRows(d8.d.querySelector('main table'), []) : null, links: Array.from(d8.d.querySelectorAll('main a[href]')).map(function (a) { return a.getAttribute('href').replace(/^https?:\/\/[^/]+/, '') + ' :: ' + T(a.textContent); }) }; }
    // ---- S9 focus ----
    out.S9_focus = {};
    for (var fs of [8880, 8106, 8078, 8082, 8102, 5183]) { var d9 = await doc('/admin/laporan-eksekutif/sekolah/' + fs); out.S9_focus[fs] = { status: d9.status, title: T(d9.d.title), leaves: mainText(d9.d), headcount: d9.d.querySelector('main table') ? tableRows(d9.d.querySelector('main table'), []) : null }; }
    // ---- S10 analytics ----
    var d10 = await doc('/admin/analytics'); out.S10_analytics = { status: d10.status, leaves: mainText(d10.d), matrix: tableRows(d10.d.querySelector('main table'), []) };
    // ---- S11 laporan (aggregates; person rows tokenised) ----
    out.S11_laporan = {};
    for (var rg of ['', '7', '90', '999']) {
      var d11 = await doc('/admin/laporan' + (rg ? '?range=' + rg : ''));
      var m = d11.d.querySelector('main');
      var ov = m.querySelector('[x-show="tab === \'overview\'"]');
      ov.querySelectorAll('.card p.truncate').forEach(function (x, i) { x.textContent = '<person:' + (i + 1) + '>'; if (x.nextElementSibling && x.nextElementSibling.tagName === 'P') { var e = x.nextElementSibling.textContent; x.nextElementSibling.textContent = /moe-dl/.test(e) ? '<email:moe-dl>' : /prestasiplus\.my/.test(e) ? '<email:school-subdomain>' : '<email:other>'; } });
      var chart = (d11.raw.match(/labels:\s*(\[[^\]]*\])[\s\S]*?data:\s*(\[[^\]]*\])/) || []);
      var tabs = {};
      ['sekolah', 'guru', 'murid'].forEach(function (k) {
        var sec = m.querySelector('[x-show="tab === \'' + k + '\'"]'); var rows = Array.from(sec.querySelectorAll('tbody tr'));
        var byShow = {}; rows.forEach(function (r) { var s = r.getAttribute('x-show') || '(none)'; byShow[s] = (byShow[s] || 0) + 1; });
        tabs[k] = { heading: T((sec.querySelector('h3') || {}).textContent), pills: Array.from(sec.querySelectorAll('button.filter-pill')).map(function (b) { return T(b.textContent); }), rowCount: rows.length, rowsByXShow: byShow,
          statTiles: Array.from(sec.querySelectorAll('.grid > div')).map(function (x) { return T(x.textContent); }).slice(0, 8),
          selectOptions: Array.from(sec.querySelectorAll('select option')).map(function (o) { return T(o.textContent); }),
          rows: k === 'sekolah' ? rows.map(function (r) { return Array.from(r.children).map(function (td) { return T(td.textContent); }); }) : rows.slice(0, 400).map(function (r, i) { return Array.from(r.children).map(function (td, j) { if (j === 1) { var e = T(td.textContent); return '<' + (k === 'guru' ? 'teacher' : 'student') + ':' + (i + 1) + '>' + (/moe-dl/.test(e) ? ' <email:moe-dl>' : /prestasiplus\.my/.test(e) ? ' <email:school-subdomain>' : /@/.test(e) ? ' <email:other>' : ''); } return T(td.textContent); }); }) };
      });
      out.S11_laporan[rg || 'default'] = { status: d11.status, overviewLeaves: leafPairs(ov), rangePills: Array.from(m.querySelectorAll('a[href*="range="]')).map(function (a) { return T(a.textContent) + ' ' + (a.className.match(/bg-\S+|text-\S+/g) || []).join(' '); }), tabButtons: Array.from(m.querySelectorAll('button[\\@click^="tab"]')).map(function (b) { return T(b.textContent); }), chartLabels: chart[1] || null, chartData: chart[2] || null, tabs: rg ? { rowCounts: Object.fromEntries(Object.entries(tabs).map(function (e) { return [e[0], e[1].rowCount]; })) } : tabs };
    }
    // ---- monitoring identity (M11 component) ----
    var norm = function (h) { var d = new DOMParser().parseFromString(h, 'text/html'); var mm = d.querySelector('main'); return mm ? mm.innerHTML.replace(/\s+/g, ' ').replace(/\d{1,2}:\d{2}(:\d{2})?( ?[AP]M)?/g, 'T').length : -1; };
    var a1 = await doc('/admin/monitoring'), g1 = await doc('/guru/monitoring');
    out.monitoringIdentity = { admin: { status: a1.status, title: T(a1.d.title), mainLen: norm(a1.raw) }, guru: { status: g1.status, title: T(g1.d.title), mainLen: norm(g1.raw) },
      kpis: Array.from(a1.d.querySelectorAll('main .grid')).slice(0, 2).map(function (g) { return T(g.textContent); }) };
    var a2 = await doc('/admin/monitoring?period=7d'); out.monitoringIdentity.kpis7d = Array.from(a2.d.querySelectorAll('main .grid')).slice(0, 2).map(function (g) { return T(g.textContent); });
    // ---- performance (M23) presence only ----
    var pf = await doc('/admin/performance'); out.performanceRoute = { status: pf.status, title: T(pf.d.title), headings: Array.from(pf.d.querySelectorAll('main h2, main h3')).map(function (h) { return T(h.textContent); }), note: 'system metrics; values not recorded (M23 owns)' };
    return out;
  };
})();
