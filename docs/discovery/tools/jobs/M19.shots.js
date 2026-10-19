// M19 masked screenshot plan → docs/discovery/img/M19/. Run M19-guard.js first; load tools/jobs/M19.js FIRST
// (window.__M19_HELPERS), then addScriptTag(this file), then browser_run_code_unsafe{filename: tools/shoot.js}.
// Every shot runs the client-side reveal actions, then M19MASK (payer names, e-mails, bill codes, gateway refs, WhatsApp
// number, avatars) and tools/sanitize.js with the M19 options (Pelajar / Pengguna columns). Read-only: no delete, no bulk
// delete, no status save, no "Langgan" (POST → ToyyibPay), no WhatsApp link, no export.
(function () {
  var B = 'https://prestasiplus.my', D = 'docs/discovery/img/M19/';
  var H = window.__M19_HELPERS;
  var MK = { eval: H.MASK };
  function EV(js) { return { eval: '(() => { ' + js + ' })()' }; }
  var S = [];
  function s(file, url, width, actions, extra) { S.push(Object.assign({ file: D + file, url: B + url, width: width || 1280, actions: (actions || []).concat([{ wait: 400 }, MK]), sanitize: (url.indexOf('/pricing') === 0 || url.indexOf('/billing') === 0) ? H.SANU : H.SAN, settle: 600 }, extra || {})); }
  var VP = { fullPage: false };
  var TICK1 = EV("var c = document.querySelector('main tbody input[type=checkbox]'); if (c) c.click(); return 'tick';");
  var FAQ1 = EV("var el = Array.from(document.querySelectorAll('main [x-data]')).find(function (x) { return /open:\\s*null/.test(x.getAttribute('x-data')); }); if (el) Alpine.$data(el).open = 1; return 'faq';");
  s('payments-desktop.png', '/admin/payments', 1280);
  s('payments-tablet.png', '/admin/payments', 768, [], VP);
  s('payments-mobile.png', '/admin/payments', 375);
  s('payments-tick-one.png', '/admin/payments', 1280, [TICK1], VP);
  s('payments-empty.png', '/admin/payments?status=failed', 1280, [], VP);
  s('payment-show-paid-desktop.png', '/admin/payments/65', 1280);
  s('payment-show-pending.png', '/admin/payments/64', 1280);
  s('payment-show-mobile.png', '/admin/payments/65', 375);
  s('payment-show-tablet.png', '/admin/payments/65', 768, [], VP);
  s('payment-edit-desktop.png', '/admin/payments/65/edit', 1280);
  s('payment-edit-mobile.png', '/admin/payments/65/edit', 375);
  s('payment-edit-tablet.png', '/admin/payments/65/edit', 768, [], VP);
  s('payments-create-500.png', '/admin/payments/create', 1280, [], VP);
  s('payment-not-found-404.png', '/admin/payments/99999999', 1280, [], VP);
  s('billing-desktop.png', '/admin/billing', 1280);
  s('billing-tablet.png', '/admin/billing', 768, [], VP);
  s('billing-mobile.png', '/admin/billing', 375);
  s('dunning-desktop.png', '/admin/dunning', 1280);
  s('dunning-tablet.png', '/admin/dunning', 768, [], VP);
  s('dunning-mobile.png', '/admin/dunning', 375);
  s('dunning-empty.png', '/admin/dunning?event=expired', 1280, [], VP);
  s('pricing-desktop.png', '/pricing', 1280);
  s('pricing-tablet.png', '/pricing', 768, [], VP);
  s('pricing-mobile.png', '/pricing', 375);
  s('pricing-faq-open.png', '/pricing', 1280, [FAQ1, { wait: 400 }, EV("window.scrollTo(0, document.body.scrollHeight); return 'end';")], VP);
  s('invoices-desktop.png', '/billing/invoices', 1280);
  s('invoices-tablet.png', '/billing/invoices', 768, [], VP);
  s('invoices-mobile.png', '/billing/invoices', 375);
  window.__shots = S;
})();
