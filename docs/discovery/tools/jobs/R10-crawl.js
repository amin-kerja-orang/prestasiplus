// R10 crawl / route probe: visits window.__r10urls one at a time (>= 450 ms apart) in a worker tab of the R10-guarded
// context; returns STRUCTURE only (GET navigation only; the R10 guard aborts every non-GET, AI, export and write-shaped
// request, and serves every page from its load-once cache after the first hit).
// Run: browser_evaluate: () => { window.__r10urls = [...] }  then  browser_run_code_unsafe { filename: this file }.
// Adapted from M21-crawl.js. Adds the redirect chain (from the Playwright response chain) so a probe that is bounced
// (302 → /dashboard, /admin-sekolah/pilih-sekolah, /login …) is recorded exactly.
// Privacy: table BODY text is never returned; the <main> text is returned with every <tbody>, e-mail / phone /
// IC-shaped token removed; person names are not expected in headings of these pages (checked by eye before writing).
async (page) => {
const urls = await page.evaluate(() => window.__r10urls || []);
const ctx = page.context();
const t = ctx.pages().find((p) => p !== page) || (await ctx.newPage());
await t.setViewportSize({ width: 1280, height: 800 });
const out = [];
for (const u of urls) {
  const r = await t.goto(u, { waitUntil: 'networkidle' }).catch((e) => null);
  const chain = []; if (r) { let q = r.request(); while (q) { chain.unshift(q.url().replace(/^https?:\/\/[^/]+/, '')); q = q.redirectedFrom(); } }
  await t.waitForTimeout(600);
  const info = await t.evaluate(() => {
    const m = (document.querySelector('main') || document.body).cloneNode(true);
    const uniq = (a) => a.filter((v, i, s) => v && s.indexOf(v) === i);
    const T = (s) => String(s || '').replace(/\s+/g, ' ').trim();
    const tables = [...m.querySelectorAll('table')].map((tb) => ({ heads: [...tb.querySelectorAll('thead th')].map((th) => T(th.textContent)), rows: tb.querySelectorAll('tbody tr').length }));
    m.querySelectorAll('tbody, script, style, template').forEach((x) => x.remove());
    const text = T(m.innerText || m.textContent).replace(/[^\s@]+@[^\s@]+\.[a-z]{2,}/gi, '<email>').replace(/\b(\+?6?01\d[\d\- ]{7,10})\b/g, '<phone>').replace(/\b\d{6}-?\d{2}-?\d{4}\b/g, '<ic>');
    const real = document.querySelector('main') || document.body;
    return {
      title: document.title, final: location.pathname + location.search, h: [...real.querySelectorAll('h1,h2,h3,h4')].map((x) => T(x.textContent)).slice(0, 60),
      text: text.slice(0, 6000), tables,
      forms: [...document.querySelectorAll('form')].map((f) => [f.getAttribute('method'), (f.getAttribute('action') || '').replace(location.origin, ''), uniq([...f.elements].map((e) => e.name)).join(',')]),
      links: uniq([...real.querySelectorAll('a[href]')].map((a) => a.getAttribute('href').replace(location.origin, '').replace(/\/(users|student|pelajar|guru|teacher)\/\d+/g, '/$1/{id}'))).slice(0, 150),
    };
  });
  out.push(Object.assign({ url: u, status: r ? r.status() : null, chain }, info));
  await t.waitForTimeout(450);
}
await page.evaluate((o) => { window.__r10out = (window.__r10out || []).concat(o); }, out);
return out.map((o) => [o.url, o.status, 'chain=' + o.chain.join(' > '), o.final, o.title, 'h=' + o.h.slice(0, 4).join(' / '), 'text=' + o.text.slice(0, 220), 'forms=' + JSON.stringify(o.forms).slice(0, 200), 'links=' + o.links.length].join(' | '));
}
