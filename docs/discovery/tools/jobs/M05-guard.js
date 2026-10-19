// M05 write-guard (run once per browser lane BEFORE any M05 job):
//   browser_run_code_unsafe { filename: docs/discovery/tools/jobs/M05-guard.js }
// Installs a context-level route that ABORTS every non-GET/HEAD/OPTIONS request (Alpine fetch() POSTs such as
// /practice/start-revision-quiz, /practice/check-answer, /practice/submit-quiz, /report-question, /target-spm, chatbot,
// fcm token …) so a discovery run can never create practice data. Blocked requests are logged in context.__m05.blocked
// (read it back with: async (page) => page.context().__m05.blocked).
async (page) => {
const ctx = page.context();
await ctx.unrouteAll({ behavior: 'ignoreErrors' });
ctx.__m05 = ctx.__m05 || { blocked: [] };
const S = ctx.__m05;
await ctx.route('**/*', async (route) => {
  const req = route.request(); const m = req.method();
  if (m !== 'GET' && m !== 'HEAD' && m !== 'OPTIONS') { S.blocked.push('BLOCK ' + m + ' ' + req.url().replace(/^https?:\/\/[^/]+/, '')); return route.abort('blockedbyclient'); }
  return route.continue();
});
const probe = await page.evaluate(async () => { try { const x = await fetch('/__m05_probe', { method: 'POST' }); return 'NOT BLOCKED ' + x.status; } catch (e) { return 'blocked ok'; } });
return ['guard installed', probe, S.blocked.length];
}
