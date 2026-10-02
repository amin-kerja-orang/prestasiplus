// M11 capture plan — Teacher Portal: Analytics & Reports. Every screen x every UI state that reveals different elements.
// Load:  browser_run_code_unsafe: async (page) => page.addScriptTag({ path: '<abs>/docs/discovery/tools/jobs/M11.js' })
// then:  browser_evaluate: () => { window.__jobs = window.__M11_JOBS.filter(j => j.group === 'A'); }
// then run tools/run-state.js, save window.__invs to docs/discovery/inventory/_raw/M11/_batch.json, split-batch.js, merge-inventory.js.
//
// SAFETY: live production admin, browser lane 2 (playwright2). READ-ONLY.
//   - Never clicked: monitoring "PDF" / "CSV" export links (/admin/monitoring/export/{pdf|csv}), the filter "Tapis" and
//     "Refresh" submit buttons (GET form to /admin/monitoring; filters are driven by URL query strings on /guru/monitoring instead).
//   - Actions are client-side reveals only: Alpine card expanders, tabs, filter pills, search box, "Papar lagi", the question
//     modal (data already in the page), guide close (Alpine state only — localStorage is NOT written), auto-refresh pause.
//   - No quiz/session URL is opened.
//
// PERSONAL DATA (students are minors): M11MASK runs first (eval) and
//   - tags person-name nodes with class "m11n": student/teacher links and the e-mail line under them in monitoring tables,
//     drill-down <h2> headers, laporan student lists, header e-mail line; sanitize.js then masks them;
//   - replaces person names embedded in Alpine x-show search expressions ('name'.includes(studentSearch…)) with '<name>';
//   - replaces school names (monitoring tables, weekly table, attention / suggestion sentences, drill-down header, <title>)
//     with "<school>" and school codes (e.g. ABC1234) with "<kod>";
//   - removes avatar <img> src; rewrites person-record ids in links and in the location (history.replaceState) to {id}.
// Table columns headed Nama / Pelajar are masked by sanitize.js itself. No real name is written in this file.
(function () {
  var B = 'https://prestasiplus.my';
  var jobs = [];
  function mask() {
    var n = 0, main = document.querySelector('main') || document.body;
    function tag(el) { if (el && !el.classList.contains('m11n')) { el.classList.add('m11n'); n++; } }
    var SCH = /\b(SEKOLAH (MENENGAH |KEBANGSAAN |JENIS |AGAMA |RENDAH |SENI |SUKAN |BERASRAMA )[A-Z0-9 ()'.@&\/-]*[A-Z0-9)]|SMK [A-Za-z][A-Za-z0-9 ()'.@-]*[A-Za-z0-9)]|SJKC? ?\(?[CT]?\)? [A-Z][A-Z0-9 ()'.-]*[A-Z0-9)]|SK [A-Z][A-Z0-9 ()'.-]*[A-Z0-9)]|SAM [A-Z][A-Z0-9 ()'.-]*[A-Z0-9)]|KOLEJ [A-Z][A-Z0-9 ()'.-]*[A-Z0-9)]|MAKTAB [A-Z][A-Z0-9 ()'.-]*[A-Z0-9)]|SBP [A-Z][A-Z0-9 ()'.-]*[A-Z0-9)]|MRSM [A-Z][A-Z0-9 ()'.-]*[A-Z0-9)])/g;
    var KOD = /\b[A-Z]{3}\d{4}\b/g;
    var path = location.pathname;
    var isDrill = /\/monitoring\/sekolah\/\d+/.test(path);
    // --- drill-down headers and <title>
    if (isDrill) {
      // the drill-down <h2> (school or person name) is echoed by the admin top bar: replace it in every text node
      var orig = [];
      main.querySelectorAll('h2').forEach(function (h) { var o = h.textContent.replace(/\s+/g, ' ').trim(); if (o.length > 2) orig.push(o); });
      var ph = /\/(pelajar|guru)\/\d+/.test(path) ? '<person>' : '<school>';
      if (orig.length) { var w0 = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), t0; while ((t0 = w0.nextNode())) { if (t0.parentNode && /SCRIPT|STYLE/.test(t0.parentNode.tagName)) continue; var v0 = t0.nodeValue; orig.forEach(function (o) { if (v0.indexOf(o) >= 0) v0 = v0.split(o).join(ph); }); if (v0 !== t0.nodeValue) { t0.nodeValue = v0; n++; } } }
      main.querySelectorAll('h2').forEach(function (h) { h.textContent = ph; n++; });
      var parts = document.title.split(' - ');
      if (parts.length > 1 && !/^[0-9]{3} /.test(document.title)) { document.title = (/\/(pelajar|guru)\/\d+/.test(path) ? '<person>' : '<school>') + ' - ' + parts.slice(1).join(' - '); n++; }
      // header e-mail line ("<e-mail> · T5"): replace only the e-mail (tagging it would make sanitize scrub "Tingkatan n" page-wide)
      main.querySelectorAll('.card p.text-sm.text-slate-500').forEach(function (p) { if (/@/.test(p.textContent)) { p.textContent = p.textContent.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig, '<email>'); n++; } });
    }
    // --- monitoring overview: school links, weekly table names, attention/suggestion sentences
    main.querySelectorAll('a[href*="/monitoring/sekolah/"]').forEach(function (a) {
      var h = a.getAttribute('href');
      if (/\/(pelajar|guru)\/\d+/.test(h)) { tag(a); var d = a.parentElement.querySelector(':scope > div'); if (d) tag(d); }
      else { a.textContent = '<school>'; n++; }
    });
    main.querySelectorAll('a[href*="/kirkpatrick/pelajar/"]').forEach(function (a) { tag(a); var d = a.parentElement.querySelector(':scope > div'); if (d) tag(d); });
    main.querySelectorAll('#section-mingguan tbody td:first-child div:first-child').forEach(function (d) { d.textContent = '<school>'; d.setAttribute('title', '<school>'); n++; });
    main.querySelectorAll('#section-perhatian li span, #section-perhatian .grid > div span').forEach(function (s) {
      var t = s.textContent.replace(/\s+/g, ' ').trim(), i = t.indexOf(' — '), j = t.indexOf(': ');
      var k = i >= 0 && (j < 0 || i < j) ? i : j;
      if (k > 0) { s.textContent = '<school>' + t.slice(k); n++; }
    });
    // --- S4 question rows: every row carries the full question JSON in @click (question-bank data, not UI copy).
    //     Keep row 1 intact as the sample; replace the payload of the others by its key list (shape documented in the narrative §6.3).
    Array.from(main.querySelectorAll('tr[\\@click*="open-question-modal"]')).forEach(function (tr, i) {
      if (i > 0) { tr.setAttribute('@click', "$dispatch('open-question-modal', {question, subject, chapter, source, difficulty, answered_at, selected_label, is_correct, options[], explanation})"); n++; }
    });
    // --- Alpine search expressions carrying lower-cased names
    main.querySelectorAll('[x-show*=".includes("]').forEach(function (e) {
      // greedy up to ".includes(" so names containing an apostrophe (which break the live expression, D-M11-18) are fully replaced
      var v = e.getAttribute('x-show'), nv = v.replace(/(\|\|\s*)'.*'\.includes\(/g, "$1'<name>'.includes(");
      if (nv !== v) { e.setAttribute('x-show', nv); n++; }
    });
    // --- laporan (/guru/laporan) student lists (name + e-mail) and avatars
    main.querySelectorAll('p.font-semibold.truncate, p.truncate').forEach(function (p) { var nx = p.nextElementSibling; if (nx && /@|<email>/.test(nx.textContent)) { tag(p); tag(nx); } });
    main.querySelectorAll('img').forEach(function (im) { var s = im.getAttribute('src') || ''; if (/ui-avatars|avatar|storage/.test(s) || im.closest('tbody, .space-y-2')) { im.removeAttribute('src'); im.setAttribute('alt', '<person>'); n++; } });
    // --- school names / codes in remaining text and attributes
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), t;
    while ((t = w.nextNode())) { if (t.parentNode && /SCRIPT|STYLE/.test(t.parentNode.tagName)) continue; var v = t.nodeValue, nv = v.replace(SCH, '<school>').replace(KOD, '<kod>'); if (nv !== v) { t.nodeValue = nv; n++; } }
    document.querySelectorAll('[title],[alt],[aria-label]').forEach(function (e) { ['title', 'alt', 'aria-label'].forEach(function (k) { var v = e.getAttribute(k); if (v) { var nv = v.replace(SCH, '<school>').replace(KOD, '<kod>'); if (nv !== v) { e.setAttribute(k, nv); n++; } } }); });
    // --- person-record ids in links and location
    document.querySelectorAll('a[href]').forEach(function (a) { var v = a.getAttribute('href'), nv = v.replace(/\/(pelajar|guru)\/\d+(?=$|[?#/])/g, '/$1/{id}'); if (nv !== v) { a.setAttribute('href', nv); n++; } });
    if (/\/(pelajar|guru)\/\d+/.test(path)) { history.replaceState(null, '', location.href.replace(/\/(pelajar|guru)\/\d+/, '/$1/{id}')); n++; }
    return 'm11mask: ' + n;
  }
  var M11MASK = '(' + mask.toString() + ')()';
  var SAN = { selectors: ['.m11n'], titleName: false };
  function J(group, file, url, state, actions, extra, opts) {
    var s = file.split('-')[0];
    var j = { group: group, file: file, url: B + url, actions: (actions || []).concat([{ eval: M11MASK }]), sanitize: SAN,
              opts: Object.assign({ state: state, prefix: 'EL-M11-' + s, redact: [] }, opts || {}) };
    Object.assign(j, extra || {});
    j.opts.state = state + (j.width === 375 ? ' @375' : j.width === 768 ? ' @768' : '');
    jobs.push(j);
  }
  var M = { width: 375 }, T = { width: 768 };
  var W = function (ms) { return { wait: ms || 500 }; };
  function EV(js) { return { eval: '(() => { ' + js + ' })()' }; }
  function CLK(sel) { return EV("var e = document.querySelector(" + JSON.stringify(sel) + "); if (!e) return 'missing " + sel.replace(/'/g, '') + "'; e.click(); return 'clicked';"); }

  // repeated lists (first N kept; totals in meta.repeats)
  var R1 = { repeat: { 'main .space-y-2 > div.flex': 3 } };
  // row samples are partitioned by variant so every row type (tahap colour, trend icon, status, badge, link target) is kept once
  var PT = 'main #section-pelajar tbody tr', GT = 'main #section-guru tbody tr', WT = 'main #section-mingguan tbody tr';
  var R2 = { repeat: {} };
  ['15803d', 'ea580c', 'dc2626', '991b1b', '6b7280'].forEach(function (c) { R2.repeat[PT + ':has(td:nth-child(6) span[style*="' + c + '"])'] = 1; R2.repeat[GT + ':has(td:nth-child(6) span[style*="' + c + '"])'] = 1; });
  R2.repeat[WT + ':has(i.fa-arrow-down)'] = 1; R2.repeat[WT + ':has(i.fa-arrow-up)'] = 1; R2.repeat[WT + ':has(i.fa-minus)'] = 1;
  var ST = 'main [x-data*=studentFilter] tbody tr';
  var R3 = { repeat: {} };
  R3.repeat[ST + ':not(.opacity-60):not(:has(span[title]))'] = 2;
  R3.repeat[ST + ':not(.opacity-60):has(span.bg-rose-100[title])'] = 1;
  R3.repeat[ST + ':not(.opacity-60):has(span.bg-amber-100[title])'] = 1;
  R3.repeat[ST + '.opacity-60:has(td span.bg-amber-100)'] = 1;
  R3.repeat[ST + '.opacity-60:not(:has(td span.bg-amber-100))'] = 1;
  R3.repeat['main [x-data*=teacherFilter] tbody tr'] = 2;
  var TP = "main [x-show=\"tab === 'topic'\"] .flex.items-center";
  var R4 = { repeat: {} };
  R4.repeat['main tbody tr.bg-red-50\\/30'] = 2; R4.repeat['main tbody tr:not(.bg-red-50\\/30)'] = 2;
  R4.repeat["main [x-show=\"tab === 'wrong'\"] .space-y-3 > div"] = 2;
  R4.repeat["main [x-show=\"tab === 'gaps'\"] .flex-wrap > span"] = 3;
  R4.repeat["main [x-show=\"tab === 'subject'\"] .space-y-2 > div"] = 3;
  R4.repeat[TP + ':has(.bg-red-100)'] = 1; R4.repeat[TP + ':has(.bg-amber-100)'] = 1; R4.repeat[TP + ':has(.bg-green-100)'] = 1;
  var R5 = { repeat: { 'main tbody tr:not(.opacity-50)': 3, 'main tbody tr.opacity-50:has(.bg-amber-100)': 1, 'main tbody tr.opacity-50:not(:has(.bg-amber-100))': 1 } };

  // ---------------- S1 /guru/laporan ----------------
  var LOGIN = CLK("main [\\@click*=\"'login'\"]"), LAT = CLK("main [\\@click*=\"'latihan'\"]"), AKT = CLK("main [\\@click*=\"'aktiviti'\"]"), SKOR = CLK("main [\\@click*=\"'skor'\"]");
  J('A', 'S1-laporan__default__1280', '/guru/laporan', 'range 30 (default), Semua Kelas', [], null, R1);
  J('A', 'S1-laporan__range-7__1280', '/guru/laporan?range=7', 'range=7 (7 Hari)', [], null, R1);
  J('A', 'S1-laporan__range-90__1280', '/guru/laporan?range=90', 'range=90 (3 Bulan)', [], null, R1);
  J('A', 'S1-laporan__range-invalid__1280', '/guru/laporan?range=999', 'range=999 (unknown value → 30 Hari)', [], null, R1);
  J('A', 'S1-laporan__card-login__1280', '/guru/laporan', 'card "Pernah Login" expanded', [LOGIN, W(700)], null, R1);
  J('A', 'S1-laporan__card-latihan__1280', '/guru/laporan', 'card "Pernah Buat Latihan" expanded', [LAT, W(700)], null, R1);
  J('A', 'S1-laporan__card-aktiviti__1280', '/guru/laporan', 'card "Jumlah Aktiviti" expanded', [AKT, W(700)], null, R1);
  J('A', 'S1-laporan__card-skor__1280', '/guru/laporan', 'card "Skor Purata" expanded', [SKOR, W(700)], null, R1);
  J('A', 'S1-laporan__card-toggle__1280', '/guru/laporan', 'card "Skor Purata" clicked twice (collapses)', [SKOR, W(700), SKOR, W(700)], null, R1);
  J('A', 'S1-laporan__default__375', '/guru/laporan', 'default', [], M, R1);
  J('A', 'S1-laporan__card-aktiviti__375', '/guru/laporan', 'card "Jumlah Aktiviti" expanded', [AKT, W(700)], M, R1);
  J('A', 'S1-laporan__default__768', '/guru/laporan', 'default', [], T, R1);

  // ---------------- S2 /guru/monitoring (admin layout; same view as /admin/monitoring) ----------------
  var GUIDE_OFF = EV("var e = document.querySelector('main [x-data*=showGuide]'); Alpine.$data(e).showGuide = false; return 'guide hidden (no localStorage)';");
  var PAUSE = CLK('main [x-data="autoRefresh()"] button');
  J('B', 'S2-monitoring__default__1280', '/guru/monitoring', 'Semua Masa / Semua Negeri / Semua Tahap (default), guide shown', [], null, R2);
  J('B', 'S2-monitoring__guide-hidden__1280', '/guru/monitoring', 'guide closed (showGuide=false) → "Tunjuk panduan penggunaan"', [GUIDE_OFF, W(400)], null, R2);
  J('B', 'S2-monitoring__refresh-paused__1280', '/guru/monitoring', 'auto-refresh paused (play icon)', [PAUSE, W(1200)], null, R2);
  J('B', 'S2-monitoring__period-7d__1280', '/guru/monitoring?period=7d', 'period=7d (GET by URL)', [], null, R2);
  J('B', 'S2-monitoring__period-3m__1280', '/guru/monitoring?period=3m', 'period=3m (GET by URL)', [], null, R2);
  J('B', 'S2-monitoring__state-tahap__1280', '/guru/monitoring?state=Selangor&tahap=Kritikal', 'state=Selangor & tahap=Kritikal (GET by URL)', [], null, R2);
  J('B', 'S2-monitoring__filter-empty__1280', '/guru/monitoring?state=Kelantan&tahap=Cemerlang', 'state=Kelantan & tahap=Cemerlang (GET by URL; empty lists)', [], null, R2);
  J('B', 'S2-monitoring__default__375', '/guru/monitoring', 'default', [], M, R2);
  J('B', 'S2-monitoring__default__768', '/guru/monitoring', 'default', [], T, R2);

  // ---------------- S3 /guru/monitoring/sekolah/{id} ----------------
  var SF = function (v) { return CLK('main button[\\@click="studentFilter = \'' + v + '\'"]'); };
  var TF = function (v) { return CLK('main button[\\@click="teacherFilter = \'' + v + '\'"]'); };
  J('C', 'S3-monitoring-sekolah__default__1280', '/guru/monitoring/sekolah/8080', 'school with students and teachers (Semua)', [], null, R3);
  J('C', 'S3-monitoring-sekolah__filter-active__1280', '/guru/monitoring/sekolah/8080', 'student pill Aktif', [SF('active'), W()], null, R3);
  J('C', 'S3-monitoring-sekolah__filter-login__1280', '/guru/monitoring/sekolah/8080', 'student pill Login sahaja', [SF('login'), W()], null, R3);
  J('C', 'S3-monitoring-sekolah__filter-never__1280', '/guru/monitoring/sekolah/8080', 'student pill Belum login', [SF('never'), W()], null, R3);
  J('C', 'S3-monitoring-sekolah__search-none__1280', '/guru/monitoring/sekolah/8080', 'search "zzzq" (no row matches; no empty message)', [{ type: ['main input[x-model="studentSearch"]', 'zzzq'] }, W()], null, R3);
  J('C', 'S3-monitoring-sekolah__teacher-active__1280', '/guru/monitoring/sekolah/8080', 'teacher pill Pernah Login', [TF('active'), W()], null, R3);
  J('C', 'S3-monitoring-sekolah__teacher-never__1280', '/guru/monitoring/sekolah/8080', 'teacher pill Belum Login (no rows)', [TF('never'), W()], null, R3);
  J('C', 'S3-monitoring-sekolah__no-teacher__1280', '/guru/monitoring/sekolah/940', 'school with 1 student and 0 teachers', [], null, R3);
  J('C', 'S3-monitoring-sekolah__not-found__1280', '/guru/monitoring/sekolah/99999999', 'unknown school id (404)');
  J('C', 'S3-monitoring-sekolah__default__375', '/guru/monitoring/sekolah/8080', 'default', [], M, R3);
  J('C', 'S3-monitoring-sekolah__default__768', '/guru/monitoring/sekolah/8080', 'default', [], T, R3);

  // ---------------- S4 /guru/monitoring/sekolah/{id}/pelajar/{id} ----------------
  var TAB = function (v) { return CLK('main button[\\@click="tab = \'' + v + '\'"]'); };
  var P = '/guru/monitoring/sekolah/8080/pelajar/';
  J('D', 'S4-monitoring-pelajar__default__1280', P + '2008', 'tab Mengikut Subjek (default); no gaps', [], null, R4);
  J('D', 'S4-monitoring-pelajar__tab-topic__1280', P + '2008', 'tab Mengikut Tajuk', [TAB('topic'), W()], null, R4);
  J('D', 'S4-monitoring-pelajar__tab-all__1280', P + '2008', 'tab Senarai Soalan (first 20 rows)', [TAB('all'), W()], null, R4);
  J('D', 'S4-monitoring-pelajar__tab-all-more__1280', P + '2008', 'tab Senarai Soalan + "Papar lagi 20"', [TAB('all'), W(), CLK('main button[\\@click="showAll += 20"]'), W()], null, R4);
  J('D', 'S4-monitoring-pelajar__modal__1280', P + '2008', 'question modal opened from Senarai Soalan row 1', [TAB('all'), W(), CLK('main tbody tr'), W(600)], null, R4);
  J('D', 'S4-monitoring-pelajar__tab-wrong__1280', P + '2008', 'tab Jawapan Salah (first 10)', [TAB('wrong'), W()], null, R4);
  J('D', 'S4-monitoring-pelajar__tab-gaps-none__1280', P + '2008', 'tab Gap Analysis clicked (student with 0 gaps): all panels hidden — gap panel outside the tab scope (defect)', [TAB('gaps'), W()], null, R4);
  J('D', 'S4-monitoring-pelajar__tab-gaps__1280', P + '5552', 'tab Gap Analysis clicked (student with 6 gaps): all panels hidden; gap cards only in DOM (defect)', [TAB('gaps'), W()], null, R4);
  J('D', 'S4-monitoring-pelajar__tab-gaps-2__1280', P + '1921', 'tab Gap Analysis clicked (student with 2 gaps): all panels hidden; gap cards only in DOM (defect)', [TAB('gaps'), W()], null, R4);
  J('D', 'S4-monitoring-pelajar__not-found__1280', P + '99999999', 'unknown student id (404)');
  J('D', 'S4-monitoring-pelajar__default__375', P + '2008', 'default', [], M, R4);
  J('D', 'S4-monitoring-pelajar__modal__375', P + '2008', 'question modal', [TAB('all'), W(), CLK('main tbody tr'), W(600)], M, R4);
  J('D', 'S4-monitoring-pelajar__default__768', P + '2008', 'default', [], T, R4);

  // ---------------- S5 /guru/monitoring/sekolah/{id}/guru/{id} ----------------
  J('E', 'S5-monitoring-guru__default__1280', '/guru/monitoring/sekolah/8080/guru/2329', 'teacher who has logged in', [], null, R5);
  J('E', 'S5-monitoring-guru__not-found__1280', '/guru/monitoring/sekolah/8080/guru/99999999', 'unknown teacher id');
  J('E', 'S5-monitoring-guru__default__375', '/guru/monitoring/sekolah/8080/guru/2329', 'default', [], M, R5);
  J('E', 'S5-monitoring-guru__default__768', '/guru/monitoring/sekolah/8080/guru/2329', 'default', [], T, R5);

  // ---------------- S6 /guru/analisis-item ----------------
  J('F', 'S6-analisis-item__default__1280', '/guru/analisis-item', 'Semua Subjek / Semua Kelas (empty)');
  J('F', 'S6-analisis-item__subject__1280', '/guru/analisis-item?subject_id=1', 'subject_id=1 (GET by URL; empty)');
  J('F', 'S6-analisis-item__default__375', '/guru/analisis-item', 'default', [], M);
  J('F', 'S6-analisis-item__default__768', '/guru/analisis-item', 'default', [], T);

  // ---------------- S7 /guru/perbandingan-kelas (500) ----------------
  J('F', 'S7-perbandingan-kelas__default__1280', '/guru/perbandingan-kelas', 'server error 500 for admin');
  J('F', 'S7-perbandingan-kelas__default__375', '/guru/perbandingan-kelas', 'server error 500', [], M);

  // ---------------- S8 /guru/laporan-mingguan-kelas (403) ----------------
  J('F', 'S8-laporan-mingguan-kelas__default__1280', '/guru/laporan-mingguan-kelas', '403 Akses Ditolak for admin');
  J('F', 'S8-laporan-mingguan-kelas__default__375', '/guru/laporan-mingguan-kelas', '403', [], M);

  // ---------------- G: audit top-up (AUD-M11-02/-03/-05/-06/-07), 2026-09-25 evening ----------------
  J('G', 'S2-monitoring__audit-period-30d__1280', '/guru/monitoring?period=30d', 'period=30d (GET by URL) (added in audit top-up)', [], null, R2);
  J('G', 'S3-monitoring-sekolah__audit-cancelled__1280', '/guru/monitoring/sekolah/8102', 'subscription "Cancelled — sehingga …" (slate) (added in audit top-up)', [], null, R3);
  J('G', 'S3-monitoring-sekolah__audit-expired__1280', '/guru/monitoring/sekolah/8107', 'subscription "Expired — sehingga …" (slate) (added in audit top-up)', [], null, R3);
  J('G', 'S3-monitoring-sekolah__audit-warn-no-excluded__1280', '/guru/monitoring/sekolah/8087', 'warning box without the "daripadanya dikecualikan" sentence (added in audit top-up)', [], null, R3);
  J('G', 'S3-monitoring-sekolah__audit-warn-single__1280', '/guru/monitoring/sekolah/10220', 'warning box "1 akaun", no excluded sentence (added in audit top-up)', [], null, R3);
  J('G', 'S4-monitoring-pelajar__audit-topics-all__1280', P + '2008', 'Student A, tab Mengikut Tajuk, every topic row (added in audit top-up)', [TAB('topic'), W()], null, { repeat: { 'main tbody tr': 0, "main [x-show=\"tab === 'wrong'\"] .space-y-3 > div": 0, "main [x-show=\"tab === 'gaps'\"] .flex-wrap > span": 3, "main [x-show=\"tab === 'subject'\"] .space-y-2 > div": 3 } });

  window.__M11_JOBS = jobs;
  window.__M11_HELPERS = { MASK: M11MASK, SAN: SAN };
})();
