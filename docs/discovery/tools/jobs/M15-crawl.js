// M15 crawl: visits window.__m15urls one at a time (>=400ms apart) in a worker tab; returns structure (GET only).
async (page) => {
const urls = await page.evaluate(() => window.__m15urls || []);
const ctx = page.context();
const t = ctx.pages().find((p) => p !== page) || (await ctx.newPage());
await t.setViewportSize({ width: 1280, height: 800 });
const out = [];
for (const u of urls) {
  const r = await t.goto(u, { waitUntil: 'networkidle' }).catch((e) => null);
  await t.waitForTimeout(400);
  const info = await t.evaluate(() => {
    const m = document.querySelector('main') || document.body;
    const uniq = (a) => a.filter((v, i, s) => v && s.indexOf(v) === i);
    return {
      title: document.title, final: location.pathname + location.search,
      text: m.innerText.slice(0, 9000),
      forms: [...document.querySelectorAll('main form, body > div form')].map((f) => [f.getAttribute('method'), f.getAttribute('action'), uniq([...f.elements].map((e) => e.name)).join(',')]),
      links: uniq([...m.querySelectorAll('a[href]')].map((a) => a.getAttribute('href').replace('https://prestasiplus.my', ''))).slice(0, 120),
      xdata: uniq([...m.querySelectorAll('[x-data]')].map((e) => e.getAttribute('x-data').slice(0, 200))),
      scripts: [...document.querySelectorAll('script:not([src])')].map((s) => s.textContent).filter((s) => /fetch\(|axios|route|coin|token|syiling|hadiah|tebus|cabutan|mystery|kotak/i.test(s) && !/serviceWorker|firebase|JBCoinFly|tournamentBanner|serverStatus|chatbot/i.test(s.slice(0, 400))).map((s) => s.slice(0, 4000)),
    };
  });
  out.push(Object.assign({ url: u, status: r ? r.status() : null }, info));
}
await page.evaluate((o) => { window.__m15out = o; }, out);
return out.map((o) => [o.url, o.status, o.final, o.title, o.text.length, o.forms.length, o.links.length, o.scripts.length].join(" | "));
}
