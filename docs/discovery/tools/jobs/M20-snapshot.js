// M20 dated seed snapshot (read-only, GET only, >= 450 ms between requests, inside the M20-guarded context).
// Load: browser_run_code_unsafe: async (page) => page.addScriptTag({ path: '<abs>/docs/discovery/tools/jobs/M20-snapshot.js' })
// Run:  browser_evaluate: async () => await window.__m20snap()   (save with filename → inventory/M20/_snapshot-<date>.json)
// - Pages are fetched with fetch() + DOMParser (no navigation, no script execution, no form ever submitted).
// - Product pages /marketplace/{slug} are NOT fetched except the three already held in the guard's cache (#1, #5, #7),
//   because every server GET of a product page adds a live view. All other product fields come from the admin edit
//   pages and the lists (which do not count views).
// - NEVER returned: e-mail, phone / WhatsApp numbers (presence flag only). The only seller is the platform's own shop
//   (owner = the admin account); its shop name and description are public shop copy and are kept.
// - Never requested: toggle / delete / ban / store / update endpoints, /marketplace/{slug}/whatsapp, wa.me.
(function () {
  function T(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  async function doc(u) { await sleep(450); var r = await fetch(u, { credentials: 'same-origin' }); var t = await r.text(); return { status: r.status, final: r.url.replace(location.origin, ''), d: new DOMParser().parseFromString(t, 'text/html') }; }
  function scrub(s) { return T(s).replace(/[^\s@]+@[^\s@]+\.[a-z]{2,}/gi, '<email>').replace(/(\+?6?0\s?1\d[\d\- ]{6,10}\d)/g, '<phone>'); }
  function leaves(root) { var out = []; if (!root) return out; root.querySelectorAll('*').forEach(function (el) { if (el.children.length || el.closest('script,style,template,select')) return; var t = scrub(el.textContent); if (t) out.push(t); }); return out; }
  function header(d) { var h = d.querySelector('header h1'); var p = h && h.parentElement && h.parentElement.querySelector('p'); return { h1: h ? T(h.textContent) : null, sub: p ? scrub(p.textContent) : null }; }
  function cards(d, sel) { return Array.from(d.querySelectorAll(sel)).map(function (c) { return c; }); }
  function slugId(h) { var m = String(h || '').match(/-([A-Za-z0-9]{5})$/); return m ? m[1] : null; }
  window.__m20snap = async function () {
    var out = { capturedAt: new Date().toISOString(), note: 'M20 seed snapshot; GET only; e-mail / phone never returned; product pages not re-fetched (each server GET adds a view).' };
    // ---- S1 admin product list + filters ----
    var a = await doc('/admin/marketplace/products');
    out.S1_adminProducts = { status: a.status, header: header(a.d), countText: T((a.d.querySelector('main p, main .text-sm') || {}).textContent || ''), rows: [] };
    cards(a.d, 'main .space-y-3 > div.card').forEach(function (c) {
      var edit = c.querySelector('a[href*="/edit"]'); var id = edit ? +edit.getAttribute('href').match(/products\/(\d+)\/edit/)[1] : null;
      var pub = c.querySelector('a[href*="/marketplace/"]');
      var spans = Array.from(c.querySelectorAll('span')).map(function (s) { return { t: T(s.textContent), i: (s.querySelector('i') || {}).className || '' }; });
      out.S1_adminProducts.rows.push({ id: id, name: T((c.querySelector('h4') || {}).textContent), slug: pub ? pub.getAttribute('href').replace(/^https?:\/\/[^/]+/, '') : null,
        leaves: leaves(c), views: (spans.find(function (s) { return /fa-eye/.test(s.i); }) || {}).t, star: (spans.find(function (s) { return /fa-star/.test(s.i); }) || {}).t,
        toggleIcon: ((c.querySelector('form[action*="/toggle"] i') || {}).className || '').replace(/\s+/g, ' '), toggleTitle: (c.querySelector('form[action*="/toggle"] button') || { getAttribute: function () { return null; } }).getAttribute('title') });
    });
    out.S1_adminProducts.filters = {};
    var F = ['category=1', 'category=2', 'category=3', 'category=4', 'category=5', 'category=6', 'status=active', 'status=draft', 'status=rejected', 'q=Beg', 'q=zzqxv', 'page=2'];
    for (var f of F) { var df = await doc('/admin/marketplace/products?' + f); out.S1_adminProducts.filters[f] = { status: df.status, ids: cards(df.d, 'main .space-y-3 > div.card').map(function (c) { var e = c.querySelector('a[href*="/edit"]'); return e ? +e.getAttribute('href').match(/products\/(\d+)\/edit/)[1] : null; }).filter(Boolean), texts: leaves(df.d.querySelector('main')).filter(function (x) { return /produk dijumpai|Tiada Produk/.test(x); }) }; }
    // ---- S3 admin edit (every product): the seed fields ----
    out.S3_productFields = {};
    for (var r of out.S1_adminProducts.rows) {
      var e = await doc('/admin/marketplace/products/' + r.id + '/edit'); var fm = e.d.querySelector('main form[action$="/products/' + r.id + '"]');
      var val = function (n) { var el = fm && fm.querySelector('[name="' + n + '"]'); if (!el) return null; if (el.tagName === 'SELECT') { var o = el.querySelector('option[selected]') || el.options[el.selectedIndex]; return o ? o.value + ' ' + T(o.textContent) : null; } if (el.tagName === 'TEXTAREA') return scrub(el.textContent); return el.getAttribute('value'); };
      var radio = function (n) { var el = fm && fm.querySelector('input[name="' + n + '"][checked]'); return el ? el.value : null; };
      out.S3_productFields[r.id] = { status: e.status, header: header(e.d), name: val('name'), category: val('category_id'), price: val('price'), originalPrice: val('original_price'), description: val('description'),
        condition: radio('condition'), stockStatus: radio('stock_status'), productStatus: radio('status'), shippingMethod: radio('shipping_method'), shippingFee: val('shipping_fee'), location: val('location'),
        imagesHeading: T((Array.from(e.d.querySelectorAll('main h3')).find(function (h) { return /Gambar Sedia Ada/.test(h.textContent); }) || {}).textContent), imageIds: Array.from(e.d.querySelectorAll('main form[action*="/products/image/"]')).map(function (x) { return +x.getAttribute('action').match(/image\/(\d+)/)[1]; }), imageCount: e.d.querySelectorAll('main img').length };
    }
    // ---- S2 create header ----
    var c2 = await doc('/admin/marketplace/products/create'); out.S2_create = { status: c2.status, header: header(c2.d), sellerOptions: Array.from(c2.d.querySelectorAll('select[name=seller_id] option')).map(function (o) { return o.value + '=' + T(o.textContent); }) };
    // ---- S4 sellers + filters ----
    var s4 = await doc('/admin/marketplace/sellers');
    out.S4_sellers = { status: s4.status, header: header(s4.d), stats: Array.from(s4.d.querySelectorAll('main .grid > div')).map(function (x) { return T(x.textContent); }),
      rows: cards(s4.d, 'main .space-y-3 > div.card').map(function (c) { var l = c.querySelector('a[href*="/sellers/"]'); return { id: l ? +l.getAttribute('href').match(/sellers\/(\d+)/)[1] : null, leaves: leaves(c) }; }), filters: {} };
    for (var q of ['pending', 'active', 'suspended', 'banned']) { var dq = await doc('/admin/marketplace/sellers?status=' + q); out.S4_sellers.filters[q] = { status: dq.status, rows: cards(dq.d, 'main .space-y-3 > div.card').length, stats: Array.from(dq.d.querySelectorAll('main .grid > div')).map(function (x) { return T(x.textContent); }), empty: leaves(dq.d.querySelector('main')).filter(function (x) { return /Tiada/.test(x); }) }; }
    // ---- S5 seller detail (non-personal fields; contact = presence flags) ----
    out.S5_sellerDetail = {};
    for (var sr of out.S4_sellers.rows) { var d5 = await doc('/admin/marketplace/sellers/' + sr.id); var L = leaves(d5.d.querySelector('main'));
      out.S5_sellerDetail[sr.id] = { status: d5.status, title: d5.d.title, header: header(d5.d), leaves: L, emailPresent: L.indexOf('<email>') >= 0, phonePresent: L.filter(function (x) { return x === '<phone>'; }).length, waLink: !!d5.d.querySelector('main a[href*="wa.me"]'), banConfirm: (d5.d.querySelector('main form[action*="/ban"]') || { getAttribute: function () { return null; } }).getAttribute('onsubmit') }; }
    // ---- S6 buyer marketplace: orders per sort / category / condition ----
    out.S6_marketplace = { variants: {} };
    var V = ['', 'sort=latest', 'sort=price_low', 'sort=price_high', 'sort=popular', 'condition=new', 'condition=used', 'category=peralatan-sekolah', 'category=buku-rujukan', 'category=uniform-pakaian', 'category=stationery', 'category=digital', 'category=lain-lain', 'q=beg', 'q=zzqxv', 'page=2', 'category=peralatan-sekolah&condition=used&sort=price_high'];
    for (var v of V) { var d6 = await doc('/marketplace' + (v ? '?' + v : '')); var g = Array.from(d6.d.querySelectorAll('main .grid > a.card'));
      out.S6_marketplace.variants[v || 'default'] = { status: d6.status, header: v ? undefined : header(d6.d), slugs: g.map(function (x) { return slugId(x.getAttribute('href')); }), cardTexts: v ? undefined : g.map(function (x) { return leaves(x); }), activeChip: T((Array.from(d6.d.querySelectorAll('main a[href*="/marketplace"]')).find(function (x) { return /bg-|text-white/.test(x.className) && /active|indigo-6|emerald-6|bg-indigo|bg-emerald/.test(x.className); }) || {}).textContent || ''), empty: leaves(d6.d.querySelector('main')).filter(function (x) { return /Tiada Produk/.test(x); }) }; }
    // ---- S7 product pages already cached (#1, #5, #7) ----
    out.S7_productCached = {};
    for (var sl of ['beg-sekolah-anti-air-premium-vH1Fj', 'e-book-1001-soalan-sains-tingkatan-3-pdf-tqd84', 'kamus-dewan-edisi-keempat-terpakai-8axTV']) { var d7 = await doc('/marketplace/' + sl); out.S7_productCached[sl] = { status: d7.status, title: d7.d.title, header: header(d7.d), leaves: leaves(d7.d.querySelector('main')), related: Array.from(d7.d.querySelectorAll('main a[href*="/marketplace/"]')).map(function (x) { return x.getAttribute('href').replace(/^https?:\/\/[^/]+/, ''); }) }; }
    // ---- S8 public shop (cached) ----
    var d8 = await doc('/marketplace/penjual/1'); out.S8_shop = { status: d8.status, title: d8.d.title, header: header(d8.d), leaves: leaves(d8.d.querySelector('main')).slice(0, 12), slugs: Array.from(d8.d.querySelectorAll('main .grid > a.card')).map(function (x) { return slugId(x.getAttribute('href')); }) };
    // ---- S9–S12 seller portal ----
    var d9 = await doc('/seller/dashboard'); out.S9_sellerDashboard = { status: d9.status, header: header(d9.d), leaves: leaves(d9.d.querySelector('main')) };
    var d10 = await doc('/seller/produk'); out.S10_sellerProducts = { status: d10.status, header: header(d10.d), rows: cards(d10.d, 'main .space-y-3 > div.card').map(function (c) { return leaves(c); }) };
    var d11 = await doc('/seller/produk/tambah'); out.S11_create = { status: d11.status, header: header(d11.d) };
    var d12 = await doc('/seller/produk/7/edit'); out.S12_edit7 = { status: d12.status, header: header(d12.d), imageCount: d12.d.querySelectorAll('main img').length };
    var d12b = await doc('/seller/daftar'); out.S9_daftarRedirect = { status: d12b.status, final: d12b.final };
    return out;
  };
})();
