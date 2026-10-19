// M14 dated snapshot runner (read-only GETs, >= 400 ms apart). Run with browser_run_code_unsafe { filename: this file }.
// For every (url, extractor) pair: open in a worker tab of the logged-in context, inject tools/jobs/M14-snapshot.js and
// call window.__m14snap(key). Results are left in window.__m14snapout of the MCP tab; save them with browser_evaluate
// { filename } and post-process with M14-snapshot-post.js (person-free by construction: extractors never read names).
async (page) => {
  const SNAP = 'D:/Dev Projects/pretasiplus-app/docs/discovery/tools/jobs/M14-snapshot.js';
  const B = 'https://prestasiplus.my';
  const P = [
    ['/admin/gamification', 'overview'],
    ['/admin/gamification/tiers', 'forms'],
    ['/admin/gamification/challenges', 'forms'],
    ['/admin/gamification/students', 'students'],
    ['/admin/gamification/students?page=113', 'students'],
    ['/admin/gamification/students?tier=bronze', 'students'],
    ['/admin/gamification/students?tier=silver', 'students'],
    ['/admin/gamification/students?tier=gold', 'students'],
    ['/admin/gamification/students?tier=platinum', 'students'],
    ['/admin/gamification/transactions', 'transactions'],
    ['/admin/gamification/transactions?type=earn', 'transactions'],
    ['/admin/gamification/transactions?type=spend', 'transactions'],
    ['/admin/gamification/transactions?type=convert', 'transactions'],
    ['/admin/gamification/transactions?type=bonus', 'transactions'],
    ['/admin/gamification/transactions?type=refund', 'transactions'],
    ['/admin/gamification/transactions?page=2118', 'transactions'],
    ['/admin/gamifikasi/guru', 'guruAdmin'],
    ['/admin/gamifikasi/guru/tebusan?status=all', 'tebusan'],
    ['/admin/gamifikasi/guru/tunai?status=all', 'tunai'],
    ['/admin/gamifikasi/pengaturan', 'forms'],
    ['/admin/reward-control', 'rewardControl'],
    ['/gamification', 'text'],
    ['/gamification/convert', 'text'],
    ['/gamification/challenges', 'text'],
    ['/gamification/leaderboard', 'leaderboard'],
    ['/gamification/achievements', 'achievements'],
    ['/gamification/referral', 'text'],
    ['/gamification/history', 'text'],
    ['/gamification/kad-kongsi', 'text'],
    ['/guru/gamifikasi', 'text'],
    ['/guru/gamifikasi/tebus-tunai', 'text'],
    ['/guru/gamifikasi/kedai', 'text'],
    ['/guru/gamifikasi/leaderboard', 'guruLeaderboard'],
    ['/guru/gamifikasi/leaderboard?tab=global', 'guruLeaderboard'],
    ['/dashboard', 'header'],
  ];
  const ctx = page.context();
  const t = ctx.pages().find((p) => p !== page) || (await ctx.newPage());
  await t.setViewportSize({ width: 1280, height: 800 });
  const out = [];
  for (const [u, k] of P) {
    const r = await t.goto(B + u, { waitUntil: 'networkidle' }).catch(() => null);
    let data;
    try { await t.addScriptTag({ path: SNAP }); data = await t.evaluate((k) => window.__m14snap(k), k); } catch (e) { data = { error: String(e).slice(0, 200) }; }
    out.push({ url: u, finalUrl: t.url().replace(B, ''), status: r ? r.status() : null, extractor: k, data });
    await t.waitForTimeout(400);
  }
  await page.evaluate((o) => { window.__m14snapout = o; }, out);
  return out.map((o) => o.url + ' ' + o.status + ' ' + (o.data && o.data.error ? 'ERR ' + o.data.error : 'ok'));
}
