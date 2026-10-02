// M22 write-guard (run once on browser lane 1 BEFORE any M22 capture, and again on every new context, e.g. a guest one):
//   browser_run_code_unsafe { filename: docs/discovery/tools/jobs/M22-guard.js }
// Notifications & support touch read-state (opening / clicking a notification marks it read), ticket replies / status,
// admin broadcasts (push to every user) and chatbot conversations, so the guard follows M21's and adds:
//   - a context-level route (installed on EVERY context of the browser) that ABORTS every request whose method is not
//     GET / HEAD / OPTIONS, with ONE exception — POST /login (re-authentication);
//   - EXTERNAL HOSTS: every document navigation, fetch / xhr / EventSource / websocket-upgrade / beacon to a host other than
//     prestasiplus.my is aborted (FCM / firebase token registration, analytics, gateways …). Only static sub-resources
//     (script / stylesheet / font / image / media) from CDNs are let through so the page renders;
//   - every download / export navigation;
//   - every write-shaped GET: mark-read / read / read-all / bulk-read / baca / dismiss / delete / padam / toggle / close /
//     tutup / reply / balas / send / hantar / broadcast / push / resolve / selesai / reopen / assign / status / logout …
// DETAIL-PAGE CACHE (M20 lesson: detail GETs may count views or mark read): every document / fetch GET of an M22 path
// (/admin/notifications…, /notifikasi…, /admin/tiket…, /pusat-tuisyen/tiket…, /admin/chatbot…, /chatbot…, guessed
// /tiket…, /bantuan…, /support…, /notifications…) reaches the server ONCE per context; every later request for the same
// URL is fulfilled from an in-memory cache, so inventory states, widths, screenshots and measurements add no server hits.
// Blocked requests are logged in context.__m22.blocked; cache hits in context.__m22.hits.
async (page) => {
const browser = page.context().browser();
const WRITE_GET = /\/(mark-?read|mark-?all-?read|mark-?as-?read|read|read-?all|bulk-?read|bulk-?delete|unread|baca|dibaca|dismiss|abaikan|delete|destroy|padam|hapus|remove|toggle|close|tutup|reply|replies|balas|send|hantar|broadcast|push|resend|test|resolve|resolved|selesai|reopen|buka-semula|assign|tetapkan|status|priority|archive|arkib|clear|kosongkan|approve|lulus|reject|tolak|store|update|export|download|muat-turun|logout|log-keluar|whatsapp|wa|redirect|impersonate|login-as|subscribe|token|fcm-token|save-token)(\/|\?|$)/i;
const M22PATH = /^https:\/\/prestasiplus\.my\/(admin\/notifications?|admin\/notifikasi|notifikasi|notifications?|admin\/tiket|admin\/tickets?|pusat-tuisyen\/tiket|tiket|tickets?|bantuan|support|admin\/chatbot|chatbot|admin\/support|admin\/bantuan)(\/|\?|$)/i;
const STATIC = new Set(['script', 'stylesheet', 'font', 'image', 'media']);
const out = [];
for (const ctx of browser.contexts()) {
  await ctx.unrouteAll({ behavior: 'ignoreErrors' });
  ctx.__m22 = ctx.__m22 || { blocked: [], cache: {}, hits: {} };
  const S = ctx.__m22;
  await ctx.route('**/*', async (route) => {
    const req = route.request(); const m = req.method(); const u = req.url(); const p = u.replace(/^https?:\/\/[^/]+/, '');
    const host = u.replace(/^[a-z]+:\/\//i, '').split('/')[0].split(':')[0];
    const own = /(^|\.)prestasiplus\.my$/i.test(host);
    const isLogin = m === 'POST' && /^https:\/\/prestasiplus\.my\/login(\?|$)/.test(u);
    if (m !== 'GET' && m !== 'HEAD' && m !== 'OPTIONS' && !isLogin) { S.blocked.push('BLOCK ' + m + ' ' + (own ? p : host + p).slice(0, 160)); return route.abort('blockedbyclient'); }
    if (!own && !/^(data|blob):/.test(u) && !STATIC.has(req.resourceType())) { S.blocked.push('BLOCK external ' + req.resourceType() + ' ' + host); return route.abort('blockedbyclient'); }
    if (own && (req.isNavigationRequest() || req.resourceType() === 'fetch' || req.resourceType() === 'xhr' || req.resourceType() === 'eventsource') && WRITE_GET.test(p.split('?')[0])) { S.blocked.push('BLOCK write-GET ' + p.slice(0, 160)); return route.abort('blockedbyclient'); }
    if (own && /\/(admin\/export\/|.*\/export(\/|\?|$)|.*\.(csv|xlsx|pdf|zip)(\?|$)|.*\/download(\/|\?|$))/i.test(p) && req.isNavigationRequest()) { S.blocked.push('BLOCK download ' + p.slice(0, 160)); return route.abort('blockedbyclient'); }
    if (m === 'GET' && M22PATH.test(u) && (req.resourceType() === 'document' || req.resourceType() === 'fetch' || req.resourceType() === 'xhr')) {
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
const P = async (label, url, init) => page.evaluate(async ([u, i, l]) => { try { const x = await fetch(u, i || undefined); return 'NOT BLOCKED ' + l + ' ' + x.status; } catch (e) { return l + ' blocked ok'; } }, [url, init || null, label]);
const probes = [
  await P('POST', '/__m22_probe', { method: 'POST' }),
  await P('DELETE', '/__m22_probe', { method: 'DELETE' }),
  await P('mark-read-GET', '/notifikasi/__m22_probe/mark-read'),
  await P('read-GET', '/notifikasi/__m22_probe/read'),
  await P('read-all-GET', '/notifikasi/read-all'),
  await P('dismiss-GET', '/__m22_probe/dismiss'),
  await P('delete-GET', '/admin/tiket/__m22_probe/delete'),
  await P('toggle-GET', '/admin/chatbot/__m22_probe/toggle'),
  await P('close-GET', '/admin/tiket/__m22_probe/close'),
  await P('reply-GET', '/admin/tiket/__m22_probe/reply'),
  await P('send-GET', '/admin/notifications/send'),
  await P('logout-GET', '/logout'),
  await P('external-fetch', 'https://example.com/__m22_probe'),
];
return out.concat(probes, ['blocked=' + page.context().__m22.blocked.length]);
}
