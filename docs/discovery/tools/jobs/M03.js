// M03 capture plan — Curriculum (Subjects, Education Levels, Chapters/Topics/Subtopics, student Topik + Peta Belajar).
// Load:  browser_run_code_unsafe: async (page) => page.addScriptTag({ path: '<abs>/docs/discovery/tools/jobs/M03.js' })
// then:  browser_evaluate: () => { window.__jobs = window.__M03_JOBS.filter(j => j.group === 'A'); }
// then run tools/run-state.js, save window.__invs to docs/discovery/inventory/_raw/M03/_batch-<G>.json, split-batch.js,
// and finally merge-inventory.js M03 tools/jobs/M03.screens.json.
//
// SAFETY: live production admin. All actions are client-side reveals only (Alpine toggles that open/close tree nodes
// and inline forms, typing nothing). Nothing is submitted, saved, toggled (the subject/level "Aktif?" switches fire a
// fetch() on click — they are NEVER clicked), deleted or reordered. confirm() texts are read from the DOM.
// Detail/edit pages opened: subject 3, level 10, chapter 91, topic 126 (admin) + student topic 7 and 68 (≤2 per entity).
// Error-flash states are produced by GET requests to non-existent ids / a missing query parameter (server redirects
// with a flash message; no data changes).
// Privacy: curriculum data is not personal. The only person-like string on these pages is the system account name
// "Admin PRESTASI+" (shell). CSRF tokens embedded in Alpine @click fetch() headers are replaced by CSRF (see SCRUB).
(function () {
  var B = 'https://prestasiplus.my';
  var jobs = [];
  // scrub CSRF tokens from attribute values (Alpine @click fetch headers, meta) before the inventory runs
  var SCRUB = { eval: "(() => { let n=0; document.querySelectorAll('*').forEach(el => { for (const a of Array.from(el.attributes)) { if (/X-CSRF-TOKEN|csrf/i.test(a.value) || a.name==='content' && el.getAttribute('name')==='csrf-token') { const v=a.value.replace(/[A-Za-z0-9]{40}/g,'CSRF'); if (v!==a.value) { el.setAttribute(a.name, v); n++; } } } }); return 'csrf scrubbed: '+n; })()" };
  // peta-belajar island nodes start at opacity 0 and are revealed by an IntersectionObserver on scroll → force the scrolled state
  var REVEAL = { eval: "(() => { const n=document.querySelectorAll('.island-node'); n.forEach(x=>{x.style.opacity='1';x.style.transform='translateY(0px)'}); return 'islands revealed: '+n.length; })()" };
  function J(group, file, url, state, actions, extra, opts) {
    var s = file.split('-')[0];
    var j = { group: group, file: file, url: B + url, actions: (actions || []).concat([SCRUB]), settle: 600,
              opts: Object.assign({ state: state, prefix: 'EL-M03-' + s }, opts || {}) };
    Object.assign(j, extra || {});
    j.opts.state = state + (j.width === 375 ? ' @375' : j.width === 768 ? ' @768' : '');
    jobs.push(j);
  }
  var M = { width: 375 }, T = { width: 768 };
  var W = function (ms) { return { wait: ms || 600 }; };
  // curriculum tree: keep 2 chapters, 3 topic blocks, 3 subtopic rows / edit forms (data-driven rows; totals in meta.repeats)
  var TREE = { repeat: { 'main [x-data="{ open: true }"]': 2, 'main [x-data^="{ topicOpen"]': 3, 'main [x-show^="editingSubtopic !=="]': 3, 'main [x-show^="editingSubtopic ==="]': 3 } };
  var CUR = '/admin/curriculum', MT4 = CUR + '?subject_id=3&education_level_id=10', BMD1 = CUR + '?subject_id=1&education_level_id=1';
  var TOPIC1 = { click: 'main [x-data^="{ topicOpen"] button[\\@click="topicOpen = !topicOpen"]' };
  var ADDSUB1 = { click: 'main [x-data^="{ topicOpen"] button[\\@click="showAddSubtopic = !showAddSubtopic"]' };

  // ---------------- S1 /admin/curriculum ----------------
  J('A', 'S1-curriculum__default__1280', CUR, 'no filter (prompt card)');
  J('A', 'S1-curriculum__subject-only__1280', CUR + '?subject_id=3', 'subject chosen, no level (prompt card, subject pre-selected)');
  J('A', 'S1-curriculum__math-t4__1280', MT4, 'Matematik + Tingkatan 4 (tree: chapters open, topics collapsed, no subtopics)', [], null, TREE);
  J('A', 'S1-curriculum__math-t4-topic-open__1280', MT4, 'first topic expanded ("Tiada subtopik" + add button)', [TOPIC1, W()], null, TREE);
  J('A', 'S1-curriculum__math-t4-add-subtopic__1280', MT4, 'first topic expanded + "Tambah Subtopik" inline form open (not submitted)', [TOPIC1, W(), ADDSUB1, W()], null, TREE);
  J('A', 'S1-curriculum__math-t4-chapter-collapsed__1280', MT4, 'first chapter collapsed', [{ click: 'main button[\\@click="open = !open"]' }, W()], null, TREE);
  J('A', 'S1-curriculum__bm-d1-topic-open__1280', BMD1, 'Bahasa Melayu + Darjah 1, first topic expanded (subtopic rows)', [TOPIC1, W()], null, TREE);
  J('A', 'S1-curriculum__bm-d1-edit-subtopic__1280', BMD1, 'first topic expanded + first subtopic inline edit form open (not submitted)', [TOPIC1, W(), { click: 'main button[\\@click^="editingSubtopic = "]' }, W()], null, TREE);
  J('A', 'S1-curriculum__empty-tree__1280', CUR + '?subject_id=2&education_level_id=9', 'BI + Tingkatan 3: no chapters (empty state)', [], null, TREE);
  J('A', 'S1-curriculum__level-not-offered__1280', CUR + '?subject_id=8&education_level_id=1', 'Matematik Tambahan + Darjah 1 (level not linked to subject)', [], null, TREE);
  J('A', 'S1-curriculum__flash-chapter-id__1280', CUR + '/topics/create', 'redirect from /topics/create without chapter_id → error flash', [], null, TREE);
  J('A', 'S1-curriculum__flash-bab-404__1280', CUR + '/chapters/999999/edit', 'redirect from a missing chapter → error flash', [], null, TREE);
  J('A', 'S1-curriculum__default__375', CUR, 'no filter', [], M);
  J('A', 'S1-curriculum__math-t4__375', MT4, 'Matematik + T4 tree, first topic expanded', [TOPIC1, W()], M, TREE);
  J('A', 'S1-curriculum__bm-d1-topic-open__375', BMD1, 'BM + D1, first topic expanded', [TOPIC1, W()], M, TREE);
  J('A', 'S1-curriculum__default__768', CUR, 'no filter', [], T);
  J('A', 'S1-curriculum__math-t4__768', MT4, 'Matematik + T4 tree', [], T, TREE);

  // ---------------- S2 chapter create / S3 chapter edit ----------------
  var CC = CUR + '/chapters/create?subject_id=3&education_level_id=10';
  J('B', 'S2-chapter-create__default__1280', CC, 'from "Tambah Bab" (subject + level pre-selected)');
  J('B', 'S2-chapter-create__no-params__1280', CUR + '/chapters/create', 'opened without query (nothing pre-selected; back link to /admin/curriculum)');
  J('B', 'S2-chapter-create__default__375', CC, 'default', [], M);
  J('B', 'S2-chapter-create__default__768', CC, 'default', [], T);
  var CE = CUR + '/chapters/91/edit';
  J('B', 'S3-chapter-edit__default__1280', CE, 'chapter 91 (Matematik T4, Bab 1)');
  J('B', 'S3-chapter-edit__default__375', CE, 'default', [], M);
  J('B', 'S3-chapter-edit__default__768', CE, 'default', [], T);

  // ---------------- S4 topic create / S5 topic edit ----------------
  var TC = CUR + '/topics/create?chapter_id=91', TE = CUR + '/topics/126/edit';
  J('C', 'S4-topic-create__default__1280', TC, 'from "Tambah Topik" of chapter 91');
  J('C', 'S4-topic-create__default__375', TC, 'default', [], M);
  J('C', 'S4-topic-create__default__768', TC, 'default', [], T);
  J('C', 'S5-topic-edit__default__1280', TE, 'topic 126 (Topik 1: Fungsi)');
  J('C', 'S5-topic-edit__default__375', TE, 'default', [], M);
  J('C', 'S5-topic-edit__default__768', TE, 'default', [], T);

  // ---------------- S6 subjects list / S7 create / S8 edit ----------------
  var SUB = { repeat: { 'main tbody tr': 8 } };   // rows 1–7 Teras, row 8 first Elektif; full list in the narrative appendix
  J('D', 'S6-subjects__default__1280', '/admin/subjects', 'list (31 subjects)', [], null, SUB);
  J('D', 'S6-subjects__flash-404__1280', '/admin/subjects/999/edit', 'redirect from a missing subject → error flash', [], null, SUB);
  J('D', 'S6-subjects__default__375', '/admin/subjects', 'list', [], M, SUB);
  J('D', 'S6-subjects__default__768', '/admin/subjects', 'list', [], T, SUB);
  J('D', 'S7-subject-create__default__1280', '/admin/subjects/create', 'empty form');
  J('D', 'S7-subject-create__default__375', '/admin/subjects/create', 'empty form', [], M);
  J('D', 'S7-subject-create__default__768', '/admin/subjects/create', 'empty form', [], T);
  J('D', 'S8-subject-edit__default__1280', '/admin/subjects/3/edit', 'subject 3 Matematik');
  J('D', 'S8-subject-edit__default__375', '/admin/subjects/3/edit', 'subject 3', [], M);
  J('D', 'S8-subject-edit__default__768', '/admin/subjects/3/edit', 'subject 3', [], T);

  // ---------------- S9 levels list / S10 create / S11 edit ----------------
  J('E', 'S9-levels__default__1280', '/admin/education-levels', 'list (11 levels, all rows kept)');
  J('E', 'S9-levels__flash-404__1280', '/admin/education-levels/999/edit', 'redirect from a missing level → error flash');
  J('E', 'S9-levels__default__375', '/admin/education-levels', 'list', [], M);
  J('E', 'S9-levels__default__768', '/admin/education-levels', 'list', [], T);
  J('E', 'S10-level-create__default__1280', '/admin/education-levels/create', 'empty form');
  J('E', 'S10-level-create__default__375', '/admin/education-levels/create', 'empty form', [], M);
  J('E', 'S10-level-create__default__768', '/admin/education-levels/create', 'empty form', [], T);
  J('E', 'S11-level-edit__default__1280', '/admin/education-levels/10/edit', 'level 10 Tingkatan 4');
  J('E', 'S11-level-edit__default__375', '/admin/education-levels/10/edit', 'level 10', [], M);
  J('E', 'S11-level-edit__default__768', '/admin/education-levels/10/edit', 'level 10', [], T);

  // ---------------- S12 /topics (student) ----------------
  var TOP = { repeat: { 'main a[href*="/topics/"]': 6 } };
  J('F', 'S12-topics__default__1280', '/topics', 'all (125 topic cards)', [], null, TOP);
  J('F', 'S12-topics__grade-d1__1280', '/topics?grade_level=DARJAH_1', 'grade_level=DARJAH_1 (grade chip active)', [], null, TOP);
  J('F', 'S12-topics__subject-sains__1280', '/topics?subject=SAINS', 'subject=SAINS (subject chip active)', [], null, TOP);
  J('F', 'S12-topics__d1-sains__1280', '/topics?grade_level=DARJAH_1&subject=SAINS', 'grade D1 + SAINS (both chips active; each chip link keeps the other filter)', [], null, TOP);
  J('F', 'S12-topics__grade-t4-hidden__1280', '/topics?grade_level=TINGKATAN_4', 'grade_level=TINGKATAN_4 (no chip exists; URL-only)', [], null, TOP);
  J('F', 'S12-topics__subject-geografi-hidden__1280', '/topics?subject=GEOGRAFI', 'subject=GEOGRAFI (no chip exists; URL-only)', [], null, TOP);
  J('F', 'S12-topics__empty__1280', '/topics?grade_level=TINGKATAN_2', 'no topics (empty state)', [], null, TOP);
  J('F', 'S12-topics__default__375', '/topics', 'all', [], M, TOP);
  J('F', 'S12-topics__default__768', '/topics', 'all', [], T, TOP);
  // ---------------- S13 /topics/{id} ----------------
  J('F', 'S13-topic-show__default__1280', '/topics/7', 'topic 7 (MATEMATIK Darjah 1, 4 subtopics)');
  J('F', 'S13-topic-show__bm-t5__1280', '/topics/68', 'topic 68 (BAHASA MELAYU Tingkatan 5, 1 subtopic)');
  J('F', 'S13-topic-show__default__375', '/topics/7', 'topic 7', [], M);
  J('F', 'S13-topic-show__default__768', '/topics/7', 'topic 7', [], T);

  // ---------------- S14 /peta-belajar ----------------
  var P = '/peta-belajar';
  J('G', 'S14-peta-belajar__default__1280', P, 'default (Matematik, Darjah 4)', [REVEAL]);
  J('G', 'S14-peta-belajar__math-d1__1280', P + '?subject=MATEMATIK&grade=DARJAH_1', 'Matematik Darjah 1 (5 islands: 2 open, 3 locked)', [REVEAL]);
  J('G', 'S14-peta-belajar__bm-d2__1280', P + '?subject=BAHASA_MELAYU&grade=DARJAH_2', 'Bahasa Melayu Darjah 2 (2 islands, all open)', [REVEAL]);
  J('G', 'S14-peta-belajar__geografi-empty__1280', P + '?subject=GEOGRAFI&grade=DARJAH_1', 'Geografi (empty state)', [REVEAL]);
  J('G', 'S14-peta-belajar__unknown-subject__1280', P + '?subject=ZZZ&grade=DARJAH_1', 'unknown subject (no active pill, empty)', [REVEAL]);
  J('G', 'S14-peta-belajar__grade-d6-clamped__1280', P + '?subject=MATEMATIK&grade=DARJAH_6', 'grade=DARJAH_6 → served as Darjah 4', [REVEAL]);
  J('G', 'S14-peta-belajar__default__375', P, 'default', [REVEAL], M);
  J('G', 'S14-peta-belajar__default__768', P, 'default', [REVEAL], T);

  window.__M03_JOBS = jobs;
  window.__jobs = jobs;
})();
