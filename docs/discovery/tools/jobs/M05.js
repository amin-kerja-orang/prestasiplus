// M05 capture plan — Practice & Drills (Latih Tubi) + user-portal home /dashboard.
// Load:  browser_run_code_unsafe: async (page) => page.addScriptTag({ path: '<abs>/docs/discovery/tools/jobs/M05.js' })
// then:  browser_evaluate: () => { window.__jobs = window.__M05_JOBS.filter(j => j.group === 'A'); }
// then run tools/run-state.js, save window.__invs to docs/discovery/inventory/_raw/M05/_batch-<G>.json, split-batch.js,
// and finally merge-inventory.js M05 tools/jobs/M05.screens.json.
//
// SAFETY (live production, admin account, user has NOT approved creating practice data):
//  * A context-level Playwright route guard (installed before any job; see M05-guard.js) aborts every non-GET request,
//    so no Alpine fetch()/form can reach the server even by accident.
//  * NO job opens a URL that starts a session: /practice/{CODE}/quiz, /practice/chapter/{CODE}/{n}/quiz,
//    /practice/{CODE}/subjektif, /latihan-berstruktur/{id}/jawab, and /practice/revision/{CODE} (its x-init POSTs
//    /practice/start-revision-quiz on load). Those screens are documented from static HTML only (fetched, not rendered).
//  * Actions are client-side reveals only (Alpine selectors on /practice/{CODE}, carousel arrows, "Baca Selanjutnya").
//    "Mula Kuiz", "Mula", "Simpan", chapter "n soalan" buttons and the /target-spm selects are never clicked/changed.
//  * Filters that are plain GET forms are captured by URL (?level=, ?subject_id=, ?kbat_level=, ?period=, ?bulan=).
// Privacy: the only account shown is the system account "Admin PRESTASI+". /latihan-berstruktur cards show a teacher
// name inside the question preview ("Soalan Oleh: …") and an author/school line → masked (MASK_SB).
(function () {
  var B = 'https://prestasiplus.my';
  var jobs = [];
  var SCRUB = { eval: "(() => { let n=0; document.querySelectorAll('*').forEach(el => { for (const a of Array.from(el.attributes)) { if (/X-CSRF-TOKEN|csrf/i.test(a.value) || a.name==='content' && el.getAttribute('name')==='csrf-token' || a.name==='value' && el.getAttribute('name')==='_token') { const v=a.value.replace(/[A-Za-z0-9]{40}/g,'CSRF'); if (v!==a.value) { el.setAttribute(a.name, v); n++; } } } }); return 'csrf scrubbed: '+n; })()" };
  function J(group, file, url, state, actions, extra, opts) {
    var s = file.split('-')[0];
    var j = { group: group, file: file, url: B + url, actions: (actions || []).concat([SCRUB]), settle: 900,
              opts: Object.assign({ state: state, prefix: 'EL-M05-' + s }, opts || {}) };
    Object.assign(j, extra || {});
    j.opts.state = state + (j.width === 375 ? ' @375' : j.width === 768 ? ' @768' : '');
    jobs.push(j);
  }
  var M = { width: 375 }, T = { width: 768 };
  var W = function (ms) { return { wait: ms || 500 }; };
  var C = function (sel) { return { click: sel }; };

  // ---------------- S1 /dashboard ----------------
  var DASH = { repeat: { 'main .subject-card': 4, 'main .subject-stat-card': 3, 'main .question-item': 2 } };
  var CAR = 'main [x-data="bannerCarousel(5)"]';
  J('A', 'S1-dashboard__default__1280', '/dashboard', 'default (slide 1/5, counters settled)', [W(1500)], null, DASH);
  J('A', 'S1-dashboard__slide2-expanded__1280', '/dashboard', 'carousel next → slide 2/5 + "Baca Selanjutnya" expanded', [C(CAR + ' button[\\@click="next()"]'), W(700), { eval: "(() => { const b=[...document.querySelectorAll('main [x-data=\"bannerCarousel(5)\"] button')].filter(x=>x.offsetParent && /Baca Selanjutnya/.test(x.textContent))[0]; if(b){b.click(); return 'expanded';} return 'no btn'; })()" }, W(400)], null, DASH);
  J('A', 'S1-dashboard__slide5__1280', '/dashboard', 'carousel dot 5 → slide 5/5', [C(CAR + ' button[\\@click="goTo(4)"]'), W(700)], null, DASH);
  J('A', 'S1-dashboard__default__375', '/dashboard', 'default', [W(1500)], M, DASH);
  J('A', 'S1-dashboard__default__768', '/dashboard', 'default', [W(1500)], T, DASH);

  // ---------------- S2 /practice ----------------
  var PR = { repeat: { 'main a[href^="/practice/"].block.group': 3 } };
  J('B', 'S2-practice__default__1280', '/practice', 'subject list (31 cards) + chapter-mode banner', [], null, PR);
  J('B', 'S2-practice__subject-param__1280', '/practice?subject=MATH', '?subject=MATH from dashboard card (parameter ignored → same page)', [], null, PR);
  J('B', 'S2-practice__level-param__1280', '/practice?level=T4', '?level=T4 from dashboard level pill (parameter ignored)', [], null, PR);
  J('B', 'S2-practice__topic-param__1280', '/practice?topic_id=7', '?topic_id=7 from Peta Belajar island (parameter ignored)', [], null, PR);
  J('B', 'S2-practice__default__375', '/practice', 'subject list', [], M, PR);
  J('B', 'S2-practice__default__768', '/practice', 'subject list', [], T, PR);

  // ---------------- S3 /practice/{CODE} (pre-start configuration) ----------------
  var SB = function (v) { return C('main button[\\@click="selectedLevel = ' + v + '"]'); };
  var SD = function (v) { return C('main button[\\@click="selectedDifficulty = ' + v + '"]'); };
  var SC = function (v) { return C('main button[\\@click="questionCount = ' + v + '"]'); };
  J('C', 'S3-subject-config__math-default__1280', '/practice/MATH', 'Matematik default (Semua Tahap / Semua / 10 soalan → ready)');
  J('C', 'S3-subject-config__math-d2-diff3-20__1280', '/practice/MATH', 'Darjah 2 + Sederhana (L3) + 20 soalan selected (quizUrl level=2&difficulty=3&count=20)', [SB(2), SD(3), SC(20), W()]);
  J('C', 'S3-subject-config__math-diff5-insufficient__1280', '/practice/MATH', 'Sangat Sukar (L5, 0 questions) → "Soalan Tidak Mencukupi", start disabled', [SD(5), W()]);
  J('C', 'S3-subject-config__math-d3-count5__1280', '/practice/MATH', 'Darjah 3 + 5 soalan', [SB(3), SC(5), W()]);
  J('C', 'S3-subject-config__bm-default__1280', '/practice/BM', 'Bahasa Melayu default');
  J('C', 'S3-subject-config__addmath-empty__1280', '/practice/ADDMATH', 'Matematik Tambahan: no levels, 0 questions (insufficient by default)');
  J('C', 'S3-subject-config__sk-d4-only__1280', '/practice/SK', 'Sains Komputer: single level D4 with 0 questions');
  J('C', 'S3-subject-config__math-default__375', '/practice/MATH', 'Matematik default', [], M);
  J('C', 'S3-subject-config__math-default__768', '/practice/MATH', 'Matematik default', [], T);

  // ---------------- S4 /practice/chapter ----------------
  J('D', 'S4-chapter-index__default__1280', '/practice/chapter', '10 subject cards (chapter mode)');
  J('D', 'S4-chapter-index__default__375', '/practice/chapter', 'default', [], M);
  J('D', 'S4-chapter-index__default__768', '/practice/chapter', 'default', [], T);

  // ---------------- S5 /practice/chapter/{CODE} ----------------
  var CH = { repeat: { 'main .space-y-4 > .rounded-3xl': 3 } };
  J('D', 'S5-chapter-subject__math-d1__1280', '/practice/chapter/MATH', 'Matematik Darjah 1 (Bab 1 open, Bab 2–8 locked)', [], null, CH);
  J('D', 'S5-chapter-subject__math-d2__1280', '/practice/chapter/MATH?level=2', '?level=2 (level select GET form)', [], null, CH);
  J('D', 'S5-chapter-subject__bm-progress__1280', '/practice/chapter/BM', 'Bahasa Melayu D1 — chapters with progress (18/320 · 44.4%, locked chapters with progress)', [], null, CH);
  J('D', 'S5-chapter-subject__addmath-empty__1280', '/practice/chapter/ADDMATH', 'no chapters: "Tiada bab tersedia untuk tahap ini." + empty level select', [], null, CH);
  J('D', 'S5-chapter-subject__math-d1__375', '/practice/chapter/MATH', 'default', [], M, CH);
  J('D', 'S5-chapter-subject__math-d1__768', '/practice/chapter/MATH', 'default', [], T, CH);

  // ---------------- S6 /practice/revision (list only; /practice/revision/{CODE} is NOT rendered) ----------------
  J('E', 'S6-revision__default__1280', '/practice/revision', '72 wrong questions: BM 46, SEJ 26');
  J('E', 'S6-revision__flash-none__1280', '/practice/revision/MATH', 'redirect from a subject with no wrong answers → flash "Tiada soalan salah untuk subjek ini. Tahniah!"');
  J('E', 'S6-revision__default__375', '/practice/revision', 'default', [], M);
  J('E', 'S6-revision__default__768', '/practice/revision', 'default', [], T);

  // ---------------- S8 /practice/progress ----------------
  J('E', 'S8-progress__default-30__1280', '/practice/progress', 'default period=30 (no data in window → "Belum Ada Data")');
  J('E', 'S8-progress__all__1280', '/practice/progress?period=all', 'period=all (stats, Chart.js trend, weak topics, per-subject cards)', [W(800)]);
  J('E', 'S8-progress__7__1280', '/practice/progress?period=7', 'period=7 (empty)');
  J('E', 'S8-progress__90__1280', '/practice/progress?period=90', 'period=90 (empty)');
  J('E', 'S8-progress__all__375', '/practice/progress?period=all', 'period=all', [W(800)], M);
  J('E', 'S8-progress__all__768', '/practice/progress?period=all', 'period=all', [W(800)], T);

  // ---------------- S9 /practice/history ----------------
  var HI = { repeat: { 'main .session-card': 2 } };
  J('F', 'S9-history__all__1280', '/practice/history', 'Semua (4 sessions)', [], null, HI);
  J('F', 'S9-history__week-empty__1280', '/practice/history?period=week', 'Minggu Ini → "Belum Ada Rekod Latihan"', [], null, HI);
  J('F', 'S9-history__month-empty__1280', '/practice/history?period=month', 'Bulan Ini (empty)', [], null, HI);
  J('F', 'S9-history__year__1280', '/practice/history?period=year', 'Tahun Ini (4 sessions)', [], null, HI);
  J('F', 'S9-history__all__375', '/practice/history', 'Semua', [], M, HI);
  J('F', 'S9-history__all__768', '/practice/history', 'Semua', [], T, HI);

  // ---------------- S10 /latihan-berstruktur ----------------
  var MASK_SB = ['main .card p.line-clamp-3', 'main .card p:has(> i.fa-user-pen)'];
  var SBO = { repeat: { 'main .grid > .card': 3 }, mask: MASK_SB };
  J('F', 'S10-berstruktur__default__1280', '/latihan-berstruktur', 'all subjects, page 1 of 204 (4061 items)', [], null, SBO);
  J('F', 'S10-berstruktur__math__1280', '/latihan-berstruktur?subject_id=3', 'subject_id=3 (Matematik)', [], null, SBO);
  J('F', 'S10-berstruktur__empty__1280', '/latihan-berstruktur?subject_id=31', 'Sains Sukan → empty state', [], null, SBO);
  J('F', 'S10-berstruktur__page2__1280', '/latihan-berstruktur?page=2', 'page 2 (Previous enabled)', [], null, SBO);
  J('F', 'S10-berstruktur__default__375', '/latihan-berstruktur', 'default', [], M, SBO);
  J('F', 'S10-berstruktur__default__768', '/latihan-berstruktur', 'default', [], T, SBO);

  // ---------------- S11 /pembetulan ----------------
  J('G', 'S11-pembetulan__current-empty__1280', '/pembetulan', 'September 2026 (current month; next arrow disabled) → "Tiada Data Pembetulan"');
  J('G', 'S11-pembetulan__may-data__1280', '/pembetulan?bulan=2026-05', 'Mei 2026 (summary + per-subject before/after)');
  J('G', 'S11-pembetulan__future__1280', '/pembetulan?bulan=2026-10', 'future month via URL');
  J('G', 'S11-pembetulan__may-data__375', '/pembetulan?bulan=2026-05', 'Mei 2026', [], M);
  J('G', 'S11-pembetulan__may-data__768', '/pembetulan?bulan=2026-05', 'Mei 2026', [], T);

  // ---------------- S12 /penguasaan ----------------
  J('G', 'S12-penguasaan__default__1280', '/penguasaan', 'scale L0–L10 + 2 subject cards (BM L2, SEJ L1)');
  J('G', 'S12-penguasaan__default__375', '/penguasaan', 'default', [], M);
  J('G', 'S12-penguasaan__default__768', '/penguasaan', 'default', [], T);

  // ---------------- S13 /remedial/saya ----------------
  J('H', 'S13-remedial__empty__1280', '/remedial/saya', 'no remedial tests (empty state)');
  J('H', 'S13-remedial__empty__375', '/remedial/saya', 'empty', [], M);
  J('H', 'S13-remedial__empty__768', '/remedial/saya', 'empty', [], T);

  // ---------------- S14 /misi-harian ----------------
  J('H', 'S14-misi-harian__empty__1280', '/misi-harian', 'no missions today (empty state)');
  J('H', 'S14-misi-harian__empty__375', '/misi-harian', 'empty', [], M);
  J('H', 'S14-misi-harian__empty__768', '/misi-harian', 'empty', [], T);

  // ---------------- S15 /target-spm ----------------
  var TS = { repeat: { 'main form .space-y-3 > div': 4 } };
  J('H', 'S15-target-spm__default__1280', '/target-spm', '20 SPM subjects, no targets set (all "Belum mula")', [], null, TS);
  J('H', 'S15-target-spm__default__375', '/target-spm', 'default', [], M, TS);
  J('H', 'S15-target-spm__default__768', '/target-spm', 'default', [], T, TS);

  window.__M05_JOBS = jobs;
})();
