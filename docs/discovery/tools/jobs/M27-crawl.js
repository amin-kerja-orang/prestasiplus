// M27 route probe: GET only with context.request.get(maxRedirects: 0), so a 302 is recorded, never followed (the follow-up
// of a redirect would bypass the guard cache and hit /admin-sekolah/pilih-sekolah, a 500, once per probe). 450 ms apart.
// Only paths taken from user-nav.ts (INFERRED hrefs) plus one nonexistent control. Run after M27-guard.js and the login:
//   browser_run_code_unsafe { filename: this file }
// The second half compares the <main> text of an alias with its /admin twin (identity proof, 0 differing characters).
async (page) => {
const rq = page.context().request;
const paths = ['/admin-sekolah','/admin-sekolah/command-center','/admin-sekolah/monitoring','/admin-sekolah/kirkpatrick','/admin-sekolah/statistik-penggunaan','/admin-sekolah/laporan-aktiviti','/admin-sekolah/pelajar','/admin-sekolah/guru','/admin-sekolah/kelas','/admin-sekolah/dskp-heatmap','/admin-sekolah/laporan-bulanan','/admin-sekolah/pengguna','/admin-sekolah/import-pelajar','/admin-sekolah/aktiviti-guru','/admin-sekolah/langganan','/admin-sekolah/invois','/admin-sekolah/pilih-sekolah','/admin-sekolah/m27-control-nonexistent'];
const BAD = /\/(toggle|delete|destroy|export|download|print|logout|generate|chat|approve|store|update)(\/|\?|$)/i;
const out = [];
for (const p of paths) {
  if (BAD.test(p)) { out.push([p, 'skipped']); continue; }
  const r = await rq.get('https://prestasiplus.my' + p, { maxRedirects: 0 });
  const h = r.headers(); const body = (await r.text()).slice(0, 4000);
  out.push([p, r.status(), h['location'] || '', (body.match(/<title>([^<]*)<\/title>/i) || [])[1] || '']);
  await page.waitForTimeout(450);
}
const norm = (h) => ((h.match(/<main[\s\S]*?<\/main>/i) || [''])[0]).replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
for (const [a, b] of [['/admin-sekolah/monitoring', '/admin/monitoring'], ['/admin-sekolah/kirkpatrick', '/admin/kirkpatrick']]) {
  const ta = norm(await (await rq.get('https://prestasiplus.my' + a, { maxRedirects: 0 })).text()); await page.waitForTimeout(500);
  const tb = norm(await (await rq.get('https://prestasiplus.my' + b, { maxRedirects: 0 })).text()); await page.waitForTimeout(500);
  let d = 0; for (let i = 0; i < Math.min(ta.length, tb.length); i++) if (ta[i] !== tb[i]) d++;
  out.push(['IDENTITY', a, b, ta.length, tb.length, 'diff=' + d]);
}
return out.map((o) => o.join(' | '));
}
