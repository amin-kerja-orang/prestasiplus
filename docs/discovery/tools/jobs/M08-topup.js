// M08 audit top-up capture plan (AUD-M08-01, AUD-M08-05 + S10/S19/S17 checks). Lane 3 (playwright3). READ-ONLY.
// Load tools/jobs/M08.js FIRST (window.__M08_HELPERS), then this file; it sets window.__M08T_JOBS.
// Never submitted/clicked: Auto-Setup, Cipta Headcount, Terbitkan, "Key-in AR" targets, "Edit TOV/ETR", "Export CSV",
// "Ya, Reset" (POST /headcount/{id}/reset-ar), "Ya, Padam" (DELETE /headcount/{id}), "Gugurkan"/"Kembalikan" (POST drop-students).
// Reset/Padam modals are only OPENED (Alpine x-show) and never confirmed. S17 files are synthetic 1x1 PNG File objects
// created in the page and passed to the page's own handleFiles(); nothing is uploaded.
// Extra mask (TMASK): "Guru: <name>" subtitle on /headcount/{id}; student name links in the headcount table
// (sanitize masks the "Nama" column too). No real name is written in this file.
(function () {
  var B = 'https://prestasiplus.my';
  var H = window.__M08_HELPERS;
  var TMASK = "(() => { var n = 0; document.querySelectorAll('main p').forEach(function (p) { if (/Guru:/.test(p.textContent)) { p.textContent = p.textContent.replace(/Guru:[\\s\\S]*$/, 'Guru: <person>'); n++; } });" +
    " document.querySelectorAll('main a[href*=\"/headcount/student/\"]').forEach(function (a) { if (a.closest('tbody')) { a.classList.add('m08n'); n++; } });" +
    " document.querySelectorAll('main tbody input[type=checkbox][value]').forEach(function (c) { c.setAttribute('value', 'N'); });" +
    " return 'tmask: ' + n; })()";
  var PNG = "(() => { var b = atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='); var u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; })()";
  function file(name) { return "new File([" + PNG + "], '" + name + "', { type: 'image/png' })"; }
  var jobs = [];
  function J(group, file_, url, state, actions, extra, opts) {
    var s = file_.split('-')[0];
    var j = { group: group, file: file_, url: B + url, actions: [{ eval: H.MASK }, { eval: TMASK }].concat(actions || []), sanitize: H.SAN,
              opts: Object.assign({ state: state, prefix: 'EL-M08-' + s, redact: [] }, opts || {}) };
    Object.assign(j, extra || {});
    j.opts.state = state + (j.width === 375 ? ' @375' : j.width === 768 ? ' @768' : '');
    jobs.push(j);
  }
  var M = { width: 375 };
  var W = function (ms) { return { wait: ms || 500 }; };
  var R5 = { repeat: { 'main .overflow-y-auto > a': 3, 'main table tbody tr': 4 } };
  var R6 = { repeat: { 'main [\\@click*="activeDay ="]': 7, 'main .grid.grid-cols-1.sm\\:grid-cols-2 > div.flex': 3 } };
  var R23 = { repeat: { 'main table tbody tr': 3 } };

  // S3 T4: full class table (13 rows, no repeat limit)
  J('T', 'S3-prestasi-tingkatan__t4-full-table__1280', '/prestasi/tingkatan/t4', 'Tingkatan 4 — full Perbandingan Kelas table (13 rows) (audit top-up)');
  // S5 class 516: headcount summary + On Track / Below badges
  J('T', 'S5-prestasi-kelas__headcount__1280', '/prestasi/kelas/516', 'class 516 with headcount (Ringkasan Kelas block, On Track/Below badges) (audit top-up)', [], null, R5);
  J('T', 'S5-prestasi-kelas__headcount__375', '/prestasi/kelas/516', 'class 516 with headcount (audit top-up)', [], M, R5);
  // S6 student reached from S3 T4 "Murid Berisiko"
  J('T', 'S6-prestasi-360__headcount-status__1280', '/prestasi/2224', 'at-risk student: 5 headcount cards On Track/Below/—, chip row without AR checkpoints (audit top-up)', [], null, R6);
  J('T', 'S6-prestasi-360__headcount-status__375', '/prestasi/2224', 'at-risk student (audit top-up)', [], M, R6);
  // S15 populated
  J('T', 'S15-headcount-pelajar__populated__1280', '/headcount/student/2224', '5 configs: On Track/Below Target/Belum Ada Data, RS badge/chip/row, Menurun, Keyakinan Rendah, Ramalan Tepat (audit top-up)');
  J('T', 'S15-headcount-pelajar__selisih-besar__1280', '/headcount/student/2219', 'Ketepatan Ramalan "Selisih Besar" variant (audit top-up)');
  J('T', 'S15-headcount-pelajar__hampir-tepat__1280', '/headcount/student/2228', 'Ketepatan Ramalan "Hampir Tepat" variant (audit top-up)');
  J('T', 'S15-headcount-pelajar__populated__375', '/headcount/student/2224', 'populated (audit top-up)', [], M);
  // S22 /headcount/{id}/summary (new route)
  J('T', 'S22-headcount-ringkasan__default__1280', '/headcount/213/summary', 'Ringkasan Kelas for config 213 (audit top-up)');
  J('T', 'S22-headcount-ringkasan__default__375', '/headcount/213/summary', 'Ringkasan Kelas (audit top-up)', [], M);
  // S23 /headcount/{id} (new route) — table, Key-in AR menu, modals opened only
  var KEY = { click: 'main button[\\@click="open = !open"]' };
  J('T', 'S23-headcount-kelas__default__1280', '/headcount/213', 'config 213 table (sort=ranking default) (audit top-up)', [], null, R23);
  J('T', 'S23-headcount-kelas__keyin-menu__1280', '/headcount/213', '"Key-in AR" menu opened (links not followed) (audit top-up)', [KEY, W()], null, R23);
  J('T', 'S23-headcount-kelas__reset-modal__1280', '/headcount/213', '"Reset Data" modal opened, NOT confirmed (audit top-up)', [{ click: 'main button[\\@click="showResetModal = true"]' }, W()], null, R23);
  J('T', 'S23-headcount-kelas__delete-modal__1280', '/headcount/213', '"Padam" modal opened, NOT confirmed (audit top-up)', [{ click: 'main button[\\@click="showDeleteModal = true"]' }, W()], null, R23);
  J('T', 'S23-headcount-kelas__sort-name__1280', '/headcount/213?sort=name', 'sort=name (A-Z) (audit top-up)', [], null, R23);
  J('T', 'S23-headcount-kelas__row-selected__1280', '/headcount/213', 'one row checkbox ticked → drop bar (NOT submitted) (audit top-up)', [{ check: 'main tbody input[type=checkbox] >> nth=0' }, W()], null, R23);
  J('T', 'S23-headcount-kelas__default__375', '/headcount/213', 'config 213 table (audit top-up)', [], M, R23);
  // S17 captions: 1 file + caption typed, then a 2nd file (captions re-rendered empty)
  var ADD1 = { eval: "(() => { handleFiles([" + file('a.png') + "]); return 'files=' + selectedFiles.length; })()" };
  var CAP = { eval: "(() => { var i = document.querySelector('#captionFields input[name=\"captions[0]\"]'); i.value = 'ujian'; return 'caption0=' + i.value; })()" };
  var ADD2 = { eval: "(() => { handleFiles([" + file('b.png') + "]); return 'files=' + selectedFiles.length + ' caption0=' + JSON.stringify(document.querySelector('#captionFields input[name=\"captions[0]\"]').value); })()" };
  J('T', 'S17-timeline-create__one-photo__1280', '/timeline/create', 'one synthetic photo selected (preview + caption field) (audit top-up)', [ADD1, W(700)]);
  J('T', 'S17-timeline-create__caption-reset__1280', '/timeline/create', 'caption typed, 2nd photo added → captions re-rendered empty (audit top-up)', [ADD1, W(700), CAP, ADD2, W(700)]);
  window.__M08T_JOBS = jobs;
  window.__M08T_MASK = TMASK;
})();
