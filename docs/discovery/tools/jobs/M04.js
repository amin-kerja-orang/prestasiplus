// M04 capture plan — Question Bank. Every screen x every UI state that reveals different elements.
// Load:  browser_run_code_unsafe: async (page) => page.addScriptTag({ path: '<abs>/docs/discovery/tools/jobs/M04.js' })
// then:  browser_evaluate: () => { window.__jobs = window.__M04_JOBS.filter(j => j.group === 'A'); }
// then run tools/run-state.js, save window.__invs to docs/discovery/inventory/_raw/M04/_batch.json, split-batch.js, merge-inventory.js.
//
// SAFETY: live production admin. All actions are client-side reveals only (filters are GET links; selects that only
// load DSKP lists via GET JSON; opening the virtual keyboard; expanding the per-row "Kemaskini" panel). Nothing is
// submitted, saved, approved, dismissed, uploaded, deleted, exported or downloaded. confirm() texts are read from the source.
// No file is ever chosen (image previews are recorded as <template> markup only).
// Personal data: M04MASK (below) runs first as an eval action and masks submitter / creator / reporter names
// ("Oleh: …", "Dicipta oleh: …", "oleh …", "Soalan Oleh: Cikgu …"), the teacher column of /admin/question-submissions
// and Cloudflare-obfuscated e-mails (data-cfemail); then tools/sanitize.js runs (job.sanitize).
// Detail pages opened: questions 564159 + 129114 (show + edit), structured questions 3698 + 4454.
(function () {
  var B = 'https://prestasiplus.my';
  var jobs = [];
  var M04MASK = "(() => { var n = 0; var W = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), t, L = []; while ((t = W.nextNode())) L.push(t);" +
    " L.forEach(function (t) { if (t.parentNode && /^(SCRIPT|STYLE)$/.test(t.parentNode.tagName)) return; var v = t.nodeValue, o = v;" +
    "  if (/^\\s*oleh\\s+\\S/.test(v) && v.trim().length < 80) v = v.replace(/oleh\\s+.+/, 'oleh <person>');" +
    "  v = v.replace(/(Soalan Oleh:|Dicipta oleh:|Oleh:)[ \\t]*([^\\n<]+)/g, function (m, a, b) { return b.trim() ? a + ' <person>' : m; });" +
    // A person's name embedded in a dataset code was redacted here during the original run; the literal is kept out of the repo.
    // To re-run, add it locally via REDACT_NAMES below (do not commit it).
    "  (window.__REDACT_NAMES || []).forEach(function (w) { v = v.split(w).join('<redacted>'); });" +
    "  if (v !== o) { t.nodeValue = v; n++; } });" +
    " document.querySelectorAll('span, p, div').forEach(function (s) { var f = s.firstChild; if (f && f.nodeType === 3 && /^\\s*Oleh:\\s*$/.test(f.nodeValue)) { var st = s.querySelector('strong'); if (st) { st.textContent = '<person>'; n++; } } });" +
    " document.querySelectorAll('[data-cfemail]').forEach(function (a) { a.removeAttribute('data-cfemail'); a.setAttribute('href', '#'); a.textContent = '<email>'; n++; });" +
    " document.querySelectorAll('main table').forEach(function (tb) { var h = tb.querySelector('thead th'); if (h && /Guru \\/ Sekolah/.test(h.textContent)) tb.querySelectorAll('tbody tr > td:first-child').forEach(function (td) { td.querySelectorAll('p').forEach(function (p, i) { var ic = p.querySelector('i'); p.textContent = i === 0 ? '<person>' : i === 1 ? '<email>' : '<school>'; if (ic && i === 2) p.prepend(ic); n++; }); }); });" +
    " document.querySelectorAll('main textarea[name=admin_notes]').forEach(function (x) { if (x.value) { x.value = '<note>'; x.textContent = '<note>'; n++; } });" +
    " return 'm04mask: ' + n; })()";
  // /admin/soalan-gambar: the school filter lists every school (10,221 options) → trimmed to 25 for the inventory
  // (total kept in data-total-options); question cards get data-card so opts.repeat keeps 3 of each list.
  var GAMBAR_PREP = "(() => { var s = document.querySelector('main select[name=school_id]'); var n = s ? s.options.length : 0; if (s) { s.setAttribute('data-total-options', n); Array.from(s.options).slice(25).forEach(function (o) { o.remove(); }); }" +
    " document.querySelectorAll('main form[action$=\"/dismiss\"]').forEach(function (f) { var c = f; while (c.parentElement && c.parentElement.children.length < 3 && c.parentElement.tagName !== 'MAIN') c = c.parentElement; c.setAttribute('data-card', ''); }); return 'gambar-prep: schools=' + n + ' cards=' + document.querySelectorAll('[data-card]').length; })()";
  // /admin/master-notes rows
  var NOTES_PREP = "(() => { document.querySelectorAll('main .row[data-id]').forEach(function (r) { r.setAttribute('data-card', ''); }); return 'notes rows=' + document.querySelectorAll('main .row[data-id]').length; })()";
  // Report-a-question modal: hosted on M05 practice pages. The modal markup was fetched once (GET) into localStorage by the
  // MCP tab (keys m04_modal_structured / m04_modal_mcq / m04_trig_*); here it is injected as static markup
  // (x-show/x-cloak removed so every branch is inventoried) into /laporan-soalan. Nothing is sent.
  function MODAL(kind) {
    return "(() => { var h = localStorage.getItem('m04_modal_" + kind + "'); var tr = localStorage.getItem('m04_trig_" + kind + "') || ''; if (!h) return 'NO MODAL IN STORAGE';" +
      " var m = document.querySelector('main'); m.innerHTML = '<div data-host=\"" + kind + "\"><h2>Host trigger (" + kind + ")</h2>' + tr + '</div>' + h;" +
      " m.querySelectorAll('[x-show],[x-cloak]').forEach(function (e) { e.removeAttribute('x-cloak'); e.setAttribute('data-x-show', e.getAttribute('x-show') || ''); e.removeAttribute('x-show'); e.style.display = ''; });" +
      " m.querySelectorAll('[x-transition\\\\:enter],[x-transition\\\\:leave]').forEach(function(){}); return 'modal injected ' + h.length; })()";
  }
  function J(group, file, url, state, actions, extra, opts) {
    var s = file.split('-')[0];
    var j = { group: group, file: file, url: B + url, actions: [{ eval: M04MASK }].concat(actions || []), sanitize: true,
              opts: Object.assign({ state: state, prefix: 'EL-M04-' + s, repeat: { 'main tbody tr': 3, 'main [data-card]': 3 }, redact: [] }, opts || {}) };
    Object.assign(j, extra || {});
    j.opts.state = state + (j.width === 375 ? ' @375' : j.width === 768 ? ' @768' : '');
    jobs.push(j);
  }
  var M = { width: 375 }, T = { width: 768 };
  var W = function (ms) { return { wait: ms || 2000 }; };
  var ROWCK = 'main tbody input[type=checkbox]', ALLCK = 'main thead input[type=checkbox]';

  // ---------------- S1 /admin/questions ----------------
  J('A', 'S1-questions__default__1280', '/admin/questions', 'default (all, page 1, newest first)');
  J('A', 'S1-questions__subject-4__1280', '/admin/questions?subject_id=4', 'subject_id=4 (subject card link)');
  J('A', 'S1-questions__status-archived__1280', '/admin/questions?status=archived', 'status=archived (Arkib/INACTIVE badges)');
  J('A', 'S1-questions__status-draft-empty__1280', '/admin/questions?status=draft', 'status=draft (0 rows → empty state)');
  J('A', 'S1-questions__compliance-quarantined__1280', '/admin/questions?compliance_filter=quarantined', 'compliance_filter=quarantined');
  J('A', 'S1-questions__compliance-pending__1280', '/admin/questions?compliance_filter=pending_mapping', 'compliance_filter=pending_mapping');
  J('A', 'S1-questions__compliance-draft__1280', '/admin/questions?compliance_filter=draft', 'compliance_filter=draft (Source: TIADA)');
  J('A', 'S1-questions__dskp-untagged__1280', '/admin/questions?dskp_filter=untagged', 'dskp_filter=untagged (Latihan Tambahan badge)');
  J('A', 'S1-questions__source-trial__1280', '/admin/questions?source_filter=trial', 'source_filter=trial');
  J('A', 'S1-questions__search-empty__1280', '/admin/questions?search=zzqxv', 'search with no result (empty state)');
  J('A', 'S1-questions__page-2__1280', '/admin/questions?page=2', 'page=2');
  J('A', 'S1-questions__select-one__1280', '/admin/questions', '1 row ticked (bulk bar)', [{ check: ROWCK }, W(400)]);
  J('A', 'S1-questions__select-all__1280', '/admin/questions', 'header checkbox ticked (all on page)', [{ check: ALLCK }, W(400)]);
  J('A', 'S1-questions__default__375', '/admin/questions', 'default', [], M);
  J('A', 'S1-questions__select-one__375', '/admin/questions', '1 row ticked', [{ check: ROWCK }, W(400)], M);
  J('A', 'S1-questions__default__768', '/admin/questions', 'default', [], T);

  // ---------------- S2 /admin/questions/create ----------------
  var QT = function (v) { return { select: ['main select[name=question_type]', v] }; };
  var DSKP = [{ select: ['main select[name=subject_id]', '4'] }, { select: ['main select[name=education_level_id]', '11'] }, W(2500),
              { select: ['main select[x-model=bidangId]', { index: 1 }] }, W(2000), { select: ['main select[x-model=skId]', { index: 1 }] }, W(2000),
              { select: ['main select[name=dskp_sp_id]', { index: 1 }] }, W(600)];
  J('B', 'S2-questions-create__default__1280', '/admin/questions/create', 'default (type mcq)');
  ['true_false', 'short_answer', 'fill_blank', 'essay'].forEach(function (t) { J('B', 'S2-questions-create__type-' + t + '__1280', '/admin/questions/create', 'question_type=' + t, [QT(t), W(500)]); });
  J('B', 'S2-questions-create__dskp-bidang__1280', '/admin/questions/create', 'subject Sains + Tingkatan 5 → Bidang list loaded', [{ select: ['main select[name=subject_id]', '4'] }, { select: ['main select[name=education_level_id]', '11'] }, W(2500)]);
  J('B', 'S2-questions-create__dskp-tagged__1280', '/admin/questions/create', 'DSKP Bidang → SK → SP chosen ("DSKP tagged")', DSKP);
  J('B', 'S2-questions-create__keyboard-arab__1280', '/admin/questions/create', 'virtual keyboard open (Arab)', [{ click: 'main .vkb-toggle-btn' }, W(600)]);
  J('B', 'S2-questions-create__keyboard-jawi__1280', '/admin/questions/create', 'virtual keyboard open (Jawi)', [{ click: 'main .vkb-toggle-btn' }, W(400), { click: "main button[\\@click=\"setMode('jawi')\"]" }, W(400)]);
  J('B', 'S2-questions-create__default__375', '/admin/questions/create', 'default', [], M);
  J('B', 'S2-questions-create__keyboard__375', '/admin/questions/create', 'virtual keyboard open (bottom sheet)', [{ click: 'main .vkb-toggle-btn' }, W(600)], M);
  J('B', 'S2-questions-create__type-essay__375', '/admin/questions/create', 'question_type=essay', [QT('essay'), W(500)], M);
  J('B', 'S2-questions-create__default__768', '/admin/questions/create', 'default', [], T);

  // ---------------- S3 /admin/questions/{id} ----------------
  J('C', 'S3-question-show__approved-dskp__1280', '/admin/questions/564159', 'approved MCQ with DSKP tag + explanation');
  J('C', 'S3-question-show__archived-untagged__1280', '/admin/questions/129114', 'archived MCQ, no DSKP, no explanation');
  J('C', 'S3-question-show__default__375', '/admin/questions/564159', 'approved', [], M);
  J('C', 'S3-question-show__default__768', '/admin/questions/564159', 'approved', [], T);

  // ---------------- S4 /admin/questions/{id}/edit ----------------
  J('C', 'S4-question-edit__default__1280', '/admin/questions/564159/edit', 'MCQ with DSKP preselected (lists loaded)', [W(4000)]);
  J('C', 'S4-question-edit__untagged__1280', '/admin/questions/129114/edit', 'MCQ without DSKP', [W(2500)]);
  J('C', 'S4-question-edit__sp-cleared__1280', '/admin/questions/564159/edit', 'SP cleared → "Buang tag DSKP" button', [W(4000), { select: ['main select[name=dskp_sp_id]', ''] }, W(500)]);
  J('C', 'S4-question-edit__default__375', '/admin/questions/564159/edit', 'default', [W(3000)], M);
  J('C', 'S4-question-edit__default__768', '/admin/questions/564159/edit', 'default', [W(3000)], T);

  // ---------------- S5 /admin/questions/import ----------------
  J('D', 'S5-import__default__1280', '/admin/questions/import', 'default');
  J('D', 'S5-import__default__375', '/admin/questions/import', 'default', [], M);
  J('D', 'S5-import__default__768', '/admin/questions/import', 'default', [], T);
  J('D', 'S5-import__history-500__1280', '/admin/questions/import-history', '"Sejarah Import" target (HTTP 500 page)');

  // ---------------- S6 /admin/questions/quality ----------------
  J('D', 'S6-quality__default__1280', '/admin/questions/quality', 'default', [], null, { repeat: { 'main tbody tr': 30 } });
  J('D', 'S6-quality__default__375', '/admin/questions/quality', 'default', [], M, { repeat: { 'main tbody tr': 30 } });
  J('D', 'S6-quality__default__768', '/admin/questions/quality', 'default', [], T, { repeat: { 'main tbody tr': 30 } });

  // ---------------- S7 /admin/question-reports ----------------
  // report cards (data-driven) get data-card so opts.repeat keeps the first 3 of each list; every card variant is in the narrative (read from source).
  var RP = { eval: "(() => { var n = 0; document.querySelectorAll('main i.fa-hashtag').forEach(function (i) { var c = i.closest('[class*=\"lg:flex-row\"]'); if (c && c.parentElement) { c.parentElement.setAttribute('data-card', ''); n++; } }); return 'report cards=' + n; })()" };
  J('E', 'S7-reports__default__1280', '/admin/question-reports', 'default (status=pending)', [RP]);
  ['reviewed', 'fixed', 'dismissed', 'all'].forEach(function (s) { J('E', 'S7-reports__status-' + s + '__1280', '/admin/question-reports?status=' + s, 'status=' + s, [RP]); });
  J('E', 'S7-reports__default__375', '/admin/question-reports', 'default', [RP], M);
  J('E', 'S7-reports__status-all__375', '/admin/question-reports?status=all', 'status=all', [RP], M);
  J('E', 'S7-reports__default__768', '/admin/question-reports?status=all', 'status=all', [RP], T);

  // ---------------- S8 /admin/structured-questions ----------------
  J('F', 'S8-structured__default__1280', '/admin/structured-questions', 'default');
  J('F', 'S8-structured__kbat-5__1280', '/admin/structured-questions?kbat_level=5', 'kbat_level=5');
  J('F', 'S8-structured__subject-2__1280', '/admin/structured-questions?subject_id=2&education_level_id=11', 'subject_id=2 + Tingkatan 5');
  J('F', 'S8-structured__empty__1280', '/admin/structured-questions?subject_id=18', 'subject with no structured questions (empty state)');
  J('F', 'S8-structured__page-2__1280', '/admin/structured-questions?page=2', 'page=2');
  J('F', 'S8-structured__default__375', '/admin/structured-questions', 'default', [], M);
  J('F', 'S8-structured__default__768', '/admin/structured-questions', 'default', [], T);

  // ---------------- S9 /admin/structured-questions/{id} ----------------
  J('F', 'S9-structured-show__multi-sub__1280', '/admin/structured-questions/3698', '3 sub-questions (3(A)–3(C))');
  J('F', 'S9-structured-show__single-sub__1280', '/admin/structured-questions/4454', '1 sub-question (A)');
  J('F', 'S9-structured-show__default__375', '/admin/structured-questions/3698', 'default', [], M);
  J('F', 'S9-structured-show__default__768', '/admin/structured-questions/3698', 'default', [], T);

  // ---------------- S10 /admin/question-submissions ----------------
  var SUB = { san: true };
  J('G', 'S10-submissions__default__1280', '/admin/question-submissions', 'default');
  J('G', 'S10-submissions__status-processing__1280', '/admin/question-submissions?status=processing', 'status=processing');
  J('G', 'S10-submissions__status-rejected__1280', '/admin/question-submissions?status=rejected', 'status=rejected (empty)');
  J('G', 'S10-submissions__row-open__1280', '/admin/question-submissions', 'row "Kemaskini" panel expanded (not submitted)', [{ click: 'main tbody tr button' }, W(400)]);
  J('G', 'S10-submissions__default__375', '/admin/question-submissions', 'default', [], M);
  J('G', 'S10-submissions__row-open__375', '/admin/question-submissions', 'row panel expanded', [{ click: 'main tbody tr button' }, W(400)], M);
  J('G', 'S10-submissions__default__768', '/admin/question-submissions', 'default', [], T);

  // ---------------- S11 /admin/soalan-gambar ----------------
  var GP = { eval: GAMBAR_PREP };
  J('H', 'S11-gambar__default__1280', '/admin/soalan-gambar', 'default (MCQ + Struktur lists, page 1)', [GP]);
  J('H', 'S11-gambar__subject-9__1280', '/admin/soalan-gambar?subject_id=9', 'subject_id=9 (Fizik)', [GP]);
  J('H', 'S11-gambar__mcq-page-2__1280', '/admin/soalan-gambar?mcq_page=2', 'mcq_page=2', [GP]);
  J('H', 'S11-gambar__str-page-2__1280', '/admin/soalan-gambar?str_page=2', 'str_page=2', [GP]);
  J('H', 'S11-gambar__few__1280', '/admin/soalan-gambar?subject_id=18', 'subject with 5 MCQ and no Struktur (Struktur section omitted)', [GP]);
  J('H', 'S11-gambar__all-done__1280', '/admin/soalan-gambar?subject_id=19', 'subject with nothing to fix (empty state)', [GP]);
  J('H', 'S11-gambar__default__375', '/admin/soalan-gambar', 'default', [GP], M);
  J('H', 'S11-gambar__default__768', '/admin/soalan-gambar', 'default', [GP], T);

  // ---------------- S12 /admin/master-notes (user-portal layout) ----------------
  var NP = { eval: NOTES_PREP };
  J('I', 'S12-master-notes__default__1280', '/admin/master-notes', 'default (tab=flagged, empty)', [NP], { shellU: true });
  J('I', 'S12-master-notes__tab-approved__1280', '/admin/master-notes?tab=approved', 'tab=approved (empty)', [NP]);
  J('I', 'S12-master-notes__tab-all__1280', '/admin/master-notes?tab=all', 'tab=all (525 notes)', [NP]);
  J('I', 'S12-master-notes__tab-all-page-2__1280', '/admin/master-notes?tab=all&page=2', 'tab=all page 2', [NP]);
  J('I', 'S12-master-notes__default__375', '/admin/master-notes?tab=all', 'tab=all', [NP], M);
  J('I', 'S12-master-notes__default__768', '/admin/master-notes?tab=all', 'tab=all', [NP], T);

  // ---------------- S13 /laporan-soalan (user-portal layout) ----------------
  J('I', 'S13-my-reports__default__1280', '/laporan-soalan', 'default (admin has sent no reports → empty state)');
  J('I', 'S13-my-reports__default__375', '/laporan-soalan', 'default', [], M);
  J('I', 'S13-my-reports__default__768', '/laporan-soalan', 'default', [], T);

  // ---------------- S14 report-a-question modal (hosted on M05 practice pages; static markup) ----------------
  J('I', 'S14-report-modal__structured__1280', '/laporan-soalan', 'structured-practice modal (all branches shown)', [{ eval: MODAL('structured') }], null, { contentRoot: 'main' });
  J('I', 'S14-report-modal__mcq__1280', '/laporan-soalan', 'MCQ quiz modal (all branches shown)', [{ eval: MODAL('mcq') }], null, { contentRoot: 'main' });
  J('I', 'S14-report-modal__mcq__375', '/laporan-soalan', 'MCQ quiz modal', [{ eval: MODAL('mcq') }], M, { contentRoot: 'main' });

  window.__M04_JOBS = jobs;
  window.__M04_HELPERS = { MASK: M04MASK, GAMBAR_PREP: GAMBAR_PREP, NOTES_PREP: NOTES_PREP };
})();
