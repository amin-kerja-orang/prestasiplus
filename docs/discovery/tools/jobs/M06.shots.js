// M06 masked screenshot plan → docs/discovery/img/M06/. Load tools/jobs/M06.js FIRST (it exposes window.__M06_HELPERS),
// then addScriptTag(this file), then browser_run_code_unsafe{filename: tools/shoot.js}.
// Every shot runs M06MASK (Duta card name/initials/slug, structured-set author + school) and then tools/sanitize.js.
// Pre-start pages only; client-side reveals only. No quiz / mock / walkthrough is started or submitted.
(function () {
  var B = 'https://prestasiplus.my', D = 'docs/discovery/img/M06/';
  var H = window.__M06_HELPERS;
  var MK = { eval: H.MASK };
  var W = function (ms) { return { wait: ms || 500 }; };
  var S = [];
  function s(file, url, width, actions, extra) { S.push(Object.assign({ file: D + file, url: B + url, width: width || 1280, actions: [MK].concat(actions || []), sanitize: true }, extra || {})); }
  var VP = { fullPage: false };
  s('spm-hub-desktop.png', '/spm', 1280);
  s('spm-hub-tablet.png', '/spm', 768, [], VP);
  s('spm-hub-mobile.png', '/spm', 375);
  s('databank-desktop.png', '/spm/tahun-lepas', 1280);
  s('databank-mobile.png', '/spm/tahun-lepas', 375, [], VP);
  s('latih-tubi-desktop.png', '/spm/latih-tubi', 1280);
  s('latih-tubi-mobile.png', '/spm/latih-tubi', 375, [], VP);
  s('latih-tubi-subject-math.png', '/spm/latih-tubi/MATH', 1280);
  s('latih-tubi-subject-t5-sukar.png', '/spm/latih-tubi/MATH', 1280, [{ click: 'main [\\@click*="selectedLevel === 11"]' }, W(), { click: 'main [\\@click*="selectedDifficulty === 4"]' }, W()]);
  s('latih-tubi-subject-free-count.png', '/spm/latih-tubi/PERNIAGA', 1280);
  s('latih-tubi-subject-mobile.png', '/spm/latih-tubi/MATH', 375);
  s('tracking-a-desktop.png', '/spm/ramalan', 1280);
  s('tracking-a-mobile.png', '/spm/ramalan', 375, [], VP);
  s('tracking-a-subject-geo.png', '/spm/ramalan/GEO', 1280);
  s('tracking-a-subject-akaun.png', '/spm/ramalan/AKAUN', 1280, [], VP);
  s('tracking-a-subject-empty-ba.png', '/spm/ramalan/BA', 1280, [], VP);
  s('tracking-a-subject-mobile.png', '/spm/ramalan/GEO', 375, [], VP);
  s('tracking-bahasa-desktop.png', '/latihan-berstruktur?subject_id=1&scope=spm&track=bahasa', 1280, [], VP);
  s('tracking-bahasa-mobile.png', '/latihan-berstruktur?subject_id=1&scope=spm&track=bahasa', 375, [], VP);
  s('subjektif-desktop.png', '/spm/subjektif', 1280);
  s('subjektif-tab-core.png', '/spm/subjektif', 1280, [{ click: "main [\\@click=\"tab = 'core'\"]" }, W()], VP);
  s('subjektif-mobile.png', '/spm/subjektif', 375, [], VP);
  s('subjektif-list-desktop.png', '/latihan-berstruktur?subject_id=3&scope=spm', 1280, [], VP);
  s('subjektif-list-mobile.png', '/latihan-berstruktur?subject_id=3&scope=spm', 375, [], VP);
  s('history-desktop.png', '/spm/history', 1280);
  s('history-empty.png', '/spm/history?type=ramalan', 1280, [], VP);
  s('history-mobile.png', '/spm/history', 375);
  s('mock-desktop.png', '/spm-mock', 1280);
  s('mock-mobile.png', '/spm-mock', 375);
  s('mock-result-desktop.png', '/spm-mock/16/result', 1280, [], VP);
  s('mock-result-mobile.png', '/spm-mock/16/result', 375, [], VP);
  s('walkthrough-desktop.png', '/pusat-ai/spm', 1280);
  s('walkthrough-mobile.png', '/pusat-ai/spm', 375);
  s('not-found-404.png', '/spm/latih-tubi/XYZ', 1280, [], VP);
  window.__shots = S;
})();
