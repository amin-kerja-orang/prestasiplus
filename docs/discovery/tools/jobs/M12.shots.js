// M12 masked screenshot plan → docs/discovery/img/M12/. Load tools/jobs/M12.js FIRST (it exposes window.__M12_HELPERS),
// then addScriptTag(this file), then browser_run_code_unsafe{filename: tools/shoot.js}.
// Every shot runs the client-side reveal actions, then M12MASK (student names, school names/codes, avatars, ids), then
// tools/sanitize.js {selectors:['.m12n'], titleName:false} — personal data is scrubbed from the DOM before the pixels are taken.
// Read-only: no export link, no form submit.
(function () {
  var B = 'https://prestasiplus.my', D = 'docs/discovery/img/M12/';
  var H = window.__M12_HELPERS;
  var MK = { eval: H.MASK };
  var W = function (ms) { return { wait: ms || 500 }; };
  function EV(js) { return { eval: '(() => { ' + js + ' })()' }; }
  var S = [];
  function s(file, url, width, actions, extra) { S.push(Object.assign({ file: D + file, url: B + url, width: width || 1280, actions: (actions || []).concat([MK]), sanitize: H.SAN }, extra || {})); }
  var VP = { fullPage: false };
  var FORCE = EV("var d = document.querySelector('main [x-show=\"open\"]'); d.hidden = false; d.removeAttribute('style'); d.style.display = 'block'; return 'forced';");
  s('overview-desktop.png', '/admin/kirkpatrick', 1280);
  s('overview-tablet.png', '/admin/kirkpatrick', 768, [], VP);
  s('overview-mobile.png', '/admin/kirkpatrick', 375);
  s('overview-school-decline.png', '/admin/kirkpatrick?school_id=8080', 1280);
  s('overview-state-empty.png', '/admin/kirkpatrick?state=Kelantan', 1280);
  s('reaction-desktop.png', '/admin/kirkpatrick/reaction', 1280, [], VP);
  s('reaction-mobile.png', '/admin/kirkpatrick/reaction', 375, [], VP);
  s('learning-desktop.png', '/admin/kirkpatrick/learning', 1280);
  s('learning-mobile.png', '/admin/kirkpatrick/learning', 375, [], VP);
  s('behavior-desktop.png', '/admin/kirkpatrick/behavior', 1280);
  s('behavior-mobile.png', '/admin/kirkpatrick/behavior', 375, [], VP);
  s('behavior-school.png', '/admin/kirkpatrick/behavior?school_id=8080', 1280);
  s('results-top.png', '/admin/kirkpatrick/results', 1280, [], { fullPage: false, height: 1400, settle: 1500 });
  s('results-alesa.png', '/admin/kirkpatrick/results', 1280, [], { clip: 'main > div.card:has(h3 i.fa-crystal-ball)', settle: 1500 });
  s('results-roi-insight.png', '/admin/kirkpatrick/results', 1280, [EV("document.querySelector('main > div.card:has(i.fa-coins)').scrollIntoView(); return 'ok';"), W(300)], { fullPage: false, settle: 1500 });
  s('results-mobile.png', '/admin/kirkpatrick/results', 375, [], { fullPage: false, height: 1400, settle: 1500 });
  s('chain-desktop.png', '/admin/kirkpatrick/chain', 1280);
  s('chain-tablet.png', '/admin/kirkpatrick/chain', 768);
  s('chain-mobile.png', '/admin/kirkpatrick/chain', 375);
  s('interventions-desktop.png', '/admin/kirkpatrick/interventions', 1280, [], VP);
  s('interventions-mobile.png', '/admin/kirkpatrick/interventions', 375, [], VP);
  s('interventions-form-forced.png', '/admin/kirkpatrick/interventions', 1280, [FORCE, W(300)]);
  s('interventions-405.png', '/admin/kirkpatrick/interventions/1', 1280, [], VP);
  s('pelajar-desktop.png', '/admin/kirkpatrick/pelajar/4664', 1280);
  s('pelajar-mobile.png', '/admin/kirkpatrick/pelajar/4664', 375);
  s('pelajar-403.png', '/admin/kirkpatrick/pelajar/99999999', 1280, [], VP);
  s('prestasi-saya-desktop.png', '/kirkpatrick', 1280);
  s('prestasi-saya-mobile.png', '/kirkpatrick', 375);
  s('maklum-balas-submitted.png', '/maklum-balas', 1280, [], VP);
  window.__shots = S;
})();
