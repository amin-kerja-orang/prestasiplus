// M17 capture plan — Admin Dashboard & Analytics. Every screen x every UI state that reveals different elements.
// Load:  browser_run_code_unsafe: async (page) => page.addScriptTag({ path: '<abs>/docs/discovery/tools/jobs/M17.js' })
// then:  browser_evaluate: () => { window.__jobs = window.__M17_JOBS.filter(j => j.group === 'A'); }
// then run tools/run-state.js, save window.__invs to docs/discovery/inventory/_raw/M17/_batch.json, split-batch.js, merge-inventory.js.
//
// SAFETY: live production admin, browser lane 1 (playwright). READ-ONLY.
//   - Never clicked / submitted: laporan-eksekutif "Refresh" (it is a POST form → /admin/laporan-eksekutif/clear-cache),
//     the dashboard "Muat Turun Data (CSV)" links (/admin/export/{users,questions,payments,schools} = downloads), the quick
//     actions "Tambah Soalan Baru" / "Tambah Subjek Baru" / "Import CSV Soalan" (M04/M03 forms; not opened here).
//   - Actions are client-side reveals and GET-only JSON reads that the page itself makes: Alpine tab / filter pills and
//     search inputs on /admin/laporan, daily-activity period tabs sw('week'|'month') and school drill(id)
//     (GET /api/command-center/daily-activity[/school/{id}]?period=), student-page modals (GET /api/command-center/student/{id}/week|subject,
//     /api/command-center/session/{id}, /api/command-center/headcount/{id}).
//
// PERSONAL DATA (students, teachers, their e-mails) appears on S2, S3, S4–S7 and S11. M17MASK runs before tools/sanitize.js:
//   1. stops every interval (live polling would re-render real names after masking) and wraps window.fetch so every
//      command-center / daily-activity JSON has its person keys (name, student, student_name, teacher_name, reason, full_name)
//      replaced by '<name>' before the page renders it; then re-runs the page's own loader (fetchData() / load()).
//   2. tags person text for sanitize (.m17n): breadcrumb teacher / student crumbs, "Guru:" info value, /admin/laporan overview
//      name + e-mail lines, every leaf that looks like an e-mail, [data-name] rows outside the Sekolah tab (data-name/data-school
//      attributes of person rows are blanked), the page <title> of student / teacher pages.
//   3. person-record ids in hrefs / onclick (…/student/123, …/teacher/123) → {id}.
//   sanitize.js then masks the "Nama", "Nama Guru", "Nama Pelajar", "Pelajar" table columns and scrubs every tagged string globally.
(function () {
  var B = 'https://prestasiplus.my';
  var jobs = [];
  function mask() {
    var n = 0;
    var PKEY = /^(name|student|student_name|teacher_name|reason|full_name)$/;
    // (1) stop polling + fetch wrapper
    var last = setTimeout(function () {}, 0); for (var i = 0; i <= last; i++) { clearInterval(i); }
    if (!window.__m17fetch) {
      var of = window.fetch; window.__m17fetch = of;
      var scrub = function (o) { if (Array.isArray(o)) return o.map(scrub); if (o && typeof o === 'object') { Object.keys(o).forEach(function (k) { if (PKEY.test(k) && typeof o[k] === 'string' && o[k]) { o[k] = '<name>'; } else o[k] = scrub(o[k]); }); } return o; };
      window.fetch = function (u, a) { return of(u, a).then(function (r) { if (!/command-center|daily-activity/.test(String(u))) return r; return r.clone().json().then(function (j) { return new Response(JSON.stringify(scrub(j)), { status: r.status, headers: { 'Content-Type': 'application/json' } }); }).catch(function () { return r; }); }); };
    }
    // (2) tags
    var tag = function (el) { if (el && !el.classList.contains('m17n')) { el.classList.add('m17n'); n++; } };
    var p = location.pathname;
    document.querySelectorAll('.breadcrumb a[href*="/teacher/"]').forEach(tag);
    if (/\/(student|teacher)\/\d+/.test(p)) { document.querySelectorAll('.breadcrumb .current').forEach(tag); document.title = '<name> - Command Center'; }
    document.querySelectorAll('.info-item').forEach(function (it) { if (/^\s*Guru:/.test(it.textContent)) tag(it.querySelector('strong')); });
    if (/^\/admin\/laporan$/.test(p)) {
      var ov = document.querySelector('main [x-show="tab === \'overview\'"]');
      if (ov) ov.querySelectorAll('.card p.truncate').forEach(function (x) { tag(x); if (x.nextElementSibling && x.nextElementSibling.tagName === 'P') tag(x.nextElementSibling); });
      document.querySelectorAll('main [data-name]').forEach(function (r) { if (r.closest('[x-show="tab === \'sekolah\'"]')) return; r.setAttribute('data-name', '<name>'); var c = r.querySelector('td:nth-child(2)'); if (c) c.querySelectorAll('div, *').forEach(function (d) { if (!d.children.length) tag(d); }); if (c && !c.children.length) tag(c); });
    }
    document.querySelectorAll('body *').forEach(function (el) { if (el.children.length || el.closest('script,style')) return; var t = (el.textContent || '').trim(); if (/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(t)) tag(el); });
    document.querySelectorAll('a.__cf_email__, [data-cfemail]').forEach(function (a) { a.removeAttribute('data-cfemail'); a.textContent = '<email>'; n++; });
    // (3) person ids
    document.querySelectorAll('[href*="/student/"], [href*="/teacher/"], [onclick*="/student/"], [onclick*="/teacher/"]').forEach(function (el) {
      ['href', 'onclick'].forEach(function (k) { var v = el.getAttribute(k); if (v) el.setAttribute(k, v.replace(/\/(student|teacher)\/\d+/g, '/$1/{id}')); });
    });
    document.querySelectorAll('img').forEach(function (im) { var s = im.getAttribute('src') || ''; if (/ui-avatars|avatar|storage\/(avatars|profile)/.test(s)) { im.setAttribute('src', 'data:image/gif;base64,R0lGODlhAQABAAAAACw='); im.setAttribute('alt', '<person>'); n++; } });
    return 'm17mask: ' + n;
  }
  var M17MASK = '(' + mask.toString() + ')()';
  // re-render dynamic panels through the wrapped fetch, then re-tag
  var RELOAD = { eval: "(async () => { if (typeof fetchData === 'function') await fetchData(); else if (typeof load === 'function' && document.getElementById('school-list')) await load(); return 'reloaded'; })()" };
  var SAN = { selectors: ['.m17n'], titleName: false, cols: '^(nama|murid|pelajar)' };
  function J(group, file, url, state, actions, extra, opts) {
    var s = file.split('-')[0];
    var pre = [{ eval: M17MASK }, RELOAD, { wait: 1800 }];
    var j = { group: group, file: file, url: B + url, actions: pre.concat(actions || []).concat([{ wait: 900 }, { eval: M17MASK }]), sanitize: SAN,
              opts: Object.assign({ state: state, prefix: 'EL-M17-' + s, redact: [] }, opts || {}) };
    Object.assign(j, extra || {});
    j.opts.state = state + (j.width === 375 ? ' @375' : j.width === 768 ? ' @768' : '');
    jobs.push(j);
  }
  var M = { width: 375 }, T = { width: 768 };
  var W = function (ms) { return { wait: ms || 500 }; };
  function EV(js) { return { eval: '(() => { ' + js + ' })()' }; }
  function AEV(js) { return { eval: '(async () => { ' + js + ' })()' }; }
  var RT = function (sel, n) { var o = {}; o[sel] = n || 3; return { repeat: o }; };

  // ---------------- S1 /admin (dashboard) ----------------
  var R1 = RT('main tbody tr', 3);
  J('A', 'S1-dashboard__default__1280', '/admin', 'admin dashboard (stat cards, quick actions, Soalan Terkini, Taburan Status Soalan, Pautan Pantas)', [], null, R1);
  J('A', 'S1-dashboard__default__375', '/admin', 'default', [], M, R1);
  J('A', 'S1-dashboard__default__768', '/admin', 'default', [], T, R1);

  // ---------------- S2 /admin/command-center (standalone LIVE board) ----------------
  var R2 = { repeat: { '#live-feed > *': 3, '#top-schools > *': 2, '#top-students > *': 2 } };
  J('B', 'S2-command-center__default__1280', '/admin/command-center', 'LIVE board after first live-data poll (polling stopped for capture)', [], null, R2);
  J('B', 'S2-command-center__default__375', '/admin/command-center', 'default', [], M, R2);
  J('B', 'S2-command-center__default__768', '/admin/command-center', 'default', [], T, R2);

  // ---------------- S3 /admin/command-center/daily-activity ----------------
  var R3 = { repeat: { '#login-feed > *': 2, '#top-students > *': 2, '#live-feed > *': 2 } };
  var DRILL = AEV("for (var k = 0; k < 20 && !document.querySelector('#school-list .school-item'); k++) await new Promise(r => setTimeout(r, 500)); var r = document.querySelector('#school-list .school-item'); if (!r) return 'no school'; var id = +r.id.replace('sr-', ''); await drill(id); return 'drill ' + id;");
  J('C', 'S3-daily-activity__default__1280', '/admin/command-center/daily-activity', 'period today (default tab "📅 Hari Ini")', [], null, R3);
  J('C', 'S3-daily-activity__week__1280', '/admin/command-center/daily-activity', 'tab "📆 Minggu Ini" (sw(\'week\'): heatmap hidden)', [AEV("sw('week'); await new Promise(r => setTimeout(r, 1800)); return 'week';")], null, R3);
  J('C', 'S3-daily-activity__month__1280', '/admin/command-center/daily-activity', 'tab "🗓️ Bulan Ini" (sw(\'month\'))', [AEV("sw('month'); await new Promise(r => setTimeout(r, 1800)); return 'month';")], null, R3);
  J('C', 'S3-daily-activity__drill__1280', '/admin/command-center/daily-activity', 'today, first school row clicked → drill panel (Guru Aktif / Pelajar / Login, "Lihat penuh →")', [DRILL, W(1500)], null, R3);
  J('C', 'S3-daily-activity__month-drill__1280', '/admin/command-center/daily-activity', 'month tab + first school drill', [AEV("sw('month'); await new Promise(r => setTimeout(r, 1800)); return 'month';"), DRILL, W(1500)], null, R3);
  J('C', 'S3-daily-activity__query-ignored__1280', '/admin/command-center/daily-activity?period=week', '?period=week in the URL is ignored (Hari Ini stays active)', [], null, R3);
  J('C', 'S3-daily-activity__default__375', '/admin/command-center/daily-activity', 'default', [], M, R3);
  J('C', 'S3-daily-activity__drill__375', '/admin/command-center/daily-activity', 'drill', [DRILL, W(1500)], M, R3);
  J('C', 'S3-daily-activity__default__768', '/admin/command-center/daily-activity', 'default', [], T, R3);

  // ---------------- S4 /admin/command-center/school/{id} ----------------
  var R4 = RT('tbody tr', 3);
  J('D', 'S4-cc-school__default__1280', '/admin/command-center/school/8082', 'school 8082 (68 teachers)', [], null, R4);
  J('D', 'S4-cc-school__other__1280', '/admin/command-center/school/8080', 'school 8080 (34 teachers)', [], null, R4);
  J('D', 'S4-cc-school__not-found__1280', '/admin/command-center/school/99999999', 'unknown id → 404', []);
  J('D', 'S4-cc-school__default__375', '/admin/command-center/school/8082', 'default', [], M, R4);
  J('D', 'S4-cc-school__default__768', '/admin/command-center/school/8082', 'default', [], T, R4);

  // ---------------- S5 /admin/command-center/school/{sid}/teacher/{uid} ----------------
  var R5 = RT('tbody tr', 3);
  J('E', 'S5-cc-teacher__default__1280', '/admin/command-center/school/8080/teacher/1919', 'teacher with 7 classes', [], null, R5);
  J('E', 'S5-cc-teacher__one-class__1280', '/admin/command-center/school/8082/teacher/4402', 'teacher with 1 class', [], null, R5);
  J('E', 'S5-cc-teacher__no-class__1280', '/admin/command-center/school/8082/teacher/4418', 'teacher with 0 classes (empty state)', [], null, R5);
  J('E', 'S5-cc-teacher__not-found__1280', '/admin/command-center/school/8080/teacher/99999999', 'unknown teacher → 404', []);
  J('E', 'S5-cc-teacher__default__375', '/admin/command-center/school/8080/teacher/1919', 'default', [], M, R5);
  J('E', 'S5-cc-teacher__default__768', '/admin/command-center/school/8080/teacher/1919', 'default', [], T, R5);

  // ---------------- S6 /admin/command-center/classroom/{id} ----------------
  var R6 = RT('tbody tr', 3);
  J('F', 'S6-cc-classroom__default__1280', '/admin/command-center/classroom/370', 'class 370 (30 pupils)', [], null, R6);
  J('F', 'S6-cc-classroom__not-found__1280', '/admin/command-center/classroom/99999999', 'unknown id → 404', []);
  J('F', 'S6-cc-classroom__default__375', '/admin/command-center/classroom/370', 'default', [], M, R6);
  J('F', 'S6-cc-classroom__default__768', '/admin/command-center/classroom/370', 'default', [], T, R6);

  // ---------------- S7 /admin/command-center/student/{id} ----------------
  var R7 = { repeat: { '#weekDetail tbody tr': 3, '#sessionQuestions .q-row': 3 } };
  var SU = '/admin/command-center/student/2022';
  var WAIT = 'await new Promise(r => setTimeout(r, 1800));';
  J('G', 'S7-cc-student__default__1280', SU, 'student page (stats, subject breakdown, 8-week bars, mood, headcount, ALESA insight); modals closed', [], null, R7);
  J('G', 'S7-cc-student__all-sessions__1280', SU, 'stat card "Jumlah Jawapan 🔍" → modal "Semua Sesi Latihan"', [AEV('showAllSessions(); ' + WAIT + " return 'all';")], null, R7);
  J('G', 'S7-cc-student__week__1280', SU, 'week bar 21/09 → modal "Minggu 21/09 (…)"', [AEV("var b = Array.from(document.querySelectorAll('.week-bar')).filter(x => +x.querySelector('.week-count').textContent > 0).pop(); b.click(); " + WAIT + " return 'week';")], null, R7);
  J('G', 'S7-cc-student__week-empty__1280', SU, 'week bar with 0 answers → click ignored (no modal)', [AEV("document.querySelector('.week-bar').click(); await new Promise(r => setTimeout(r, 600)); return 'week0';")], null, R7);
  J('G', 'S7-cc-student__subject__1280', SU, 'subject row "Latihan Bebas 🔍" → modal "{subjek} — Semua Sesi"', [AEV("document.querySelector('.subject-row').click(); " + WAIT + " return 'subject';")], null, R7);
  J('G', 'S7-cc-student__session__1280', SU, 'Semua Sesi → first session row → session modal (questions list)', [AEV('showAllSessions(); ' + WAIT + " var r = document.querySelector('#weekDetail tbody tr'); if (r) r.click(); " + WAIT + " return 'session';")], null, R7);
  J('G', 'S7-cc-student__headcount__1280', SU, 'headcount row → modal "HeadCount: {subjek}" (all pupils of the config)', [AEV("document.querySelectorAll('.hc-table tbody tr')[1].click(); " + WAIT + " return 'hc';")], null, R7);
  J('G', 'S7-cc-student__not-found__1280', '/admin/command-center/student/99999999', 'unknown id → 404', []);
  J('G', 'S7-cc-student__default__375', SU, 'default', [], M, R7);
  J('G', 'S7-cc-student__session__375', SU, 'session modal', [AEV('showAllSessions(); ' + WAIT + " var r = document.querySelector('#weekDetail tbody tr'); if (r) r.click(); " + WAIT + " return 'session';")], M, R7);
  J('G', 'S7-cc-student__default__768', SU, 'default', [], T, R7);

  // ---------------- S8 /admin/laporan-eksekutif ----------------
  var R8 = { repeat: { 'main .space-y-2 > div': 3, 'main tbody tr': 3 } };
  J('H', 'S8-laporan-eksekutif__default__1280', '/admin/laporan-eksekutif', 'year 2026 (current, default)', [], null, R8);
  J('H', 'S8-laporan-eksekutif__year-2025__1280', '/admin/laporan-eksekutif?year=2025', '?year=2025 (no activity: 0 figures, no monthly trend / comparison / subject / headcount / GPS sections)', [], null, R8);
  J('H', 'S8-laporan-eksekutif__year-2027__1280', '/admin/laporan-eksekutif?year=2027', '?year=2027 (future year accepted, link "← 2026")', [], null, R8);
  J('H', 'S8-laporan-eksekutif__year-invalid__1280', '/admin/laporan-eksekutif?year=abc', '?year=abc → HTTP 500 "500 - Ralat Pelayan"', []);
  J('H', 'S8-laporan-eksekutif__default__375', '/admin/laporan-eksekutif', 'default', [], M, R8);
  J('H', 'S8-laporan-eksekutif__default__768', '/admin/laporan-eksekutif', 'default', [], T, R8);

  // ---------------- S9 /admin/laporan-eksekutif/sekolah/{id} ----------------
  J('I', 'S9-eksekutif-sekolah__default__1280', '/admin/laporan-eksekutif/sekolah/8880', 'school 8880 focus page (2026)', [], null, { repeat: { 'main tbody tr': 3 } });
  J('I', 'S9-eksekutif-sekolah__no-data__1280', '/admin/laporan-eksekutif/sekolah/5183', 'school 5183 (a 2025 "top 5" school with 0 activity)', []);
  J('I', 'S9-eksekutif-sekolah__not-found__1280', '/admin/laporan-eksekutif/sekolah/99999999', 'unknown id → 404', []);
  J('I', 'S9-eksekutif-sekolah__default__375', '/admin/laporan-eksekutif/sekolah/8880', 'default', [], M, { repeat: { 'main tbody tr': 3 } });
  J('I', 'S9-eksekutif-sekolah__default__768', '/admin/laporan-eksekutif/sekolah/8880', 'default', [], T, { repeat: { 'main tbody tr': 3 } });

  // ---------------- S10 /admin/analytics ----------------
  var R10 = { repeat: { 'main tbody tr': 3 } };
  J('J', 'S10-analytics__default__1280', '/admin/analytics', 'analytics (import cards, status distribution, content counts, top 10 subjects, coverage matrix, difficulty, curriculum status)', [], null, R10);
  J('J', 'S10-analytics__default__375', '/admin/analytics', 'default', [], M, R10);
  J('J', 'S10-analytics__default__768', '/admin/analytics', 'default', [], T, R10);

  // ---------------- S11 /admin/laporan ----------------
  var R11 = { repeat: { 'main tbody tr': 3 } };
  var TAB = function (k) { return EV("var el = document.querySelector('main [x-data]'); Alpine.$data(el).tab = '" + k + "'; return 'tab " + k + "';"); };
  var SET = function (k, v) { return EV("var el = document.querySelector('main [x-data]'); Alpine.$data(el)." + k + " = " + JSON.stringify(v) + "; return '" + k + "';"); };
  J('K', 'S11-laporan__default__1280', '/admin/laporan', 'tab Overview, range 30 (default)', [], null, R11);
  J('K', 'S11-laporan__range-7__1280', '/admin/laporan?range=7', '?range=7', [], null, R11);
  J('K', 'S11-laporan__range-90__1280', '/admin/laporan?range=90', '?range=90 ("3 Bulan")', [], null, R11);
  J('K', 'S11-laporan__range-invalid__1280', '/admin/laporan?range=999', '?range=999 → falls back to 30', [], null, R11);
  J('K', 'S11-laporan__tab-sekolah__1280', '/admin/laporan', 'tab "Sekolah (61)", filter Semua', [TAB('sekolah'), W()], null, R11);
  J('K', 'S11-laporan__sekolah-aktif__1280', '/admin/laporan', 'Sekolah, filter "Aktif (9)"', [TAB('sekolah'), SET('schoolFilter', 'aktif'), W()], null, R11);
  J('K', 'S11-laporan__sekolah-kurang__1280', '/admin/laporan', 'Sekolah, filter "Kurang (0)" (no rows)', [TAB('sekolah'), SET('schoolFilter', 'kurang'), W()], null, R11);
  J('K', 'S11-laporan__sekolah-tidak__1280', '/admin/laporan', 'Sekolah, filter "Tidak Aktif (52)"', [TAB('sekolah'), SET('schoolFilter', 'tidak'), W()], null, R11);
  J('K', 'S11-laporan__sekolah-search__1280', '/admin/laporan', 'Sekolah, search "KHIR"', [TAB('sekolah'), { fill: ['main input[x-model="schoolSearch"]', 'KHIR'] }, W()], null, R11);
  J('K', 'S11-laporan__tab-guru__1280', '/admin/laporan', 'tab "Guru (551)", filter Semua', [TAB('guru'), W()], null, R11);
  J('K', 'S11-laporan__guru-login__1280', '/admin/laporan', 'Guru, filter "Pernah Login (289)"', [TAB('guru'), SET('guruFilter', 'login'), W()], null, R11);
  J('K', 'S11-laporan__guru-belum__1280', '/admin/laporan', 'Guru, filter "Belum Login (262)"', [TAB('guru'), SET('guruFilter', 'belum'), W()], null, R11);
  J('K', 'S11-laporan__guru-school__1280', '/admin/laporan', 'Guru, school select = SEKOLAH MENENGAH KEBANGSAAN KHIR JOHARI', [TAB('guru'), { select: ['main select[x-model="guruSchool"]', 'SEKOLAH MENENGAH KEBANGSAAN KHIR JOHARI'] }, W()], null, R11);
  J('K', 'S11-laporan__guru-search-none__1280', '/admin/laporan', 'Guru, search "zzzz" (no match; no empty-state row)', [TAB('guru'), { fill: ['main input[x-model="guruSearch"]', 'zzzz'] }, W()], null, R11);
  J('K', 'S11-laporan__tab-murid__1280', '/admin/laporan', 'tab "Murid (4,533)" — Top 200', [TAB('murid'), W()], null, R11);
  J('K', 'S11-laporan__murid-aktif__1280', '/admin/laporan', 'Murid, filter Aktif', [TAB('murid'), SET('muridFilter', 'aktif'), W()], null, R11);
  J('K', 'S11-laporan__murid-login__1280', '/admin/laporan', 'Murid, filter "Login Sahaja" (no rows)', [TAB('murid'), SET('muridFilter', 'login'), W()], null, R11);
  J('K', 'S11-laporan__murid-belum__1280', '/admin/laporan', 'Murid, filter "Belum Login" (no rows)', [TAB('murid'), SET('muridFilter', 'belum'), W()], null, R11);
  J('K', 'S11-laporan__murid-school__1280', '/admin/laporan', 'Murid, school select = SEKOLAH MENENGAH KEBANGSAAN KHIR JOHARI', [TAB('murid'), { select: ['main select[x-model="muridSchool"]', 'SEKOLAH MENENGAH KEBANGSAAN KHIR JOHARI'] }, W()], null, R11);
  J('K', 'S11-laporan__default__375', '/admin/laporan', 'default', [], M, R11);
  J('K', 'S11-laporan__tab-guru__375', '/admin/laporan', 'tab Guru', [TAB('guru'), W()], M, R11);
  J('K', 'S11-laporan__default__768', '/admin/laporan', 'default', [], T, R11);

  window.__M17_JOBS = jobs;
  window.__M17_HELPERS = { MASK: M17MASK, SAN: SAN };
})();
