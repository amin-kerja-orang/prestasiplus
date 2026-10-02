// R10 masked screenshot plan → docs/discovery/img/R10/. Run R10-guard.js first; load tools/jobs/R10.js FIRST
// (window.__R10_HELPERS), then addScriptTag(this file), then browser_run_code_unsafe{filename: tools/shoot.js}.
// Every shot runs R10MASK (Cikgu Pakar card name + initials, e-mail / phone leaves) and tools/sanitize.js before the
// pixels are taken. Read-only: nothing is clicked. S2 / S3 are shot at /admin-sekolah/pilih-sekolah directly (the page
// both routes redirect to), so the guard's load-once cache serves it (redirect follow-ups bypass the cache).
(function () {
  var B = 'https://prestasiplus.my', D = 'docs/discovery/img/R10/';
  var H = window.__R10_HELPERS;
  var MK = { eval: H.MASK };
  var S = [];
  function s(file, url, width, actions, extra) { S.push(Object.assign({ file: D + file, url: B + url, width: width || 1280, actions: (actions || []).concat([{ wait: 400 }, MK]), sanitize: H.SAN, settle: 600 }, extra || {})); }
  s('heatmap-topik-lemah-desktop.png', '/buku-nota/heatmap', 1280);
  s('heatmap-topik-lemah-tablet.png', '/buku-nota/heatmap', 768);
  s('heatmap-topik-lemah-mobile.png', '/buku-nota/heatmap', 375);
  s('admin-sekolah-pilih-sekolah-500-desktop.png', '/admin-sekolah/pilih-sekolah', 1280);
  s('admin-sekolah-pilih-sekolah-500-tablet.png', '/admin-sekolah/pilih-sekolah', 768);
  s('admin-sekolah-pilih-sekolah-500-mobile.png', '/admin-sekolah/pilih-sekolah', 375);
  window.__shots = S;
})();
