// R10 write / AI guard (Release 1.0 screens: "Heatmap Topik Lemah", "DSKP Heatmap", "Laporan Bulanan").
// Run once on browser lane 3 BEFORE anything else (before the login), and again on every new context:
//   browser_run_code_unsafe { filename: <abs>/docs/discovery/tools/jobs/R10-guard.js }
// Adapted from M21-guard.js. A context-level route (installed on EVERY context of the browser) ABORTS:
//   - every request whose method is not GET / HEAD / OPTIONS, with ONE exception: POST /login (the login itself);
//   - every request to an external host, except static assets (script / stylesheet / font / image GETs) from the
//     CDN allow-list the pages need to render (tailwind, jsdelivr, cdnjs, unpkg, Google fonts, font-awesome);
//     any AI-provider host is always blocked;
//   - every download / export navigation or fetch (csv / xlsx / pdf / zip / export / download / print / cetak);
//   - every write-shaped GET (toggle / delete / mark / send / generate / logout / approve / … see WRITE_GET);
//   - every AI endpoint: /ai…, /api/ai…, any fetch / xhr whose path has an "ai" segment, chat, generate / jana,
//     analyze / analyse, openai, gpt, gemini, claude, anthropic, llm, prompt, completion, ask / tanya, cikgu-alesa
//     API calls, so no AI generation can ever be triggered (Pusat AI pages may call an AI service).
// LOAD-ONCE CACHE: after the login, set ctx.__r10.cacheOn = true (R10-cache-on step). From then on every same-origin
// document / fetch / xhr GET reaches the server ONCE per context; later requests for the same URL are fulfilled from
// memory, so states, widths, screenshots and measurements add no further server hits. /login is never cached.
// Blocked requests are logged in ctx.__r10.blocked; cache hits in ctx.__r10.hits (the side-effect ledger).
// LESSON (R10 run): the follow-up request of a redirect that the guard fulfils from its cache is NOT routed again by
// Playwright, so it bypasses both the cache and the checks below. On R10 every /admin-sekolah/* load therefore hit
// /admin-sekolah/pilih-sekolah (a read-only GET → 500) on the server. Next time, navigate straight to the redirect target
// once (it is then cached) instead of re-loading the redirecting URL for each state / width.
async (page) => {
const browser = page.context().browser();
const AI_HOST = /openai|anthropic|claude\.ai|googleapis\.com\/.*(generative|gemini)|generativelanguage|gemini|mistral|cohere|groq|deepseek|together\.ai|replicate|huggingface|perplexity|x\.ai/i;
const CDN_OK = /^(cdn\.tailwindcss\.com|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|unpkg\.com|fonts\.googleapis\.com|fonts\.gstatic\.com|use\.fontawesome\.com|kit\.fontawesome\.com|ka-f\.fontawesome\.com|www\.gstatic\.com|ui-avatars\.com)$/i;
const WRITE_GET = /\/(toggle|delete|destroy|padam|hapus|remove|mark|tanda|mark-read|read-all|send|hantar|kirim|notify|generate|jana|regenerate|approve|lulus|reject|tolak|suspend|activate|deactivate|assign|store|update|save|simpan|submit|start|mula|begin|finish|complete|selesai|reset|claim|tuntut|redeem|buy|beli|bayar|pay|checkout|subscribe|export|eksport|download|muat-turun|print|cetak|pdf|csv|logout|log-keluar|impersonate|login-as|whatsapp|wa|redirect)(\/|\?|$|\.)/i;
const AI_PATH = /(^\/(ai|api\/ai)(\/|\?|$))|((^|\/)[^/?]*[-_]?ai([-_/?]|$))|chat|generate|\bjana\b|analy[sz]e|openai|\bgpt|gemini|claude|anthropic|\bllm\b|prompt|completion|\/ask(\/|\?|$)|\/tanya(\/|\?|$)|cikgu-alesa\/(api|send|ask|chat)/i;
const DOWNLOAD = /(\/export(\/|\?|$)|\/eksport|\.(csv|xlsx|xls|pdf|zip|docx)(\?|$)|\/download(\/|\?|$)|\/muat-turun|\/print(\/|\?|$)|\/cetak(\/|\?|$))/i;
const out = [];
for (const ctx of browser.contexts()) {
  await ctx.unrouteAll({ behavior: 'ignoreErrors' });
  ctx.__r10 = ctx.__r10 || { blocked: [], cache: {}, hits: {}, cacheOn: false, passed: [] };
  const S = ctx.__r10;
  await ctx.route('**/*', async (route) => {
    const req = route.request(); const m = req.method(); const u = req.url(); const rt = req.resourceType();
    const host = (u.match(/^https?:\/\/([^/]+)/) || [])[1] || '';
    const p = u.replace(/^https?:\/\/[^/]+/, '');
    const own = /^(www\.)?prestasiplus\.my$/i.test(host);
    const isLogin = own && m === 'POST' && /^\/login(\?|$)/.test(p);
    if (/^(data|blob):/.test(u)) return route.continue();
    if (m !== 'GET' && m !== 'HEAD' && m !== 'OPTIONS' && !isLogin) { S.blocked.push('BLOCK ' + m + ' ' + (own ? p : host + p).slice(0, 160)); return route.abort('blockedbyclient'); }
    if (!own) {
      if (AI_HOST.test(host + p)) { S.blocked.push('BLOCK ai-host ' + host); return route.abort('blockedbyclient'); }
      if (CDN_OK.test(host) && /^(script|stylesheet|font|image)$/.test(rt)) return route.continue();
      S.blocked.push('BLOCK external ' + rt + ' ' + host + p.slice(0, 60)); return route.abort('blockedbyclient');
    }
    const po = p.split('?')[0];
    const nav = req.isNavigationRequest(); const api = rt === 'fetch' || rt === 'xhr' || rt === 'eventsource' || rt === 'websocket';
    if ((nav || api) && DOWNLOAD.test(p)) { S.blocked.push('BLOCK download ' + p.slice(0, 160)); return route.abort('blockedbyclient'); }
    if ((nav || api) && WRITE_GET.test(po)) { S.blocked.push('BLOCK write-GET ' + p.slice(0, 160)); return route.abort('blockedbyclient'); }
    if (api && AI_PATH.test(p)) { S.blocked.push('BLOCK ai ' + p.slice(0, 160)); return route.abort('blockedbyclient'); }
    if (nav && /^\/(ai|api\/ai)(\/|\?|$)|openai|\/chat(\/|\?|$)|\/generate/i.test(p)) { S.blocked.push('BLOCK ai-nav ' + p.slice(0, 160)); return route.abort('blockedbyclient'); }
    if (S.cacheOn && m === 'GET' && (rt === 'document' || api) && !/^\/login(\?|$)/.test(p) && !/^\/cdn-cgi\//.test(p)) {
      const key = u.split('#')[0];
      if (!S.cache[key]) { const resp = await route.fetch({ maxRedirects: 0 }); S.cache[key] = { status: resp.status(), headers: resp.headers(), body: await resp.body() }; S.hits[key] = 0; }
      S.hits[key]++;
      const c = S.cache[key]; const h = Object.assign({}, c.headers); delete h['content-encoding']; delete h['content-length']; delete h['set-cookie'];
      return route.fulfill({ status: c.status, headers: h, body: c.body });
    }
    if (rt === 'document' || api) S.passed.push(m + ' ' + p.slice(0, 120));
    return route.continue();
  });
  out.push('guarded ctx pages=' + ctx.pages().length);
}
const ev = async (f) => page.evaluate(f).catch((e) => 'eval-error ' + String(e).slice(0, 60));
const onSite = /prestasiplus\.my/.test(page.url());
const probes = !onSite ? ['(probes need a prestasiplus.my page; re-run after the first navigation)'] : [
  await ev(async () => { try { const x = await fetch('/__r10_probe', { method: 'POST' }); return 'NOT BLOCKED POST ' + x.status; } catch (e) { return 'POST blocked ok'; } }),
  await ev(async () => { try { const x = await fetch('/__r10_probe', { method: 'DELETE' }); return 'NOT BLOCKED DELETE ' + x.status; } catch (e) { return 'DELETE blocked ok'; } }),
  await ev(async () => { try { const x = await fetch('/__r10_probe/toggle'); return 'NOT BLOCKED ' + x.status; } catch (e) { return 'toggle-GET blocked ok'; } }),
  await ev(async () => { try { const x = await fetch('/notifications/__r10_probe/mark-read'); return 'NOT BLOCKED ' + x.status; } catch (e) { return 'mark-GET blocked ok'; } }),
  await ev(async () => { try { const x = await fetch('/__r10_probe/export?format=csv'); return 'NOT BLOCKED ' + x.status; } catch (e) { return 'export-GET blocked ok'; } }),
  await ev(async () => { try { const x = await fetch('/logout'); return 'NOT BLOCKED ' + x.status; } catch (e) { return 'logout-GET blocked ok'; } }),
  await ev(async () => { try { const x = await fetch('/api/ai/__r10_probe'); return 'NOT BLOCKED ' + x.status; } catch (e) { return 'api-ai blocked ok'; } }),
  await ev(async () => { try { const x = await fetch('/pusat-ai/__r10_probe/generate'); return 'NOT BLOCKED ' + x.status; } catch (e) { return 'generate blocked ok'; } }),
  await ev(async () => { try { const x = await fetch('/cikgu-alesa/chat'); return 'NOT BLOCKED ' + x.status; } catch (e) { return 'chat blocked ok'; } }),
  await ev(async () => { try { const x = await fetch('https://api.openai.com/v1/models'); return 'NOT BLOCKED ' + x.status; } catch (e) { return 'openai host blocked ok'; } }),
  await ev(async () => { try { const x = await fetch('https://example.com/'); return 'NOT BLOCKED ' + x.status; } catch (e) { return 'external blocked ok'; } }),
];
return out.concat(probes, ['blocked=' + page.context().__r10.blocked.length]);
}
