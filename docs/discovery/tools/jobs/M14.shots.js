// M14 masked screenshot plan → docs/discovery/img/M14/. Load tools/jobs/M14.js FIRST (it exposes window.__M14_HELPERS),
// then addScriptTag(this file), then browser_run_code_unsafe{filename: tools/shoot.js}.
// Every shot runs the client-side reveal actions, then M14MASK (person names, avatars, bank data, school names), an extra
// pass that blanks every "Sekolah" table cell (guru leaderboard), then tools/sanitize.js {selectors:['.m14n'], titleName:false}.
// S6 (/admin/gamifikasi/guru) has no personal data and skips sanitize.js so the badge names stay (as in M14.js).
// Read-only: no form submit, no convert / claim / tebus / award / save click. Only client-side reveals.
(function () {
  var B = 'https://prestasiplus.my', D = 'docs/discovery/img/M14/';
  var H = window.__M14_HELPERS;
  var MK = { eval: H.MASK };
  var SCH = { eval: "(() => { var n = 0; document.querySelectorAll('main table').forEach(function (t) { var i = -1; t.querySelectorAll('thead th').forEach(function (h, k) { if (/^Sekolah$/i.test(h.textContent.trim())) i = k; }); if (i < 0) return; t.querySelectorAll('tbody tr').forEach(function (tr) { if (tr.children[i]) { tr.children[i].textContent = '<school>'; n++; } }); }); return 'school cells: ' + n; })()" };
  var W = function (ms) { return { wait: ms || 500 }; };
  function EV(js) { return { eval: '(() => { ' + js + ' })()' }; }
  function CLK(sel) { return EV("var e = document.querySelector(" + JSON.stringify(sel) + "); if (e) e.click(); return 'ok';"); }
  var S = [];
  function s(file, url, width, actions, extra) {
    var o = Object.assign({ file: D + file, url: B + url, width: width || 1280, actions: (actions || []).concat([MK, SCH]), sanitize: H.SAN }, extra || {});
    if (/^admin-guru-/.test(file) && !/tebusan|tunai|pengaturan/.test(file)) o.sanitize = false;
    S.push(o);
  }
  var VP = { fullPage: false };
  // admin
  s('admin-overview-desktop.png', '/admin/gamification', 1280);
  s('admin-overview-mobile.png', '/admin/gamification', 375);
  s('admin-tiers-desktop.png', '/admin/gamification/tiers', 1280, [], VP);
  s('admin-tiers-mobile.png', '/admin/gamification/tiers', 375, [], VP);
  s('admin-challenges-desktop.png', '/admin/gamification/challenges', 1280, [], VP);
  s('admin-challenges-mobile.png', '/admin/gamification/challenges', 375, [], VP);
  s('admin-students-desktop.png', '/admin/gamification/students', 1280, [], VP);
  s('admin-students-mobile.png', '/admin/gamification/students', 375, [], VP);
  s('admin-students-empty.png', '/admin/gamification/students?search=zzzq', 1280, [], VP);
  s('admin-transactions-desktop.png', '/admin/gamification/transactions', 1280, [], VP);
  s('admin-transactions-mobile.png', '/admin/gamification/transactions', 375, [], VP);
  s('admin-transactions-empty.png', '/admin/gamification/transactions?type=refund', 1280, [], VP);
  s('admin-guru-desktop.png', '/admin/gamifikasi/guru', 1280);
  s('admin-guru-badge-edit.png', '/admin/gamifikasi/guru', 1280, [CLK('main tbody[x-data] button'), W()], VP);
  s('admin-guru-ganjaran-form.png', '/admin/gamifikasi/guru', 1280, [CLK('main [x-data*="showForm"] > button'), W()]);
  s('admin-guru-mobile.png', '/admin/gamifikasi/guru', 375);
  s('admin-guru-tebusan.png', '/admin/gamifikasi/guru/tebusan', 1280, [], VP);
  s('admin-guru-tunai-desktop.png', '/admin/gamifikasi/guru/tunai', 1280, [], VP);
  s('admin-guru-tunai-mobile.png', '/admin/gamifikasi/guru/tunai', 375, [], VP);
  s('admin-pengaturan-desktop.png', '/admin/gamifikasi/pengaturan', 1280);
  s('admin-pengaturan-mobile.png', '/admin/gamifikasi/pengaturan', 375, [], VP);
  s('admin-reward-control-desktop.png', '/admin/reward-control', 1280, [CLK('main details summary'), W()]);
  s('admin-reward-control-mobile.png', '/admin/reward-control', 375, [], VP);
  // student
  s('gamification-desktop.png', '/gamification', 1280);
  s('gamification-tablet.png', '/gamification', 768, [], VP);
  s('gamification-mobile.png', '/gamification', 375);
  s('convert-desktop.png', '/gamification/convert', 1280);
  s('convert-below-min.png', '/gamification/convert', 1280, [{ fill: ['#syilingInput', ''] }, { type: ['#syilingInput', '30'] }, W(300)], VP);
  s('convert-mobile.png', '/gamification/convert', 375);
  s('challenges-desktop.png', '/gamification/challenges', 1280, [], VP);
  s('challenges-mobile.png', '/gamification/challenges', 375, [], VP);
  s('leaderboard-desktop.png', '/gamification/leaderboard', 1280, [], VP);
  s('leaderboard-mobile.png', '/gamification/leaderboard', 375, [], VP);
  s('achievements-desktop.png', '/gamification/achievements', 1280);
  s('achievements-mobile.png', '/gamification/achievements', 375, [], VP);
  s('achievements-share-modal.png', '/gamification/achievements', 1280, [EV("openShareCard('👣','Langkah Pertama','Jawab kuiz pertama anda','common','#9ca3af','Biasa',5,3); return 'opened';"), W()], VP);
  s('referral-desktop.png', '/gamification/referral', 1280);
  s('referral-mobile.png', '/gamification/referral', 375);
  s('history-desktop.png', '/gamification/history', 1280);
  s('history-empty.png', '/gamification/history?type=spend', 1280, [], VP);
  s('history-mobile.png', '/gamification/history', 375, [], VP);
  s('kad-kongsi-profil.png', '/gamification/kad-kongsi', 1280, [], VP);
  s('kad-kongsi-kombo.png', '/gamification/kad-kongsi', 1280, [CLK("main button[\\@click=\"tab='kombo'\"]"), W()], VP);
  s('kad-kongsi-penguasaan.png', '/gamification/kad-kongsi', 1280, [CLK("main button[\\@click=\"tab='penguasaan'\"]"), W()], VP);
  s('kad-kongsi-ranking.png', '/gamification/kad-kongsi', 1280, [CLK("main button[\\@click=\"tab='ranking'\"]"), W()], VP);
  s('kad-kongsi-mobile.png', '/gamification/kad-kongsi', 375, [], VP);
  // teacher
  s('guru-gamifikasi-desktop.png', '/guru/gamifikasi', 1280);
  s('guru-gamifikasi-mobile.png', '/guru/gamifikasi', 375, [], VP);
  s('guru-tebus-tunai-desktop.png', '/guru/gamifikasi/tebus-tunai', 1280);
  s('guru-tebus-tunai-preview.png', '/guru/gamifikasi/tebus-tunai', 1280, [{ click: 'main form button[type=button]:nth-child(2)' }, W(300)], VP);
  s('guru-tebus-tunai-mobile.png', '/guru/gamifikasi/tebus-tunai', 375, [], VP);
  s('guru-kedai.png', '/guru/gamifikasi/kedai', 1280, [], VP);
  s('guru-leaderboard-sekolah.png', '/guru/gamifikasi/leaderboard', 1280, [], VP);
  s('guru-leaderboard-global.png', '/guru/gamifikasi/leaderboard?tab=global', 1280, [], VP);
  s('guru-leaderboard-mobile.png', '/guru/gamifikasi/leaderboard?tab=global', 375, [], VP);
  window.__shots = S;
})();
