// M19 write-guard (run once on browser lane 1 BEFORE any M19 capture):
//   browser_run_code_unsafe { filename: docs/discovery/tools/jobs/M19-guard.js }
// Finance & Subscriptions touches money flows, so the guard is stricter than M05's: a context-level route ABORTS every
// request whose method is not GET / HEAD / OPTIONS, with ONE exception — POST /login (so the lane can re-authenticate
// if the session expires). Everything else (payment gateway callbacks, invoice create, refund, approve, cancel, dunning
// retry, CSRF-refresh POSTs, chatbot, FCM token, analytics beacons) is blocked. It also aborts GET navigations to known
// download / export / gateway hosts (toyyibpay, billplz, stripe, senangpay, ipay88, chip-in, fpx) and /admin/export/*,
// *.csv / *.pdf / *.xlsx downloads, so a stray click can never leave the site or download a file.
// Blocked requests are logged in context.__m19.blocked (read back: async (page) => page.context().__m19.blocked).
async (page) => {
const ctx = page.context();
await ctx.unrouteAll({ behavior: 'ignoreErrors' });
ctx.__m19 = ctx.__m19 || { blocked: [] };
const S = ctx.__m19;
const GATEWAY = /toyyibpay|billplz|stripe\.com|senangpay|ipay88|chip-in\.asia|gate\.chip|paydibs|molpay|razer|fpx|paypal|curlec|revenuemonster/i;
await ctx.route('**/*', async (route) => {
  const req = route.request(); const m = req.method(); const u = req.url(); const p = u.replace(/^https?:\/\/[^/]+/, '');
  const isLogin = m === 'POST' && /^https:\/\/prestasiplus\.my\/login(\?|$)/.test(u);
  if (m !== 'GET' && m !== 'HEAD' && m !== 'OPTIONS' && !isLogin) { S.blocked.push('BLOCK ' + m + ' ' + p.slice(0, 160)); return route.abort('blockedbyclient'); }
  if (GATEWAY.test(u.replace(/^https?:\/\//, '').split('/')[0])) { S.blocked.push('BLOCK gateway ' + u.slice(0, 120)); return route.abort('blockedbyclient'); }
  if (/prestasiplus\.my\/(admin\/export\/|.*\/export(\/|\?|$)|.*\.(csv|xlsx|pdf)(\?|$)|.*\/download(\/|\?|$))/i.test(u) && req.isNavigationRequest()) { S.blocked.push('BLOCK download ' + p.slice(0, 160)); return route.abort('blockedbyclient'); }
  return route.continue();
});
const probe = await page.evaluate(async () => { try { const x = await fetch('/__m19_probe', { method: 'POST' }); return 'NOT BLOCKED ' + x.status; } catch (e) { return 'POST blocked ok'; } });
const probe2 = await page.evaluate(async () => { try { const x = await fetch('/__m19_probe', { method: 'DELETE' }); return 'NOT BLOCKED ' + x.status; } catch (e) { return 'DELETE blocked ok'; } });
return ['guard installed', probe, probe2, S.blocked.length];
}
