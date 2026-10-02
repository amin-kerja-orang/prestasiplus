// M15 dated seed snapshot (read-only, GET only, >= 400 ms between requests). Returns NON-PERSONAL values only.
// Load: browser_run_code_unsafe: async (page) => page.addScriptTag({ path: '<abs>/docs/discovery/tools/jobs/M15-snapshot.js' })
// Run:  browser_evaluate: async () => await window.__m15snap()   (save with filename → inventory/M15/_snapshot-<date>.json)
// - Catalogue: every row of /admin/hadiah pages 1..n (live id from the checkbox value) + every field of its edit form
//   (values of the edit form inputs; no personal data exists on these records).
// - Category filter counts (?cat=…), page-3 / bogus-cat behaviour.
// - Tebusan queue: per status, row count and non-personal columns. The Pelajar column is NEVER read: it is replaced by
//   "<student:n>" tokens numbered per distinct row owner inside this capture (owner identity compared in-page, never returned),
//   plus the e-mail domain class only ("moe-dl" / "other").
// - Student-side pages: wallet figures and box / draw / approval values as rendered for the admin account.
(function () {
  function T(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  async function doc(u) { await sleep(400); var r = await fetch(u, { credentials: 'same-origin' }); var t = await r.text(); return { status: r.status, d: new DOMParser().parseFromString(t, 'text/html') }; }
  function catRows(d) {
    return Array.from(d.querySelectorAll('main tbody tr')).filter(function (tr) { return tr.children.length >= 9; }).map(function (tr) {
      var td = tr.children, cb = tr.querySelector('.row-check'), st = td[7].querySelector('span');
      return { id: cb ? +cb.value : null, title: T(td[1].querySelector('.font-semibold').textContent), vendor: T(td[1].querySelector('.text-xs').textContent),
        kategori: T(td[2].textContent), rm: T(td[3].textContent), token: T(td[4].textContent), stok: T(td[5].textContent), tebusan: T(td[6].textContent),
        status: st ? T(st.textContent) : null, statusBg: st ? st.style.backgroundColor : null, editHref: (td[8].querySelector('a') || {}).getAttribute ? td[8].querySelector('a').getAttribute('href').replace(/^https?:\/\/[^/]+/, '') : null };
    });
  }
  function cards(d) { var o = {}; d.querySelectorAll('main .grid > div').forEach(function (c) { var x = c.querySelectorAll('div'); if (x.length >= 2) o[T(x[0].textContent)] = T(x[1].textContent); }); return o; }
  function pager(d) { var p = d.querySelector('main nav[role=navigation] p'); return p ? T(p.textContent) : null; }
  function formVals(d) {
    var f = d.querySelector('main form'); if (!f) return null; var o = {};
    Array.from(f.elements).forEach(function (e) {
      if (!e.name || e.name === '_token' || e.name === '_method') return;
      if (e.type === 'checkbox') o[e.name] = e.hasAttribute('checked');
      else if (e.tagName === 'SELECT') { var s = e.querySelector('option[selected]') || e.options[0]; o[e.name] = s ? s.value : null; o[e.name + '__selectedAttr'] = !!e.querySelector('option[selected]'); }
      else if (e.tagName === 'TEXTAREA') o[e.name] = e.textContent;
      else o[e.name] = e.getAttribute('value');
    });
    return { action: f.getAttribute('action').replace(/^https?:\/\/[^/]+/, ''), h1: T(d.querySelector('main h1').textContent), values: o };
  }
  window.__m15snap = async function () {
    var out = { capturedAt: new Date().toISOString(), note: 'M15 seed snapshot; GET only; no personal data (Pelajar column tokenised).' };
    // ---- catalogue ----
    var p1 = await doc('/admin/hadiah'), rows = catRows(p1.d), page = 2, last = pager(p1.d);
    out.catalogueCards = cards(p1.d); out.pager = { page1: last };
    while (true) { var pn = await doc('/admin/hadiah?page=' + page); var r = catRows(pn.d); out.pager['page' + page] = pager(pn.d) || ('(no pager) rows=' + r.length); out.pager['page' + page + 'EmptyText'] = r.length ? null : T((pn.d.querySelector('main tbody') || {}).textContent || ''); if (!r.length) break; rows = rows.concat(r); page++; if (page > 5) break; }
    out.catalogue = rows;
    // category filters
    out.categoryFilter = {};
    var cats = ['all', 'flagship', 'ewallet', 'telco', 'gaming', 'streaming', 'food_beverage', 'ecommerce', 'education', 'entertainment', 'bogus'];
    for (var i = 0; i < cats.length; i++) {
      var c = await doc('/admin/hadiah?cat=' + cats[i]); var cr = catRows(c.d);
      var act = Array.from(c.d.querySelectorAll('main a[href*="?cat="]')).filter(function (a) { return /7c3aed/i.test(a.getAttribute('style') || ''); }).map(function (a) { return T(a.textContent); });
      out.categoryFilter[cats[i]] = { status: c.status, rowsOnPage1: cr.length, ids: cr.map(function (x) { return x.id; }), pager: pager(c.d), activePill: act, cards: cards(c.d) };
    }
    // edit forms
    out.editForms = {};
    for (var k = 0; k < rows.length; k++) { var e = await doc('/admin/hadiah/' + rows[k].id + '/edit'); out.editForms[rows[k].id] = formVals(e.d); }
    var cr0 = await doc('/admin/hadiah/baharu'); out.createFormDefaults = formVals(cr0.d);
    // ---- tebusan ----
    out.tebusan = {}; var owners = [];
    var sts = ['', 'pending_admin', 'pending_parent_consent', 'delivered', 'cancelled', 'all', 'bogus'];
    for (var s = 0; s < sts.length; s++) {
      var q = await doc('/admin/hadiah/tebusan' + (sts[s] ? '?status=' + sts[s] : ''));
      var act2 = Array.from(q.d.querySelectorAll('main a[href*="?status="]')).filter(function (a) { return /7c3aed/i.test(a.getAttribute('style') || ''); }).map(function (a) { return T(a.textContent); });
      var trs = Array.from(q.d.querySelectorAll('main tbody tr')).filter(function (tr) { return tr.children.length > 1; });
      var empty = q.d.querySelector('main tbody td[colspan]');
      out.tebusan[sts[s] || '(none)'] = { status: q.status, activePill: act2, empty: empty ? T(empty.textContent) : null, pager: T((q.d.querySelector('main .mt-4') || {}).textContent || ''),
        rows: trs.map(function (tr) {
          var td = tr.children, who = T(td[0].textContent), idx = owners.indexOf(who); if (idx < 0) { owners.push(who); idx = owners.length - 1; }
          var mail = td[0].querySelector('a.__cf_email__, [data-cfemail]'); var em = T(td[0].textContent);
          var badge = td[4].querySelector('span');
          return { student: '<student:' + (idx + 1) + '>', emailClass: /moe-dl/.test(em) ? 'moe-dl' : (mail || /@/.test(em) ? 'other' : 'none'),
            hadiah: T(td[1].querySelector('div').textContent), vendor: T((td[1].querySelectorAll('div')[1] || {}).textContent || ''), rm: T(td[2].textContent), token: T(td[3].textContent),
            status: T(badge ? badge.textContent : td[4].textContent), statusBg: badge ? badge.style.backgroundColor : null, tarikh: T(td[5].textContent), tindakan: T(td[6].innerHTML) === '' ? '(empty)' : '(content)' };
        }) };
    }
    owners.length = 0;
    // ---- student-side pages (admin account) ----
    var rw = await doc('/gamification/rewards'); out.rewards = { status: rw.status, bakiToken: T((rw.d.querySelector('.shop-hero .text-xl') || {}).textContent), empty: T((rw.d.querySelector('main .text-center.py-16') || {}).textContent) , cards: rw.d.querySelectorAll('.reward-card').length };
    var mb = await doc('/gamification/mystery-box');
    out.mysteryBox = { status: mb.status, tokenAnda: T((mb.d.querySelector('.mystery-hero strong') || {}).textContent), boxes: Array.from(mb.d.querySelectorAll('form.box-card')).map(function (f) {
      var b = f.querySelector('button');
      return { id: +f.getAttribute('action').match(/mystery-box\/(\d+)\/open/)[1], action: f.getAttribute('action').replace(/^https?:\/\/[^/]+/, ''), style: f.getAttribute('style'), ribbon: T((f.querySelector('.rarity-ribbon') || {}).textContent || ''), ribbonClass: (f.querySelector('.rarity-ribbon') || { className: '' }).className,
        icon: T(f.querySelector('.box-icon').textContent), name: T(f.querySelector('.box-name').textContent), desc: T(f.querySelector('.box-desc').textContent), cost: T(f.querySelector('.box-cost').textContent),
        coinRange: T(f.querySelectorAll('.box-range strong')[0].textContent), xpRange: T(f.querySelectorAll('.box-range strong')[1].textContent), button: T(b.textContent), disabled: b.hasAttribute('disabled') };
    }), history: mb.d.querySelectorAll('.history-card, .history-item').length, modal: mb.d.querySelectorAll('.modal-overlay').length };
    var cb2 = await doc('/cabutan'); out.cabutan = { status: cb2.status, syilingAnda: T((cb2.d.querySelector('main .text-2xl.font-bold:not(h1)') || {}).textContent), heading: T((cb2.d.querySelector('main h2') || {}).textContent), empty: T((cb2.d.querySelector('main .border-dashed') || {}).textContent) };
    var kl = await doc('/cikgu/kelulusan-hadiah'); out.kelulusan = { status: kl.status, headings: Array.from(kl.d.querySelectorAll('main h2')).map(function (h) { return T(h.textContent); }), empties: Array.from(kl.d.querySelectorAll('main .text-slate-400')).map(function (x) { return T(x.textContent); }) };
    return out;
  };
})();
