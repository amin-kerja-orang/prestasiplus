// M27 capture plan: School Admin Portal (/admin-sekolah/*), admin account only (D16).
// Guard first: browser_run_code_unsafe { filename: <abs>/docs/discovery/tools/jobs/M27-guard.js }, then log in, then ctx.__m27.cacheOn = true.
// Load: browser_run_code_unsafe: async (page) => page.addScriptTag({ path: '<abs>/docs/discovery/tools/jobs/M27.js' })
// then: browser_evaluate: () => { window.__jobs = window.__M27_JOBS; }  then tools/run-state.js.
// Reachable screens for the admin: /admin-sekolah/pilih-sekolah (500), /admin-sekolah/command-center (403), an
// /admin-sekolah/* 404 control. /admin-sekolah/monitoring and /admin-sekolah/kirkpatrick are byte-identical aliases of
// /admin/monitoring (M11) and /admin/kirkpatrick (M12) and are NOT re-inventoried (identity proof in the narrative).
// Redirecting routes are never loaded in the browser (their follow-up bypasses the guard cache); jobs go straight to the
// redirect target. SAFETY: GET only; nothing is clicked.
(function () {
  var B = 'https://prestasiplus.my';
  var jobs = [];
  function mask() {
    var n = 0; var T = function (s) { return String(s || '').replace(/\s+/g, ' ').trim(); };
    var PHONE = /(\+?6?0\s?1\d[\d\- ]{6,10}\d)/;
    document.querySelectorAll('body *').forEach(function (el) {
      if (el.children.length || el.closest('script,style,template,select,option')) return;
      var t = T(el.textContent); if (!t) return;
      if (/[^\s@]+@[^\s@]+\.[a-z]{2,}/i.test(t)) { el.classList.add('m27n'); n++; }
      else if (PHONE.test(t) && !/RM\s?\d/.test(t)) { el.classList.add('m27n'); n++; }
    });
    return 'm27mask: ' + n;
  }
  var M27MASK = '(' + mask.toString() + ')()';
  var SAN = { selectors: ['.m27n'], titleName: false };
  window.__M27_HELPERS = { MASK: M27MASK, SAN: SAN };
  function J(file, url, state, extra) {
    var s = file.split('-')[0];
    var j = { group: 'A', file: file, url: B + url, actions: [{ wait: 500 }, { eval: M27MASK }], sanitize: SAN, settle: 500, opts: { state: state, prefix: 'EL-M27-' + s, redact: [] } };
    Object.assign(j, extra || {});
    j.opts.state = state + (j.width === 375 ? ' @375' : j.width === 768 ? ' @768' : '');
    jobs.push(j);
  }
  var M = { width: 375 }, T = { width: 768 };
  J('S1-pilih-sekolah__admin-500__1280', '/admin-sekolah/pilih-sekolah', 'admin: target of the 302 from 8 routes; 500 "Ralat Pelayan"');
  J('S1-pilih-sekolah__admin-500__768', '/admin-sekolah/pilih-sekolah', 'admin-500', T);
  J('S1-pilih-sekolah__admin-500__375', '/admin-sekolah/pilih-sekolah', 'admin-500', M);
  J('S2-command-center__admin-403__1280', '/admin-sekolah/command-center', 'admin: 403 "Akses Ditolak"');
  J('S2-command-center__admin-403__768', '/admin-sekolah/command-center', 'admin-403', T);
  J('S2-command-center__admin-403__375', '/admin-sekolah/command-center', 'admin-403', M);
  J('S3-laporan-aktiviti__admin-404__1280', '/admin-sekolah/laporan-aktiviti', 'admin: 404 "Halaman Tidak Dijumpai" (INFERRED href does not exist)');
  J('S3-laporan-aktiviti__admin-404__768', '/admin-sekolah/laporan-aktiviti', 'admin-404', T);
  J('S3-laporan-aktiviti__admin-404__375', '/admin-sekolah/laporan-aktiviti', 'admin-404', M);
  window.__M27_JOBS = jobs;
})();
