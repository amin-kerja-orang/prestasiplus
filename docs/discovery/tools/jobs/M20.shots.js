// M20 masked screenshot plan → docs/discovery/img/M20/. Run M20-guard.js first; load tools/jobs/M20.js FIRST
// (window.__M20_HELPERS), then addScriptTag(this file), then browser_run_code_unsafe{filename: tools/shoot.js}.
// Every shot runs the client-side reveal actions, then M20MASK (e-mail, phone / WhatsApp numbers, wa.me links, avatars)
// and tools/sanitize.js with the M20 options. Read-only: no toggle, delete, ban, save, add, WhatsApp link.
// Product / shop pages come from the guard cache (no extra live views).
// Note: sanitize.js blanks the input named "name" and the "Nama:" value, so the edit-page product-name field / header
// subtitle and the seller-dashboard shop name show as blank / <name> in the PNGs (not personal data; values in the snapshot).
(function () {
  var B = 'https://prestasiplus.my', D = 'docs/discovery/img/M20/';
  var H = window.__M20_HELPERS;
  var MK = { eval: H.MASK };
  function EV(js) { return { eval: '(() => { ' + js + ' })()' }; }
  var S = [];
  function s(file, url, width, actions, extra) { S.push(Object.assign({ file: D + file, url: B + url, width: width || 1280, actions: (actions || []).concat([{ wait: 400 }, MK]), sanitize: H.SAN, settle: 600 }, extra || {})); }
  var VP = { fullPage: false };
  var THUMB = EV("var b = Array.from(document.querySelectorAll('main button[onclick*=setMainImage]'))[1]; if (b) b.click(); return 'thumb';");
  s('admin-products-desktop.png', '/admin/marketplace/products', 1280);
  s('admin-products-tablet.png', '/admin/marketplace/products', 768, [], VP);
  s('admin-products-mobile.png', '/admin/marketplace/products', 375);
  s('admin-products-empty.png', '/admin/marketplace/products?status=draft', 1280, [], VP);
  s('admin-product-create-desktop.png', '/admin/marketplace/products/create', 1280);
  s('admin-product-create-mobile.png', '/admin/marketplace/products/create', 375);
  s('admin-product-create-tablet.png', '/admin/marketplace/products/create', 768, [], VP);
  s('admin-product-edit-desktop.png', '/admin/marketplace/products/1/edit', 1280);
  s('admin-product-edit-mobile.png', '/admin/marketplace/products/1/edit', 375);
  s('admin-product-edit-tablet.png', '/admin/marketplace/products/1/edit', 768, [], VP);
  s('admin-product-show-405.png', '/admin/marketplace/products/1', 1280, [], VP);
  s('admin-sellers-desktop.png', '/admin/marketplace/sellers', 1280);
  s('admin-sellers-tablet.png', '/admin/marketplace/sellers', 768, [], VP);
  s('admin-sellers-mobile.png', '/admin/marketplace/sellers', 375);
  s('admin-sellers-empty.png', '/admin/marketplace/sellers?status=pending', 1280, [], VP);
  s('admin-seller-show-desktop.png', '/admin/marketplace/sellers/1', 1280);
  s('admin-seller-show-tablet.png', '/admin/marketplace/sellers/1', 768, [], VP);
  s('admin-seller-show-mobile.png', '/admin/marketplace/sellers/1', 375);
  s('marketplace-desktop.png', '/marketplace', 1280);
  s('marketplace-tablet.png', '/marketplace', 768, [], VP);
  s('marketplace-mobile.png', '/marketplace', 375);
  s('marketplace-category.png', '/marketplace?category=buku-rujukan', 1280, [], VP);
  s('marketplace-empty.png', '/marketplace?q=zzqxv', 1280, [], VP);
  s('product-desktop.png', '/marketplace/beg-sekolah-anti-air-premium-vH1Fj', 1280);
  s('product-thumb-2.png', '/marketplace/beg-sekolah-anti-air-premium-vH1Fj', 1280, [THUMB], VP);
  s('product-used.png', '/marketplace/kamus-dewan-edisi-keempat-terpakai-8axTV', 1280, [], VP);
  s('product-tablet.png', '/marketplace/beg-sekolah-anti-air-premium-vH1Fj', 768, [], VP);
  s('product-mobile.png', '/marketplace/beg-sekolah-anti-air-premium-vH1Fj', 375);
  s('product-not-found-404.png', '/marketplace/tiada-produk-zzqxv', 1280, [], VP);
  s('shop-desktop.png', '/marketplace/penjual/1', 1280);
  s('shop-tablet.png', '/marketplace/penjual/1', 768, [], VP);
  s('shop-mobile.png', '/marketplace/penjual/1', 375);
  s('seller-dashboard-desktop.png', '/seller/dashboard', 1280);
  s('seller-dashboard-tablet.png', '/seller/dashboard', 768, [], VP);
  s('seller-dashboard-mobile.png', '/seller/dashboard', 375);
  s('seller-products-desktop.png', '/seller/produk', 1280);
  s('seller-products-mobile.png', '/seller/produk', 375);
  s('seller-products-tablet.png', '/seller/produk', 768, [], VP);
  s('seller-products-empty.png', '/seller/produk?page=2', 1280, [], VP);
  s('seller-product-create-desktop.png', '/seller/produk/tambah', 1280);
  s('seller-product-create-mobile.png', '/seller/produk/tambah', 375);
  s('seller-product-edit-desktop.png', '/seller/produk/1/edit', 1280);
  s('seller-product-edit-mobile.png', '/seller/produk/1/edit', 375);
  window.__shots = S;
})();
