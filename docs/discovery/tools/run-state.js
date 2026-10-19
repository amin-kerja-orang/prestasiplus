// Inventory state runner (see inventory.js header, step 3). Reads window.__jobs from the MCP tab, runs each job in a worker tab (guest context or logged-in context), stores results in window.__invs.
async (page) => {
const SCRIPT = 'D:/Dev Projects/pretasiplus-app/docs/discovery/tools/inventory.js';
const SANITIZE = 'D:/Dev Projects/pretasiplus-app/docs/discovery/tools/sanitize.js'; // optional personal-data scrubber (job.sanitize)
const jobs = await page.evaluate(() => window.__jobs || []);
const browser = page.context().browser();
async function worker(guest) {
let ctx = guest ? browser.contexts().find((c) => c !== page.context()) : page.context();
if (!ctx) ctx = await browser.newContext();
const ps = ctx.pages().filter((p) => p !== page);
return ps[0] || (await ctx.newPage());
}
const out = [], sum = [];
for (const job of jobs) {
const t = await worker(!!job.guest);
await t.setViewportSize({ width: job.width || 1280, height: job.height || 800 });
let status = null;
if (job.url) { const r = await t.goto(job.url, { waitUntil: 'networkidle' }).catch(() => null); status = r ? r.status() : null; }
const log = [];
for (const a of job.actions || []) {
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
} catch (e) { log.push('ERR ' + JSON.stringify(a).slice(0, 80) + ': ' + String(e).slice(0, 160)); }
}
await t.waitForTimeout(job.settle || 400);
if (job.sanitize) { try { await t.addScriptTag({ path: SANITIZE }); log.push(await t.evaluate((o) => window.__sanitize(o), job.sanitize === true ? {} : job.sanitize)); } catch (e) { log.push('ERR sanitize: ' + String(e).slice(0, 160)); } }
await t.addScriptTag({ path: SCRIPT });
const inv = await t.evaluate((o) => window.__inventory(o), job.opts || {});
if (job.sanitize) { const js = JSON.stringify(inv); inv.meta.piiLeakCheck = await t.evaluate((j) => { const L = window.__sanitizeStrings || []; return { checked: L.length, leaks: L.filter((x) => x.length >= 4 && j.indexOf(x) >= 0).length }; }, js); }
Object.assign(inv.meta, { httpStatus: status, finalUrl: t.url().replace(/^https?:\/\/[^/]+/, ''), session: job.guest ? 'guest' : 'admin', actions: job.actions || [], actionLog: log, file: job.file });
out.push(inv);
sum.push([job.file, inv.meta.finalUrl, status, inv.meta.total, inv.meta.visibleCount, inv.meta.hasHorizontalOverflow ? 'OVERFLOW' : '', inv.meta.piiLeakCheck ? 'pii:' + JSON.stringify(inv.meta.piiLeakCheck) : '', log.join(' ; ').slice(0, 300)].join(' | '));
}
await page.evaluate((o) => { window.__invs = o; }, out);
return sum;
}
