// M18 crawl: visits window.__m18urls one at a time (>=400ms apart) in a worker tab; GET only; returns structure.
// Browser lane 2 (playwright2), admin session. READ-ONLY: no click, no submit.
// PERSONAL DATA: the page text kept in window.__m18out is held in the browser only (never written to the repo); callers
// read structural fields (status, final URL, title, forms, links, x-data) and mask before saving anything.
async (page) => {
const urls = await page.evaluate(() => window.__m18urls || []);
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
      h1: (m.querySelector('h1') || {}).textContent ? m.querySelector('h1').textContent.replace(/\s+/g, ' ').trim() : null,
      text: m.innerText.slice(0, 12000),
      forms: [...document.querySelectorAll('main form, body > div form')].map((f) => [f.getAttribute('method'), f.getAttribute('action'), uniq([...f.elements].map((e) => e.name)).join(',')]),
      links: uniq([...m.querySelectorAll('a[href]')].map((a) => a.getAttribute('href').replace('https://prestasiplus.my', ''))).slice(0, 150),
      xdata: uniq([...m.querySelectorAll('[x-data]')].map((e) => e.getAttribute('x-data').slice(0, 200))),
      scripts: [...document.querySelectorAll('script:not([src])')].map((s) => s.textContent).filter((s) => /fetch\(|axios|Chart|ppd|jpn|sekolah|daerah|negeri|amaran|ranking|heat|export/i.test(s) && !/serviceWorker|firebase|JBCoinFly|tournamentBanner|serverStatus|chatbot/i.test(s.slice(0, 400))).map((s) => s.slice(0, 6000)),
    };
  });
  out.push(Object.assign({ url: u, status: r ? r.status() : null }, info));
}
await page.evaluate((o) => { window.__m18out = (window.__m18out || []).concat(o); }, out);
return out.map((o) => [o.url.replace('https://prestasiplus.my', ''), o.status, o.final, o.title, 'h1=' + o.h1, 'txt=' + o.text.length, 'forms=' + o.forms.length, 'links=' + o.links.length, 'scripts=' + o.scripts.length].join(' | '));
}
