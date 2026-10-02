// M13 capture plan — Cikgu Alesa (AI teacher assistant). Every screen x every UI state that reveals different elements.
// Load:  browser_run_code_unsafe: async (page) => page.addScriptTag({ path: '<abs>/docs/discovery/tools/jobs/M13.js' })
// then:  browser_evaluate: () => { window.__jobs = window.__M13_JOBS.filter(j => j.group === 'A'); }
// then run tools/run-state.js, save window.__invs to docs/discovery/inventory/_raw/M13/_batch.json, split-batch.js, merge-inventory.js.
//
// SAFETY: live production admin, browser lane 1 (playwright). READ-ONLY. NO AI CALL.
//   - Never clicked / never submitted: chat "Hantar" (#cikgu-send → POST /cikgu/send), the mic 🎤 (#cikgu-mic: speech
//     recognition auto-submits the chat form on end when the input has > 5 chars), RPH "Jana RPH dengan Cikgu Alesa"
//     (POST /cikgu/rph), PBD "Jalankan Auto-Tag" (POST /cikgu/pbd/rollup), PBD "Lulus pukal (TP cadangan)"
//     (POST /cikgu/pbd/bulk-approve), and the "Eksport CSV (Approved)" link (/cikgu/pbd/export.csv; target recorded only).
//   - The voice-mode checkbox is set through the DOM property only (no 'change' event → localStorage is NOT written).
//   - RPH native validation is shown with form.reportValidity() (never submit; the required fields are empty).
//   - Essay "Hantar ke Cikgu Alesa" is clicked: it only runs client-side code (alert when < 50 chars, else writes
//     sessionStorage 'cikgu_pending_essay' and navigates by GET to /cikgu?action=mark_essay&…). /cikgu never auto-sends
//     (its only prefill script reads ?ask= into the input). The essay text used is a neutral dummy sentence.
//
// PERSONAL DATA: the /cikgu header names three real teachers ("Powered by <nama> · <nama> · <nama> + 50K+ soalan DSKP").
//   M13MASK replaces each name by '<nama>' structurally (split on ' · '), so no name is written in this file.
//   Then tools/sanitize.js (default options) masks the shell user name / e-mail. The M13 list tables are empty for admin.
(function () {
  var B = 'https://prestasiplus.my';
  var jobs = [];
  function mask() {
    var n = 0;
    document.querySelectorAll('.cikgu-alesa-shell header p').forEach(function (p) {
      var t = p.textContent, i = t.indexOf('Powered by '), j = t.indexOf(' + ');
      if (i >= 0 && j > i) {
        var names = t.slice(i + 11, j).split(' · ').map(function () { return '<nama>'; });
        p.textContent = t.slice(0, i + 11) + names.join(' · ') + t.slice(j); n++;
      }
    });
    // essay handoff query string may carry a student name (dummy here) → mask it in the location too
    if (/[?&]student=/.test(location.search)) { history.replaceState(null, '', location.href.replace(/([?&]student=)[^&]*/, '$1<nama>')); n++; }
    return 'm13mask: ' + n;
  }
  var M13MASK = '(' + mask.toString() + ')()';
  function J(group, file, url, state, actions, extra, opts) {
    var s = file.split('-')[0];
    var j = { group: group, file: file, url: url ? B + url : null, actions: (actions || []).concat([{ eval: M13MASK }]), sanitize: true,
              opts: Object.assign({ state: state, prefix: 'EL-M13-' + s, redact: [] }, opts || {}) };
    Object.assign(j, extra || {});
    j.opts.state = state + (j.width === 375 ? ' @375' : j.width === 768 ? ' @768' : '');
    jobs.push(j);
  }
  var M = { width: 375 }, T = { width: 768 };
  var W = function (ms) { return { wait: ms || 500 }; };
  function EV(js) { return { eval: '(() => { ' + js + ' })()' }; }
  var ALERT_HOOK = EV("window.alert = function (m) { document.body.setAttribute('data-m13-alert', m); }; return 'alert hooked';");
  var ALERT_READ = EV("return 'alert=' + (document.body.getAttribute('data-m13-alert') || '(none)');");
  var DUMMY = 'Ini ialah teks contoh untuk ujian sahaja dan bukan karangan sebenar oleh mana-mana pelajar.'; // 94 chars, 15 words

  // ---------------- S1 /cikgu (chat) ----------------
  J('A', 'S1-cikgu__default__1280', '/cikgu', 'default (greeting only; voice mode off; empty thread)');
  J('A', 'S1-cikgu__voice-on__1280', '/cikgu', 'voice-mode checkbox shown checked (DOM property only; no change event, localStorage untouched)', [EV("var c = document.getElementById('cikgu-voice-mode'); c.checked = true; return 'checked=' + c.checked + ' mic.disabled=' + document.getElementById('cikgu-mic').disabled + ' SR=' + !!(window.SpeechRecognition || window.webkitSpeechRecognition);")]);
  J('A', 'S1-cikgu__ask-prefill__1280', '/cikgu?ask=' + encodeURIComponent('Terangkan pecahan setara'), '?ask= prefill (input filled + focused; nothing sent)', [EV("return 'input=' + document.getElementById('cikgu-input').value + ' focused=' + (document.activeElement && document.activeElement.id);")]);
  J('A', 'S1-cikgu__essay-handoff__1280', '/cikgu/essay/baharu', 'arrived from S5 "Hantar ke Cikgu Alesa" (?action=mark_essay&rubric=…); /cikgu ignores the params and sessionStorage — input stays empty', [
    { select: ['#rubric_key', 'sejarah_essay'] }, { fill: ['#subject_name', 'Sejarah'] }, { fill: ['#level', 'T4'] }, { fill: ['#student_name', 'Contoh'] }, { fill: ['#essay_title', 'Contoh Tajuk'] },
    { fill: ['#essay_text', DUMMY] }, { click: 'button[onclick="submitToChat()"]' }, W(2500),
    EV("return 'url=' + location.pathname + location.search.replace(/student=[^&]*/, 'student=<nama>') + ' input=[' + document.getElementById('cikgu-input').value + '] pendingLen=' + (sessionStorage.getItem('cikgu_pending_essay') || '').length;"),
    EV("sessionStorage.removeItem('cikgu_pending_essay'); return 'pending essay removed';")]);
  J('A', 'S1-cikgu__default__375', '/cikgu', 'default', [], M);
  J('A', 'S1-cikgu__default__768', '/cikgu', 'default', [], T);

  // ---------------- S2 /cikgu/rph (list) ----------------
  J('B', 'S2-rph__default__1280', '/cikgu/rph', 'empty list (admin has no RPH)');
  J('B', 'S2-rph__page-2__1280', '/cikgu/rph?page=2', '?page=2 (same empty state; no pager)');
  J('B', 'S2-rph__default__375', '/cikgu/rph', 'default', [], M);
  J('B', 'S2-rph__default__768', '/cikgu/rph', 'default', [], T);

  // ---------------- S3 /cikgu/rph/baharu (create form) ----------------
  J('B', 'S3-rph-baharu__default__1280', '/cikgu/rph/baharu', 'no classroom linked → manual form ("Sistem belum jumpa kelas…")');
  J('B', 'S3-rph-baharu__classroom-param__1280', '/cikgu/rph/baharu?classroom_id=1', '?classroom_id=1 (ignored for admin; same form)');
  J('B', 'S3-rph-baharu__validity__1280', '/cikgu/rph/baharu', 'form.reportValidity() on the empty form (native bubbles; never submitted)', [EV("var f = document.getElementById('rph-create-form'); var bad = Array.from(f.elements).filter(function (e) { return e.willValidate && !e.checkValidity(); }).map(function (e) { return e.name + ': ' + e.validationMessage; }); f.reportValidity(); return 'invalid=' + JSON.stringify(bad) + ' novalidate=' + f.noValidate;")]);
  J('B', 'S3-rph-baharu__default__375', '/cikgu/rph/baharu', 'default', [], M);
  J('B', 'S3-rph-baharu__default__768', '/cikgu/rph/baharu', 'default', [], T);

  // ---------------- S4 /cikgu/essay (list) ----------------
  J('B', 'S4-essay__default__1280', '/cikgu/essay', 'empty list (admin has no marked essay)');
  J('B', 'S4-essay__page-2__1280', '/cikgu/essay?page=2', '?page=2 (same empty state; no pager)');
  J('B', 'S4-essay__default__375', '/cikgu/essay', 'default', [], M);
  J('B', 'S4-essay__default__768', '/cikgu/essay', 'default', [], T);

  // ---------------- S5 /cikgu/essay/baharu (essay form) ----------------
  J('B', 'S5-essay-baharu__default__1280', '/cikgu/essay/baharu', 'default (rubric = first option; counter "0 perkataan")');
  J('B', 'S5-essay-baharu__typed__1280', '/cikgu/essay/baharu', 'essay text typed (word counter updates on input)', [{ type: ['#essay_text', 'satu dua tiga empat lima'] }, W(300), EV("return document.getElementById('word-counter').textContent;")]);
  J('B', 'S5-essay-baharu__too-short__1280', '/cikgu/essay/baharu', '"Hantar ke Cikgu Alesa" with < 50 chars → alert, stays on page', [ALERT_HOOK, { fill: ['#essay_text', 'terlalu pendek'] }, { click: 'button[onclick="submitToChat()"]' }, W(400), ALERT_READ]);
  J('B', 'S5-essay-baharu__rubric-general__1280', '/cikgu/essay/baharu', 'rubric "Rubric Am (default)" selected', [{ select: ['#rubric_key', 'general'] }]);
  J('B', 'S5-essay-baharu__default__375', '/cikgu/essay/baharu', 'default', [], M);
  J('B', 'S5-essay-baharu__default__768', '/cikgu/essay/baharu', 'default', [], T);

  // ---------------- S6 /cikgu/pbd (auto-tag queue) ----------------
  J('B', 'S6-pbd__default__1280', '/cikgu/pbd', 'empty queue; class select has only the placeholder (admin owns no class)');
  J('B', 'S6-pbd__select-all__1280', '/cikgu/pbd', '"Pilih semua" ticked (no rows to tick; nothing submitted)', [{ check: '#select-all' }, EV("return 'rowChecks=' + document.querySelectorAll('.row-check').length;")]);
  J('B', 'S6-pbd__classroom-param__1280', '/cikgu/pbd?classroom_id=1', '?classroom_id=1 (ignored; same empty queue)');
  J('C', 'S6-pbd__page-2__1280', '/cikgu/pbd?page=2', '?page=2 (paginator appears: "Showing 0 of 0 results")');
  J('C', 'S2-rph__page-2__375', '/cikgu/rph?page=2', '?page=2 mobile paginator ("« Previous" / "Next »" only)', [], M);
  J('B', 'S6-pbd__default__375', '/cikgu/pbd', 'default', [], M);
  J('B', 'S6-pbd__default__768', '/cikgu/pbd', 'default', [], T);

  // ---------------- S7 404 (detail ids, dead link /cikgu-alesa) ----------------
  J('A', 'S7-not-found__rph-id__1280', '/cikgu/rph/1', '/cikgu/rph/{id} → 404 (also /essay/{id}, /pbd/{id}, …/edit, …/print, …/pdf)');
  J('A', 'S7-not-found__cikgu-alesa__1280', '/cikgu-alesa', '/cikgu-alesa (target of "Buka Cikgu Alesa" on /pusat-nota-ringkas) → 404');
  J('A', 'S7-not-found__rph-id__375', '/cikgu/rph/1', '404', [], M);

  // ---------------- S8 405 (GET on POST-only endpoints) ----------------
  J('A', 'S8-method-not-allowed__send__1280', '/cikgu/send', 'GET /cikgu/send → 405 (also /cikgu/pbd/rollup, /cikgu/pbd/bulk-approve)');
  J('A', 'S8-method-not-allowed__send__375', '/cikgu/send', '405', [], M);

  window.__M13_JOBS = jobs;
  window.__M13_HELPERS = { MASK: M13MASK };
})();
