// M19 dated seed snapshot (read-only, GET only, >= 450 ms between requests, inside the M19-guarded context).
// Load: browser_run_code_unsafe: async (page) => page.addScriptTag({ path: '<abs>/docs/discovery/tools/jobs/M19-snapshot.js' })
// Run:  browser_evaluate: async () => await window.__m19snap()   (save with filename → inventory/M19/_snapshot-<date>.json)
// - Pages are fetched with fetch() + DOMParser (no navigation, no script execution, no form ever submitted).
// - NEVER returned: payer names, e-mails, phones, bill codes, gateway references. The payer cell becomes a '<payer:n>' token
//   numbered by first appearance inside this capture (so the same payer on two rows keeps one token) plus an e-mail
//   domain class; bill code / gateway ref become presence flags. Payment ids (not person ids) and school names are kept.
// - Never requested: /admin/export/*, invoice PDFs, /subscribe/* (POST → gateway), any wa.me / gateway URL.
(function () {
  function T(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  async function doc(u) { await sleep(450); var r = await fetch(u, { credentials: 'same-origin' }); var t = await r.text(); return { status: r.status, d: new DOMParser().parseFromString(t, 'text/html') }; }
  var payers = {}, pn = 0;
  function payer(txt) {
    var em = (txt.match(/[^\s@]+@[^\s@]+\.[a-z]{2,}/i) || [''])[0];
    var key = em || txt; if (!payers[key]) payers[key] = ++pn;
    var dom = !em ? 'none' : /moe-dl/i.test(em) ? 'moe-dl' : /prestasiplus\.my/i.test(em) ? 'prestasiplus' : /gmail|yahoo|hotmail|outlook|icloud/i.test(em) ? 'webmail' : 'other';
    return '<payer:' + payers[key] + '> <email:' + dom + '>';
  }
  function leaves(root) { var out = []; if (!root) return out; root.querySelectorAll('*').forEach(function (el) { if (el.children.length || el.closest('script,style,template')) return; var t = T(el.textContent); if (t) out.push(t); }); return out; }
  function rows(tb, personCols, refCols) {
    if (!tb) return null;
    var heads = Array.from(tb.querySelectorAll('thead th')).map(function (th) { return T(th.textContent); });
    var rs = Array.from(tb.querySelectorAll('tbody tr')).map(function (tr) { return Array.from(tr.children).map(function (td, i) { var x = T(td.textContent); if (personCols.indexOf(i) >= 0) return x ? payer(x) : ''; if ((refCols || []).indexOf(i) >= 0) return x ? '<ref present>' : ''; return x; }); });
    return { heads: heads, rows: rs };
  }
  function statCards(d) { return Array.from(d.querySelectorAll('main .grid > div')).map(function (c) { return T(c.textContent); }).filter(function (x) { return x.length < 120; }); }
  window.__m19snap = async function () {
    var out = { capturedAt: new Date().toISOString(), note: 'M19 seed snapshot; GET only; payer names/e-mails tokenised (<payer:n>, e-mail domain class), bill codes and gateway refs as presence flags only.' };
    // ---- S1 payments: all pages + filters ----
    out.S1_payments = { pages: {}, filters: {} };
    var ids = [];
    for (var p = 1; p <= 3; p++) {
      var d = await doc('/admin/payments?page=' + p); var tb = d.d.querySelector('main table');
      var r = rows(tb, [1], []);
      var rowIds = tb ? Array.from(tb.querySelectorAll('tbody tr')).map(function (tr) { var a = tr.querySelector('a[href*="/admin/payments/"]'); var m = a && a.getAttribute('href').match(/payments\/(\d+)/); return m ? +m[1] : null; }) : [];
      ids = ids.concat(rowIds);
      out.S1_payments.pages[p] = { status: d.status, stats: statCards(d.d), rowIds: rowIds, table: r, info: T((d.d.querySelector('main nav') || {}).textContent || '') };
    }
    var F = ['status=paid', 'status=pending', 'status=failed', 'type=regular', 'type=personal', 'type=pksk', 'gateway=toyyibpay', 'gateway=bizappay', 'search=zzqxv', 'status=paid&type=personal'];
    for (var f of F) { var df = await doc('/admin/payments?' + f); var tf = df.d.querySelector('main table'); out.S1_payments.filters[f] = { status: df.status, rowCount: tf ? tf.querySelectorAll('tbody tr').length : 0, info: T((df.d.querySelector('main nav') || {}).textContent || ''), stats: statCards(df.d), empty: T((df.d.querySelector('main .text-center h3, main .text-center p') || {}).textContent || '') }; }
    // ---- S2 payment detail (every id on the list; non-personal fields only) ----
    out.S2_paymentDetail = {};
    for (var id of ids) {
      if (!id) continue; var dd = await doc('/admin/payments/' + id); var L = leaves(dd.d.querySelector('main'));
      var o = {}; ['Pakej', 'Gateway', 'Tarikh Dicipta'].forEach(function (k) { var i = L.indexOf(k); if (i >= 0) o[k] = L[i + 1]; });
      if (L.indexOf('Pakej') >= 0) o.PakejSub = L[L.indexOf('Pakej') + 2];
      var bi = L.indexOf('Bill Code'); o.billCode = bi >= 0 ? (L[bi + 1] && L[bi + 1] !== 'Gateway Bill Code' && L[bi + 1] !== '—' ? 'present' : (L[bi + 1] === '—' ? '—' : 'see-raw')) : 'absent';
      var gi = L.indexOf('Gateway Ref'); o.gatewayRef = gi >= 0 ? (L[gi + 1] === '—' ? '—' : 'present') : 'absent';
      o.banner = L.filter(function (x) { return /^Pembayaran (Berjaya|Pending|Gagal|Tertunda)|^Dibayar pada|^Menunggu|^RM\d/.test(x); });
      o.status = dd.status; out.S2_paymentDetail[id] = o;
    }
    // ---- S3 edit (one per status) ----
    // ---- S4 billing ----
    var b = await doc('/admin/billing');
    var bm = b.d.querySelector('main'); var btb = bm.querySelector('table'); var brec = rows(btb, [1], []); if (btb) btb.remove();
    out.S4_billing = { status: b.status, leaves: leaves(bm), recent: brec };
    // ---- S5 dunning (+ filters) ----
    out.S5_dunning = {};
    for (var q of ['', 'type=school', 'type=individual', 'event=reminder_7d', 'event=reminder_3d', 'event=reminder_1d', 'event=expired', 'event=grace_start', 'event=grace_end']) {
      var dn = await doc('/admin/dunning' + (q ? '?' + q : '')); var tn = dn.d.querySelector('main table');
      out.S5_dunning[q || 'default'] = { status: dn.status, stats: statCards(dn.d), table: q ? { rowCount: tn ? tn.querySelectorAll('tbody tr').length : 0 } : rows(tn, [], []) };
    }
    // ---- S6 pricing / S7 invoices (static copy; admin view) ----
    var pr = await doc('/pricing'); out.S6_pricing = { status: pr.status, prices: leaves(pr.d.querySelector('main')).filter(function (x) { return /RM\d/.test(x); }), forms: Array.from(pr.d.querySelectorAll('main form')).map(function (f) { return [f.getAttribute('method'), (f.getAttribute('action') || '').replace(/^https?:\/\/[^/]+/, ''), Array.from(f.querySelectorAll('input[type=hidden]:not([name=_token])')).map(function (i) { return i.name + '=' + i.value; }).join('&')]; }), compare: rows(pr.d.querySelector('main table'), [], []) };
    var iv = await doc('/billing/invoices'); out.S7_invoices = { status: iv.status, leaves: leaves(iv.d.querySelector('main')) };
    // ---- cross-module reads (M02 subscriptions, owner M02) ----
    var ss = await doc('/admin/school-subscriptions'); var ts = ss.d.querySelector('main table');
    out.M02_subscriptions = { status: ss.status, stats: statCards(ss.d), table: rows(ts, [], []), ids: ts ? Array.from(ts.querySelectorAll('tbody tr')).map(function (tr) { var a = tr.querySelector('a[href*="/school-subscriptions/"]'); var m = a && a.getAttribute('href').match(/subscriptions\/(\d+)/); return m ? +m[1] : null; }) : [] };
    // school ids of the subscription rows (via the M02 school list search by school code; GET)
    var codes = {}; (out.M02_subscriptions.table ? out.M02_subscriptions.table.rows : []).forEach(function (r) { var m = r[0].match(/\b([A-Z]{3}\d{4})$/); if (m) codes[m[1]] = null; });
    for (var c in codes) { var sc = await doc('/admin/schools?search=' + c); var a = Array.from(sc.d.querySelectorAll('main a[href*="/admin/schools/"]')).map(function (x) { return x.getAttribute('href'); }).find(function (h) { return /schools\/\d+\/edit/.test(h); }); codes[c] = a ? +a.match(/schools\/(\d+)/)[1] : null; }
    out.M02_subscriptions.schoolIdByCode = codes;
    out.payerCount = pn;
    return out;
  };
})();
