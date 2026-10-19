// Masked screenshot runner (added for M02; reusable). Reads window.__shots from the MCP tab:
//   shot = { file: '<abs or repo-relative png path>', url, width (default 1280), height (default 800), fullPage (default true),
//            actions: [...same as run-state.js...], sanitize: true | {sanitize.js opts} (default true), clip: 'css selector' }
// For each shot: open in the logged-in worker tab, run the client-side actions, run tools/sanitize.js (personal data
// scrubbed from the DOM BEFORE the pixels are taken), then page.screenshot. Returns one summary line per shot.
async (page) => {
const ROOT = 'D:/Dev Projects/pretasiplus-app/';
const SANITIZE = ROOT + 'docs/discovery/tools/sanitize.js';
const shots = await page.evaluate(() => window.__shots || []);
const ctx = page.context();
const t = ctx.pages().find((p) => p !== page) || (await ctx.newPage());
const out = [];
for (const s of shots) {
await t.setViewportSize({ width: s.width || 1280, height: s.height || 800 });
let status = null;
if (s.url) { const r = await t.goto(s.url, { waitUntil: 'networkidle' }).catch(() => null); status = r ? r.status() : null; }
const log = [];
for (const a of s.actions || []) {
try {
if (a.click) await t.locator(a.click).first().click({ timeout: 5000 });
else if (a.hover) await t.locator(a.hover).first().hover({ timeout: 5000 });
else if (a.fill) await t.locator(a.fill[0]).first().fill(a.fill[1], { timeout: 5000 });
else if (a.type) await t.locator(a.type[0]).first().pressSequentially(a.type[1], { delay: 60, timeout: 8000 });
else if (a.check) await t.locator(a.check).first().check({ timeout: 5000, force: true });
else if (a.select) await t.locator(a.select[0]).first().selectOption(a.select[1], { timeout: 5000 });
else if (a.press) await t.keyboard.press(a.press);
else if (a.eval) log.push(await t.evaluate(a.eval));
else if (a.wait) await t.waitForTimeout(a.wait);
} catch (e) { log.push('ERR ' + JSON.stringify(a).slice(0, 60) + ': ' + String(e).slice(0, 100)); }
}
await t.waitForTimeout(s.settle || 500);
if (s.sanitize !== false) { await t.addScriptTag({ path: SANITIZE }); log.push(await t.evaluate((o) => window.__sanitize(o), s.sanitize && s.sanitize !== true ? s.sanitize : {})); }
await t.waitForTimeout(150);
const path = /^[A-Za-z]:|^\//.test(s.file) ? s.file : ROOT + s.file;
if (s.clip) await t.locator(s.clip).first().screenshot({ path });
else await t.screenshot({ path, fullPage: s.fullPage !== false });
out.push([s.file.split('/').pop(), status, log.join(' ; ').slice(0, 160)].join(' | '));
}
return out;
}
