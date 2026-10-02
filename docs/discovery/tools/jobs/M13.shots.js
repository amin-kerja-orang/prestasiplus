// M13 masked screenshot plan → docs/discovery/img/M13/. Load tools/jobs/M13.js FIRST (it exposes window.__M13_HELPERS),
// then addScriptTag(this file), then browser_run_code_unsafe{filename: tools/shoot.js}.
// Every shot runs the client-side reveal actions, then M13MASK (the three teacher names in the /cikgu header), then
// tools/sanitize.js (shell user name / e-mail). Read-only: no chat send, no mic, no RPH/PBD submit, no export link.
(function () {
  var B = 'https://prestasiplus.my', D = 'docs/discovery/img/M13/';
  var H = window.__M13_HELPERS;
  var MK = { eval: H.MASK };
  var S = [];
  function s(file, url, width, actions, extra) { S.push(Object.assign({ file: D + file, url: B + url, width: width || 1280, actions: (actions || []).concat([MK]), sanitize: true }, extra || {})); }
  var VP = { fullPage: false };
  s('chat-desktop.png', '/cikgu', 1280);
  s('chat-tablet.png', '/cikgu', 768, [], VP);
  s('chat-mobile.png', '/cikgu', 375);
  s('chat-ask-prefill.png', '/cikgu?ask=' + encodeURIComponent('Terangkan pecahan setara'), 1280, [], VP);
  s('rph-list-desktop.png', '/cikgu/rph', 1280, [], VP);
  s('rph-list-mobile.png', '/cikgu/rph', 375, [], VP);
  s('rph-list-page2-mobile.png', '/cikgu/rph?page=2', 375);
  s('rph-baharu-desktop.png', '/cikgu/rph/baharu', 1280);
  s('rph-baharu-tablet.png', '/cikgu/rph/baharu', 768);
  s('rph-baharu-mobile.png', '/cikgu/rph/baharu', 375);
  s('essay-list-desktop.png', '/cikgu/essay', 1280, [], VP);
  s('essay-list-page2.png', '/cikgu/essay?page=2', 1280, [], VP);
  s('essay-list-mobile.png', '/cikgu/essay', 375, [], VP);
  s('essay-baharu-desktop.png', '/cikgu/essay/baharu', 1280);
  s('essay-baharu-typed.png', '/cikgu/essay/baharu', 1280, [{ type: ['#essay_text', 'satu dua tiga empat lima'] }, { wait: 300 }], VP);
  s('essay-baharu-mobile.png', '/cikgu/essay/baharu', 375);
  s('pbd-desktop.png', '/cikgu/pbd', 1280, [], VP);
  s('pbd-tablet.png', '/cikgu/pbd', 768, [], VP);
  s('pbd-mobile.png', '/cikgu/pbd', 375, [], VP);
  s('not-found-404.png', '/cikgu/rph/1', 1280, [], VP);
  s('method-not-allowed-405.png', '/cikgu/send', 1280, [], VP);
  window.__shots = S;
})();
