// M17 crawl: visits window.__m17urls one at a time (>=400ms apart) in a worker tab; returns structure (GET only).
// Run: browser_evaluate: () => { window.__m17urls = [...] }  then  browser_run_code_unsafe { filename: this file }.
// SAFETY: GET navigation only. Export / download URLs (/admin/export/*, /admin/monitoring/export/*, *.csv, *.pdf) are never
// put in the list. The result stays in window.__m17out (in-page); only a one-line summary per URL is returned.
async (page) => {
const urls = await page.evaluate(() => window.__m17urls || []);
const ctx = page.context();
const t = ctx.pages().find((p) => p !== page) || (await ctx.newPage());
await t.setViewportSize({ width: 1280, height: 800 });
const out = [];
for (const u of urls) {
  const r = await t.goto(u, { waitUntil: 'networkidle' }).catch((e) => null);
  await t.waitForTimeout(450);
  const info = await t.evaluate(() => {
    const m = document.querySelector('main') || document.body;
    const uniq = (a) => a.filter((v, i, s) => v && s.indexOf(v) === i);
    return {
      title: document.title, final: location.pathname + location.search,
      text: m.innerText.slice(0, 12000),
      forms: [...document.querySelectorAll('main form, body > div form')].map((f) => [f.getAttribute('method'), f.getAttribute('action'), uniq([...f.elements].map((e) => e.name)).join(',')]),
      links: uniq([...m.querySelectorAll('a[href]')].map((a) => a.getAttribute('href').replace('https://prestasiplus.my', ''))).slice(0, 150),
      canvases: [...document.querySelectorAll('canvas')].map((c) => c.id || c.className),
      xdata: uniq([...m.querySelectorAll('[x-data]')].map((e) => e.getAttribute('x-data').slice(0, 200))),
      scripts: [...document.querySelectorAll('script:not([src])')].map((s) => s.textContent).filter((s) => /fetch\(|axios|Chart|setInterval|labels|datasets/i.test(s) && !/serviceWorker|firebase|JBCoinFly|tournamentBanner|chatbot/i.test(s.slice(0, 400))).map((s) => s.slice(0, 8000)),
      srcScripts: [...document.querySelectorAll('script[src]')].map((s) => s.getAttribute('src')).filter((s) => !/googletag|gtag|firebase|cloudflare/i.test(s)),
    };
  });
  out.push(Object.assign({ url: u, status: r ? r.status() : null }, info));
}
await page.evaluate((o) => { window.__m17out = o; }, out);
return out.map((o) => [o.url, o.status, o.final, o.title, o.text.length, 'forms=' + o.forms.length, 'links=' + o.links.length, 'canvas=' + o.canvases.length, 'scripts=' + o.scripts.length].join(' | '));
}
