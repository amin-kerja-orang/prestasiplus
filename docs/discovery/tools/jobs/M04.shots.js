// M04 masked screenshot plan → docs/discovery/img/M04/. Load tools/jobs/M04.js FIRST (it exposes window.__M04_HELPERS),
// then addScriptTag(this file), then browser_run_code_unsafe{filename: tools/shoot.js}.
// Every shot runs M04MASK (names / e-mails of submitters, reporters, creators) and then tools/sanitize.js before capture.
// Client-side reveals only; nothing is submitted, uploaded, dismissed or approved.
(function () {
  var B = 'https://prestasiplus.my', D = 'docs/discovery/img/M04/';
  var H = window.__M04_HELPERS;
  var MK = { eval: H.MASK }, GP = { eval: H.GAMBAR_PREP };
  var W = function (ms) { return { wait: ms || 1500 }; };
  // report modal rendered live by Alpine (open state) inside /laporan-soalan, from markup fetched earlier into localStorage
  function MODAL(kind) {
    return { eval: "(() => { var h = localStorage.getItem('m04_modal_" + kind + "'); if (!h) return 'NO MODAL'; var d = document.createElement('div');" +
      " d.setAttribute('x-data', \"{ reportModal: true, reportReasons: [], reportComment: '', reportLoading: false, reportSubmitted: false, reportMessage: '', submitReport() {}, submitStructuredReport() {} }\");" +
      " d.innerHTML = h; document.body.appendChild(d); window.Alpine.initTree(d); return 'modal rendered'; })()" };
  }
  var S = [];
  function s(file, url, width, actions, extra) { S.push(Object.assign({ file: D + file, url: B + url, width: width || 1280, actions: [MK].concat(actions || []), sanitize: true }, extra || {})); }
  var VP = { fullPage: false };
  // S1 list
  s('questions-list-desktop.png', '/admin/questions', 1280);
  s('questions-list-tablet.png', '/admin/questions', 768, [], VP);
  s('questions-list-mobile.png', '/admin/questions', 375);
  s('questions-list-bulk-bar.png', '/admin/questions', 1280, [{ check: 'main tbody input[type=checkbox]' }, W(400), { eval: "document.querySelector('main select[name=action]').scrollIntoView({block:'center'})" }], VP);
  s('questions-list-subject-filter.png', '/admin/questions?subject_id=4', 1280, [], VP);
  s('questions-list-archived.png', '/admin/questions?status=archived', 1280, [{ eval: "document.querySelector('main table').scrollIntoView()" }], VP);
  s('questions-list-empty.png', '/admin/questions?search=zzqxv', 1280, [{ eval: "window.scrollTo(0, document.body.scrollHeight)" }], VP);
  // S2 create
  s('question-create-mcq.png', '/admin/questions/create', 1280);
  s('question-create-true-false.png', '/admin/questions/create', 1280, [{ select: ['main select[name=question_type]', 'true_false'] }, W(400)]);
  s('question-create-short-answer.png', '/admin/questions/create', 1280, [{ select: ['main select[name=question_type]', 'short_answer'] }, W(400)]);
  s('question-create-fill-blank.png', '/admin/questions/create', 1280, [{ select: ['main select[name=question_type]', 'fill_blank'] }, W(400), { eval: "document.querySelector('[name=correct_answer_text]').scrollIntoView({block:'center'})" }], VP);
  s('question-create-essay.png', '/admin/questions/create', 1280, [{ select: ['main select[name=question_type]', 'essay'] }, W(400)]);
  s('question-create-dskp-tagged.png', '/admin/questions/create', 1280, [{ select: ['main select[name=subject_id]', '4'] }, { select: ['main select[name=education_level_id]', '11'] }, W(2500),
    { select: ['main select[x-model=bidangId]', { index: 1 }] }, W(2000), { select: ['main select[x-model=skId]', { index: 1 }] }, W(2000), { select: ['main select[name=dskp_sp_id]', { index: 1 }] }, W(500),
    { eval: "document.querySelector('main select[name=dskp_sp_id]').scrollIntoView({block:'center'})" }], VP);
  s('question-create-keyboard-jawi.png', '/admin/questions/create', 1280, [{ click: 'main .vkb-toggle-btn' }, W(400), { click: "main button[\\@click=\"setMode('jawi')\"]" }, W(400)], VP);
  s('question-create-mobile.png', '/admin/questions/create', 375);
  s('question-create-keyboard-mobile.png', '/admin/questions/create', 375, [{ click: 'main .vkb-toggle-btn' }, W(600)], VP);
  // S3 / S4
  s('question-show-approved.png', '/admin/questions/564159', 1280);
  s('question-show-archived.png', '/admin/questions/129114', 1280);
  s('question-show-mobile.png', '/admin/questions/564159', 375);
  s('question-edit-desktop.png', '/admin/questions/564159/edit', 1280, [W(3500)]);
  s('question-edit-remove-dskp.png', '/admin/questions/564159/edit', 1280, [W(3500), { select: ['main select[name=dskp_sp_id]', ''] }, W(400), { eval: "document.querySelector('main select[name=dskp_sp_id]').scrollIntoView({block:'center'})" }], VP);
  s('question-edit-mobile.png', '/admin/questions/564159/edit', 375, [W(3000)]);
  // S5 / S6
  s('import-desktop.png', '/admin/questions/import', 1280);
  s('import-mobile.png', '/admin/questions/import', 375);
  s('import-history-500.png', '/admin/questions/import-history', 1280, [], VP);
  s('quality-desktop.png', '/admin/questions/quality', 1280);
  s('quality-mobile.png', '/admin/questions/quality', 375);
  // S7
  s('reports-pending-desktop.png', '/admin/question-reports', 1280);
  s('reports-all-desktop.png', '/admin/question-reports?status=all', 1280);
  s('reports-all-mobile.png', '/admin/question-reports?status=all', 375, [], VP);
  s('reports-dismissed-empty.png', '/admin/question-reports?status=dismissed', 1280, [], VP);
  // S8 / S9
  s('structured-list-desktop.png', '/admin/structured-questions', 1280, [], VP);
  s('structured-list-mobile.png', '/admin/structured-questions', 375, [], VP);
  s('structured-list-empty.png', '/admin/structured-questions?subject_id=18', 1280);
  s('structured-show-desktop.png', '/admin/structured-questions/3698', 1280);
  s('structured-show-mobile.png', '/admin/structured-questions/3698', 375, [], VP);
  // S10
  s('submissions-desktop.png', '/admin/question-submissions', 1280);
  s('submissions-row-open.png', '/admin/question-submissions', 1280, [{ click: 'main tbody tr button' }, W(400)]);
  s('submissions-mobile.png', '/admin/question-submissions', 375);
  // S11
  s('gambar-desktop.png', '/admin/soalan-gambar', 1280, [GP], VP);
  s('gambar-structured-section.png', '/admin/soalan-gambar', 1280, [GP, { eval: "Array.from(document.querySelectorAll('main h2')).pop().scrollIntoView()" }], VP);
  s('gambar-mobile.png', '/admin/soalan-gambar', 375, [GP], VP);
  // S12 / S13 / S14 (user-portal layout)
  s('master-notes-default.png', '/admin/master-notes', 1280, [], VP);
  s('master-notes-all.png', '/admin/master-notes?tab=all', 1280, [], VP);
  s('master-notes-mobile.png', '/admin/master-notes?tab=all', 375, [], VP);
  s('my-reports-desktop.png', '/laporan-soalan', 1280, [], VP);
  s('my-reports-mobile.png', '/laporan-soalan', 375, [], VP);
  s('report-modal-mcq.png', '/laporan-soalan', 1280, [MODAL('mcq'), W(500)], VP);
  s('report-modal-structured.png', '/laporan-soalan', 1280, [MODAL('structured'), W(500)], VP);
  s('report-modal-mcq-mobile.png', '/laporan-soalan', 375, [MODAL('mcq'), W(500)], VP);
  window.__shots = S;
})();
