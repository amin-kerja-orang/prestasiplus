// M10 capture plan — Teacher Portal: Class & Teaching. Every screen x every UI state that reveals different elements.
// Load:  browser_run_code_unsafe: async (page) => page.addScriptTag({ path: '<abs>/docs/discovery/tools/jobs/M10.js' })
// then:  browser_evaluate: () => { window.__jobs = window.__M10_JOBS.filter(j => j.group === 'A'); }
// then run tools/run-state.js, save window.__invs to docs/discovery/inventory/_raw/M10/_batch.json, split-batch.js, merge-inventory.js.
//
// SAFETY: live production admin, browser lane 1 (playwright). READ-ONLY.
//   - No form is submitted and no mutating button is clicked: never "Cipta Kelas", "Lancarkan Misi", "Cipta Set & Tambah Soalan",
//     "Simpan Soalan", "Hantar untuk Semakan", "Simpan Perubahan", "Hantar", "Tambah" (jadual), "Hantar Laporan", "Hantar Artikel",
//     "Kemaskini Artikel", "Simpan Profil", "Sertai", "Import", "Hantar kepada Admin", "Padam", inline "Simpan" (new chapter/topic/
//     bidang/SK/SP), toggle-status, "Simpan Set Audio KBAT".
//   - Command Center: only read-only GET drill modals (drill?type=…) and "Kelas" / "Ramalan SPM" / "Remedial" (GET scan) panels are
//     opened. "Evaluate" (GET /evaluate, "Penilaian Risiko") and "Badges" ("Scan & Award Badges", GET /achievements) are NOT opened
//     because their names suggest server-side writes; remedial "Jana" (POST generate) and "Batal" (POST cancel) are never clicked.
//   - No /quiz, /jawab, /start, /mula or live-class join link is opened.
//   - Actions are client-side reveals only: Alpine toggles, tabs, select changes wired to GET JSON lookups (chapters/topics/DSKP),
//     school-search typing (GET /api/schools/search), modal open/close.
//
// PERSONAL DATA (students are minors): M10MASK runs first (eval):
//   - "Soalan Oleh: <teacher>", "Dicipta oleh <x>", "Disediakan oleh <x>" in text and textarea values → "<person>";
//   - school names in text / attributes / input values → "<school>"; school-search results and the profile school card are tagged .m10n;
//   - avatars removed; the huge chapter selects (M03 data, 936 options) are trimmed to 12 options (total recorded in data-total-options).
//   Then tools/sanitize.js masks the Nama / Pelajar columns (attendance list, drill tables) and personal inputs (profile name/e-mail/IC).
(function () {
  var B = 'https://prestasiplus.my';
  var jobs = [];
  var M10MASK = "(() => { var n = 0; var main = document.querySelector('main') || document.body;" +
    " var RO = /(Soalan Oleh:\\s*|Dicipta oleh\\s+|Disediakan oleh:?\\s*)((Cikgu|Cg\\.?|Puan|Pn\\.?|Encik|En\\.?|Ustaz|Ustazah|Tuan|Dr\\.?)\\s+)?[A-Za-z][A-Za-z'.@\\/-]*(\\s+(bin|binti|bt|b\\.|A\\/P|A\\/L|[A-Z][A-Za-z'.-]*))*/g;" +
    " var RE = /\\b(SEKOLAH (MENENGAH |KEBANGSAAN |JENIS |AGAMA |RENDAH |SENI )[A-Z0-9 ()'.@&\\/-]*[A-Z0-9)]|SMK [A-Z]{2}[A-Z0-9 ()'.@-]*[A-Z0-9)]|SJKC? ?\\(?[CT]?\\)? [A-Z]{2}[A-Z0-9 ()'.-]*[A-Z0-9)]|SK [A-Z]{2}[A-Z0-9 ()'.-]*[A-Z0-9)]|SMA [A-Z]{2}[A-Z0-9 ()'.-]*[A-Z0-9)]|MRSM [A-Z]{2}[A-Z0-9 ()'.-]*[A-Z0-9)])/g;" +
    " var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), t; while ((t = w.nextNode())) { if (t.parentNode && /SCRIPT|STYLE/.test(t.parentNode.tagName)) continue; var v = t.nodeValue, nv = v.replace(RO, '$1<person>').replace(RE, '<school>'); if (nv !== v) { t.nodeValue = nv; n++; } }" +
    " document.querySelectorAll('textarea, input[type=text]').forEach(function (e) { var v = e.value, nv = v.replace(RO, '$1<person>').replace(RE, '<school>'); if (nv !== v) { e.value = nv; n++; } });" +
    " document.querySelectorAll('[title],[alt],[placeholder]').forEach(function (e) { ['title', 'alt'].forEach(function (k) { var v = e.getAttribute(k); if (v) { var nv = v.replace(RO, '$1<person>').replace(RE, '<school>'); if (nv !== v) { e.setAttribute(k, nv); n++; } } }); });" +
    " main.querySelectorAll('[x-text=\"s.name\"], [x-text=\"schoolName\"], [x-text=\"selectedName\"], [x-text=\"r.name\"], [x-text=\"school.name\"]').forEach(function (e) { e.classList.add('m10n'); n++; });" +
    " main.querySelectorAll('img').forEach(function (im) { if (/avatar|ui-avatars|profile/i.test(im.getAttribute('src') || '')) { im.removeAttribute('src'); im.setAttribute('alt', '<person>'); n++; } });" +
    " main.querySelectorAll('select').forEach(function (s) { if (s.options.length > 60) { s.setAttribute('data-total-options', s.options.length); while (s.options.length > 12) s.remove(12); n++; } });" +
    " return 'm10mask: ' + n; })()";
  var SAN = { selectors: ['.m10n'], titleName: false };
  function J(group, file, url, state, actions, extra, opts) {
    var s = file.split('-')[0];
    var j = { group: group, file: file, url: B + url, actions: [{ eval: M10MASK }].concat(actions || []).concat([{ eval: M10MASK }]), sanitize: SAN,
              opts: Object.assign({ state: state, prefix: 'EL-M10-' + s, redact: [] }, opts || {}) };
    Object.assign(j, extra || {});
    j.opts.state = state + (j.width === 375 ? ' @375' : j.width === 768 ? ' @768' : '');
    jobs.push(j);
  }
  var M = { width: 375 }, T = { width: 768 };
  var W = function (ms) { return { wait: ms || 500 }; };
  function three(g, key, url, state, actions, opts) { J(g, key + '__default__1280', url, state, actions, null, opts); J(g, key + '__default__375', url, state, actions, M, opts); J(g, key + '__default__768', url, state, actions, T, opts); }
  function one(g, key, st, url, state, actions, opts, w) { J(g, key + '__' + st + '__' + (w || 1280), url, state, actions, w === 375 ? M : w === 768 ? T : null, opts); }
  function ev(js) { return { eval: js }; }

  // repeated lists (first N kept; totals in meta.repeats)
  var R_ATT = { repeat: { 'main table tbody tr': 3 } };
  var R_TBL = { repeat: { 'main table tbody tr': 3 } };
  var R_CARD = { repeat: { 'main [x-data="{ open: false }"]': 3 } };
  var R_ART = { repeat: { 'main div.divide-y > div.p-5': 3 } };
  var R_DB = { repeat: { 'main div.card:has(button[\\@click^="openReport("])': 3 } };
  var R_AUD = { repeat: { 'main div.rounded-xl.border.border-slate-200:has(> textarea[name$="[question_text]"])': 2 } };

  // ---------------- A: dashboard, command center, remedial ----------------
  three('A', 'S1-guru-dashboard', '/guru', 'teacher dashboard (guide shown, admin owns no class)', [ev("localStorage.removeItem('hideGuruGuide')"), W(200)]);
  one('A', 'S1-guru-dashboard', 'guide-hidden', '/guru', 'guide dismissed (X) → "Tunjuk panduan" pill', [ev("localStorage.removeItem('hideGuruGuide')"), { click: "main button[\\@click^=\"showGuide = false\"]" }, W(300)]);
  three('A', 'S2-command-center', '/guru/command-center', 'Command Center (standalone dark layout)', [W(1500)]);
  var DR = function (a, b) { return [W(1200), ev("drill('" + a + "'" + (b ? ", '" + b + "'" : '') + ")"), W(1500)]; };
  one('A', 'S2-command-center', 'drill-students', '/guru/command-center', 'drill modal students (empty)', DR('students'));
  one('A', 'S2-command-center', 'drill-gps', '/guru/command-center', 'drill modal gps (empty)', DR('gps'));
  one('A', 'S2-command-center', 'drill-kirk-t1', '/guru/command-center', 'drill modal kirk t1 (empty)', DR('kirk', 't1'));
  one('A', 'S2-command-center', 'drill-mood', '/guru/command-center', 'drill modal mood happy (empty)', DR('mood', 'happy'));
  one('A', 'S2-command-center', 'remedial', '/guru/command-center', 'Remedial panel (GET scan → HTTP 500)', [W(1200), ev('showRemedial()'), W(2500)]);
  one('A', 'S2-command-center', 'predictive', '/guru/command-center', 'Ramalan SPM panel (GET predictive, empty)', [W(1200), ev('showPredictive()'), W(2500)]);
  one('A', 'S2-command-center', 'kelas', '/guru/command-center', 'Kelas panel (GET live-data)', [W(1200), ev('showTeacherPerf()'), W(2500)]);
  one('A', 'S2-command-center', 'drill-students', '/guru/command-center', 'drill modal students', DR('students'), null, 375);
  three('A', 'S3-remedial-progress', '/guru/remedial-progress', 'Remedial Progress Dashboard (empty)');

  // ---------------- B: classes, students, attendance, timetable, broadcast, live ----------------
  three('B', 'S4-guru-kelas', '/guru/kelas', 'class list (empty)');
  one('B', 'S4-guru-kelas', 'qr-modal', '/guru/kelas', 'quick QR modal forced open (no class; fields empty)', [ev("(() => { var m = document.getElementById('quickQrModal'); m.classList.remove('hidden'); m.classList.add('flex'); return 'open'; })()"), W(300)]);
  three('B', 'S5-kelas-cipta', '/guru/kelas/cipta', 'create class form');
  one('B', 'S5-kelas-cipta', 'school-search', '/guru/kelas/cipta', 'school search typed "kebangsaan" → results', [{ type: ['main input[placeholder^="Taip nama sekolah"]', 'kebangsaan'] }, W(1800)]);
  one('B', 'S5-kelas-cipta', 'school-none', '/guru/kelas/cipta', 'school search "zzqx" → Tiada sekolah dijumpai', [{ type: ['main input[placeholder^="Taip nama sekolah"]', 'zzqx'] }, W(1800)]);
  one('B', 'S5-kelas-cipta', 'school-selected', '/guru/kelas/cipta', 'school chosen from results (secondary) → Ting. radios only', [{ type: ['main input[placeholder^="Taip nama sekolah"]', 'menengah'] }, W(1800), { click: 'main button[\\@click="selectSchool(s)"]' }, W(600)]);
  three('B', 'S6-guru-pelajar', '/guru/pelajar', 'my students (tab Pelajar Saya, empty)');
  one('B', 'S6-guru-pelajar', 'tab-school', '/guru/pelajar', 'tab Pelajar Sekolah', [{ click: "main button[\\@click=\"tab = 'school'\"]" }, W(400)]);
  one('B', 'S6-guru-pelajar', 'tab-school', '/guru/pelajar', 'tab Pelajar Sekolah', [{ click: "main button[\\@click=\"tab = 'school'\"]" }, W(400)], null, 375);
  three('B', 'S7-kehadiran-digital', '/guru/kehadiran-digital', 'digital attendance today (school students list)', [], R_ATT);
  one('B', 'S7-kehadiran-digital', 'date-past', '/guru/kehadiran-digital?date=2026-09-01', 'attendance for a past date (GET ?date=)', [], R_ATT);
  three('B', 'S8-jadual-belajar', '/guru/jadual-belajar', 'study timetable (empty week)');
  three('B', 'S9-broadcast', '/guru/broadcast', 'broadcast form + empty history');
  one('B', 'S9-broadcast', 'penting', '/guru/broadcast', 'priority Penting selected (not sent)', [{ check: 'main input[name="priority"][value="important"]' }, W(200)]);
  three('B', 'S10-live-kelas', '/guru/live-kelas', 'live classroom (no active students)', [W(800)]);
  one('B', 'S10-live-kelas', 'refreshed', '/guru/live-kelas', 'after Muat Semula (GET JSON)', [{ click: 'main button[\\@click="fetchSessions()"]' }, W(1500)]);

  // ---------------- C: missions, sets, soalan & rujukan ----------------
  three('C', 'S11-misi-harian', '/guru/misi-harian', 'missions list (empty)');
  three('C', 'S12-misi-harian-cipta', '/guru/misi-harian/cipta', 'create mission (default Latih Tubi SPM)');
  one('C', 'S12-misi-harian-cipta', 'tracking-a', '/guru/misi-harian/cipta', 'Jenis Misi = Tracking A', [{ select: ['main select[name="mission_type"]', 'tracking_a'] }, W(300)]);
  one('C', 'S12-misi-harian-cipta', 'youtube', '/guru/misi-harian/cipta', 'Jenis Misi = Soalan & Rujukan (YouTube)', [{ select: ['main select[name="mission_type"]', 'youtube'] }, W(300)]);
  one('C', 'S12-misi-harian-cipta', 'subject-bm', '/guru/misi-harian/cipta', 'Subjek BM → chapter options filtered', [{ select: ['main select[name="subject_id"]', '1'] }, W(300), ev("(() => { var s = document.getElementById('chapterSelect'); return 'visible chapters=' + Array.from(s.options).filter(function (o) { return o.style.display !== 'none'; }).length; })()")]);
  one('C', 'S12-misi-harian-cipta', 'youtube', '/guru/misi-harian/cipta', 'Jenis Misi = YouTube', [{ select: ['main select[name="mission_type"]', 'youtube'] }, W(300)], null, 375);
  three('C', 'S13-set-soalan', '/guru/set-soalan', 'question sets list (empty)');
  three('C', 'S14-set-soalan-cipta', '/guru/set-soalan/cipta', 'create set (status Draf)');
  one('C', 'S14-set-soalan-cipta', 'scheduled', '/guru/set-soalan/cipta', 'status Jadual → scheduled_at shown', [{ click: "main label[\\@click=\"status = 'scheduled'\"]" }, W(300)]);
  one('C', 'S14-set-soalan-cipta', 'published', '/guru/set-soalan/cipta', 'status Terbit', [{ click: "main label[\\@click=\"status = 'published'\"]" }, W(300)]);
  three('C', 'S15-soalan-guru', '/guru/soalan-guru', 'Soalan & Rujukan list (empty)');
  three('C', 'S16-soalan-guru-cipta', '/guru/soalan-guru/cipta', 'create Soalan & Rujukan (guide open)');
  one('C', 'S16-soalan-guru-cipta', 'guide-hidden', '/guru/soalan-guru/cipta', 'guide collapsed', [{ click: 'main button[\\@click="showGuide = !showGuide"]' }, W(300)]);
  one('C', 'S16-soalan-guru-cipta', 'youtube', '/guru/soalan-guru/cipta', 'YouTube URL typed → preview', [{ fill: ['main input[name="youtube_url"]', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'] }, ev("(() => { var i = document.querySelector('main input[name=youtube_url]'); i.dispatchEvent(new Event('input', {bubbles:true})); return 'yt'; })()"), W(800)]);
  one('C', 'S16-soalan-guru-cipta', 'link-other', '/guru/soalan-guru/cipta', 'non-YouTube link typed', [{ fill: ['main input[name="youtube_url"]', 'https://example.com/rujukan.pdf'] }, ev("(() => { var i = document.querySelector('main input[name=youtube_url]'); i.dispatchEvent(new Event('input', {bubbles:true})); return 'lnk'; })()"), W(500)]);
  one('C', 'S16-soalan-guru-cipta', 'subject-chapters', '/guru/soalan-guru/cipta', 'subject BM + level → chapters loaded; add-chapter panel', [{ select: ['main select[name="subject_id"]', '1'] }, W(1200), { select: ['main select[name="education_level_id"]', '11'] }, W(1200), { click: 'main button[\\@click="showAddChapter = true"]' }, W(300)]);
  one('C', 'S16-soalan-guru-cipta', 'two-questions', '/guru/soalan-guru/cipta', 'Tambah Soalan → 2 question cards', [{ click: 'main button[\\@click="addQuestion()"]' }, W(400)]);
  one('C', 'S16-soalan-guru-cipta', 'two-questions', '/guru/soalan-guru/cipta', 'Tambah Soalan → 2 cards', [{ click: 'main button[\\@click="addQuestion()"]' }, W(400)], null, 375);

  // ---------------- D: structured questions ----------------
  three('D', 'S17-soalan-berstruktur', '/guru/soalan-berstruktur', 'structured list page 1', [], R_TBL);
  one('D', 'S17-soalan-berstruktur', 'filter-draf', '/guru/soalan-berstruktur?subject_id=&education_level_id=&status=draft', 'filter Status=Draf (GET)', [], R_TBL);
  one('D', 'S17-soalan-berstruktur', 'page-2', '/guru/soalan-berstruktur?page=2', 'pager page 2', [], R_TBL);
  three('D', 'S18-berstruktur-cipta', '/guru/soalan-berstruktur/cipta', 'create structured question');
  one('D', 'S18-berstruktur-cipta', 'subject-level', '/guru/soalan-berstruktur/cipta', 'Subjek Sains + Tingkatan 5 → Bab + DSKP Bidang loaded', [{ select: ['main select[name="subject_id"]', '4'] }, W(1200), { select: ['main select[name="education_level_id"]', '11'] }, W(1500)]);
  one('D', 'S18-berstruktur-cipta', 'inline-add', '/guru/soalan-berstruktur/cipta', 'all inline "add" panels open (chapter/topic/bidang/SK/SP)', [ev("(() => { var d = Alpine.$data(document.querySelector('main [x-data=\"structuredForm()\"]')); d.showAddChapter = d.showAddTopic = d.showAddBidang = d.showAddSk = d.showAddSp = true; return 'open'; })()"), W(300)]);
  one('D', 'S18-berstruktur-cipta', 'visibility-class', '/guru/soalan-berstruktur/cipta', 'visibility = class → classroom select', [ev("(() => { Alpine.$data(document.querySelector('main [x-data=\"structuredForm()\"]')).visibility = 'class'; return 'class'; })()"), W(300)]);
  one('D', 'S18-berstruktur-cipta', 'visibility-tingkatan', '/guru/soalan-berstruktur/cipta', 'visibility = tingkatan → level filter', [ev("(() => { Alpine.$data(document.querySelector('main [x-data=\"structuredForm()\"]')).visibility = 'tingkatan'; return 'tingkatan'; })()"), W(300)]);
  one('D', 'S18-berstruktur-cipta', 'symbols', '/guru/soalan-berstruktur/cipta', 'Simbol & Aksara Khas open', [{ click: 'main button[\\@click="showSymbols = !showSymbols"]' }, W(300)]);
  one('D', 'S18-berstruktur-cipta', 'template-eksperimen', '/guru/soalan-berstruktur/cipta', 'template Eksperimen applied', [{ select: ['main select[name="question_template"]', 'eksperimen'] }, W(500)]);
  one('D', 'S18-berstruktur-cipta', 'two-subs-numeric', '/guru/soalan-berstruktur/cipta', 'Tambah sub → 2 subs; sub 1 answer_type numeric; Tambah rubric', [{ click: 'main button[x-on\\:click="addSub()"]' }, W(300), { select: ['main select[name="subs[0][answer_type]"]', 'numeric'] }, W(300), { click: 'main button[x-on\\:click="addRubric(sIdx)"]' }, W(300)]);
  one('D', 'S18-berstruktur-cipta', 'script-jawi', '/guru/soalan-berstruktur/cipta', 'script type Jawi → RTL', [{ select: ['main select[name="script_type"]', 'jawi'] }, W(300)]);
  one('D', 'S18-berstruktur-cipta', 'symbols', '/guru/soalan-berstruktur/cipta', 'symbols open', [{ click: 'main button[\\@click="showSymbols = !showSymbols"]' }, W(300)], null, 375);
  three('D', 'S19-berstruktur-show', '/guru/soalan-berstruktur/4454', 'structured question preview');
  three('D', 'S20-berstruktur-edit', '/guru/soalan-berstruktur/4454/edit', 'edit structured question (preloaded)', [W(1500), ev("(() => { var f = document.querySelector('main form'); return Array.from(f.querySelectorAll('select')).map(function (s) { return s.name + '=' + (s.value || '∅'); }).join(' '); })()")]);
  one('D', 'S20-berstruktur-edit', 'symbols', '/guru/soalan-berstruktur/4454/edit', 'symbols open', [{ click: 'main button[\\@click="showSymbols = !showSymbols"]' }, W(300)]);

  // ---------------- E: Sumbang Soalan + audio KBAT ----------------
  three('E', 'S21-sumbang-soalan', '/guru/soalan', 'Sumbang Soalan hub + my questions', [], R_CARD);
  one('E', 'S21-sumbang-soalan', 'import-open', '/guru/soalan', 'Import CSV panel open', [{ click: 'main button[\\@click="showImport = !showImport"]' }, W(300)], R_CARD);
  one('E', 'S21-sumbang-soalan', 'card-open', '/guru/soalan', 'first question card expanded', [{ click: 'main [x-data="{ open: false }"] div[\\@click="open = !open"]' }, W(300)], R_CARD);
  one('E', 'S21-sumbang-soalan', 'page-2', '/guru/soalan?page=2', 'pager page 2', [], R_CARD);
  three('E', 'S22-soalan-cipta', '/guru/soalan/cipta', 'add question (MCQ default)');
  ['true_false', 'short_answer', 'fill_blank', 'essay'].forEach(function (qt) {
    one('E', 'S22-soalan-cipta', 'type-' + qt.replace('_', '-'), '/guru/soalan/cipta', 'question_type = ' + qt, [{ select: ['main select[name="question_type"]', qt] }, W(300)]);
  });
  one('E', 'S22-soalan-cipta', 'script-arab', '/guru/soalan/cipta', 'script Arab → virtual keyboard', [{ select: ['main select[name="script_type"]', 'arab'] }, W(300), { click: 'main textarea[name="question_text"]' }, W(500)]);
  one('E', 'S22-soalan-cipta', 'galeri', '/guru/soalan/cipta', 'Galeri Rajah modal (GET galeri-rajah)', [{ click: 'main button[\\@click="openGaleri()"]' }, W(1800)]);
  one('E', 'S22-soalan-cipta', 'level-subject', '/guru/soalan/cipta', 'Tahap Tingkatan 5 + Subjek Sains → Bab, DSKP Bidang', [{ select: ['main select[name="education_level_id"]', '11'] }, W(900), { select: ['main select[name="subject_id"]', '4'] }, W(1500)]);
  one('E', 'S22-soalan-cipta', 'inline-add', '/guru/soalan/cipta', 'inline add panels open', [ev("(() => { var el = Array.from(document.querySelectorAll('main [x-data]')).find(function (e) { return /questionType/.test(e.getAttribute('x-data')); }); var d = Alpine.$data(el); d.showAddChapter = d.showAddTopic = d.showAddBidang = d.showAddSk = d.showAddSp = true; return 'open'; })()"), W(300)]);
  one('E', 'S22-soalan-cipta', 'script-arab', '/guru/soalan/cipta', 'Arab keyboard', [{ select: ['main select[name="script_type"]', 'arab'] }, W(300), { click: 'main textarea[name="question_text"]' }, W(500)], null, 375);
  three('E', 'S23-soalan-show', '/guru/soalan/522425', 'contributed question detail');
  three('E', 'S24-soalan-edit', '/guru/soalan/522425/edit', 'edit contributed question (preloaded)', [ev("(() => { var s = document.querySelector('main select[name=difficulty_level]'); return 'difficulty=' + (s && s.value); })()")]);
  three('E', 'S25-audio-kbat', '/guru/audio-kbat', 'Audio KBAT sets (empty)');
  three('E', 'S26-audio-kbat-create', '/guru/audio-kbat/create', 'create Audio KBAT set (30 questions)', [], R_AUD);

  // ---------------- F: databank, articles, profile, student side, errors ----------------
  three('F', 'S27-databank', '/guru/databank', 'SPM databank subject grid');
  three('F', 'S28-databank-subjek', '/guru/databank/BM', 'databank subject BM', [], R_DB);
  one('F', 'S28-databank-subjek', 'penerangan', '/guru/databank/BM', 'first Penerangan expanded', [{ click: 'main button[\\@click="open = !open"]' }, W(300)], R_DB);
  one('F', 'S28-databank-subjek', 'report-modal', '/guru/databank/BM', 'Lapor Masalah modal (not sent)', [{ click: 'main button[\\@click^="openReport("]' }, W(400)], R_DB);
  one('F', 'S28-databank-subjek', 'bidang', '/guru/databank/BM', 'Bidang chosen → SK loaded', [{ select: ['main select[name="dskp_bidang_id"]', { index: 1 }] }, W(1500)], R_DB);
  one('F', 'S28-databank-subjek', 'filtered', '/guru/databank/BM?q=&question_type=mcq&source_type=&difficulty=3', 'GET filter mcq + difficulty 3', [], R_DB);
  one('F', 'S28-databank-subjek', 'report-modal', '/guru/databank/BM', 'report modal', [{ click: 'main button[\\@click^="openReport("]' }, W(400)], R_DB, 375);
  three('F', 'S29-sumbang-artikel', '/guru/artikel', 'Sumbang Artikel list', [], R_ART);
  one('F', 'S29-sumbang-artikel', 'page-2', '/guru/artikel?page=2', 'pager page 2', [], R_ART);
  three('F', 'S30-artikel-cipta', '/guru/artikel/cipta', 'write article');
  three('F', 'S31-artikel-edit', '/guru/artikel/10/edit', 'edit article (preloaded)', [ev("(() => Array.from(document.querySelectorAll('main select')).map(function (s) { return s.name + '=' + s.value; }).join(' '))()")]);
  three('F', 'S32-profil-guru', '/guru/profil/edit', 'teacher profile edit');
  one('F', 'S32-profil-guru', 'school-search', '/guru/profil/edit', 'school picker search results', [ev("(() => { var b = document.querySelector('main button[\\\\@click*=\"selectedId = null\"], main button[\\\\@click^=\"clear\"]'); if (b) b.click(); return b ? 'cleared' : 'no-clear'; })()"), W(300), { type: ['main input[\\@input\\.debounce\\.300ms="search()"]', 'kebangsaan'] }, W(1800)]);
  three('F', 'S33-kelas-saya', '/kelas-saya', 'student: join class by code (not joined)');
  three('F', 'S34-set-soalan-saya', '/set-soalan-saya', 'student: teacher sets (empty)');
  one('F', 'S35-errors', 'settings-404', '/settings', '/settings → 404');
  one('F', 'S35-errors', 'settings-404', '/settings', '/settings → 404', [], null, 375);
  one('F', 'S35-errors', 'profil-awam-404', '/guru/3', 'teacher public profile link /guru/{id} → 404');
  one('F', 'S35-errors', 'set-405', '/guru/set-soalan/1', 'GET /guru/set-soalan/{id} → 405 Symfony page');

  window.__M10_JOBS = jobs;
  window.__M10_RERUN = jobs.filter(function (j) { return /^S(26|28|29)-/.test(j.file); });
  window.__M10_HELPERS = { MASK: M10MASK, SAN: SAN };
})();
