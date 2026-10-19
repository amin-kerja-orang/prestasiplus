// R10 capture plan — Release 1.0 screens not yet discovered (D15):
//   S1 "Heatmap Topik Lemah" (student sidebar, Pusat AI)  → live route /buku-nota/heatmap (found by crawl: the
//      "🌡️ Heatmap Topik" tile of /pusat-nota-ringkas and the "Heatmap Topik Lemah" tab of /buku-nota); open to admin.
//   S2 "DSKP Heatmap" (school-admin sidebar, Analitik)    → /admin-sekolah/dskp-heatmap: 302 → /admin-sekolah/pilih-sekolah → 500 for admin.
//   S3 "Laporan Bulanan" (school-admin sidebar, Penilaian) → /admin-sekolah/laporan-bulanan: 302 → same 500 for admin.
// Guard first:  browser_run_code_unsafe { filename: <abs>/docs/discovery/tools/jobs/R10-guard.js }  (then log in, then
//   set ctx.__r10.cacheOn = true: every page reaches the server once per context, later loads come from the cache).
// Load:  browser_run_code_unsafe: async (page) => page.addScriptTag({ path: '<abs>/docs/discovery/tools/jobs/R10.js' })
// then:  browser_evaluate: () => { window.__jobs = window.__R10_JOBS; }
// then run tools/run-state.js, save window.__invs to docs/discovery/inventory/_raw/R10/_batch.json, split-batch.js,
// merge-inventory.js R10 tools/jobs/R10.screens.json.
//
// SAFETY: live production, browser lane 3 (playwright3), admin account. READ-ONLY. S1 is server-rendered with no
// client-side state; its cells are plain links to /practice/chapter (never followed: no practice session is started).
// No AI call is made by these pages; the guard would abort any (see R10-guard.js). No reveal action is needed.
//
// PERSONAL DATA: S1 shows a "Cikgu Pakar" ambassador card (M24 Duta profile) whose display name is a person name, with
// avatar initials. R10MASK tags the card's name and initials (.r10n → masked and scrubbed globally), plus every
// e-mail / phone-shaped leaf; tools/sanitize.js then runs with SAN. Topic names, subjects and figures are not personal
// (they are the admin account's own practice aggregates).
(function () {
  var B = 'https://prestasiplus.my';
  var jobs = [];
  function mask() {
    var n = 0;
    var tag = function (el) { if (el && el.classList && !el.classList.contains('r10n')) { el.classList.add('r10n'); n++; } };
    var T = function (s) { return String(s || '').replace(/\s+/g, ' ').trim(); };
    var PHONE = /(\+?6?0\s?1\d[\d\- ]{6,10}\d)/;
    document.querySelectorAll('.duta-card .name, .duta-card .av-img').forEach(tag);
    document.querySelectorAll('body *').forEach(function (el) {
      if (el.children.length || el.closest('script,style,template,select,option')) return;
      var t = T(el.textContent); if (!t) return;
      if (/[^\s@]+@[^\s@]+\.[a-z]{2,}/i.test(t)) tag(el);
      else if (PHONE.test(t) && !/RM\s?\d/.test(t)) tag(el);
      else if (/\b(BIN|BINTI|BTE|BT|A\/L|A\/P)\b/i.test(t) && t.length < 90 && !el.closest('label,button,nav,aside,th')) tag(el);
    });
    document.querySelectorAll('a.__cf_email__, [data-cfemail]').forEach(function (a) { a.removeAttribute('data-cfemail'); a.textContent = '<email>'; n++; });
    document.querySelectorAll('img').forEach(function (im) { var s = im.getAttribute('src') || ''; if (/ui-avatars|avatar|storage\/(avatars|profile|duta)/.test(s)) { im.setAttribute('src', 'data:image/gif;base64,R0lGODlhAQABAAAAACw='); im.setAttribute('alt', '<person>'); n++; } });
    return 'r10mask: ' + n;
  }
  var R10MASK = '(' + mask.toString() + ')()';
  var SAN = { selectors: ['.r10n'], titleName: false };
  window.__R10_HELPERS = { MASK: R10MASK, SAN: SAN };
  function J(group, file, url, state, actions, extra, opts) {
    var s = file.split('-')[0];
    var j = { group: group, file: file, url: B + url, actions: (actions || []).concat([{ wait: 500 }, { eval: R10MASK }]), sanitize: SAN, settle: 500,
              opts: Object.assign({ state: state, prefix: 'EL-R10-' + s, redact: [] }, opts || {}) };
    Object.assign(j, extra || {});
    j.opts.state = state + (j.width === 375 ? ' @375' : j.width === 768 ? ' @768' : '');
    jobs.push(j);
  }
  var M = { width: 375 }, T = { width: 768 };
  var RC = null; // 6 cells only: every cell is inventoried (no row sampling)

  // ---------------- S1 /buku-nota/heatmap "Heatmap Topik Lemah" ----------------
  J('A', 'S1-heatmap-topik-lemah__default__1280', '/buku-nota/heatmap', 'admin account data (6 topic cells in 2 subjects; Cikgu Pakar card masked)', [], null, RC);
  J('A', 'S1-heatmap-topik-lemah__default__768', '/buku-nota/heatmap', 'default', [], T, RC);
  J('A', 'S1-heatmap-topik-lemah__default__375', '/buku-nota/heatmap', 'default', [], M, RC);

  // ---------------- S2 /admin-sekolah/dskp-heatmap (302 → /admin-sekolah/pilih-sekolah → 500 for admin) ----------------
  J('B', 'S2-dskp-heatmap__admin-500__1280', '/admin-sekolah/dskp-heatmap', 'admin: 302 → /admin-sekolah/pilih-sekolah → 500 "Ralat Pelayan" (content not reachable)', []);
  J('B', 'S2-dskp-heatmap__admin-500__768', '/admin-sekolah/dskp-heatmap', 'admin: 302 → 500', [], T);
  J('B', 'S2-dskp-heatmap__admin-500__375', '/admin-sekolah/dskp-heatmap', 'admin: 302 → 500', [], M);

  // ---------------- S3 /admin-sekolah/laporan-bulanan (302 → /admin-sekolah/pilih-sekolah → 500 for admin) ----------------
  J('C', 'S3-laporan-bulanan__admin-500__1280', '/admin-sekolah/laporan-bulanan', 'admin: 302 → /admin-sekolah/pilih-sekolah → 500 "Ralat Pelayan" (content not reachable)', []);
  J('C', 'S3-laporan-bulanan__admin-500__768', '/admin-sekolah/laporan-bulanan', 'admin: 302 → 500', [], T);
  J('C', 'S3-laporan-bulanan__admin-500__375', '/admin-sekolah/laporan-bulanan', 'admin: 302 → 500', [], M);

  window.__R10_JOBS = jobs;
})();
