// M22 capture plan — Notifications & Support (admin push notifications: history + composer; admin tickets: list + detail;
// admin chatbot helpdesk: conversations, conversation detail, analytics, knowledge base + add document; user "Tiket Bantuan"
// list + new ticket (/pusat-tuisyen/tiket and the /tiket alias); notification inbox /notifikasi (shared with M01); the
// global chatbot widget (logged-in and guest lead-capture states).
// Guard first:  browser_run_code_unsafe { filename: docs/discovery/tools/jobs/M22-guard.js }
//   (aborts every non-GET but POST /login, every non-static request to an external host, downloads and write-shaped GETs:
//    mark-read / read / read-all / dismiss / delete / toggle / close / reply / send / logout …; every M22 document / fetch
//    GET reaches the server once per context and is then served from the guard cache, so no page is counted twice).
//   Re-run the guard after creating the guest context (it installs itself on every context).
// Load:  browser_run_code_unsafe: async (page) => page.addScriptTag({ path: '<abs>/docs/discovery/tools/jobs/M22.js' })
// then:  browser_evaluate: () => { window.__jobs = window.__M22_JOBS.filter(j => j.group === 'A'); }
// then run tools/run-state.js, save window.__invs to docs/discovery/inventory/_raw/M22/_batch-<g>.json, split-batch.js,
// merge-inventory.js.
//
// SAFETY: live production admin, browser lane 1 (playwright). READ-ONLY.
//   - Never clicked / submitted: "Hantar Notifikasi" (POST /admin/notifications/send — a broadcast to real users),
//     ticket "Kemaskini" status (POST /admin/tiket/{id}/status, _method), ticket "Balas" (POST /admin/tiket/{id}/reply),
//     chatbot "Ambil Alih Perbualan" (POST /admin/chatbot/{id}/takeover), chatbot "Padam" (DELETE /admin/chatbot/{id},
//     confirm 'Padam perbualan ini?'), knowledge "Simpan & Proses" (POST /admin/chatbot/knowledge), user "Hantar Tiket"
//     (POST /pusat-tuisyen/tiket and POST /tiket), inbox "Tanda semua dibaca" / item click (mark read) / delete / bulk,
//     chatbot widget "Mula Berbual" / quick questions / send (POST /chatbot/send, /chatbot/rate).
//   - Never typed into: the composer user / school searches (GET /admin/notifications/users-search|schools-search?q=,
//     return real users / schools); the widget lead form and message box.
//   - Individual notifications are never opened or clicked (a click marks them read, M01 §2.11). Only ONE ticket (#2) and
//     ONE conversation (#74) detail page were opened (once each, guard cache); ticket counts re-checked unchanged.
//   - Client-side reveals only: composer audience radios, knowledge source radio, ticket category "Lain-lain" (select),
//     inbox "Pilih" select mode, chatbot widget open / close (toggle-chatbot event).
//
// PERSONAL DATA: ticket submitters (name, e-mail, role, school), ticket descriptions and attachment names, chatbot users /
// visitors (name, e-mail, phone, IP), every chatbot message (user text and bot replies addressed to the user), and the
// inbox notification titles / bodies (they embed student names) are personal. M22MASK tags (.m22n → masked and scrubbed
// globally) every e-mail-shaped leaf, every phone-shaped leaf or token, leaves with BIN / BINTI / BTE / BT / A/L / A/P,
// every cell of the table columns "Pengguna" / "Pengguna / Pelawat", the ticket subject line in the list, the ticket detail
// requester block / description / attachment names, every chatbot message bubble and the "Nama" / "Nama (Lead)" / "Emel"
// / "IP" / "Telefon" values, and every inbox item title / body; tools/sanitize.js then runs with SAN.
(function () {
  var B = 'https://prestasiplus.my';
  var jobs = [];
  function mask() {
    var n = 0;
    var tag = function (el, c) { c = c || 'm22n'; if (el && el.classList && !el.classList.contains(c)) { el.classList.add(c); n++; } };
    var T = function (s) { return String(s || '').replace(/\s+/g, ' ').trim(); };
    var PHONE = /(\+?6?0\s?1\d[\d\- ]{6,10}\d)/;
    var leafs = function (root) { var a = []; root.querySelectorAll('*').forEach(function (x) { if (!x.children.length && T(x.textContent)) a.push(x); }); if (!root.children.length && T(root.textContent)) a.push(root); return a; };
    document.querySelectorAll('body *').forEach(function (el) {
      if (el.children.length || el.closest('script,style,template,select,option')) return;
      var t = T(el.textContent); if (!t) return;
      if (/[^\s@]+@[^\s@]+\.[a-z]{2,}/i.test(t)) tag(el);
      else if (PHONE.test(t) && !/RM\s?\d/.test(t)) tag(el);
      else if (/\b(BIN|BINTI|BTE|BT|A\/L|A\/P)\b/i.test(t) && t.length < 90 && !el.closest('label,button,nav,aside,th')) tag(el);
    });
    // person columns of the M22 tables; ticket list: subject line (first <p> of the "Tiket" cell; the TKT number is kept)
    document.querySelectorAll('main table').forEach(function (tb) {
      var heads = Array.from(tb.querySelectorAll('thead th')).map(function (th) { return T(th.textContent); });
      heads.forEach(function (h, i) {
        var person = /^(Pengguna|Pengguna \/ Pelawat|Pelawat|Nama|Pemohon)$/i.test(h), subj = /^Tiket$/i.test(h);
        if (!person && !subj) return;
        tb.querySelectorAll('tbody tr').forEach(function (tr) { var td = tr.children[i]; if (!td || tr.children.length !== heads.length) return;
          if (person) leafs(td).forEach(function (x) { if (!x.closest('form,button')) tag(x); });
          else { var p = td.querySelector('p'); if (p) tag(p); } });
      });
    });
    // ticket detail: requester block, description, attachments
    if (/\/admin\/tiket\/\d+/.test(location.pathname) || /\/tiket\/\d+/.test(location.pathname)) {
      document.querySelectorAll('main .prose, main a[href*="tiket-attachment"], main [class*="whitespace-pre"]').forEach(function (x) { leafs(x).forEach(function (y) { tag(y); }); tag(x); });
      document.querySelectorAll('main p').forEach(function (p) { var nx = p.nextElementSibling; if (nx && /·/.test(T(nx.textContent)) && /(Teacher|Student|Guru|Pelajar|Admin|Parent|School|Sekolah)/i.test(T(nx.textContent))) { tag(p); tag(nx); } });
    }
    // chatbot conversation detail: every message bubble and the identity values
    if (/\/admin\/chatbot\/\d+/.test(location.pathname)) {
      document.querySelectorAll('main p.whitespace-pre-wrap, main [class*="whitespace-pre"]').forEach(function (x) { tag(x); });
      document.querySelectorAll('main span').forEach(function (s) { if (/^(Nama|Nama \(Lead\)|Emel|E-mel|IP|Telefon|No\. Telefon|Pelawat)$/.test(T(s.textContent)) && s.nextElementSibling) leafs(s.nextElementSibling).forEach(function (y) { tag(y); }); });
    }
    // inbox items (titles embed student names): title + body text of every .notif-item
    document.querySelectorAll('.notif-item').forEach(function (it) { it.querySelectorAll('p, h3, h4').forEach(function (p) { if (!/(yang lepas|lalu|ago)$/.test(T(p.textContent)) && !p.querySelector('i.fa-clock')) tag(p); }); });
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    var tn; while ((tn = w.nextNode())) { if (tn.parentElement && tn.parentElement.closest('script,style,template')) continue; if (PHONE.test(tn.nodeValue) && !/RM\s?\d/.test(tn.nodeValue)) { tn.nodeValue = tn.nodeValue.replace(new RegExp(PHONE.source, 'g'), '<phone>'); n++; } }
    document.querySelectorAll('a[href^="tel:"], a[href^="mailto:"], a[href*="wa.me"]').forEach(function (a) { a.setAttribute('href', a.getAttribute('href').replace(/(wa\.me\/|tel:)\+?\d+/, '$160XXXXXXXXX').replace(/^mailto:.*/, 'mailto:<email>')); n++; });
    document.querySelectorAll('a.__cf_email__, [data-cfemail]').forEach(function (a) { a.removeAttribute('data-cfemail'); a.textContent = '<email>'; n++; });
    document.querySelectorAll('[href*="/users/"], [href*="/student/"], [href*="/pelajar/"]').forEach(function (el) { el.setAttribute('href', el.getAttribute('href').replace(/\/(users|student|pelajar)\/\d+/g, '/$1/{id}')); });
    document.querySelectorAll('img').forEach(function (im) { var s = im.getAttribute('src') || ''; if (/ui-avatars|avatar|storage\/(avatars|profile)|tiket-attachment/.test(s)) { im.setAttribute('src', 'data:image/gif;base64,R0lGODlhAQABAAAAACw='); im.setAttribute('alt', '<person>'); n++; } });
    return 'm22mask: ' + n;
  }
  var M22MASK = '(' + mask.toString() + ')()';
  var SAN = { selectors: ['.m22n'], titleName: false, keepSelects: 'category|priority|status|type|source_type' };
  window.__M22_HELPERS = { MASK: M22MASK, SAN: SAN };
  function J(group, file, url, state, actions, extra, opts) {
    var s = file.split('-')[0];
    var j = { group: group, file: file, url: B + url, actions: (actions || []).concat([{ wait: 500 }, { eval: M22MASK }]), sanitize: SAN, settle: 500,
              opts: Object.assign({ state: state, prefix: 'EL-M22-' + s, redact: [] }, opts || {}) };
    Object.assign(j, extra || {});
    j.opts.state = state + (j.width === 375 ? ' @375' : j.width === 768 ? ' @768' : '') + (j.guest ? ' (guest)' : '');
    jobs.push(j);
  }
  var M = { width: 375 }, T = { width: 768 }, G = { guest: true };
  function EV(js) { return { eval: '(() => { ' + js + ' })()' }; }
  var R = function (sel, n) { var o = {}; o[sel] = n || 3; return { repeat: o }; };
  var RT = R('main tbody tr', 3);
  var RN = R('.notif-item', 3);
  var W = { contentRoot: '[x-data^="chatbotWidget"]' };
  // client-side only
  var AUD = function (v) { return EV("var r = document.querySelector('input[name=audience][value=\"" + v + "\"]'); if (r) r.click(); return 'audience " + v + " ' + !!r;"); };
  var SRC_UP = EV("var r = document.querySelector('input[name=source_type][value=upload]'); if (r) r.click(); return 'source upload ' + !!r;");
  var CAT_OTHER = { select: ['select[name=category]', 'other'] };
  var PILIH = EV("var b = Array.from(document.querySelectorAll('main button')).find(function (x) { return /Pilih$/.test(x.textContent.trim()); }); if (b) b.click(); return 'pilih ' + !!b;");
  var WOPEN = EV("var b = document.querySelector('[x-data^=\"chatbotWidget\"] > button, [x-data^=\"chatbotWidget\"] button[\\\\@click=\"toggleChat()\"]'); if (!b) { window.dispatchEvent(new CustomEvent('toggle-chatbot')); return 'event'; } b.click(); return 'fab clicked';");

  // ---------------- S1 /admin/notifications ----------------
  J('A', 'S1-admin-notifications__default__1280', '/admin/notifications', 'push history (1 row)', [], null, RT);
  J('A', 'S1-admin-notifications__default__375', '/admin/notifications', 'default', [], M, RT);
  J('A', 'S1-admin-notifications__default__768', '/admin/notifications', 'default', [], T, RT);
  // ---------------- S2 /admin/notifications/create ----------------
  J('A', 'S2-admin-notification-create__default__1280', '/admin/notifications/create', 'composer (never sent)', []);
  J('A', 'S2-admin-notification-create__aud-all__1280', '/admin/notifications/create', 'audience "Semua Pengguna" selected (client-side)', [AUD('all')]);
  J('A', 'S2-admin-notification-create__aud-school__1280', '/admin/notifications/create', 'audience "Sekolah Tertentu" (school search shown; never typed)', [AUD('school')]);
  J('A', 'S2-admin-notification-create__aud-individual__1280', '/admin/notifications/create', 'audience "Individu Tertentu" (user search shown; never typed)', [AUD('individual')]);
  J('A', 'S2-admin-notification-create__default__375', '/admin/notifications/create', 'default', [], M);
  J('A', 'S2-admin-notification-create__default__768', '/admin/notifications/create', 'default', [], T);

  // ---------------- S3 /admin/tiket ----------------
  J('B', 'S3-admin-tiket__default__1280', '/admin/tiket', 'ticket list (2 tickets)', [], null, RT);
  ['open', 'in_progress', 'waiting_reply', 'resolved', 'closed'].forEach(function (s) { J('B', 'S3-admin-tiket__status-' + s.replace('_', '-') + '__1280', '/admin/tiket?status=' + s, 'status=' + s, [], null, RT); });
  J('B', 'S3-admin-tiket__cat-system__1280', '/admin/tiket?category=system_issue', 'category=system_issue', [], null, RT);
  J('B', 'S3-admin-tiket__cat-suggestion__1280', '/admin/tiket?category=suggestion', 'category=suggestion → empty', [], null, RT);
  J('B', 'S3-admin-tiket__prio-high__1280', '/admin/tiket?priority=high', 'priority=high', [], null, RT);
  J('B', 'S3-admin-tiket__search-none__1280', '/admin/tiket?search=zzqxv', 'search with no match → empty', [], null, RT);
  J('B', 'S3-admin-tiket__default__375', '/admin/tiket', 'default', [], M, RT);
  J('B', 'S3-admin-tiket__default__768', '/admin/tiket', 'default', [], T, RT);
  // ---------------- S4 /admin/tiket/{id} ----------------
  J('B', 'S4-admin-tiket-show__default__1280', '/admin/tiket/2', 'ticket #2 (status / reply forms never submitted)', []);
  J('B', 'S4-admin-tiket-show__not-found__1280', '/admin/tiket/999999', 'unknown id → 404', []);
  J('B', 'S4-admin-tiket-show__default__375', '/admin/tiket/2', 'ticket #2', [], M);
  J('B', 'S4-admin-tiket-show__default__768', '/admin/tiket/2', 'ticket #2', [], T);

  // ---------------- S5 /admin/chatbot ----------------
  J('C', 'S5-admin-chatbot__default__1280', '/admin/chatbot', 'conversations (155; 20 per page)', [], null, RT);
  J('C', 'S5-admin-chatbot__type-visitor__1280', '/admin/chatbot?type=visitor', 'type=visitor (Pelawat)', [], null, RT);
  J('C', 'S5-admin-chatbot__type-user__1280', '/admin/chatbot?type=user', 'type=user (Pengguna Berdaftar)', [], null, RT);
  J('C', 'S5-admin-chatbot__type-lead__1280', '/admin/chatbot?type=lead', 'type=lead (Leads)', [], null, RT);
  J('C', 'S5-admin-chatbot__page-8__1280', '/admin/chatbot?page=8', 'last page', [], null, RT);
  J('C', 'S5-admin-chatbot__search-none__1280', '/admin/chatbot?search=zzqxv', 'search with no match → empty', [], null, RT);
  J('C', 'S5-admin-chatbot__default__375', '/admin/chatbot', 'default', [], M, RT);
  J('C', 'S5-admin-chatbot__default__768', '/admin/chatbot', 'default', [], T, RT);
  // ---------------- S6 /admin/chatbot/{id} ----------------
  J('C', 'S6-admin-chatbot-show__default__1280', '/admin/chatbot/74', 'conversation #74 (takeover never clicked)', []);
  J('C', 'S6-admin-chatbot-show__not-found__1280', '/admin/chatbot/999999', 'unknown id → 404', []);
  J('C', 'S6-admin-chatbot-show__default__375', '/admin/chatbot/74', 'conversation #74', [], M);
  J('C', 'S6-admin-chatbot-show__default__768', '/admin/chatbot/74', 'conversation #74', [], T);
  // ---------------- S7 /admin/chatbot/analytics ----------------
  J('D', 'S7-admin-chatbot-analytics__default__1280', '/admin/chatbot/analytics', 'analytics', []);
  J('D', 'S7-admin-chatbot-analytics__default__375', '/admin/chatbot/analytics', 'analytics', [], M);
  J('D', 'S7-admin-chatbot-analytics__default__768', '/admin/chatbot/analytics', 'analytics', [], T);
  // ---------------- S8 /admin/chatbot/knowledge ----------------
  J('D', 'S8-admin-chatbot-knowledge__default__1280', '/admin/chatbot/knowledge', 'knowledge base (empty)', [], null, RT);
  J('D', 'S8-admin-chatbot-knowledge__page-2__1280', '/admin/chatbot/knowledge?page=2', '?page=2 → English pager "Showing 0 of 0 results"', [], null, RT);
  J('D', 'S8-admin-chatbot-knowledge__show-405__1280', '/admin/chatbot/knowledge/1', 'GET /admin/chatbot/knowledge/{id} → 405 Symfony page', []);
  J('D', 'S8-admin-chatbot-knowledge__default__375', '/admin/chatbot/knowledge', 'default', [], M, RT);
  J('D', 'S8-admin-chatbot-knowledge__default__768', '/admin/chatbot/knowledge', 'default', [], T, RT);
  // ---------------- S9 /admin/chatbot/knowledge/create ----------------
  J('D', 'S9-admin-knowledge-create__default__1280', '/admin/chatbot/knowledge/create', 'add document, "Tulis Manual" (never saved)', []);
  J('D', 'S9-admin-knowledge-create__upload__1280', '/admin/chatbot/knowledge/create', '"Muat Naik Fail" selected (client-side)', [SRC_UP]);
  J('D', 'S9-admin-knowledge-create__default__375', '/admin/chatbot/knowledge/create', 'default', [], M);
  J('D', 'S9-admin-knowledge-create__default__768', '/admin/chatbot/knowledge/create', 'default', [], T);

  // ---------------- S10 /pusat-tuisyen/tiket (user) ----------------
  J('E', 'S10-tiket__default__1280', '/pusat-tuisyen/tiket', 'my tickets (admin has 0) → empty', []);
  ['open', 'in_progress', 'waiting_reply', 'resolved', 'closed'].forEach(function (s) { J('E', 'S10-tiket__status-' + s.replace('_', '-') + '__1280', '/pusat-tuisyen/tiket?status=' + s, 'status=' + s + ' → empty', []); });
  J('E', 'S10-tiket__alias__1280', '/tiket', 'alias /tiket (links use /tiket/…)', []);
  J('E', 'S10-tiket__forbidden__1280', '/pusat-tuisyen', '/pusat-tuisyen → 403 for admin', []);
  J('E', 'S10-tiket__default__375', '/pusat-tuisyen/tiket', 'default', [], M);
  J('E', 'S10-tiket__default__768', '/pusat-tuisyen/tiket', 'default', [], T);
  // ---------------- S11 /pusat-tuisyen/tiket/baru ----------------
  J('E', 'S11-tiket-baru__default__1280', '/pusat-tuisyen/tiket/baru', 'new ticket form (never submitted)', []);
  J('E', 'S11-tiket-baru__cat-other__1280', '/pusat-tuisyen/tiket/baru', 'category "Lain-lain" selected (reveals "Nyatakan Kategori")', [CAT_OTHER]);
  J('E', 'S11-tiket-baru__alias__1280', '/tiket/baru', 'alias /tiket/baru (form POST /tiket)', []);
  J('E', 'S11-tiket-baru__default__375', '/pusat-tuisyen/tiket/baru', 'default', [], M);
  J('E', 'S11-tiket-baru__default__768', '/pusat-tuisyen/tiket/baru', 'default', [], T);

  // ---------------- S12 /notifikasi (shared with M01 S11) ----------------
  J('F', 'S12-notifikasi__default__1280', '/notifikasi', 'inbox (items never clicked)', [], null, RN);
  J('F', 'S12-notifikasi__unread__1280', '/notifikasi?filter=unread', 'filter=unread', [], null, RN);
  J('F', 'S12-notifikasi__read__1280', '/notifikasi?filter=read', 'filter=read', [], null, RN);
  J('F', 'S12-notifikasi__type-system__1280', '/notifikasi?type=system', 'type=system → empty', [], null, RN);
  J('F', 'S12-notifikasi__select-mode__1280', '/notifikasi', '"Pilih" select mode (client-side)', [PILIH], null, RN);
  J('F', 'S12-notifikasi__default__375', '/notifikasi', 'default', [], M, RN);
  J('F', 'S12-notifikasi__default__768', '/notifikasi', 'default', [], T, RN);
  // ---------------- S13 chatbot widget (global, SHU pages) ----------------
  J('F', 'S13-chatbot-widget__closed__1280', '/pusat-tuisyen/tiket', 'widget closed (FAB only)', [], null, W);
  J('F', 'S13-chatbot-widget__open__1280', '/pusat-tuisyen/tiket', 'widget open, logged in (welcome + quick questions; nothing sent)', [WOPEN, { wait: 600 }], null, W);
  J('F', 'S13-chatbot-widget__open__375', '/pusat-tuisyen/tiket', 'widget open', [WOPEN, { wait: 600 }], M, W);
  J('F', 'S13-chatbot-widget__open__768', '/pusat-tuisyen/tiket', 'widget open', [WOPEN, { wait: 600 }], T, W);

  // ---------------- guest (fresh context, no login) ----------------
  // Every M22 route redirects a guest to /login (302; probed, not inventoried: the page is M01's login).
  J('G', 'S13-chatbot-widget__guest-lead__1280', '/', 'guest on the landing page: widget open → lead-capture form (never submitted)', [WOPEN, { wait: 600 }], G, W);
  J('G', 'S13-chatbot-widget__guest-lead__375', '/', 'guest lead-capture form', [WOPEN, { wait: 600 }], Object.assign({ width: 375 }, G), W);

  window.__M22_JOBS = jobs;
})();
