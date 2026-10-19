// M18 masked screenshot plan → docs/discovery/img/M18/. Load tools/jobs/M18.js FIRST (window.__M18_HELPERS), then
// addScriptTag(this file), then browser_run_code_unsafe{filename: tools/shoot.js}.
// Every shot runs the client-side reveal actions, then M18MASK (person names, e-mails, avatars, intervention notes, the
// student name in the intervention title) and tools/sanitize.js {selectors:['.m18n'], keepCols:'^pelajar$', titleName:false}
// (masks Nama / Nama Pelajar / No. IC / Email / Guru columns). Read-only: no download link, no print, no form submit,
// no effectiveness <select>, no "Tunjuk IC Penuh".
(function () {
  var B = 'https://prestasiplus.my', D = 'docs/discovery/img/M18/';
  var H = window.__M18_HELPERS;
  var MK = { eval: H.MASK };
  var W = function (ms) { return { wait: ms || 500 }; };
  function EV(js) { return { eval: '(() => { ' + js + ' })()' }; }
  function BTN(re) { return EV("var b = Array.from(document.querySelectorAll('main button')).find(function (x) { return " + re + ".test(x.textContent.replace(/\\s+/g, ' ').trim()); }); if (b) b.click(); return 'ok';"); }
  function AT(re) { return EV("var b = Array.from(document.querySelectorAll('main button')).find(function (x) { return " + re + ".test(x.getAttribute('@click') || ''); }); if (b) b.click(); return 'ok';"); }
  var S = [];
  function s(file, url, width, actions, extra) { S.push(Object.assign({ file: D + file, url: B + url, width: width || 1280, actions: (actions || []).concat([MK]), sanitize: H.SAN, settle: 700 }, extra || {})); }
  var VP = { fullPage: false };
  s('ppd-dashboard-desktop.png', '/ppd/dashboard', 1280);
  s('ppd-dashboard-tablet.png', '/ppd/dashboard', 768, [], VP);
  s('ppd-dashboard-mobile.png', '/ppd/dashboard', 375);
  s('ppd-command-center-403.png', '/ppd/command-center', 1280);
  s('ppd-statistik-desktop.png', '/ppd/statistik-penggunaan', 1280);
  s('ppd-statistik-mobile.png', '/ppd/statistik-penggunaan', 375);
  s('ppd-ranking-desktop.png', '/ppd/ranking-kebangsaan', 1280);
  s('ppd-ranking-mobile.png', '/ppd/ranking-kebangsaan', 375);
  s('ppd-benchmark-desktop.png', '/ppd/benchmark-sekolah', 1280, [], VP);
  s('ppd-benchmark-mobile.png', '/ppd/benchmark-sekolah', 375, [], VP);
  s('ppd-peta-haba-desktop.png', '/ppd/peta-haba', 1280, [], VP);
  s('ppd-peta-haba-mobile.png', '/ppd/peta-haba', 375, [], VP);
  s('ppd-export-desktop.png', '/ppd/export-laporan', 1280);
  s('ppd-export-mobile.png', '/ppd/export-laporan', 375);
  s('ppd-leaderboard-desktop.png', '/ppd/leaderboard-sekolah', 1280, [], VP);
  s('ppd-leaderboard-tablet.png', '/ppd/leaderboard-sekolah', 768, [], VP);
  s('ppd-leaderboard-mobile.png', '/ppd/leaderboard-sekolah', 375, [], VP);
  s('ppd-leaderboard-tab-subjek.png', '/ppd/leaderboard-sekolah', 1280, [BTN('/^Ikut Subjek$/'), W()], VP);
  s('ppd-sekolah-desktop.png', '/ppd/sekolah/8880', 1280);
  s('ppd-sekolah-mobile.png', '/ppd/sekolah/8880', 375, [], VP);
  s('ppd-sekolah-class-open.png', '/ppd/sekolah/8880', 1280, [AT('/^open = !open$/'), W(), EV("var e = document.getElementById('sec-pelajar'); if (e) e.scrollIntoView(); return 'ok';")], VP);
  s('jpn-dashboard-desktop.png', '/jpn/dashboard', 1280, [], VP);
  s('jpn-dashboard-mobile.png', '/jpn/dashboard', 375, [], VP);
  s('jpn-dashboard-search.png', '/jpn/dashboard', 1280, [{ type: ['#school-search-input', 'KLUANG'] }, W(700)], VP);
  s('jpn-command-center-desktop.png', '/jpn/command-center', 1280, [W(1500)]);
  s('jpn-command-center-mobile.png', '/jpn/command-center', 375, [W(1500)]);
  s('jpn-statistik-desktop.png', '/jpn/statistik-penggunaan', 1280);
  s('jpn-ranking-desktop.png', '/jpn/ranking-kebangsaan', 1280);
  s('jpn-ranking-mobile.png', '/jpn/ranking-kebangsaan', 375, [], VP);
  s('jpn-daerah-desktop.png', '/jpn/daerah/PPD%20KLUANG', 1280);
  s('jpn-sekolah-desktop.png', '/jpn/sekolah/8765', 1280, [], VP);
  s('amaran-desktop.png', '/amaran', 1280, [], VP);
  s('amaran-mobile.png', '/amaran', 375, [], VP);
  s('amaran-kelas-desktop.png', '/amaran/kelas/1156', 1280);
  s('amaran-kelas-mobile.png', '/amaran/kelas/1156', 375);
  s('amaran-ppd-desktop.png', '/amaran/ppd', 1280, [], VP);
  s('amaran-ppd-mobile.png', '/amaran/ppd', 375, [], VP);
  s('amaran-jpn-desktop.png', '/amaran/jpn', 1280, [], VP);
  s('amaran-keberkesanan-ppd-desktop.png', '/amaran/keberkesanan/ppd', 1280);
  s('amaran-keberkesanan-ppd-mobile.png', '/amaran/keberkesanan/ppd', 375);
  s('amaran-keberkesanan-desktop.png', '/amaran/keberkesanan', 1280);
  s('amaran-sekolah-desktop.png', '/amaran/sekolah/7780', 1280, [], VP);
  s('amaran-ringkasan-desktop.png', '/amaran/ringkasan-eksekutif?scope=district&district=PPD%20BATANG%20PADANG&state=Perak', 1280);
  s('amaran-ringkasan-mobile.png', '/amaran/ringkasan-eksekutif?scope=school&school_id=8880', 375);
  s('amaran-intervensi-desktop.png', '/amaran/intervensi/2229', 1280);
  s('amaran-intervensi-mobile.png', '/amaran/intervensi/2229', 375, [], VP);
  s('analisa-item-ppd-desktop.png', '/analisa-item/ppd', 1280, [], VP);
  s('analisa-item-ppd-mobile.png', '/analisa-item/ppd', 375, [], VP);
  s('analisa-item-jpn-desktop.png', '/analisa-item/jpn', 1280, [], VP);
  s('sekolah-prestasi-desktop.png', '/sekolah/8880/prestasi', 1280);
  s('sekolah-prestasi-mobile.png', '/sekolah/8880/prestasi', 375, [], VP);
  s('sekolah-amaran-desktop.png', '/sekolah/8880/amaran', 1280, [], VP);
  s('sekolah-kombo-desktop.png', '/sekolah/8880/kombo', 1280);
  s('sekolah-kombo-mobile.png', '/sekolah/8880/kombo', 375, [], VP);
  s('sekolah-analisa-item-desktop.png', '/sekolah/8880/analisa-item', 1280, [], VP);
  s('sekolah-analisa-item-mobile.png', '/sekolah/8880/analisa-item', 375, [], VP);
  s('sekolah-analisa-item-open.png', '/sekolah/8880/analisa-item', 1280, [EV("var c = document.querySelector('main .space-y-4.mt-3 > div.rounded-2xl'); if (c) { c.click(); c.scrollIntoView(); } return 'ok';"), W()], VP);
  window.__shots = S;
})();
// group E (kombo officer views), appended after the first run
(function () {
  var H = window.__M18_HELPERS, B = 'https://prestasiplus.my', D = 'docs/discovery/img/M18/';
  [['kombo-ppd-desktop.png', '/kombo/ppd', 1280, false], ['kombo-ppd-mobile.png', '/kombo/ppd', 375, false], ['kombo-jpn-desktop.png', '/kombo/jpn', 1280, false],
   ['kombo-sekolah-desktop.png', '/kombo/sekolah/7780', 1280, true], ['kombo-sekolah-mobile.png', '/kombo/sekolah/7780', 375, true], ['kombo-sekolah-500.png', '/kombo/sekolah/99999999', 1280, true]].forEach(function (x) {
    window.__shots.push({ file: D + x[0], url: B + x[1], width: x[2], actions: [{ eval: H.MASK }], sanitize: H.SAN, settle: 700, fullPage: x[3] });
  });
})();
