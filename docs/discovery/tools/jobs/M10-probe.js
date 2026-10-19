// M10 read-only crawl probe: GETs each path in window.__probe (>=800 ms apart) in the worker tab; returns structure (titles, headings, id-normalised links, form method/action/field names, button labels).
async (page) => {
const urls = await page.evaluate(() => window.__probe || []);
const ctx = page.context();
const t = ctx.pages().find((p) => p !== page) || (await ctx.newPage());
await t.setViewportSize({ width: 1280, height: 800 });
const out = [];
for (const u of urls) {
  const r = await t.goto('https://prestasiplus.my' + u, { waitUntil: 'networkidle' }).catch(() => null);
  await t.waitForTimeout(400);
  const info = await t.evaluate(() => {
    const m = document.querySelector('main') || document.body;
    const q = (s) => Array.from(m.querySelectorAll(s));
    const tx = (e) => (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 50);
    const hdr = document.querySelector('header h1, header h2');
    return {
      title: document.title,
      header: hdr ? tx(hdr) : '',
      h1: q('h1,h2').slice(0, 12).map(tx),
      links: Array.from(new Set(q('a[href]').map((a) => a.getAttribute('href').replace(/^https?:\/\/prestasiplus\.my/, '').replace(/\/\d+(?=\/|$|\?)/g, '/{id}')))).slice(0, 60),
      forms: q('form').map((f) => (f.getAttribute('method') || 'get').toUpperCase() + ' ' + (f.getAttribute('action') || '').replace(/^https?:\/\/prestasiplus\.my/, '') + ' [' + Array.from(f.elements).map((e) => e.name).filter(Boolean).join(',') + ']'),
      buttons: q('button').slice(0, 40).map((b) => tx(b) + (b.getAttribute('@click') ? ' {' + b.getAttribute('@click').slice(0, 60) + '}' : '')),
      len: m.innerText.length,
      shell: (function(){ var hrefs = Array.from(document.querySelectorAll('aside a[href]')).map(function(a){return a.getAttribute('href');}).join(' '); return !document.querySelector('aside') ? 'none' : (/\/admin\/users/.test(hrefs) && !/\/practice/.test(hrefs) ? 'admin' : 'user'); })(),
      fetches: Array.from(new Set(Array.from(document.querySelectorAll('script:not([src])')).map(function(s){return s.textContent;}).join(' ').match(/(fetch|axios\.\w+)\s*\(\s*[`'"][^`'"]{2,120}[`'"]/g) || [])).slice(0,30),
    };
  });
  out.push({ u, status: r ? r.status() : null, final: t.url().replace('https://prestasiplus.my', ''), ...info });
  await t.waitForTimeout(400);
}
return out;
}
