// M19 capture plan — Finance & Subscriptions. Every screen x every UI state that reveals different elements.
// Guard first:  browser_run_code_unsafe { filename: docs/discovery/tools/jobs/M19-guard.js }   (aborts every non-GET but POST /login)
// Load:  browser_run_code_unsafe: async (page) => page.addScriptTag({ path: '<abs>/docs/discovery/tools/jobs/M19.js' })
// then:  browser_evaluate: () => { window.__jobs = window.__M19_JOBS.filter(j => j.group === 'A'); }
// then run tools/run-state.js, save window.__invs to docs/discovery/inventory/_raw/M19/_batch.json, split-batch.js, merge-inventory.js.
//
// SAFETY: live production admin, browser lane 1 (playwright). READ-ONLY. Money never moves.
//   - Never clicked / submitted: payment row delete (POST _method=DELETE /admin/payments/{id}), "Padam Dipilih" bulk delete
//     (POST /admin/payments/bulk-delete), the payment edit form "Simpan"/update (PUT /admin/payments/{id}), the pricing
//     "Langgan …" buttons (POST /subscribe/regular, /subscribe/personal → ToyyibPay), "Hubungi Kami" / WhatsApp links
//     (external), invoice PDF links, the dashboard CSV export /admin/export/payments.
//   - Actions are GET navigations (filters driven by URL query strings, pagination), Alpine FAQ accordion toggles on /pricing,
//     and opening pages (show / edit) without touching any control that submits. The M19 guard aborts every non-GET request
//     (except POST /login) and every gateway host, so even a stray click cannot write.
//
// PERSONAL DATA (payer = student / parent names, e-mails, phones, bill codes, gateway transaction ids): M19MASK runs first
// and tags (.m19n → masked and scrubbed globally) every e-mail-shaped leaf, names in the "Pelajar" / "Pengguna" cells
// (also when not in a table), label → value pairs whose label names a person or a payment reference, and every
// bill-code / transaction-id-shaped token (.m19r → masked in place only); it rewrites the WhatsApp number of wa.me links
// to 60XXXXXXXXX and person ids in links to {id}. tools/sanitize.js then runs with SAN.
(function () {
  var B = 'https://prestasiplus.my';
  var jobs = [];
  function mask() {
    var n = 0;
    var tag = function (el, c) { c = c || 'm19n'; if (el && el.classList && !el.classList.contains(c)) { el.classList.add(c); n++; } };
    var T = function (s) { return String(s || '').replace(/\s+/g, ' ').trim(); };
    // label / reference rules only on admin finance pages (on /pricing "Pelajar" is a package name, not a person label)
    var adm = /^\/admin/.test(location.pathname);
    var LBL = /^(nama( penuh| pelajar| pembayar| pengguna)?|pelajar|pengguna|pembayar|ibu ?bapa|penjaga|e-?mel|email|telefon|no\.? ?tel(efon)?|phone|ic|no\.? ?k\/?p|bill ?code|kod bil|rujukan( pembayaran| gateway| transaksi)?|no\.? ?rujukan|reference|ref|transaction ?id|id transaksi|order ?id|external ?id|bil)\s*:?$/i;
    document.querySelectorAll('body *').forEach(function (el) {
      if (el.children.length || el.closest('script,style,template,select,option')) return;
      var t = T(el.textContent); if (!t) return;
      if (/[^\s@]+@[^\s@]+\.[a-z]{2,}/i.test(t)) tag(el);
      else if (/\b(BIN|BINTI|BT|A\/L|A\/P)\b/.test(t) && t.length < 90) tag(el);
      else if (adm && /^(?=.*\d)(?=.*[a-z])[a-z0-9_\-]{8,40}$/i.test(t) && !/^(EL|INV|ID)-/i.test(t) && !/^\d{4}-\d{2}-\d{2}/.test(t)) tag(el, 'm19r');
      if (adm && LBL.test(t) && !el.closest('th,thead,label,button,nav,aside,header,a')) {
        var v = el.nextElementSibling || (el.parentElement && el.parentElement.nextElementSibling);
        if (v && !v.querySelector('input,select,textarea,button,form')) { if (/rujukan|ref|bill|kod|transaction|transaksi|order|external|^bil/i.test(t)) tag(v, 'm19r'); else tag(v); }
      }
    });
    // table cells of person columns (also the first line of multi-line cells: name / e-mail / phone)
    document.querySelectorAll('table').forEach(function (tb) {
      var hs = Array.from(tb.querySelectorAll('thead th')).map(function (h) { return T(h.textContent); });
      hs.forEach(function (h, i) {
        var person = /^(pelajar|pengguna|nama|pembayar|user)$/i.test(h), ref = /^(rujukan|ref|bill ?code|transaksi|reference)/i.test(h);
        if (!person && !ref) return;
        tb.querySelectorAll('tbody tr').forEach(function (tr) { var td = tr.children[i]; if (!td) return; td.querySelectorAll('*').forEach(function (d) { if (!d.children.length && T(d.textContent)) tag(d, person ? 'm19n' : 'm19r'); }); if (!td.children.length && T(td.textContent)) tag(td, person ? 'm19n' : 'm19r'); });
      });
    });
    // form inputs holding a person value or a reference
    document.querySelectorAll('input, textarea').forEach(function (i) { var nm = (i.name || '') + ' ' + (i.id || ''); if (/ref|bill|transaction|order|external|name|email|phone/i.test(nm) && i.type !== 'hidden' && i.value) { i.setAttribute('data-m19', 'masked'); i.value = ''; i.setAttribute('value', ''); n++; } });
    document.querySelectorAll('a[href*="wa.me"], a[href*="api.whatsapp"]').forEach(function (a) { a.setAttribute('href', a.getAttribute('href').replace(/(wa\.me\/|phone=)\d+/, '$160XXXXXXXXX')); n++; });
    document.querySelectorAll('a.__cf_email__, [data-cfemail]').forEach(function (a) { a.removeAttribute('data-cfemail'); a.textContent = '<email>'; n++; });
    document.querySelectorAll('[href*="/users/"], [href*="/student/"], [href*="/pelajar/"]').forEach(function (el) { el.setAttribute('href', el.getAttribute('href').replace(/\/(users|student|pelajar)\/\d+/g, '/$1/{id}')); });
    document.querySelectorAll('img').forEach(function (im) { var s = im.getAttribute('src') || ''; if (/ui-avatars|avatar|storage\/(avatars|profile)/.test(s)) { im.setAttribute('src', 'data:image/gif;base64,R0lGODlhAQABAAAAACw='); im.setAttribute('alt', '<person>'); n++; } });
    return 'm19mask: ' + n;
  }
  var M19MASK = '(' + mask.toString() + ')()';
  var SAN = { selectors: ['.m19n'], localSelectors: ['.m19r'], titleName: false, cols: '^(pelajar|pengguna|pembayar)$', labels: 'pelajar|pengguna|pembayar|nama pelajar' };
  // user-portal pages (S6 /pricing, S7 /billing/invoices): only the shell's own user name / e-mail are personal; no extra labels
  var SANU = { selectors: ['.m19n'], titleName: false };
  window.__M19_HELPERS = { MASK: M19MASK, SAN: SAN, SANU: SANU };
  function J(group, file, url, state, actions, extra, opts) {
    var s = file.split('-')[0];
    var j = { group: group, file: file, url: B + url, actions: (actions || []).concat([{ wait: 500 }, { eval: M19MASK }]), sanitize: (url.indexOf('/pricing') === 0 || url.indexOf('/billing') === 0) ? SANU : SAN, settle: 500,
              opts: Object.assign({ state: state, prefix: 'EL-M19-' + s, redact: [] }, opts || {}) };
    Object.assign(j, extra || {});
    j.opts.state = state + (j.width === 375 ? ' @375' : j.width === 768 ? ' @768' : '');
    jobs.push(j);
  }
  var M = { width: 375 }, T = { width: 768 };
  function EV(js) { return { eval: '(() => { ' + js + ' })()' }; }
  var R = function (sel, n) { var o = {}; o[sel] = n || 3; return { repeat: o }; };
  // client-side only: tick checkboxes (Alpine x-model selectedIds). "Padam Dipilih" is NEVER clicked.
  var TICK1 = EV("var c = document.querySelector('main tbody input[type=checkbox]'); if (!c) return 'no row'; c.click(); return 'ticked 1';");
  var TICKALL = EV("var c = document.querySelector('main thead input[type=checkbox]'); if (!c) return 'no header box'; c.click(); return 'ticked all';");
  var FAQ = function (i) { return EV("var el = Array.from(document.querySelectorAll('main [x-data]')).find(function (x) { return /open:\\s*null/.test(x.getAttribute('x-data')); }); if (!el) return 'no faq'; Alpine.$data(el).open = " + i + "; return 'faq " + i + "';"); };

  // ---------------- S1 /admin/payments ----------------
  var R1 = R('main tbody tr', 3);
  J('A', 'S1-payments__default__1280', '/admin/payments', 'list page 1 (59 payments, 20/page; stat cards; no filter)', [], null, R1);
  J('A', 'S1-payments__page-2__1280', '/admin/payments?page=2', '?page=2', [], null, R1);
  J('A', 'S1-payments__page-3__1280', '/admin/payments?page=3', '?page=3 (last page, 19 rows)', [], null, R1);
  J('A', 'S1-payments__page-empty__1280', '/admin/payments?page=99', '?page=99 → empty state "Tiada Pembayaran" (no Reset link)', [], null, R1);
  J('A', 'S1-payments__status-paid__1280', '/admin/payments?status=paid', 'status=paid (8 rows; "Reset" link appears)', [], null, R1);
  J('A', 'S1-payments__status-pending__1280', '/admin/payments?status=pending', 'status=pending (51, paginated)', [], null, R1);
  J('A', 'S1-payments__status-failed__1280', '/admin/payments?status=failed', 'status=failed → empty state', [], null, R1);
  J('A', 'S1-payments__type-regular__1280', '/admin/payments?type=regular', 'type=regular ("Biasa", 51)', [], null, R1);
  J('A', 'S1-payments__type-personal__1280', '/admin/payments?type=personal', 'type=personal (8)', [], null, R1);
  J('A', 'S1-payments__type-pksk__1280', '/admin/payments?type=pksk', 'type=pksk → empty state', [], null, R1);
  J('A', 'S1-payments__gateway-bizappay__1280', '/admin/payments?gateway=bizappay', 'gateway=bizappay → empty state', [], null, R1);
  J('A', 'S1-payments__search-none__1280', '/admin/payments?search=zzqxv', 'search with no match → empty state', [], null, R1);
  J('A', 'S1-payments__paid-personal__1280', '/admin/payments?status=paid&type=personal', 'status=paid & type=personal (2 rows)', [], null, R1);
  J('A', 'S1-payments__tick-one__1280', '/admin/payments', 'one row checkbox ticked → "1 dipilih" (client-side; bulk delete not clicked)', [TICK1], null, R1);
  J('A', 'S1-payments__tick-all__1280', '/admin/payments', 'header checkbox ticked → "20 dipilih" (client-side)', [TICKALL], null, R1);
  J('A', 'S1-payments__default__375', '/admin/payments', 'default', [], M, R1);
  J('A', 'S1-payments__tick-one__375', '/admin/payments', 'one row ticked', [TICK1], M, R1);
  J('A', 'S1-payments__default__768', '/admin/payments', 'default', [], T, R1);

  // ---------------- S2 /admin/payments/{id} ----------------
  J('B', 'S2-payment-show__default__1280', '/admin/payments/65', 'payment #65 (personal monthly, Berjaya, "Dibayar pada …")', []);
  J('B', 'S2-payment-show__pending__1280', '/admin/payments/64', 'payment #64 (regular monthly, "Menunggu Pembayaran")', []);
  J('B', 'S2-payment-show__onetime-paid__1280', '/admin/payments/25', 'payment #25 (personal onetime, Berjaya)', []);
  J('B', 'S2-payment-show__not-found__1280', '/admin/payments/99999999', 'unknown id → 404 "Halaman Tidak Dijumpai"', []);
  J('B', 'S2-payment-show__create-500__1280', '/admin/payments/create', '/admin/payments/create → HTTP 500 "Ralat Pelayan" (resource route without a view)', []);
  J('B', 'S2-payment-show__default__375', '/admin/payments/65', 'paid', [], M);
  J('B', 'S2-payment-show__default__768', '/admin/payments/65', 'paid', [], T);

  // ---------------- S3 /admin/payments/{id}/edit ----------------
  J('C', 'S3-payment-edit__default__1280', '/admin/payments/65/edit', 'edit #65 (radio "Berjaya" checked); Simpan never clicked', []);
  J('C', 'S3-payment-edit__pending__1280', '/admin/payments/64/edit', 'edit #64 (radio "Pending" checked)', []);
  J('C', 'S3-payment-edit__not-found__1280', '/admin/payments/99999999/edit', 'unknown id → 404', []);
  J('C', 'S3-payment-edit__default__375', '/admin/payments/65/edit', 'edit', [], M);
  J('C', 'S3-payment-edit__default__768', '/admin/payments/65/edit', 'edit', [], T);

  // ---------------- S4 /admin/billing ----------------
  var R4 = R('main tbody tr', 3);
  J('D', 'S4-billing__default__1280', '/admin/billing', 'billing dashboard (4 stat cards, active school packages, 20 latest payments)', [], null, R4);
  J('D', 'S4-billing__query-ignored__1280', '/admin/billing?month=2026-08', '?month=2026-08 ignored (same page)', [], null, R4);
  J('D', 'S4-billing__default__375', '/admin/billing', 'default', [], M, R4);
  J('D', 'S4-billing__default__768', '/admin/billing', 'default', [], T, R4);

  // ---------------- S5 /admin/dunning ----------------
  var R5 = R('main tbody tr', 3);
  J('E', 'S5-dunning__default__1280', '/admin/dunning', 'dunning log (21 rows, no filter; header shows the default "Dashboard")', [], null, R5);
  J('E', 'S5-dunning__type-school__1280', '/admin/dunning?type=school', 'type=school (3 rows; "Reset" link)', [], null, R5);
  J('E', 'S5-dunning__type-individual__1280', '/admin/dunning?type=individual', 'type=individual (18 rows)', [], null, R5);
  J('E', 'S5-dunning__event-7d__1280', '/admin/dunning?event=reminder_7d', 'event=reminder_7d (7 rows)', [], null, R5);
  J('E', 'S5-dunning__event-expired__1280', '/admin/dunning?event=expired', 'event=expired → empty "📭 Tiada log dunning dijumpai."', [], null, R5);
  J('E', 'S5-dunning__page-2__1280', '/admin/dunning?page=2', '?page=2 → empty, pager "Showing 0 of 21 results"', [], null, R5);
  J('E', 'S5-dunning__default__375', '/admin/dunning', 'default', [], M, R5);
  J('E', 'S5-dunning__default__768', '/admin/dunning', 'default', [], T, R5);

  // ---------------- S6 /pricing ----------------
  J('F', 'S6-pricing__default__1280', '/pricing', 'pricing (admin viewer; all FAQ closed)', []);
  J('F', 'S6-pricing__faq-0__1280', '/pricing', 'FAQ 1 open', [FAQ(0)]);
  J('F', 'S6-pricing__faq-1__1280', '/pricing', 'FAQ 2 open', [FAQ(1)]);
  J('F', 'S6-pricing__faq-2__1280', '/pricing', 'FAQ 3 open', [FAQ(2)]);
  J('F', 'S6-pricing__faq-3__1280', '/pricing', 'FAQ 4 open', [FAQ(3)]);
  J('F', 'S6-pricing__faq-4__1280', '/pricing', 'FAQ 5 open', [FAQ(4)]);
  J('F', 'S6-pricing__default__375', '/pricing', 'default', [], M);
  J('F', 'S6-pricing__faq-0__375', '/pricing', 'FAQ 1 open', [FAQ(0)], M);
  J('F', 'S6-pricing__default__768', '/pricing', 'default', [], T);

  // ---------------- S7 /billing/invoices ----------------
  J('G', 'S7-invoices__default__1280', '/billing/invoices', 'admin viewer: 0 invoices → empty state', []);
  J('G', 'S7-invoices__default__375', '/billing/invoices', 'empty', [], M);
  J('G', 'S7-invoices__default__768', '/billing/invoices', 'empty', [], T);

  window.__M19_JOBS = jobs;
})();
