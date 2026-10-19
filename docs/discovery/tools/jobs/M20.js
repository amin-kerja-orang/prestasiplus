// M20 capture plan — Marketplace (admin products / sellers, buyer marketplace, public seller shop, seller portal).
// Guard first:  browser_run_code_unsafe { filename: docs/discovery/tools/jobs/M20-guard.js }
//   (aborts every non-GET but POST /login, gateway hosts, downloads and write-shaped GETs incl. the product "/whatsapp"
//    contact redirect; serves product / seller detail pages from an in-memory cache after their first GET so the live
//    "tontonan" view counter is incremented at most once per page for the whole run).
// Load:  browser_run_code_unsafe: async (page) => page.addScriptTag({ path: '<abs>/docs/discovery/tools/jobs/M20.js' })
// then:  browser_evaluate: () => { window.__jobs = window.__M20_JOBS.filter(j => j.group === 'A'); }
// then run tools/run-state.js, save window.__invs to docs/discovery/inventory/_raw/M20/_batch-<g>.json, split-batch.js,
// merge-inventory.js.
//
// SAFETY: live production admin, browser lane 1 (playwright). READ-ONLY.
//   - Never clicked / submitted: admin product toggle (POST /admin/marketplace/products/{id}/toggle), admin product delete
//     (POST _method=DELETE, confirm('Padam produk ini?')), admin product create / update (POST /admin/marketplace/products,
//     PUT /admin/marketplace/products/{id}), image delete (DELETE /admin/marketplace/products/image/{id}), seller ban
//     (POST /admin/marketplace/sellers/{id}/ban, confirm('Haramkan penjual ini?')), seller-portal product create / update /
//     delete (POST /seller/produk, PUT / DELETE /seller/produk/{id}), the buyer "Hubungi Penjual di WhatsApp" link
//     (GET /marketplace/{slug}/whatsapp → counts a click and redirects to wa.me), the admin wa.me link.
//   - Actions are GET navigations (filters / sort / search driven by URL query strings) and the client-side image
//     thumbnail switch on the product page (setMainImage, no request).
//
// PERSONAL DATA: the only seller on live is the platform's own shop ("JomBelajar Official", owner = the admin account),
// but its e-mail, phone / WhatsApp number and the wa.me link are still masked. M20MASK tags (.m20n → masked and scrubbed
// globally) every e-mail-shaped leaf, every phone-shaped leaf or token, leaves with BIN / BINTI / A/L / A/P, and the value
// after a contact / bank / identity label (E-mel, Telefon, WhatsApp, No. IC, Bank, No. Akaun …); it rewrites wa.me numbers
// to 60XXXXXXXXX, person ids in links to {id}, and avatars. tools/sanitize.js then runs with SAN.
(function () {
  var B = 'https://prestasiplus.my';
  var jobs = [];
  function mask() {
    var n = 0;
    var tag = function (el, c) { c = c || 'm20n'; if (el && el.classList && !el.classList.contains(c)) { el.classList.add(c); n++; } };
    var T = function (s) { return String(s || '').replace(/\s+/g, ' ').trim(); };
    var PHONE = /(\+?6?0\s?1\d[\d\- ]{6,10}\d)/;
    var LBL = /^(e-?mel|email|telefon|no\.? ?tel(efon)?|phone|whatsapp|no\.? ?whatsapp|ic|no\.? ?(ic|k\/?p|mykad)|bank|nama bank|no\.? ?akaun|akaun bank|nombor akaun|pemegang akaun|alamat|ssm|no\.? ?ssm)\s*:?$/i;
    document.querySelectorAll('body *').forEach(function (el) {
      if (el.children.length || el.closest('script,style,template,select,option')) return;
      var t = T(el.textContent); if (!t) return;
      if (/[^\s@]+@[^\s@]+\.[a-z]{2,}/i.test(t)) tag(el);
      else if (PHONE.test(t) && !/RM\s?\d/.test(t)) tag(el);
      else if (/\b(BIN|BINTI|A\/L|A\/P)\b/.test(t) && t.length < 90) tag(el);
      if (LBL.test(t) && !el.closest('th,thead,label,button,nav,aside,header,a')) {
        var v = el.nextElementSibling || (el.parentElement && el.parentElement.nextElementSibling);
        if (v && !v.querySelector('input,select,textarea,button,form')) tag(v);
      }
    });
    // phone text nodes that share a leaf with a label ("WhatsApp: 60…") — replace only the number in place
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    var tn; while ((tn = w.nextNode())) { if (tn.parentElement && tn.parentElement.closest('script,style,template')) continue; if (PHONE.test(tn.nodeValue) && !/RM\s?\d/.test(tn.nodeValue)) { tn.nodeValue = tn.nodeValue.replace(new RegExp(PHONE.source, 'g'), '<phone>'); n++; } }
    document.querySelectorAll('input, textarea').forEach(function (i) { var nm = (i.name || '') + ' ' + (i.id || ''); if (/phone|telefon|whatsapp|email|emel|ic_|bank|account|akaun/i.test(nm) && i.type !== 'hidden' && i.value) { i.setAttribute('data-m20', 'masked'); i.value = ''; i.setAttribute('value', ''); n++; } });
    document.querySelectorAll('a[href*="wa.me"], a[href*="api.whatsapp"], a[href^="tel:"], a[href^="mailto:"]').forEach(function (a) { a.setAttribute('href', a.getAttribute('href').replace(/(wa\.me\/|phone=|tel:)\+?\d+/, '$160XXXXXXXXX').replace(/^mailto:.*/, 'mailto:<email>')); n++; });
    document.querySelectorAll('a.__cf_email__, [data-cfemail]').forEach(function (a) { a.removeAttribute('data-cfemail'); a.textContent = '<email>'; n++; });
    document.querySelectorAll('[href*="/users/"], [href*="/student/"], [href*="/pelajar/"]').forEach(function (el) { el.setAttribute('href', el.getAttribute('href').replace(/\/(users|student|pelajar)\/\d+/g, '/$1/{id}')); });
    document.querySelectorAll('img').forEach(function (im) { var s = im.getAttribute('src') || ''; if (/ui-avatars|avatar|storage\/(avatars|profile)|uploads\/(sellers|documents|ic)/.test(s)) { im.setAttribute('src', 'data:image/gif;base64,R0lGODlhAQABAAAAACw='); im.setAttribute('alt', '<person>'); n++; } });
    return 'm20mask: ' + n;
  }
  var M20MASK = '(' + mask.toString() + ')()';
  var SAN = { selectors: ['.m20n'], titleName: false };
  window.__M20_HELPERS = { MASK: M20MASK, SAN: SAN };
  function J(group, file, url, state, actions, extra, opts) {
    var s = file.split('-')[0];
    var j = { group: group, file: file, url: B + url, actions: (actions || []).concat([{ wait: 500 }, { eval: M20MASK }]), sanitize: SAN, settle: 500,
              opts: Object.assign({ state: state, prefix: 'EL-M20-' + s, redact: [] }, opts || {}) };
    Object.assign(j, extra || {});
    j.opts.state = state + (j.width === 375 ? ' @375' : j.width === 768 ? ' @768' : '');
    jobs.push(j);
  }
  var M = { width: 375 }, T = { width: 768 };
  function EV(js) { return { eval: '(() => { ' + js + ' })()' }; }
  var R = function (sel, n) { var o = {}; o[sel] = n || 3; return { repeat: o }; };
  var RL = R('main .space-y-3 > div.card', 3);      // admin / seller product rows, admin seller rows
  var RG = R('main .grid > a.card', 3);              // buyer product grid, public shop grid
  // client-side only: switch the product gallery's main image (setMainImage; no request)
  var THUMB = EV("var b = Array.from(document.querySelectorAll('main button[onclick*=setMainImage]'))[1]; if (!b) return 'no 2nd thumb'; b.click(); return 'thumb 2';");

  // ---------------- S1 /admin/marketplace/products ----------------
  J('A', 'S1-admin-products__default__1280', '/admin/marketplace/products', 'list (10 products; no filter)', [], null, RL);
  J('A', 'S1-admin-products__q-match__1280', '/admin/marketplace/products?q=Beg', 'q=Beg (search match)', [], null, RL);
  J('A', 'S1-admin-products__q-none__1280', '/admin/marketplace/products?q=zzqxv', 'q with no match → empty state', [], null, RL);
  J('A', 'S1-admin-products__cat-2__1280', '/admin/marketplace/products?category=2', 'category=2 Buku & Rujukan', [], null, RL);
  J('A', 'S1-admin-products__cat-6__1280', '/admin/marketplace/products?category=6', 'category=6 Lain-lain', [], null, RL);
  J('A', 'S1-admin-products__status-active__1280', '/admin/marketplace/products?status=active', 'status=active', [], null, RL);
  J('A', 'S1-admin-products__status-draft__1280', '/admin/marketplace/products?status=draft', 'status=draft → empty', [], null, RL);
  J('A', 'S1-admin-products__status-rejected__1280', '/admin/marketplace/products?status=rejected', 'status=rejected → empty', [], null, RL);
  J('A', 'S1-admin-products__page-2__1280', '/admin/marketplace/products?page=2', '?page=2', [], null, RL);
  J('A', 'S1-admin-products__default__375', '/admin/marketplace/products', 'default', [], M, RL);
  J('A', 'S1-admin-products__default__768', '/admin/marketplace/products', 'default', [], T, RL);

  // ---------------- S2 /admin/marketplace/products/create ----------------
  J('B', 'S2-admin-product-create__default__1280', '/admin/marketplace/products/create', 'create form (never submitted)', []);
  J('B', 'S2-admin-product-create__default__375', '/admin/marketplace/products/create', 'create form', [], M);
  J('B', 'S2-admin-product-create__default__768', '/admin/marketplace/products/create', 'create form', [], T);

  // ---------------- S3 /admin/marketplace/products/{id}/edit ----------------
  J('C', 'S3-admin-product-edit__default__1280', '/admin/marketplace/products/1/edit', 'edit #1 (new, Pos / Kurier RM8, 4 images); never saved', []);
  J('C', 'S3-admin-product-edit__used-cod__1280', '/admin/marketplace/products/3/edit', 'edit #3 (used, COD)', []);
  J('C', 'S3-admin-product-edit__digital-free__1280', '/admin/marketplace/products/5/edit', 'edit #5 (digital, free shipping, no original price)', []);
  J('C', 'S3-admin-product-edit__pickup__1280', '/admin/marketplace/products/9/edit', 'edit #9 (pickup)', []);
  J('C', 'S3-admin-product-edit__not-found__1280', '/admin/marketplace/products/999999/edit', 'unknown id → 404', []);
  J('C', 'S3-admin-product-edit__show-405__1280', '/admin/marketplace/products/1', 'GET /admin/marketplace/products/1 → 405 Symfony page (no show route)', []);
  J('C', 'S3-admin-product-edit__default__375', '/admin/marketplace/products/1/edit', 'edit #1', [], M);
  J('C', 'S3-admin-product-edit__default__768', '/admin/marketplace/products/1/edit', 'edit #1', [], T);

  // ---------------- S4 /admin/marketplace/sellers ----------------
  J('D', 'S4-admin-sellers__default__1280', '/admin/marketplace/sellers', 'sellers (1 seller; stat cards)', [], null, RL);
  J('D', 'S4-admin-sellers__status-pending__1280', '/admin/marketplace/sellers?status=pending', 'status=pending → empty', [], null, RL);
  J('D', 'S4-admin-sellers__status-active__1280', '/admin/marketplace/sellers?status=active', 'status=active', [], null, RL);
  J('D', 'S4-admin-sellers__status-suspended__1280', '/admin/marketplace/sellers?status=suspended', 'status=suspended → empty', [], null, RL);
  J('D', 'S4-admin-sellers__status-banned__1280', '/admin/marketplace/sellers?status=banned', 'status=banned → empty', [], null, RL);
  J('D', 'S4-admin-sellers__default__375', '/admin/marketplace/sellers', 'default', [], M, RL);
  J('D', 'S4-admin-sellers__default__768', '/admin/marketplace/sellers', 'default', [], T, RL);

  // ---------------- S5 /admin/marketplace/sellers/{id} ----------------
  J('E', 'S5-admin-seller-show__default__1280', '/admin/marketplace/sellers/1', 'seller #1 review page ("Haramkan Penjual" never clicked)', []);
  J('E', 'S5-admin-seller-show__not-found__1280', '/admin/marketplace/sellers/999999', 'unknown id → 404', []);
  J('E', 'S5-admin-seller-show__default__375', '/admin/marketplace/sellers/1', 'seller #1', [], M);
  J('E', 'S5-admin-seller-show__default__768', '/admin/marketplace/sellers/1', 'seller #1', [], T);

  // ---------------- S6 /marketplace (buyer) ----------------
  J('F', 'S6-marketplace__default__1280', '/marketplace', 'marketplace (10 products, sort Terbaru)', [], null, RG);
  J('F', 'S6-marketplace__cat-buku__1280', '/marketplace?category=buku-rujukan', 'category=buku-rujukan (chip active)', [], null, RG);
  J('F', 'S6-marketplace__cat-lain__1280', '/marketplace?category=lain-lain', 'category=lain-lain', [], null, RG);
  J('F', 'S6-marketplace__cond-used__1280', '/marketplace?condition=used', 'condition=used (Terpakai)', [], null, RG);
  J('F', 'S6-marketplace__sort-price-low__1280', '/marketplace?sort=price_low', 'sort=price_low', [], null, RG);
  J('F', 'S6-marketplace__sort-popular__1280', '/marketplace?sort=popular', 'sort=popular', [], null, RG);
  J('F', 'S6-marketplace__q-none__1280', '/marketplace?q=zzqxv', 'q with no match → "Tiada Produk Dijumpai"', [], null, RG);
  J('F', 'S6-marketplace__default__375', '/marketplace', 'default', [], M, RG);
  J('F', 'S6-marketplace__default__768', '/marketplace', 'default', [], T, RG);

  // ---------------- S7 /marketplace/{slug} (product page; cached after first GET) ----------------
  J('G', 'S7-product__default__1280', '/marketplace/beg-sekolah-anti-air-premium-vH1Fj', 'product #1 (new, discount, Pos / Kurier, 4 images)', []);
  J('G', 'S7-product__thumb-2__1280', '/marketplace/beg-sekolah-anti-air-premium-vH1Fj', 'second thumbnail clicked (client-side)', [THUMB]);
  J('G', 'S7-product__used__1280', '/marketplace/kamus-dewan-edisi-keempat-terpakai-8axTV', 'product #7 (Terpakai, 2 related)', []);
  J('G', 'S7-product__no-discount__1280', '/marketplace/e-book-1001-soalan-sains-tingkatan-3-pdf-tqd84', 'product #5 (no original price, free shipping)', []);
  J('G', 'S7-product__not-found__1280', '/marketplace/tiada-produk-zzqxv', 'unknown slug → 404', []);
  J('G', 'S7-product__default__375', '/marketplace/beg-sekolah-anti-air-premium-vH1Fj', 'product #1', [], M);
  J('G', 'S7-product__default__768', '/marketplace/beg-sekolah-anti-air-premium-vH1Fj', 'product #1', [], T);

  // ---------------- S8 /marketplace/penjual/{id} (public shop) ----------------
  J('H', 'S8-shop__default__1280', '/marketplace/penjual/1', 'public shop of seller #1 (10 products)', [], null, RG);
  J('H', 'S8-shop__not-found__1280', '/marketplace/penjual/999999', 'unknown seller → 404', [], null, RG);
  J('H', 'S8-shop__default__375', '/marketplace/penjual/1', 'default', [], M, RG);
  J('H', 'S8-shop__default__768', '/marketplace/penjual/1', 'default', [], T, RG);

  // ---------------- S9 /seller/dashboard ----------------
  J('I', 'S9-seller-dashboard__default__1280', '/seller/dashboard', 'seller dashboard "Kedai Saya" (admin is seller #1)', []);
  J('I', 'S9-seller-dashboard__daftar-redirect__1280', '/seller/daftar', '/seller/daftar → redirect to /seller/dashboard (already a seller)', []);
  J('I', 'S9-seller-dashboard__default__375', '/seller/dashboard', 'default', [], M);
  J('I', 'S9-seller-dashboard__default__768', '/seller/dashboard', 'default', [], T);

  // ---------------- S10 /seller/produk ----------------
  J('J', 'S10-seller-products__default__1280', '/seller/produk', 'my products (10)', [], null, RL);
  J('J', 'S10-seller-products__page-2__1280', '/seller/produk?page=2', '?page=2 → empty "Belum Ada Produk"', [], null, RL);
  J('J', 'S10-seller-products__default__375', '/seller/produk', 'default', [], M, RL);
  J('J', 'S10-seller-products__default__768', '/seller/produk', 'default', [], T, RL);

  // ---------------- S11 /seller/produk/tambah ----------------
  J('K', 'S11-seller-product-create__default__1280', '/seller/produk/tambah', 'seller add-product form (never submitted)', []);
  J('K', 'S11-seller-product-create__default__375', '/seller/produk/tambah', 'form', [], M);
  J('K', 'S11-seller-product-create__default__768', '/seller/produk/tambah', 'form', [], T);

  // ---------------- S12 /seller/produk/{id}/edit ----------------
  J('L', 'S12-seller-product-edit__default__1280', '/seller/produk/1/edit', 'seller edit #1 (never saved)', []);
  J('L', 'S12-seller-product-edit__used__1280', '/seller/produk/7/edit', 'seller edit #7 (Terpakai)', []);
  J('L', 'S12-seller-product-edit__not-found__1280', '/seller/produk/999999/edit', 'unknown id → 404', []);
  J('L', 'S12-seller-product-edit__show-405__1280', '/seller/produk/1', 'GET /seller/produk/1 → 405', []);
  J('L', 'S12-seller-product-edit__default__375', '/seller/produk/1/edit', 'edit #1', [], M);
  J('L', 'S12-seller-product-edit__default__768', '/seller/produk/1/edit', 'edit #1', [], T);

  window.__M20_JOBS = jobs;
})();
