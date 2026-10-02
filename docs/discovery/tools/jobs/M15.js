// M15 capture plan — Rewards Shop & Redemption. Every screen x every UI state that reveals different elements.
// Load:  browser_run_code_unsafe: async (page) => page.addScriptTag({ path: '<abs>/docs/discovery/tools/jobs/M15.js' })
// then:  browser_evaluate: () => { window.__jobs = window.__M15_JOBS.filter(j => j.group === 'A'); }
// then run tools/run-state.js, save window.__invs to docs/discovery/inventory/_raw/M15/_batch.json, split-batch.js, merge-inventory.js.
//
// SAFETY: live production admin, browser lane 1 (playwright). READ-ONLY.
//   - Never clicked / submitted: "➕ Tambah" / "💾 Simpan" (hadiah create / update forms), the bulk toolbar actions
//     (Aktifkan, Nyahaktifkan, Set Stok, Had/Bulan, Pelaras Token, Padam — they open confirm()/prompt() and submit
//     POST /admin/hadiah/bulk), mystery-box "Buka" forms (POST /gamification/mystery-box/{id}/open; all disabled for the
//     admin anyway: 0 token), any cabutan ticket purchase (none rendered: no open draw), parent approve / reject (none rendered).
//   - Actions are client-side reveals only: ticking a row checkbox / the select-all checkbox (runs updateBulkUI(), shows the
//     bulk toolbar; nothing is submitted), "Batal" of the toolbar (clearSelection()), form.reportValidity() on the empty
//     create form (native bubbles only; the form is not submitted).
//
// PERSONAL DATA: the only personal data in M15 is the "Pelajar" column of /admin/hadiah/tebusan (student name + e-mail line). sanitize.js masks the Pelajar column
// (built-in PERSONAL_COL) and M15MASK additionally tags both lines of that cell (.m15n) and removes any Cloudflare data-cfemail payload.
(function () {
  var B = 'https://prestasiplus.my';
  var jobs = [];
  function mask() {
    var n = 0;
    document.querySelectorAll('a.__cf_email__, [data-cfemail]').forEach(function (a) { a.removeAttribute('data-cfemail'); a.textContent = '<email>'; a.setAttribute('href', '/cdn-cgi/l/email-protection'); n++; });
    document.querySelectorAll('main tbody td:first-child .font-semibold, main tbody td:first-child .text-xs').forEach(function (d) { if (/tebusan/.test(location.pathname)) { d.classList.add('m15n'); n++; } });
    document.querySelectorAll('img').forEach(function (im) { var s = im.getAttribute('src') || ''; if (/ui-avatars|avatar|storage\/(avatars|profile)/.test(s)) { im.setAttribute('src', 'data:image/gif;base64,R0lGODlhAQABAAAAACw='); im.setAttribute('alt', '<person>'); n++; } });
    return 'm15mask: ' + n;
  }
  var M15MASK = '(' + mask.toString() + ')()';
  var SAN = { selectors: ['.m15n'], titleName: false };
  function J(group, file, url, state, actions, extra, opts) {
    var s = file.split('-')[0];
    var j = { group: group, file: file, url: B + url, actions: (actions || []).concat([{ eval: M15MASK }]), sanitize: SAN,
              opts: Object.assign({ state: state, prefix: 'EL-M15-' + s, redact: [] }, opts || {}) };
    Object.assign(j, extra || {});
    // S2 states with zero rows: the empty-state cell sits in the Pelajar column (colspan) and sanitize.js would mask it as a name;
    // keep that column there (no person is rendered in these states; .m15n still masks any row that might appear).
    if (group === 'B' && !/status=(all|cancelled)/.test(url)) j.sanitize = { selectors: ['.m15n'], titleName: false, keepCols: '^pelajar$' };
    j.opts.state = state + (j.width === 375 ? ' @375' : j.width === 768 ? ' @768' : '');
    jobs.push(j);
  }
  var M = { width: 375 }, T = { width: 768 };
  var W = function (ms) { return { wait: ms || 400 }; };
  function EV(js) { return { eval: '(() => { ' + js + ' })()' }; }
  // catalogue rows: keep one sample per stock variant (∞ / number) and per consent-less / flagship look
  var RC = { repeat: { 'main tbody tr': 3 } };
  var TICK1 = EV("var c = document.querySelector('main .row-check'); c.checked = true; updateBulkUI(); return 'ticked 1';");
  var TICKALL = EV("var m = document.getElementById('select-all'); m.checked = true; toggleAll(m); return 'select-all';");
  var CLEAR = EV("clearSelection(); return 'cleared';");

  // ---------------- S1 /admin/hadiah (catalogue) ----------------
  J('A', 'S1-hadiah__default__1280', '/admin/hadiah', 'catalogue page 1, cat=all (default)', [], null, RC);
  J('A', 'S1-hadiah__page-2__1280', '/admin/hadiah?page=2', 'page 2 (51–59)', [], null, RC);
  J('A', 'S1-hadiah__page-3__1280', '/admin/hadiah?page=3', 'page=3 (beyond last page: empty row "Tiada hadiah dalam kategori ini.", pager "Showing 0 of 59 results")', [], null, RC);
  ['flagship', 'ewallet', 'telco', 'gaming', 'streaming', 'food_beverage', 'ecommerce', 'education', 'entertainment', 'bogus'].forEach(function (c) {
    J('A', 'S1-hadiah__cat-' + c.replace('_', '') + '__1280', '/admin/hadiah?cat=' + c, 'cat=' + c + ' (GET by URL)', [], null, RC);
  });
  J('A', 'S1-hadiah__bulk-one__1280', '/admin/hadiah', 'one row ticked → bulk toolbar "1 hadiah dipilih" (client-side only)', [TICK1, W()], null, RC);
  J('A', 'S1-hadiah__bulk-all__1280', '/admin/hadiah', 'select-all ticked → "50 hadiah dipilih"', [TICKALL, W()], null, RC);
  J('A', 'S1-hadiah__bulk-cleared__1280', '/admin/hadiah', 'select-all then toolbar "Batal" (clearSelection) → toolbar hidden again', [TICKALL, W(), CLEAR, W()], null, RC);
  J('A', 'S1-hadiah__default__375', '/admin/hadiah', 'default', [], M, RC);
  J('A', 'S1-hadiah__bulk-one__375', '/admin/hadiah', 'one row ticked → bulk toolbar', [TICK1, W()], M, RC);
  J('A', 'S1-hadiah__default__768', '/admin/hadiah', 'default', [], T, RC);

  // ---------------- S2 /admin/hadiah/tebusan (redemption queue) ----------------
  J('B', 'S2-tebusan__default__1280', '/admin/hadiah/tebusan', 'no status → pill "⏳ Pending Admin" active, empty "Tiada tebusan dalam status ini."', []);
  ['pending_admin', 'pending_parent_consent', 'delivered', 'cancelled', 'all', 'bogus'].forEach(function (s) {
    J('B', 'S2-tebusan__status-' + s.replace(/_/g, '') + '__1280', '/admin/hadiah/tebusan?status=' + s, 'status=' + s + ' (GET by URL)', []);
  });
  J('B', 'S2-tebusan__default__375', '/admin/hadiah/tebusan', 'default', [], M);
  J('B', 'S2-tebusan__status-all__375', '/admin/hadiah/tebusan?status=all', 'status=all (3 cancelled rows)', [], M);
  J('B', 'S2-tebusan__default__768', '/admin/hadiah/tebusan', 'default', [], T);

  // ---------------- S3 /admin/hadiah/baharu (create form) ----------------
  var VALID = EV("var f = document.querySelector('main form'); var ok = f.reportValidity(); var inv = Array.from(f.querySelectorAll(':invalid')).map(function (e) { return e.name + ':' + e.validationMessage; }); return 'reportValidity=' + ok + ' ' + inv.join(' ; ');");
  J('C', 'S3-hadiah-baharu__default__1280', '/admin/hadiah/baharu', 'empty create form (defaults)', []);
  J('C', 'S3-hadiah-baharu__validity__1280', '/admin/hadiah/baharu', 'form.reportValidity() on the empty form (native required bubbles; NOT submitted)', [VALID, W(300)]);
  J('C', 'S3-hadiah-baharu__default__375', '/admin/hadiah/baharu', 'default', [], M);
  J('C', 'S3-hadiah-baharu__default__768', '/admin/hadiah/baharu', 'default', [], T);

  // ---------------- S4 /admin/hadiah/{id}/edit ----------------
  J('D', 'S4-hadiah-edit__default__1280', '/admin/hadiah/1/edit', 'id 1 Roblox RM10 (gaming, parent consent ticked, stock ∞)', []);
  J('D', 'S4-hadiah-edit__stock__1280', '/admin/hadiah/9/edit', 'id 9 Hotlink RM5 (telco, stock 5, no monthly cap)', []);
  J('D', 'S4-hadiah-edit__flagship__1280', '/admin/hadiah/59/edit', 'id 59 Roblox RM1000 (flagship)', []);
  J('D', 'S4-hadiah-edit__not-found__1280', '/admin/hadiah/99999/edit', 'unknown id (404)', []);
  J('D', 'S4-hadiah-edit__default__375', '/admin/hadiah/1/edit', 'default', [], M);
  J('D', 'S4-hadiah-edit__default__768', '/admin/hadiah/1/edit', 'default', [], T);

  // ---------------- S5 /gamification/rewards (student shop) ----------------
  J('E', 'S5-rewards__default__1280', '/gamification/rewards', 'no reward available (empty state), Baki Token 0', []);
  J('E', 'S5-rewards__query-ignored__1280', '/gamification/rewards?category=gaming', 'unknown query ignored', []);
  J('E', 'S5-rewards__default__375', '/gamification/rewards', 'default', [], M);
  J('E', 'S5-rewards__default__768', '/gamification/rewards', 'default', [], T);

  // ---------------- S6 /gamification/mystery-box ----------------
  J('E', 'S6-mystery-box__default__1280', '/gamification/mystery-box', '4 boxes, 0 token → every button disabled "🔒 Token Tidak Cukup"', []);
  J('E', 'S6-mystery-box__default__375', '/gamification/mystery-box', 'default', [], M);
  J('E', 'S6-mystery-box__default__768', '/gamification/mystery-box', 'default', [], T);

  // ---------------- S7 /cabutan (lucky draw) ----------------
  J('E', 'S7-cabutan__default__1280', '/cabutan', 'no open draw (empty state), Syiling anda 256', []);
  J('E', 'S7-cabutan__default__375', '/cabutan', 'default', [], M);
  J('E', 'S7-cabutan__default__768', '/cabutan', 'default', [], T);

  // ---------------- S8 /cikgu/kelulusan-hadiah (parent approval) ----------------
  J('E', 'S8-kelulusan-hadiah__default__1280', '/cikgu/kelulusan-hadiah', 'no pending, no history (empty states)', []);
  J('E', 'S8-kelulusan-hadiah__default__375', '/cikgu/kelulusan-hadiah', 'default', [], M);
  J('E', 'S8-kelulusan-hadiah__default__768', '/cikgu/kelulusan-hadiah', 'default', [], T);

  // ---------------- S9 GET /admin/hadiah/{id} (update URL opened with GET) ----------------
  J('F', 'S9-hadiah-show__default__1280', '/admin/hadiah/1', 'GET on the PUT-only URL → 405 "Method Not Allowed" (framework error page)', []);
  J('F', 'S9-hadiah-show__default__375', '/admin/hadiah/1', '405', [], M);

  window.__M15_JOBS = jobs;
  window.__M15_HELPERS = { MASK: M15MASK, SAN: SAN };
})();
