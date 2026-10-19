// M27 masked screenshot plan -> docs/discovery/img/M27/. Run M27-guard.js first; load tools/jobs/M27.js FIRST
// (window.__M27_HELPERS), then addScriptTag(this file), then browser_run_code_unsafe{filename: tools/shoot.js}.
// Read-only: nothing is clicked. Every page is served by the guard's load-once cache or reached once (error pages).
(function () {
  var B = 'https://prestasiplus.my', D = 'docs/discovery/img/M27/';
  var H = window.__M27_HELPERS; var MK = { eval: H.MASK }; var S = [];
  function s(file, url, width, extra) { S.push(Object.assign({ file: D + file, url: B + url, width: width || 1280, actions: [{ wait: 400 }, MK], sanitize: H.SAN, settle: 600 }, extra || {})); }
  [['desktop', 1280], ['tablet', 768], ['mobile', 375]].forEach(function (w) {
    s('admin-sekolah-pilih-sekolah-500-' + w[0] + '.png', '/admin-sekolah/pilih-sekolah', w[1]);
    s('admin-sekolah-command-center-403-' + w[0] + '.png', '/admin-sekolah/command-center', w[1]);
    s('admin-sekolah-laporan-aktiviti-404-' + w[0] + '.png', '/admin-sekolah/laporan-aktiviti', w[1]);
  });
  s('admin-sekolah-kirkpatrick-alias-desktop.png', '/admin-sekolah/kirkpatrick', 1280);
  s('admin-sekolah-kirkpatrick-alias-mobile.png', '/admin-sekolah/kirkpatrick', 375);
  s('admin-sekolah-monitoring-alias-desktop.png', '/admin-sekolah/monitoring', 1280);
  s('admin-sekolah-monitoring-alias-mobile.png', '/admin-sekolah/monitoring', 375);
  window.__shots = S;
})();
