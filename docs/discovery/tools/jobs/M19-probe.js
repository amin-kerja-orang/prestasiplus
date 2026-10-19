// M19 page probe (read-only; GET navigation only inside the M19-guarded context). Used for detail / edit / filtered pages
// whose copy must be read but which carry personal data (payer name, e-mail, phone, bill code, bank reference).
// Run: browser_evaluate: () => { window.__m19urls = [...] }  then  browser_run_code_unsafe { filename: this file }.
// For each URL: goto → M19MASK (window.__M19_HELPERS.MASK source, injected from jobs/M19.js) → tools/sanitize.js with the
// M19 options → returns the page's unique leaf texts (masked), headings, forms (method/action/field names), <select>
// options, buttons and links. Result kept in window.__m19probe; only the summary is returned.
async (page) => {
const ROOT = 'D:/Dev Projects/pretasiplus-app/docs/discovery/tools/';
const urls = await page.evaluate(() => window.__m19urls || []);
const ctx = page.context();
const t = ctx.pages().find((p) => p !== page) || (await ctx.newPage());
await t.setViewportSize({ width: 1280, height: 800 });
const out = [];
for (const u of urls) {
  const r = await t.goto(u, { waitUntil: 'networkidle' }).catch(() => null);
  await t.waitForTimeout(500);
  await t.addScriptTag({ path: ROOT + 'jobs/M19.js' });
  const mlog = await t.evaluate(() => eval(window.__M19_HELPERS.MASK));
  await t.addScriptTag({ path: ROOT + 'sanitize.js' });
  const slog = await t.evaluate((o) => window.__sanitize(o), await t.evaluate(() => window.__M19_HELPERS.SAN));
  const info = await t.evaluate(() => {
    const T = (s) => String(s || '').replace(/\s+/g, ' ').trim();
    const uniq = (a) => a.filter((v, i, s) => v && s.indexOf(v) === i);
    const root = document.querySelector('main') || document.body;
    const leaves = []; root.querySelectorAll('*').forEach((el) => { if (el.closest('script,style,template')) return; const own = Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.nodeValue).join(' '); const x = T(own); if (x) leaves.push(x); });
    return { title: document.title, final: location.pathname + location.search, h: [...root.querySelectorAll('h1,h2,h3,h4')].map((x) => T(x.textContent)),
      leaves: uniq(leaves).slice(0, 400),
      forms: [...document.querySelectorAll('main form, body > div form')].map((f) => [f.getAttribute('method'), (f.getAttribute('action') || '').replace('https://prestasiplus.my', ''), uniq([...f.elements].map((e) => e.name + (e.type ? ':' + e.type : '') + (e.required ? '*' : ''))).join(',')]),
      selects: [...root.querySelectorAll('select')].map((s) => (s.name || s.id) + ': ' + [...s.options].map((o) => o.value + '=' + T(o.text) + (o.selected ? '(sel)' : '')).slice(0, 40).join(' | ')),
      buttons: uniq([...root.querySelectorAll('button, input[type=submit]')].map((b) => T(b.textContent || b.value) + (b.getAttribute('@click') ? ' @' + b.getAttribute('@click').slice(0, 80) : '') + (b.getAttribute('onclick') ? ' on:' + b.getAttribute('onclick').slice(0, 80) : ''))),
      links: uniq([...root.querySelectorAll('a[href]')].map((a) => a.getAttribute('href').replace('https://prestasiplus.my', '') + ' :: ' + T(a.textContent).slice(0, 40))).slice(0, 120) };
  });
  out.push(Object.assign({ url: u.replace('https://prestasiplus.my', ''), status: r ? r.status() : null, mask: mlog, san: slog }, info));
  await t.waitForTimeout(450);
}
await page.evaluate((o) => { window.__m19probe = o; }, out);
return out.map((o) => [o.url, o.status, o.final, o.title, 'leaves=' + o.leaves.length, o.mask, o.san].join(' | '));
}
