// M07 capture plan — Premium PKSK. Every screen x every UI state that reveals different elements.
// Load:  browser_run_code_unsafe: async (page) => page.addScriptTag({ path: '<abs>/docs/discovery/tools/jobs/M07.js' })
// then:  browser_evaluate: () => { window.__jobs = window.__M07_JOBS.filter(j => j.group === 'A'); }
// then run tools/run-state.js, save window.__invs to docs/discovery/inventory/_raw/M07/_batch-<g>.json, split-batch.js, merge-inventory.js.
//
// SAFETY: live production admin, browser lane 3. Read-only. No job opens /pksk/level/{L}/exam or /pksk/level/{L}/domain/{CODE}
// (they may start an exam / practice session: targets recorded only). No form is submitted except the GET filter/search forms
// (by URL). Actions are client-side reveals only: <select> changes on the create form (Alpine), "Tambah Pilihan" / remove
// option buttons, row / select-all checkboxes (they only reveal the bulk bar — Luluskan / Tolak / Padam are never clicked),
// the "Beri Akses Baru" toggle (the grant form is never submitted), filling a field in an unsubmitted form.
//
// Personal data: /admin/pksk/access lists real users. M07MASK masks the "Pengguna" (name + e-mail/username) and
// "Diberi Oleh" cells before tools/sanitize.js runs (job.sanitize). No real name is written in this file.
(function () {
  var B = 'https://prestasiplus.my';
  var jobs = [];
  // (1) create form: the Alpine-rendered domain <option x-text="d.name"> elements lose their x-text attribute (moved to
  //     data-x-text) so that sanitize.js rule 1e (x-text bound to *.name) does not mask the 15 domain names (an enumeration,
  //     not a person); the <template x-for> source keeps x-text="d.name" and is inventoried as-is.
  // (2) access list: "Pengguna" (name + e-mail/username) and "Diberi Oleh" cells masked.
  var M07MASK = "(() => { var n = 0; document.querySelectorAll('main select option[x-text=\"d.name\"]').forEach(function (o) { o.removeAttribute('x-text'); o.setAttribute('data-x-text', 'd.name'); n++; });" +
    " if (!/\\/admin\\/pksk\\/access/.test(location.pathname)) return 'm07mask: ' + n;" +
    " document.querySelectorAll('main tbody tr').forEach(function (tr) { var td = tr.querySelectorAll('td'); if (td.length < 7) return;" +
    " var d = td[0].querySelectorAll('div'); if (d[0]) { d[0].textContent = '<person>'; n++; } if (d[1]) { d[1].textContent = '<email>'; n++; }" +
    " if (td[2].textContent.trim() !== '-') { td[2].textContent = '<person>'; n++; } });" +
    " return 'm07mask: ' + n; })()";
  function J(group, file, url, state, actions, extra, opts) {
    var s = file.split('-')[0];
    // titleName:false — tab titles "… - Admin" / "PRESTASIPLUS - Platform Latih Tubi Nasional" carry no person name
    var j = { group: group, file: file, url: B + url, actions: [{ eval: M07MASK }].concat(actions || [], [{ eval: M07MASK }]), sanitize: { titleName: false },
              opts: Object.assign({ state: state, prefix: 'EL-M07-' + s, repeat: { 'main tbody tr': 3 }, redact: [] }, opts || {}) };
    Object.assign(j, extra || {});
    j.opts.state = state + (j.width === 375 ? ' @375' : j.width === 768 ? ' @768' : '');
    jobs.push(j);
  }
  var M = { width: 375 }, T = { width: 768 };
  var W = function (ms) { return { wait: ms || 400 }; };
  var SEL = function (n, v) { return { select: ['main select[name=' + n + ']', v] }; };

  // ---------------- S1 /pksk (student hub "PKSK PRO") ----------------
  J('A', 'S1-pksk-hub__default__1280', '/pksk', 'default (admin: T1 + T4 cards AKTIF)');
  J('A', 'S1-pksk-hub__default__375', '/pksk', 'default', [], M);
  J('A', 'S1-pksk-hub__default__768', '/pksk', 'default', [], T);

  // ---------------- S2 /pksk/level/{L} (level dashboard) ----------------
  var HREFS = { eval: "(() => [...document.querySelectorAll('main a[href*=\"/pksk/level/\"]')].map(a => a.getAttribute('href').replace(/^https?:\\/\\/[^/]+/, '')).join(' '))()" };
  J('A', 'S2-level-dashboard__default__1280', '/pksk/level/T1', 'T1 dashboard (0%, grade E, 13 B domains)', [HREFS]);
  J('A', 'S2-level-dashboard__t4__1280', '/pksk/level/T4', 'T4 dashboard', [HREFS]);
  J('A', 'S2-level-dashboard__not-found__1280', '/pksk/level/T9', 'unknown level T9 (404)');
  J('A', 'S2-level-dashboard__default__375', '/pksk/level/T1', 'T1 dashboard', [], M);
  J('A', 'S2-level-dashboard__default__768', '/pksk/level/T1', 'T1 dashboard', [], T);

  // ---------------- S3 /pksk/level/{L}/domains ----------------
  J('B', 'S3-domains__default__1280', '/pksk/level/T1/domains', 'T1 domains (A 1, B 13, C 1)', [HREFS]);
  J('B', 'S3-domains__t4__1280', '/pksk/level/T4/domains', 'T4 domains (counts differ: SEJ 24)', [HREFS]);
  J('B', 'S3-domains__not-found__1280', '/pksk/level/T9/domains', 'unknown level (404)');
  J('B', 'S3-domains__default__375', '/pksk/level/T1/domains', 'T1 domains', [], M);
  J('B', 'S3-domains__default__768', '/pksk/level/T1/domains', 'T1 domains', [], T);

  // ---------------- S4 /pksk/level/{L}/history (live: HTTP 500) ----------------
  J('B', 'S4-history__server-error__1280', '/pksk/level/T1/history', 'T1 history -> HTTP 500 "Ralat Pelayan"');
  J('B', 'S4-history__server-error-t4__1280', '/pksk/level/T4/history', 'T4 history -> HTTP 500');
  J('B', 'S4-history__server-error__375', '/pksk/level/T1/history', 'HTTP 500', [], M);

  // ---------------- S5 /admin/pksk/questions (list) ----------------
  var Q = '/admin/pksk/questions';
  J('C', 'S5-questions__default__1280', Q, 'default (763, page 1 of 39)');
  J('C', 'S5-questions__row-selected__1280', Q, 'one row checkbox ticked (bulk bar "1 dipilih"; NOT submitted)', [{ check: 'main tbody input[type=checkbox]' }, W()]);
  J('C', 'S5-questions__select-all__1280', Q, 'select-all ticked ("20 dipilih"; NOT submitted)', [{ check: 'main thead input[type=checkbox]' }, W(), { eval: "document.querySelector('main [x-text*=dipilih]').textContent" }]);
  J('C', 'S5-questions__bahagian-a__1280', Q + '?bahagian=A', 'bahagian=A (160)');
  J('C', 'S5-questions__bahagian-c__1280', Q + '?bahagian=C', 'bahagian=C (30, 2 pages)');
  J('C', 'S5-questions__level-t1-b__1280', Q + '?level=T1&bahagian=B', 'level=T1 & bahagian=B (288)');
  J('C', 'S5-questions__search__1280', Q + '?search=inovasi', 'search=inovasi (13, one page)');
  J('C', 'S5-questions__empty__1280', Q + '?status=pending', 'status=pending (empty state)');
  J('C', 'S5-questions__filtered-page-2__1280', Q + '?bahagian=A&page=2', 'bahagian=A page 2 (pager keeps filter)');
  J('C', 'S5-questions__last-page__1280', Q + '?page=39', 'last page (3 rows)');
  J('C', 'S5-questions__default__375', Q, 'default', [], M);
  J('C', 'S5-questions__row-selected__375', Q, 'one row ticked', [{ check: 'main tbody input[type=checkbox]' }, W()], M);
  J('C', 'S5-questions__default__768', Q, 'default', [], T);

  // ---------------- S6 /admin/pksk/questions/create (NOT submitted) ----------------
  var C = Q + '/create';
  var VAL = { eval: "(() => { var f = document.querySelector('main form'); return 'valid=' + f.checkValidity() + ' invalid=' + [...f.querySelectorAll(':invalid')].map(e => e.name).join(',') + ' domain=' + f.pksk_domain_id.value + ' opts=' + [...f.pksk_domain_id.options].map(o => o.value).join('/'); })()" };
  J('D', 'S6-create__default__1280', C, 'default (no Bahagian: all 15 domains, 4 options, Betul hidden)', [VAL]);
  J('D', 'S6-create__bahagian-a__1280', C, 'Bahagian A (domain list = 1; note "(Tiada jawapan betul/salah)")', [SEL('bahagian', 'A'), W(), VAL]);
  J('D', 'S6-create__bahagian-b__1280', C, 'Bahagian B (13 domains; "Betul" checkboxes shown)', [SEL('bahagian', 'B'), W(), VAL]);
  J('D', 'S6-create__bahagian-c__1280', C, 'Bahagian C (options card hidden; hidden required inputs keep form invalid)', [SEL('bahagian', 'C'), W(), SEL('pksk_domain_id', '15'), { fill: ['main textarea[name=question_text]', 'x'] }, W(), VAL]);
  J('D', 'S6-create__domain-reset__1280', C, 'Bahagian B, domain Sains, then Bahagian A (domain select back to placeholder)', [SEL('bahagian', 'B'), W(), SEL('pksk_domain_id', '3'), W(), SEL('bahagian', 'A'), W(), VAL]);
  J('D', 'S6-create__max-options__1280', C, 'Bahagian B + 2x "Tambah Pilihan" (6 options, add button hidden)', [SEL('bahagian', 'B'), W(), { click: 'main button:has-text("Tambah Pilihan")' }, W(200), { click: 'main button:has-text("Tambah Pilihan")' }, W(), VAL]);
  J('D', 'S6-create__min-options__1280', C, 'two options removed (2 left, remove buttons hidden)', [{ click: 'main form button:has(.fa-times)' }, W(200), { click: 'main form button:has(.fa-times)' }, W(), VAL]);
  J('D', 'S6-create__default__375', C, 'default', [], M);
  J('D', 'S6-create__bahagian-b__375', C, 'Bahagian B', [SEL('bahagian', 'B'), W()], M);
  J('D', 'S6-create__default__768', C, 'default', [], T);

  // ---------------- S7 /admin/pksk/questions/{id}/edit (NOT submitted) ----------------
  J('E', 'S7-edit__default__1280', Q + '/178460/edit', 'Bahagian B question (Kebudayaan Kaum, T4, Diluluskan; option A Betul)', [VAL]);
  J('E', 'S7-edit__bahagian-a__1280', Q + '/178359/edit', 'Bahagian A question (no Betul column; options preloaded)', [VAL]);
  J('E', 'S7-edit__bahagian-c__1280', Q + '/178349/edit', 'Bahagian C essay (no options card)', [VAL]);
  J('E', 'S7-edit__option-added__1280', Q + '/178460/edit', 'B question + "Tambah Pilihan" (5 options)', [{ click: 'main button:has-text("Tambah Pilihan")' }, W(), VAL]);
  J('E', 'S7-edit__not-found__1280', Q + '/99999999/edit', 'unknown id (404)');
  J('E', 'S7-edit__default__375', Q + '/178460/edit', 'B question', [], M);
  J('E', 'S7-edit__default__768', Q + '/178460/edit', 'B question', [], T);

  // ---------------- S8 /admin/pksk/access ----------------
  var A = '/admin/pksk/access';
  var TOG = { click: 'main button:has-text("Beri Akses Baru")' };
  J('F', 'S8-access__default__1280', A, 'default (3 active, grant form hidden)');
  J('F', 'S8-access__form-open__1280', A, '"Beri Akses Baru" clicked (grant form shown; NOT submitted)', [TOG, W(500)]);
  J('F', 'S8-access__form-toggled__1280', A, 'form opened, User ID typed, toggled closed and reopened (value kept)', [TOG, W(500), { fill: ['main input[name=user_id]', '123'] }, TOG, W(500), TOG, W(500), { eval: "'user_id after re-open=' + document.querySelector('main input[name=user_id]').value" }]);
  // empty table: the colspan empty-state cell sits under the "Pengguna" header, so column masking is switched off (no rows)
  J('F', 'S8-access__search-empty__1280', A + '?search=zzzzqqq', 'search with no match (empty state)', [], { sanitize: { titleName: false, keepCols: '.*' } });
  J('F', 'S8-access__default__375', A, 'default', [], M);
  J('F', 'S8-access__form-open__375', A, 'grant form open', [TOG, W(500)], M);
  J('F', 'S8-access__default__768', A, 'default', [], T);

  window.__M07_JOBS = jobs;
  window.__M07_HELPERS = { MASK: M07MASK };
})();
