// M20 write-guard (run once on browser lane 1 BEFORE any M20 capture):
//   browser_run_code_unsafe { filename: docs/discovery/tools/jobs/M20-guard.js }
// Marketplace touches orders, carts and money, so the guard follows M19's and adds GET blocks: a context-level route
// ABORTS every request whose method is not GET / HEAD / OPTIONS, with ONE exception — POST /login (re-authentication).
// It also aborts every request to a payment-gateway host, every download / export navigation, and every GET navigation
// whose path looks like a state-changing GET on a shop (add-to-cart, buy, checkout, pay, order create, approve / reject /
// publish / toggle / delete / cancel links, and the product "/whatsapp" contact redirect, which logs a lead), so a GET link that writes can never be followed.
// Blocked requests are logged in context.__m20.blocked (read back: async (page) => page.context().__m20.blocked).
async (page) => {
const ctx = page.context();
await ctx.unrouteAll({ behavior: 'ignoreErrors' });
ctx.__m20 = ctx.__m20 || { blocked: [] };
const S = ctx.__m20;
const GATEWAY = /toyyibpay|billplz|stripe\.com|senangpay|ipay88|chip-in\.asia|gate\.chip|paydibs|molpay|razer|fpx|paypal|curlec|revenuemonster|bizappay/i;
const WRITE_GET = /\/(cart\/(add|remove|update|clear)|add-to-cart|troli\/(tambah|add)|buy|beli|checkout|bayar|pay|payment\/(create|process)|order\/(create|place|store)|orders?\/\d+\/(cancel|approve|reject|ship|complete|refund)|approve|reject|publish|unpublish|toggle|delete|destroy|cancel|batal|lulus|tolak|ban|unban|suspend|verify|export|download|logout|whatsapp|wa|contact-seller|hubungi)(\/|\?|$)/i;
await ctx.route('**/*', async (route) => {
  const req = route.request(); const m = req.method(); const u = req.url(); const p = u.replace(/^https?:\/\/[^/]+/, '');
  const isLogin = m === 'POST' && /^https:\/\/prestasiplus\.my\/login(\?|$)/.test(u);
  if (m !== 'GET' && m !== 'HEAD' && m !== 'OPTIONS' && !isLogin) { S.blocked.push('BLOCK ' + m + ' ' + p.slice(0, 160)); return route.abort('blockedbyclient'); }
  if (GATEWAY.test(u.replace(/^https?:\/\//, '').split('/')[0])) { S.blocked.push('BLOCK gateway ' + u.slice(0, 120)); return route.abort('blockedbyclient'); }
  if (/prestasiplus\.my/.test(u) && (req.isNavigationRequest() || req.resourceType() === 'fetch' || req.resourceType() === 'xhr') && WRITE_GET.test(p.split('?')[0])) { S.blocked.push('BLOCK write-GET ' + p.slice(0, 160)); return route.abort('blockedbyclient'); }
  if (/prestasiplus\.my\/(admin\/export\/|.*\/export(\/|\?|$)|.*\.(csv|xlsx|pdf|zip)(\?|$)|.*\/download(\/|\?|$))/i.test(u) && req.isNavigationRequest()) { S.blocked.push('BLOCK download ' + p.slice(0, 160)); return route.abort('blockedbyclient'); }
  // VIEW-COUNTER CACHE: every GET of a product page /marketplace/{slug} adds 1 to its live "tontonan" counter (verified:
  // 31 → 32 after one fetch). The first GET of each detail page (product /marketplace/{slug}, seller /marketplace/penjual/{id})
  // goes to the server once; every later request for the same URL is fulfilled from this in-memory cache, so inventory
  // states, widths, screenshots and measurements add no further views.
  if (m === 'GET' && /^https:\/\/prestasiplus\.my\/marketplace\/[^/?#]+(\/\d+)?(\?.*)?$/.test(u) && (req.resourceType() === 'document' || req.resourceType() === 'fetch')) {
    S.cache = S.cache || {}; S.hits = S.hits || {};
    const key = u.split('#')[0];
    if (!S.cache[key]) { const resp = await route.fetch(); S.cache[key] = { status: resp.status(), headers: resp.headers(), body: await resp.body() }; S.hits[key] = 0; }
    S.hits[key]++;
    const c = S.cache[key]; const h = Object.assign({}, c.headers); delete h['content-encoding']; delete h['content-length']; delete h['set-cookie'];
    return route.fulfill({ status: c.status, headers: h, body: c.body });
  }
  return route.continue();
});
const probe = await page.evaluate(async () => { try { const x = await fetch('/__m20_probe', { method: 'POST' }); return 'NOT BLOCKED ' + x.status; } catch (e) { return 'POST blocked ok'; } });
const probe2 = await page.evaluate(async () => { try { const x = await fetch('/__m20_probe', { method: 'DELETE' }); return 'NOT BLOCKED ' + x.status; } catch (e) { return 'DELETE blocked ok'; } });
const probe4 = await page.evaluate(async () => { try { const x = await fetch('/marketplace/__m20_probe/whatsapp'); return 'NOT BLOCKED ' + x.status; } catch (e) { return 'whatsapp-GET blocked ok'; } });
const probe3 = await page.evaluate(async () => { try { const x = await fetch('/marketplace/__m20_probe/checkout'); return 'NOT BLOCKED ' + x.status; } catch (e) { return 'write-GET blocked ok'; } });
return ['guard installed', probe, probe2, probe3, probe4, S.blocked.length];
}
