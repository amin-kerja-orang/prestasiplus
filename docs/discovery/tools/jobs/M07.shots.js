// M07 masked screenshot plan → docs/discovery/img/M07/. Load tools/jobs/M07.js FIRST (it exposes window.__M07_HELPERS),
// then addScriptTag(this file), then browser_run_code_unsafe{filename: tools/shoot.js}.
// Every shot runs M07MASK (access list: Pengguna + Diberi Oleh cells) and then tools/sanitize.js {titleName:false}.
// Client-side reveals only; nothing is submitted. /pksk/level/{L}/exam and /domain/{CODE} are never opened.
(function () {
  var B = 'https://prestasiplus.my', D = 'docs/discovery/img/M07/';
  var H = window.__M07_HELPERS;
  var MK = { eval: H.MASK };
  var W = function (ms) { return { wait: ms || 500 }; };
  var S = [];
  function s(file, url, width, actions, extra) { S.push(Object.assign({ file: D + file, url: B + url, width: width || 1280, actions: [MK].concat(actions || [], [MK]), sanitize: { titleName: false } }, extra || {})); }
  var VP = { fullPage: false };
  var SEL = function (n, v) { return { select: ['main select[name=' + n + ']', v] }; };
  var TOG = { click: 'main button:has-text("Beri Akses Baru")' };
  s('pksk-hub-desktop.png', '/pksk', 1280);
  s('pksk-hub-tablet.png', '/pksk', 768, [], VP);
  s('pksk-hub-mobile.png', '/pksk', 375);
  s('level-dashboard-desktop.png', '/pksk/level/T1', 1280);
  s('level-dashboard-mobile.png', '/pksk/level/T1', 375, [], VP);
  s('domains-desktop.png', '/pksk/level/T1/domains', 1280);
  s('domains-mobile.png', '/pksk/level/T1/domains', 375, [], VP);
  s('history-500.png', '/pksk/level/T1/history', 1280, [], VP);
  s('questions-desktop.png', '/admin/pksk/questions', 1280);
  s('questions-bulk-bar.png', '/admin/pksk/questions', 1280, [{ check: 'main thead input[type=checkbox]' }, W()], VP);
  s('questions-empty.png', '/admin/pksk/questions?status=pending', 1280, [], VP);
  s('questions-tablet.png', '/admin/pksk/questions', 768, [], VP);
  s('questions-mobile.png', '/admin/pksk/questions', 375);
  s('create-desktop.png', '/admin/pksk/questions/create', 1280);
  s('create-bahagian-a.png', '/admin/pksk/questions/create', 1280, [SEL('bahagian', 'A'), W()]);
  s('create-bahagian-b-max.png', '/admin/pksk/questions/create', 1280, [SEL('bahagian', 'B'), W(), { click: 'main button:has-text("Tambah Pilihan")' }, W(200), { click: 'main button:has-text("Tambah Pilihan")' }, W()]);
  s('create-bahagian-c.png', '/admin/pksk/questions/create', 1280, [SEL('bahagian', 'C'), W()]);
  s('create-mobile.png', '/admin/pksk/questions/create', 375, [SEL('bahagian', 'B'), W()]);
  s('edit-desktop.png', '/admin/pksk/questions/178460/edit', 1280);
  s('edit-bahagian-c.png', '/admin/pksk/questions/178349/edit', 1280);
  s('edit-mobile.png', '/admin/pksk/questions/178460/edit', 375);
  s('access-desktop.png', '/admin/pksk/access', 1280);
  s('access-form-open.png', '/admin/pksk/access', 1280, [TOG, W()]);
  s('access-empty.png', '/admin/pksk/access?search=zzzzqqq', 1280, [], Object.assign({ sanitize: { titleName: false, keepCols: '.*' } }, VP));
  s('access-mobile.png', '/admin/pksk/access', 375, [TOG, W()]);
  window.__shots = S;
})();
