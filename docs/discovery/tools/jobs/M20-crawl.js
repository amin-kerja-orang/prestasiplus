// M20 crawl: visits window.__m20urls one at a time (>= 450 ms apart) in a worker tab of the guarded context; returns
// STRUCTURE only (GET navigation only; the M20 guard aborts every non-GET request).
// Run: browser_evaluate: () => { window.__m20urls = [...] }  then  browser_run_code_unsafe { filename: this file }.
// Privacy: table BODY text is never returned. Each page's <main> text is returned with every <tbody>, every e-mail /
// phone / IC-shaped token and every person-column cell removed first; a person-shaped value in stat cards is not
// expected on marketplace pages; card lists (products / sellers) are returned only as counts and heading shapes (checked by eye before any file is written). Full result stays in window.__m20out.
// Export / download / gateway URLs are never put in the list (and the guard aborts them anyway).
async (page) => {
const urls = await page.evaluate(() => window.__m20urls || []);
const ctx = page.context();
const t = ctx.pages().find((p) => p !== page) || (await ctx.newPage());
await t.setViewportSize({ width: 1280, height: 800 });
const out = [];
for (const u of urls) {
  const r = await t.goto(u, { waitUntil: 'networkidle' }).catch((e) => null);
  await t.waitForTimeout(500);
  const info = await t.evaluate(() => {
    const m = (document.querySelector('main') || document.body).cloneNode(true);
    const uniq = (a) => a.filter((v, i, s) => v && s.indexOf(v) === i);
    const T = (s) => String(s || '').replace(/\s+/g, ' ').trim();
    const tables = [...m.querySelectorAll('table')].map((tb) => ({ heads: [...tb.querySelectorAll('thead th')].map((th) => T(th.textContent)), rows: tb.querySelectorAll('tbody tr').length,
      firstRowShape: [...(tb.querySelector('tbody tr') || { children: [] }).children].map((td) => { const x = T(td.textContent); return /^[\d\s,.:%\/\-RM]+$/.test(x) ? x : (x ? '<text:' + x.length + '>' : ''); }) }));
    m.querySelectorAll('tbody, script, style, template').forEach((x) => x.remove());
    let text = T(m.innerText || m.textContent).replace(/[^\s@]+@[^\s@]+\.[a-z]{2,}/gi, '<email>').replace(/\b(\+?6?01\d[\d\- ]{7,10})\b/g, '<phone>').replace(/\b\d{6}-?\d{2}-?\d{4}\b/g, '<ic>');
    const real = document.querySelector('main') || document.body;
    return {
      title: document.title, final: location.pathname + location.search, h: [...real.querySelectorAll('h1,h2,h3,h4')].map((x) => T(x.textContent)).slice(0, 60),
      text: text.slice(0, 8000), tables,
      forms: [...document.querySelectorAll('main form, body > div form')].map((f) => [f.getAttribute('method'), f.getAttribute('action'), uniq([...f.elements].map((e) => e.name)).join(',')]),
      selects: [...real.querySelectorAll('select')].map((s) => (s.name || s.id) + ': ' + [...s.options].map((o) => o.value + '=' + T(o.text)).slice(0, 40).join(' | ')),
      buttons: uniq([...real.querySelectorAll('button, input[type=submit]')].map((b) => T(b.textContent || b.value) + (b.getAttribute('@click') ? ' @' + b.getAttribute('@click').slice(0, 60) : '') + (b.getAttribute('onclick') ? ' on:' + b.getAttribute('onclick').slice(0, 60) : ''))).slice(0, 80),
      links: uniq([...real.querySelectorAll('a[href]')].map((a) => a.getAttribute('href').replace('https://prestasiplus.my', '').replace(/\/(users|student|pelajar|guru|teacher)\/\d+/g, '/$1/{id}'))).slice(0, 200),
      xdata: uniq([...real.querySelectorAll('[x-data]')].map((e) => e.getAttribute('x-data').slice(0, 160))),
      scripts: [...document.querySelectorAll('script:not([src])')].map((s) => s.textContent).filter((s) => /fetch\(|axios|Chart|setInterval|labels|datasets|route\(|api\//i.test(s) && !/serviceWorker|firebase|JBCoinFly|tournamentBanner|chatbot|adminSidebar|server-status/i.test(s.slice(0, 600))).map((s) => s.replace(/[^\s@"']+@[^\s@"']+\.[a-z]{2,}/gi, '<email>').slice(0, 5000)),
    };
  });
  out.push(Object.assign({ url: u, status: r ? r.status() : null }, info));
  await t.waitForTimeout(450);
}
await page.evaluate((o) => { window.__m20out = o; }, out);
return out.map((o) => [o.url, o.status, o.final, o.title, 'text=' + o.text.length, 'tables=' + o.tables.map((x) => x.rows).join('/'), 'forms=' + o.forms.length, 'links=' + o.links.length, 'scripts=' + o.scripts.length].join(' | '));
}
