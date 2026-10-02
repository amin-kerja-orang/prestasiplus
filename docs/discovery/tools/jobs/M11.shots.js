// M11 masked screenshot plan → docs/discovery/img/M11/. Load tools/jobs/M11.js FIRST (it exposes window.__M11_HELPERS),
// then addScriptTag(this file), then browser_run_code_unsafe{filename: tools/shoot.js}.
// Every shot runs the client-side reveal actions, then M11MASK (person names, school names/codes, avatars, ids), then
// tools/sanitize.js {selectors:['.m11n'], titleName:false} — personal data is scrubbed from the DOM before the pixels are taken.
// Read-only: no export link, no form submit, no quiz link.
(function () {
  var B = 'https://prestasiplus.my', D = 'docs/discovery/img/M11/';
  var H = window.__M11_HELPERS;
  var MK = { eval: H.MASK };
  var W = function (ms) { return { wait: ms || 500 }; };
  function EV(js) { return { eval: '(() => { ' + js + ' })()' }; }
  function CLK(sel) { return EV("var e = document.querySelector(" + JSON.stringify(sel) + "); if (e) e.click(); return 'ok';"); }
  var S = [];
  function s(file, url, width, actions, extra) { S.push(Object.assign({ file: D + file, url: B + url, width: width || 1280, actions: (actions || []).concat([MK]), sanitize: H.SAN }, extra || {})); }
  var VP = { fullPage: false };
  var P = '/guru/monitoring/sekolah/8080/pelajar/';
  s('laporan-desktop.png', '/guru/laporan', 1280);
  s('laporan-tablet.png', '/guru/laporan', 768, [], VP);
  s('laporan-mobile.png', '/guru/laporan', 375);
  s('laporan-card-login.png', '/guru/laporan', 1280, [CLK("main [\\@click*=\"'login'\"]"), W(700)], VP);
  s('laporan-card-aktiviti.png', '/guru/laporan', 1280, [CLK("main [\\@click*=\"'aktiviti'\"]"), W(700)], VP);
  s('laporan-card-skor.png', '/guru/laporan', 1280, [CLK("main [\\@click*=\"'skor'\"]"), W(700)], VP);
  s('monitoring-desktop.png', '/guru/monitoring', 1280);
  s('monitoring-tablet.png', '/guru/monitoring', 768, [], VP);
  s('monitoring-mobile.png', '/guru/monitoring', 375, [], VP);
  s('monitoring-mobile-tables.png', '/guru/monitoring', 375, [EV("document.getElementById('section-pelajar').scrollIntoView(); return 'ok';"), W(400)], VP);
  s('monitoring-guide-hidden.png', '/guru/monitoring', 1280, [EV("Alpine.$data(document.querySelector('main [x-data*=showGuide]')).showGuide = false; return 'ok';"), W(400)], VP);
  s('monitoring-filter-empty.png', '/guru/monitoring?state=Kelantan&tahap=Cemerlang', 1280);
  s('sekolah-desktop.png', '/guru/monitoring/sekolah/8080', 1280, [], VP);
  s('sekolah-filter-never.png', '/guru/monitoring/sekolah/8080', 1280, [CLK('main button[\\@click="studentFilter = \'never\'"]'), W()], VP);
  s('sekolah-mobile.png', '/guru/monitoring/sekolah/8080', 375, [], VP);
  s('sekolah-no-teacher.png', '/guru/monitoring/sekolah/940', 1280);
  s('pelajar-desktop.png', P + '2008', 1280);
  s('pelajar-topic.png', P + '2008', 1280, [CLK('main button[\\@click="tab = \'topic\'"]'), W()], VP);
  s('pelajar-senarai.png', P + '2008', 1280, [CLK('main button[\\@click="tab = \'all\'"]'), W()], VP);
  s('pelajar-wrong.png', P + '2008', 1280, [CLK('main button[\\@click="tab = \'wrong\'"]'), W()], VP);
  s('pelajar-gaps-blank.png', P + '5552', 1280, [CLK('main button[\\@click="tab = \'gaps\'"]'), W()]);
  s('pelajar-modal.png', P + '2008', 1280, [CLK('main button[\\@click="tab = \'all\'"]'), W(), CLK('main tbody tr'), W(600)], VP);
  s('pelajar-mobile.png', P + '2008', 375);
  s('pelajar-modal-mobile.png', P + '2008', 375, [CLK('main button[\\@click="tab = \'all\'"]'), W(), CLK('main tbody tr'), W(600)], VP);
  s('guru-desktop.png', '/guru/monitoring/sekolah/8080/guru/2329', 1280, [], VP);
  s('guru-mobile.png', '/guru/monitoring/sekolah/8080/guru/2329', 375, [], VP);
  s('analisis-item-desktop.png', '/guru/analisis-item', 1280);
  s('analisis-item-tablet.png', '/guru/analisis-item', 768);
  s('analisis-item-mobile.png', '/guru/analisis-item', 375);
  s('perbandingan-kelas-500.png', '/guru/perbandingan-kelas', 1280, [], VP);
  s('laporan-mingguan-kelas-403.png', '/guru/laporan-mingguan-kelas', 1280, [], VP);
  window.__shots = S;
})();
