// M08 capture plan — Student Performance & Analytics. Every screen x every UI state that reveals different elements.
// Load:  browser_run_code_unsafe: async (page) => page.addScriptTag({ path: '<abs>/docs/discovery/tools/jobs/M08.js' })
// then:  browser_evaluate: () => { window.__jobs = window.__M08_JOBS.filter(j => j.group === 'A'); }
// then run tools/run-state.js, save window.__invs to docs/discovery/inventory/_raw/M08/_batch.json, split-batch.js, merge-inventory.js.
//
// SAFETY: live production admin, browser lane 1 (playwright). READ-ONLY.
//   - No job opens /quiz, /jawab, /start, /mula (the "Latihan Fokus" / "Fokus" links of /analitik/pelajar and /prestasi/{id}
//     point to /practice/{CODE}/quiz?... and are NEVER followed).
//   - No form is submitted: "Auto-Setup" (POST /headcount/auto-setup), "Cipta Headcount" (POST /headcount) and "Terbitkan"
//     (POST /timeline) are never clicked. Checkboxes inside the Auto-Setup modal are ticked client-side only (Alpine x-model).
//   - GET filter forms (/ranking, /analitik/kelas) are driven by URL query strings only (read-only list views).
//   - Actions are client-side reveals only: Alpine tabs, accordion rows, modal open/close, <select> changes that are not
//     wired to a submit, a heatmap cell click (tooltip).
//
// PERSONAL DATA (students are minors): M08MASK runs first (eval) and
//   - tags every person-name node with class "m08n" (teacher cards, top / at-risk student lists, class "Perlu Perhatian" list,
//     item-analysis "Pelajar Yang Salah" chips, ranking rows, leaderboard podium, Prestasi 360 / headcount-student headers);
//     tools/sanitize.js then masks them (selectors: ['.m08n']) and records the originals for meta.piiLeakCheck;
//   - removes avatar <img> src/alt inside main;
//   - replaces school names (SEKOLAH …, SMK/SK/SJK …) with "<school>" and PPD names with "PPD <ppd>" in text, titles and attributes;
//   - rewrites person-record ids in links (/prestasi/{id}, /prestasi?{id}, /headcount/student/{id}, /analitik/kelas/pelajar/{id}).
// Table columns headed Guru / Nama / Pelajar are masked by sanitize.js itself. No real name is written in this file.
(function () {
  var B = 'https://prestasiplus.my';
  var jobs = [];
  var M08MASK = "(() => { var n = 0; var main = document.querySelector('main') || document.body;" +
    " function tag(el) { if (el && !el.classList.contains('m08n')) { el.classList.add('m08n'); n++; } }" +
    " function wrapText(a) { Array.from(a.childNodes).forEach(function (c) { if (c.nodeType === 3 && c.nodeValue.trim()) { var s = document.createElement('span'); s.className = 'm08n'; s.textContent = c.nodeValue.trim(); a.replaceChild(s, c); n++; } }); }" +
    " function h(sel, re) { return Array.from(main.querySelectorAll(sel)).filter(function (x) { return re.test(x.textContent); }); }" +
    // S1 teacher cards
    " h('h2', /Prestasi Guru/).forEach(function (x) { var g = x.nextElementSibling; if (g) Array.from(g.children).forEach(function (c) { tag(c.querySelector('span')); }); });" +
    // S3 top / at-risk students
    " h('h3', /Murid Terbaik|Murid Berisiko/).forEach(function (x) { var g = x.nextElementSibling; if (g) g.querySelectorAll('p.font-semibold').forEach(tag); });" +
    // S5 class 'Perlu Perhatian' list
    " main.querySelectorAll('.overflow-y-auto a[href*=\"/prestasi/\"] p:first-child').forEach(tag);" +
    // S6 / S15 page headers of a person
    " if (document.querySelector('main') && /^\\/(prestasi\\/\\d+|headcount\\/student\\/\\d+)/.test(location.pathname)) { main.querySelectorAll('h1').forEach(tag); var av = main.querySelector('.w-16.h-16.rounded-full'); if (av) { av.textContent = '<in>'; n++; } }" +
    // S11 wrong-answer chips
    " Array.from(main.querySelectorAll('tbody a[href*=\"/prestasi/\"].rounded-lg')).filter(function (a) { return /\\/prestasi\\/\\d+$/.test(a.getAttribute('href')); }).forEach(wrapText);" +
    // stat-card labels such as 'Guru' would be read by sanitize.js as a person label and mask the NEXT card ('Kelas'):
    // give those leaf labels a child span so sanitize's label→value rule skips them (text unchanged).
    " main.querySelectorAll('div,p,span').forEach(function (el) { if (el.children.length || el.closest('table,select,label,button,a')) return; if (/^(guru|nama|pelajar|cikgu|guru kelas)\\s*:?$/i.test(el.textContent.trim())) { var sp = document.createElement('span'); sp.textContent = el.textContent; el.textContent = ''; el.appendChild(sp); n++; } });" +
    // S19 ranking rows (name + school)
    " main.querySelectorAll('.grid.grid-cols-12 .col-span-5 p').forEach(tag);" +
    // S20 leaderboard podium
    " main.querySelectorAll('.podium-position .truncate').forEach(tag);" +
    // avatars
    " main.querySelectorAll('img').forEach(function (im) { if (im.closest('.podium-position, tbody, .leaderboard-row, .col-span-5') || /avatar|storage|ui-avatars/i.test(im.getAttribute('src') || '')) { im.removeAttribute('src'); im.setAttribute('alt', '<person>'); n++; } });" +
    // schools / PPD (text nodes, attributes, title)
    " var RE = /\\b(SEKOLAH (MENENGAH |KEBANGSAAN |JENIS |AGAMA |RENDAH |SENI )[A-Z0-9 ()'.@&\\/-]*[A-Z0-9)]|SMK [A-Z][A-Z0-9 ()'.@-]*[A-Z0-9)]|SJKC? ?\\(?[CT]?\\)? [A-Z][A-Z0-9 ()'.-]*[A-Z0-9)]|SK [A-Z][A-Z0-9 ()'.-]*[A-Z0-9)])/g;" +
    " var RP = /\\bPPD [A-Z][A-Z ]+[A-Z]/g;" +
    " var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), t; while ((t = w.nextNode())) { if (t.parentNode && t.parentNode.tagName === 'SCRIPT') continue; var v = t.nodeValue, nv = v.replace(RE, '<school>').replace(RP, 'PPD <ppd>'); if (nv !== v) { t.nodeValue = nv; n++; } }" +
    " document.querySelectorAll('[title],[onclick],[alt]').forEach(function (e) { ['title', 'onclick', 'alt'].forEach(function (k) { var v = e.getAttribute(k); if (v && RE.test(v)) { e.setAttribute(k, v.replace(RE, '<school>')); n++; } RE.lastIndex = 0; }); });" +
    // person-record ids in links
    " document.querySelectorAll('a[href]').forEach(function (a) { var v = a.getAttribute('href'), nv = v.replace(/\\/prestasi\\/(\\d+)(?=$|[?#])/, '/prestasi/{id}').replace(/\\/prestasi\\?\\d+/, '/prestasi?{id}').replace(/\\/headcount\\/student\\/\\d+/, '/headcount/student/{id}').replace(/\\/analitik\\/kelas\\/pelajar\\/\\d+/, '/analitik/kelas/pelajar/{id}'); if (nv !== v) { a.setAttribute('href', nv); n++; } });" +
    " if (document.querySelector('main') && /^\\/(prestasi\\/\\d+|headcount\\/student\\/\\d+)/.test(location.pathname)) { var hh = main.querySelector('h1'); var nm = hh ? hh.textContent.trim() : ''; if (nm && nm !== '<masked>' && nm.length > 2) document.title = document.title.split(nm).join('<person>'); }" +
    " return 'm08mask: ' + n; })()";
  var SAN = { selectors: ['.m08n'], titleName: false };
  function J(group, file, url, state, actions, extra, opts) {
    var s = file.split('-')[0];
    var j = { group: group, file: file, url: B + url, actions: [{ eval: M08MASK }].concat(actions || []), sanitize: SAN,
              opts: Object.assign({ state: state, prefix: 'EL-M08-' + s, redact: [] }, opts || {}) };
    Object.assign(j, extra || {});
    j.opts.state = state + (j.width === 375 ? ' @375' : j.width === 768 ? ' @768' : '');
    jobs.push(j);
  }
  var M = { width: 375 }, T = { width: 768 };
  var W = function (ms) { return { wait: ms || 500 }; };
  function three(g, key, url, state, actions, opts) { J(g, key + '__default__1280', url, state, actions, null, opts); J(g, key + '__default__375', url, state, actions, M, opts); J(g, key + '__default__768', url, state, actions, T, opts); }

  // repeated lists (first N kept; totals in meta.repeats)
  var R1 = { repeat: { 'main .space-y-3.max-h-96 > div': 3, 'main table tbody tr': 6 } };
  var R3 = { repeat: { 'main table tbody tr': 4 } };
  var R5 = { repeat: { 'main .overflow-y-auto > a': 3, 'main table tbody tr': 4 } };
  var R6 = { repeat: { 'main [\\@click*="activeDay ="]': 7, 'main .grid.grid-cols-1.sm\\:grid-cols-2 > div.flex': 3 } };
  var R7 = { repeat: { 'main [x-show^="activeSubject ==="].rounded-xl': 3 } };
  var R10 = { repeat: { 'main a[href*="/analisa-item/kelas/"].rounded-2xl': 3 } };
  var R11 = { repeat: { 'main tbody[x-data]': 3, 'main [x-show*="discrimination"] tbody tr': 3, 'main a[href*="/analisa-item/kelas/"].rounded-lg': 3 } };
  var R20 = { repeat: { 'main tbody tr': 5 } };

  // ---------------- S1 /prestasi → /prestasi/sekolah ----------------
  three('A', 'S1-prestasi-sekolah', '/prestasi', 'school dashboard (redirect /prestasi → /prestasi/sekolah)', [], R1);

  // ---------------- S2 /prestasi/tingkatan ----------------
  three('A', 'S2-prestasi-tingkatan-pilih', '/prestasi/tingkatan', 'Tingkatan picker (T4, T5)');

  // ---------------- S3 /prestasi/tingkatan/{t4|t5} ----------------
  J('A', 'S3-prestasi-tingkatan__t4__1280', '/prestasi/tingkatan/t4', 'Tingkatan 4 dashboard', [], null, R3);
  J('A', 'S3-prestasi-tingkatan__t5__1280', '/prestasi/tingkatan/t5', 'Tingkatan 5 dashboard (645 classes, 10 top students)', [], null, R3);
  J('A', 'S3-prestasi-tingkatan__not-found__1280', '/prestasi/tingkatan/t3', 'unsupported level t3 (404)');
  J('A', 'S3-prestasi-tingkatan__t4__375', '/prestasi/tingkatan/t4', 'Tingkatan 4', [], M, R3);
  J('A', 'S3-prestasi-tingkatan__t4__768', '/prestasi/tingkatan/t4', 'Tingkatan 4', [], T, R3);

  // ---------------- S4 /prestasi/kelas ----------------
  three('B', 'S4-prestasi-kelas-pilih', '/prestasi/kelas', 'class picker (admin: no active class → empty state)');

  // ---------------- S5 /prestasi/kelas/{id} ----------------
  J('B', 'S5-prestasi-kelas__no-activity__1280', '/prestasi/kelas/4', 'class 4 (no activity in 30 days)', [], null, R5);
  J('B', 'S5-prestasi-kelas__trend__1280', '/prestasi/kelas/228', 'class 228 (trend chart, ranking)', [], null, R5);
  J('B', 'S5-prestasi-kelas__sc-link__1280', '/prestasi/kelas/sc-419', 'school-class link sc-{id} from S3 (404)');
  J('B', 'S5-prestasi-kelas__trend__375', '/prestasi/kelas/228', 'class 228', [], M, R5);
  J('B', 'S5-prestasi-kelas__trend__768', '/prestasi/kelas/228', 'class 228', [], T, R5);

  // ---------------- S6 /prestasi/{userId} (Prestasi 360) ----------------
  var DAY = { click: 'main [\\@click*="activeDay ="] >> nth=10' };
  J('C', 'S6-prestasi-360__empty__1280', '/prestasi/1', 'own account (no practice data)', [], null, R6);
  J('C', 'S6-prestasi-360__day-tooltip__1280', '/prestasi/1', 'heatmap cell clicked (activeDay tooltip)', [DAY, W(300)], null, R6);
  J('C', 'S6-prestasi-360__data__1280', '/prestasi/1771', 'student with data (headcount card, mastery, weak topics, suggestions)', [], null, R6);
  J('C', 'S6-prestasi-360__not-found__1280', '/prestasi/99999999', 'unknown user id (404)');
  J('C', 'S6-prestasi-360__data__375', '/prestasi/1771', 'student with data', [], M, R6);
  J('C', 'S6-prestasi-360__data__768', '/prestasi/1771', 'student with data', [], T, R6);

  // ---------------- S7 /analitik/pelajar ----------------
  var SEJ = { click: 'main button[\\@click="activeSubject = 5"]' };
  var ALL = { click: 'main button[\\@click="showAllWeakTopics = !showAllWeakTopics"]' };
  J('D', 'S7-analitik-pelajar__default__1280', '/analitik/pelajar', 'subject tab Bahasa Melayu (default)', [], null, R7);
  J('D', 'S7-analitik-pelajar__all-weak__1280', '/analitik/pelajar', '"Lihat semua 17 topik lemah" expanded', [ALL, W()], null, R7);
  J('D', 'S7-analitik-pelajar__tab-sej__1280', '/analitik/pelajar', 'subject tab Sejarah', [SEJ, W()], null, R7);
  J('D', 'S7-analitik-pelajar__tab-sej-all__1280', '/analitik/pelajar', 'Sejarah + all weak topics expanded', [SEJ, W(), ALL, W()], null, R7);
  J('D', 'S7-analitik-pelajar__default__375', '/analitik/pelajar', 'default', [], M, R7);
  J('D', 'S7-analitik-pelajar__all-weak__375', '/analitik/pelajar', 'all weak topics expanded', [ALL, W()], M, R7);
  J('D', 'S7-analitik-pelajar__default__768', '/analitik/pelajar', 'default', [], T, R7);

  // ---------------- S8 /analitik/kelas ----------------
  J('D', 'S8-analitik-kelas__empty__1280', '/analitik/kelas', 'no class selected (empty state)');
  J('D', 'S8-analitik-kelas__class-4__1280', '/analitik/kelas?classroom_id=4', 'classroom_id=4 (6 students)');
  J('D', 'S8-analitik-kelas__risk-low__1280', '/analitik/kelas?classroom_id=4&subject_id=1&risk_level=low', 'risk_level=low filter (GET)');
  J('D', 'S8-analitik-kelas__subject-sej__1280', '/analitik/kelas?classroom_id=4&subject_id=5', 'subject_id=5 (Sejarah) (GET)');
  J('D', 'S8-analitik-kelas__class-4__375', '/analitik/kelas?classroom_id=4', 'classroom_id=4', [], M);
  J('D', 'S8-analitik-kelas__class-4__768', '/analitik/kelas?classroom_id=4', 'classroom_id=4', [], T);

  // ---------------- S9 /analisa-item/sekolah ----------------
  J('E', 'S9-analisa-item-sekolah__default__1280', '/analisa-item/sekolah', 'Semua (no student data)');
  J('E', 'S9-analisa-item-sekolah__t4__1280', '/analisa-item/sekolah?tingkatan=T4', 'tingkatan=T4');
  J('E', 'S9-analisa-item-sekolah__t5__1280', '/analisa-item/sekolah?tingkatan=T5', 'tingkatan=T5');
  J('E', 'S9-analisa-item-sekolah__default__375', '/analisa-item/sekolah', 'Semua', [], M);
  J('E', 'S9-analisa-item-sekolah__default__768', '/analisa-item/sekolah', 'Semua', [], T);

  // ---------------- S10 /analisa-item/kelas ----------------
  three('E', 'S10-analisa-item-kelas-pilih', '/analisa-item/kelas', 'class picker (750 class cards)', [], R10);

  // ---------------- S11 /analisa-item/kelas/{id} ----------------
  var ROW = { eval: "(() => { var r = document.querySelector('main tbody[x-data] tr'); r.click(); return 'row clicked'; })()" };
  var DISC = { click: "main button[\\@click=\"activeTab = 'discrimination'\"]" };
  J('F', 'S11-analisa-item-kelas__difficulty__1280', '/analisa-item/kelas/228', 'class 228: tab Indeks Kesukaran (default)', [], null, R11);
  J('F', 'S11-analisa-item-kelas__row-open__1280', '/analisa-item/kelas/228', 'first item row expanded', [ROW, W()], null, R11);
  J('F', 'S11-analisa-item-kelas__discrimination__1280', '/analisa-item/kelas/228', 'tab Indeks Diskriminasi', [DISC, W()], null, R11);
  J('F', 'S11-analisa-item-kelas__sort-changed__1280', '/analisa-item/kelas/228', 'sort select = Paling Mudah Dahulu + search "fact" (no effect on rows)',
    [{ select: ['main select[x-model=diffSort]', 'difficulty_asc'] }, { fill: ['main input[x-model=diffSearch]', 'fact'] }, W(),
     { eval: "(() => { var r = Array.from(document.querySelectorAll('main tbody[x-data] > tr:first-child')); var vis = r.filter(function (t) { return t.offsetParent !== null; }).length; return 'rows=' + r.length + ' visible=' + vis + ' first=' + (r[0] ? r[0].children[4].textContent.trim() : ''); })()" }], null, R11);
  J('F', 'S11-analisa-item-kelas__empty__1280', '/analisa-item/kelas/6', 'class 6: no answers (Tiada Data Lagi)', [], null, R11);
  J('F', 'S11-analisa-item-kelas__empty-disc__1280', '/analisa-item/kelas/6', 'class 6: discrimination tab (Data Tidak Mencukupi)', [DISC, W()], null, R11);
  J('F', 'S11-analisa-item-kelas__not-found__1280', '/analisa-item/kelas/99999999', 'unknown class id');
  J('F', 'S11-analisa-item-kelas__difficulty__375', '/analisa-item/kelas/228', 'class 228', [], M, R11);
  J('F', 'S11-analisa-item-kelas__row-open__375', '/analisa-item/kelas/228', 'first row expanded', [ROW, W()], M, R11);
  J('F', 'S11-analisa-item-kelas__difficulty__768', '/analisa-item/kelas/228', 'class 228', [], T, R11);

  // ---------------- S12 /headcount ----------------
  var AUTO = { click: 'main button[\\@click^="showAutoSetup = true"]' };
  J('G', 'S12-headcount__default__1280', '/headcount', 'no headcount yet (empty state)');
  J('G', 'S12-headcount__auto-setup__1280', '/headcount', 'Auto-Setup modal open (nothing selected, submit disabled)', [AUTO, W()]);
  J('G', 'S12-headcount__auto-setup-selected__1280', '/headcount', 'Auto-Setup modal with D1 + T4 ticked (NOT submitted)',
    [AUTO, W(), { check: 'main input[name="levels[]"][value="1"]' }, { check: 'main input[name="levels[]"][value="T4"]' }, W()]);
  J('G', 'S12-headcount__auto-setup-reopen__1280', '/headcount', 'ticked, Batal, reopened (selection reset by opener)',
    [AUTO, W(), { check: 'main input[name="levels[]"][value="1"]' }, { click: 'main button[\\@click="showAutoSetup = false"][type=button]' }, W(), AUTO, W(),
     { eval: "(() => 'checked=' + document.querySelectorAll('main input[name=\"levels[]\"]:checked').length)()" }]);
  J('G', 'S12-headcount__default__375', '/headcount', 'empty', [], M);
  J('G', 'S12-headcount__auto-setup__375', '/headcount', 'Auto-Setup modal open', [AUTO, W()], M);
  J('G', 'S12-headcount__default__768', '/headcount', 'empty', [], T);

  // ---------------- S13 /headcount/dashboard ----------------
  three('G', 'S13-headcount-dashboard', '/headcount/dashboard', 'no configs (empty)');

  // ---------------- S14 /headcount/create ----------------
  J('G', 'S14-headcount-create__default__1280', '/headcount/create', 'form default (3 OTR, mode Auto)');
  J('G', 'S14-headcount-create__manual__1280', '/headcount/create', 'mode Manual picked + 5 OTR + subject/level chosen (NOT submitted)',
    [{ check: 'main input[name=mode][value=manual]' }, { check: 'main input[name=active_otrs][value="5"]' }, { select: ['main select[name=subject_id]', '3'] }, { select: ['main select[name=education_level_id]', '11'] }, W()]);
  J('G', 'S14-headcount-create__default__375', '/headcount/create', 'form default', [], M);
  J('G', 'S14-headcount-create__default__768', '/headcount/create', 'form default', [], T);

  // ---------------- S15 /headcount/student/{id} ----------------
  J('G', 'S15-headcount-pelajar__default__1280', '/headcount/student/1771', 'student headcount (3 configs, charts)');
  J('G', 'S15-headcount-pelajar__not-found__1280', '/headcount/student/99999999', 'unknown id');
  J('G', 'S15-headcount-pelajar__default__375', '/headcount/student/1771', 'student headcount', [], M);
  J('G', 'S15-headcount-pelajar__default__768', '/headcount/student/1771', 'student headcount', [], T);

  // ---------------- S16 /timeline ----------------
  three('H', 'S16-timeline', '/timeline', 'empty timeline + public profile link');

  // ---------------- S17 /timeline/create ----------------
  J('H', 'S17-timeline-create__default__1280', '/timeline/create', 'form default (Kategori = Cerita)');
  J('H', 'S17-timeline-create__category__1280', '/timeline/create', 'Kategori = Sijil selected (NOT submitted)', [{ select: ['main select[name=category]', 'sijil'] }, W()]);
  J('H', 'S17-timeline-create__default__375', '/timeline/create', 'form default', [], M);
  J('H', 'S17-timeline-create__default__768', '/timeline/create', 'form default', [], T);

  // ---------------- S18 /pelajar/{id} (public profile) ----------------
  J('H', 'S18-profil-awam__default__1280', '/pelajar/1', 'own public profile (id 1)');
  J('H', 'S18-profil-awam__timeline-link__1280', '/pelajar/3', 'id from the /timeline "Profil Awam" link (404)');
  J('H', 'S18-profil-awam__default__375', '/pelajar/1', 'own public profile', [], M);
  J('H', 'S18-profil-awam__default__768', '/pelajar/1', 'own public profile', [], T);

  // ---------------- S19 /ranking ----------------
  J('I', 'S19-ranking__nasional__1280', '/ranking', 'scope nasional (default)');
  J('I', 'S19-ranking__negeri__1280', '/ranking?scope=negeri', 'scope negeri (negeri select, empty)');
  J('I', 'S19-ranking__daerah__1280', '/ranking?scope=daerah', 'scope daerah (empty)');
  J('I', 'S19-ranking__sekolah__1280', '/ranking?scope=sekolah', 'scope sekolah (empty)');
  J('I', 'S19-ranking__negeri-selangor__1280', '/ranking?scope=negeri&negeri=Selangor', 'negeri=Selangor');
  J('I', 'S19-ranking__subject__1280', '/ranking?scope=nasional&subject_id=3', 'subject_id=3 (Matematik)');
  J('I', 'S19-ranking__tingkatan-empty__1280', '/ranking?scope=nasional&tingkatan=T4', 'tingkatan=T4 (empty)');
  J('I', 'S19-ranking__nasional__375', '/ranking', 'nasional', [], M);
  J('I', 'S19-ranking__negeri__375', '/ranking?scope=negeri', 'negeri', [], M);
  J('I', 'S19-ranking__nasional__768', '/ranking', 'nasional', [], T);

  // ---------------- S20 /leaderboard ----------------
  J('I', 'S20-leaderboard__default__1280', '/leaderboard', 'no period (Minggu Ini active)', [], null, R20);
  J('I', 'S20-leaderboard__all__1280', '/leaderboard?period=all', 'Semua Masa (own rank shown)', [], null, R20);
  J('I', 'S20-leaderboard__month__1280', '/leaderboard?period=month', 'Bulan Ini', [], null, R20);
  J('I', 'S20-leaderboard__default__375', '/leaderboard', 'default', [], M, R20);
  J('I', 'S20-leaderboard__default__768', '/leaderboard', 'default', [], T, R20);

  // ---------------- S21 /laporan-mingguan (+ other access outcomes) ----------------
  J('J', 'S21-laporan-mingguan__forbidden__1280', '/laporan-mingguan', 'admin account: 403 Akses Ditolak');
  J('J', 'S21-laporan-mingguan__forbidden__375', '/laporan-mingguan', '403', [], M);
  J('J', 'S21-laporan-mingguan__analitik-pelajar-403__1280', '/analitik/kelas/pelajar/1', '/analitik/kelas/pelajar/{id} (S8 "Lihat Analitik") → 403');

  window.__M08_JOBS = jobs;
  window.__M08_HELPERS = { MASK: M08MASK, SAN: SAN };
})();
