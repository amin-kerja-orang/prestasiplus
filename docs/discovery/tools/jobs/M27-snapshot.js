// M27 dated snapshot (read-only). Pages come from the guard cache (worker tab, goto). Reads the KPI cards, table row counts and
// tahap distributions of /admin-sekolah/monitoring and the Kirkpatrick main text of /admin-sekolah/kirkpatrick, and returns the
// guard ledger (blocked, hits, cache keys). Result is saved by hand to inventory/M27/_snapshot-<date>.json. No person data is read.
async (page) => {
const ctx = page.context(); const S = ctx.__m27;
const t = ctx.pages().find((p) => p !== page) || (await ctx.newPage());
await t.setViewportSize({ width: 1280, height: 800 });
await t.goto('https://prestasiplus.my/admin-sekolah/monitoring', { waitUntil: 'networkidle' });
const mon = await t.evaluate(() => {
  const T = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const kpi = [...document.querySelectorAll('main p')].filter((p) => p.nextElementSibling && p.nextElementSibling.tagName === 'P' && /^[\d.,%]+$/.test(T(p.nextElementSibling.textContent))).map((p) => [T(p.textContent), T(p.nextElementSibling.textContent)]);
  const tables = [...document.querySelectorAll('main table')].map((tb) => ({ heads: [...tb.querySelectorAll('thead th')].map((x) => T(x.textContent)), rows: tb.querySelectorAll('tbody tr').length }));
  return { kpi, tables, heads: [...document.querySelectorAll('main h3')].map((h) => T(h.textContent)) };
});
await t.goto('https://prestasiplus.my/admin-sekolah/kirkpatrick', { waitUntil: 'networkidle' });
const kp = await t.evaluate(() => { const T = (s) => String(s || '').replace(/\s+/g, ' ').trim(); const c = document.querySelector('main').cloneNode(true); c.querySelectorAll('select,script,style').forEach((x) => x.remove()); return T(c.innerText).slice(0, 1400); });
return JSON.stringify({ mon, kp, blocked: S.blocked.length, hits: S.hits, cacheKeys: Object.keys(S.cache) });
}
