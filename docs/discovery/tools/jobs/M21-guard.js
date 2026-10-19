// M21 write-guard (run once on browser lane 1 BEFORE any M21 capture, and again on every new context, e.g. the guest one):
//   browser_run_code_unsafe { filename: docs/discovery/tools/jobs/M21-guard.js }
// Sponsorship / anak angkat touches money, sponsor approvals and student applications, so the guard follows M20's:
// a context-level route (installed on EVERY context of the browser, admin and guest) ABORTS every request whose method
// is not GET / HEAD / OPTIONS, with ONE exception — POST /login (re-authentication).
// It also aborts every request to a payment-gateway host, every download / export navigation, and every GET whose path
// looks like a state-changing GET (approve / reject / suspend / activate / toggle / delete / sponsor / adopt / pay /
// whatsapp / redirect-to-external / logout …), so a GET link that writes can never be followed.
// DETAIL-PAGE CACHE (M20 lesson: detail GETs may count views): every document / fetch GET of an M21 path
// (/admin/sponsors…, /admin/anak-angkat…, /sponsor…, /penaja…, /anak-angkat…, /mohon-keluarga-angkat…, /keluarga-angkat…)
// reaches the server ONCE per context; every later request for the same URL is fulfilled from an in-memory cache, so
// inventory states, widths, screenshots and measurements add no further server hits.
// Blocked requests are logged in context.__m21.blocked; cache hits in context.__m21.hits.
async (page) => {
const browser = page.context().browser();
const GATEWAY = /toyyibpay|billplz|stripe\.com|senangpay|ipay88|chip-in\.asia|gate\.chip|paydibs|molpay|razer|fpx|paypal|curlec|revenuemonster|bizappay/i;
const WRITE_GET = /\/(approve|lulus|luluskan|reject|tolak|suspend|gantung|activate|aktifkan|deactivate|nyahaktif|toggle|delete|destroy|padam|hapus|remove|cancel|batal|verify|sahkan|assign|tetapkan|match|padankan|adopt|ambil|taja|sponsor-now|donate|derma|bayar|pay|payment\/(create|process)|checkout|subscribe|store|update|export|download|muat-turun|logout|log-keluar|whatsapp|wa|redirect|impersonate|login-as)(\/|\?|$)/i;
const M21PATH = /^https:\/\/prestasiplus\.my\/(admin\/sponsors?|admin\/penaja|admin\/anak-angkat|admin\/keluarga-angkat|sponsors?|penaja|anak-angkat|keluarga-angkat|mohon-keluarga-angkat)(\/|\?|$)/i;
const out = [];
for (const ctx of browser.contexts()) {
  await ctx.unrouteAll({ behavior: 'ignoreErrors' });
  ctx.__m21 = ctx.__m21 || { blocked: [], cache: {}, hits: {} };
  const S = ctx.__m21;
  await ctx.route('**/*', async (route) => {
    const req = route.request(); const m = req.method(); const u = req.url(); const p = u.replace(/^https?:\/\/[^/]+/, '');
    const isLogin = m === 'POST' && /^https:\/\/prestasiplus\.my\/login(\?|$)/.test(u);
    if (m !== 'GET' && m !== 'HEAD' && m !== 'OPTIONS' && !isLogin) { S.blocked.push('BLOCK ' + m + ' ' + p.slice(0, 160)); return route.abort('blockedbyclient'); }
    if (GATEWAY.test(u.replace(/^https?:\/\//, '').split('/')[0])) { S.blocked.push('BLOCK gateway ' + u.slice(0, 120)); return route.abort('blockedbyclient'); }
    if (/prestasiplus\.my/.test(u) && (req.isNavigationRequest() || req.resourceType() === 'fetch' || req.resourceType() === 'xhr') && WRITE_GET.test(p.split('?')[0])) { S.blocked.push('BLOCK write-GET ' + p.slice(0, 160)); return route.abort('blockedbyclient'); }
    if (/prestasiplus\.my\/(admin\/export\/|.*\/export(\/|\?|$)|.*\.(csv|xlsx|pdf|zip)(\?|$)|.*\/download(\/|\?|$))/i.test(u) && req.isNavigationRequest()) { S.blocked.push('BLOCK download ' + p.slice(0, 160)); return route.abort('blockedbyclient'); }
    if (m === 'GET' && M21PATH.test(u) && (req.resourceType() === 'document' || req.resourceType() === 'fetch')) {
      const key = u.split('#')[0];
      if (!S.cache[key]) { const resp = await route.fetch({ maxRedirects: 0 }); S.cache[key] = { status: resp.status(), headers: resp.headers(), body: await resp.body() }; S.hits[key] = 0; }
      S.hits[key]++;
      const c = S.cache[key]; const h = Object.assign({}, c.headers); delete h['content-encoding']; delete h['content-length']; delete h['set-cookie'];
      return route.fulfill({ status: c.status, headers: h, body: c.body });
    }
    return route.continue();
  });
  out.push('guarded ctx pages=' + ctx.pages().length);
}
const probe = await page.evaluate(async () => { try { const x = await fetch('/__m21_probe', { method: 'POST' }); return 'NOT BLOCKED ' + x.status; } catch (e) { return 'POST blocked ok'; } });
const probe2 = await page.evaluate(async () => { try { const x = await fetch('/__m21_probe', { method: 'DELETE' }); return 'NOT BLOCKED ' + x.status; } catch (e) { return 'DELETE blocked ok'; } });
const probe3 = await page.evaluate(async () => { try { const x = await fetch('/admin/sponsors/__m21_probe/approve'); return 'NOT BLOCKED ' + x.status; } catch (e) { return 'approve-GET blocked ok'; } });
const probe4 = await page.evaluate(async () => { try { const x = await fetch('/admin/anak-angkat/__m21_probe/toggle'); return 'NOT BLOCKED ' + x.status; } catch (e) { return 'toggle-GET blocked ok'; } });
const probe5 = await page.evaluate(async () => { try { const x = await fetch('/__m21_probe/whatsapp'); return 'NOT BLOCKED ' + x.status; } catch (e) { return 'whatsapp-GET blocked ok'; } });
const probe6 = await page.evaluate(async () => { try { const x = await fetch('/logout'); return 'NOT BLOCKED ' + x.status; } catch (e) { return 'logout-GET blocked ok'; } });
return out.concat([probe, probe2, probe3, probe4, probe5, probe6, 'blocked=' + page.context().__m21.blocked.length]);
}
