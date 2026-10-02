// M08 audit top-up screenshots → docs/discovery/img/M08/. Load tools/jobs/M08.js, then M08-topup.js, then this file.
(function () {
  var B = 'https://prestasiplus.my', D = 'docs/discovery/img/M08/';
  var H = window.__M08_HELPERS, T = window.__M08T_MASK;
  var PNG = "(() => { var b = atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='); var u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; })()";
  var S = [], VP = { fullPage: false };
  function s(file, url, width, actions, extra) { S.push(Object.assign({ file: D + file, url: B + url, width: width || 1280, actions: [{ eval: H.MASK }, { eval: T }].concat(actions || []), sanitize: H.SAN }, extra || {})); }
  var W = function (ms) { return { wait: ms || 500 }; };
  s('tingkatan-t4-class-table.png', '/prestasi/tingkatan/t4', 1280, [{ eval: "document.querySelector('main table').scrollIntoView()" }, W(200)], { clip: 'main table' });
  s('kelas-headcount-516.png', '/prestasi/kelas/516', 1280);
  s('prestasi-360-headcount-status.png', '/prestasi/2224', 1280, [{ eval: "document.querySelectorAll('main h2')[0].scrollIntoView()" }, W(200)], VP);
  s('prestasi-360-headcount-status-mobile.png', '/prestasi/2224', 375, [{ eval: "document.querySelectorAll('main h2')[0].scrollIntoView()" }, W(200)], VP);
  s('headcount-pelajar-populated.png', '/headcount/student/2224', 1280);
  s('headcount-pelajar-selisih-besar.png', '/headcount/student/2219', 1280);
  s('headcount-pelajar-hampir-tepat.png', '/headcount/student/2228', 1280);
  s('headcount-pelajar-populated-mobile.png', '/headcount/student/2224', 375, [], VP);
  s('headcount-ringkasan-desktop.png', '/headcount/213/summary', 1280);
  s('headcount-ringkasan-mobile.png', '/headcount/213/summary', 375);
  s('headcount-kelas-desktop.png', '/headcount/213', 1280, [], VP);
  s('headcount-kelas-reset-modal.png', '/headcount/213', 1280, [{ click: 'main button[\\@click="showResetModal = true"]' }, W()], VP);
  s('headcount-kelas-mobile.png', '/headcount/213', 375, [], VP);
  s('timeline-create-caption-reset.png', '/timeline/create', 1280, [{ eval: "(() => { handleFiles([new File([" + PNG + "], 'a.png', {type:'image/png'})]); return 1; })()" }, W(700), { eval: "(() => { document.querySelector('#captionFields input').value = 'ujian'; handleFiles([new File([" + PNG + "], 'b.png', {type:'image/png'})]); return 2; })()" }, W(700)]);
  window.__shots = S;
})();
