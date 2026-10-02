// M10: fetches page-specific inline scripts (shell widgets removed) for each path in window.__probe; returns {path: script}.
// Used to document client logic (endpoints, messages, validation). Code only — no personal data is present in these scripts
// except the teacher's own profile link id, which is rewritten to {id}.
async (page) => {
const urls = await page.evaluate(() => window.__probe || []);
const t = page.context().pages().find((p) => p !== page) || (await page.context().newPage());
const out = {};
for (const u of urls) {
  await t.goto('https://prestasiplus.my' + u, { waitUntil: 'networkidle' }).catch(() => null);
  await t.waitForTimeout(400);
  out[u] = await t.evaluate(() => Array.from(document.querySelectorAll('script:not([src])')).map((s) => s.textContent)
    .filter((x) => !/JBCoinFly|tournamentBanner\(\)\s*\{|chatbot|firebase|unread-count|gtag\(|dataLayer/.test(x) && x.trim().length > 30)
    .join('\n/* ---- */\n').replace(/prestasiplus\.my\/guru\/\d+/g, 'prestasiplus.my/guru/{id}'));
  await t.waitForTimeout(400);
}
await page.evaluate((o) => { window.__scr = o; }, out);
return Object.keys(out).map((k) => k + ':' + out[k].length);
}
