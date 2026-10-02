// R10 crawl supplement (adapted from M21-crawl-post.js) (node, CommonJS via tools/package.json). Run AFTER merge-inventory.js.
// usage: node tools/jobs/R10-crawl-post.js <crawl-struct.json>
// crawl-struct.json = structural output of tools/jobs/R10-crawl.js (url, HTTP status, final URL, title (person name masked),
// forms, in-page links — no page text). The inventory samples only 3 rows per table / card list, so most row links
// (6 sponsors, 3 applications …) are not in the merged _crawl.json; this script adds every crawled page (kind "probe" with
// its HTTP status) and every in-page link it found (kind "crawl-link"), classified with the same TRACKER + extraModuleRules
// logic as merge-inventory.js. Person-record links keep only their numeric ids (no names).
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../../../..');
const OUT = path.join(ROOT, 'docs/discovery/inventory/R10/_crawl.json');
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'R10.screens.json'), 'utf8'));
const struct = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const tracker = fs.readFileSync(path.join(ROOT, 'docs/TRACKER.md'), 'utf8');
const routeMap = []; let cur = null;
for (const line of tracker.split('\n')) {
  const h = line.match(/^### (M\d\d) /); if (h) { cur = h[1]; continue; }
  if (/^## /.test(line)) cur = null;
  if (!cur || !/^- \[[ x]\]/.test(line)) continue;
  for (const m of line.matchAll(/`(\/[^`\s]*)`/g)) {
    const r = m[1].replace(/\{[^}]+\}/g, '[^/]+').replace(/\/\*$/, '(/.*)?').replace(/\.\.\.$/, '');
    routeMap.push({ re: new RegExp('^' + r + '(/.*)?$'), exact: new RegExp('^' + r + '/?$'), module: cur, route: m[1] });
  }
}
const EXTRA = (cfg.extraModuleRules || []).map(([re, module, note]) => ({ re: new RegExp(re), module, route: note }));
function classify(p) {
  const po = decodeURI(p.split('?')[0]);
  for (const r of EXTRA) if (r.re.test(po)) return { module: r.module, via: r.route };
  let best = null; for (const r of routeMap) if (r.re.test(po) && (!best || r.route.length > best.route.length)) best = r;
  return best ? { module: best.module, via: 'TRACKER ' + best.route } : { module: 'unknown', via: '' };
}
const crawl = JSON.parse(fs.readFileSync(OUT, 'utf8'));
const byUrl = {}; crawl.urls.forEach((u) => { byUrl[u.url] = u; });
function add(url, kind, from, text, status) {
  if (!url) return;
  url = url.replace(/^https?:\/\/(www\.)?prestasiplus\.my/, '').replace(/#.*$/, '');
  if (!url.startsWith('/') || /^\/(cdn-cgi|chatbot)/.test(url)) return;
  let u = byUrl[url];
  if (!u) { const cl = classify(url); const po = url.split('?')[0]; u = byUrl[url] = { url, module: cl.module, via: cl.via, inTracker: routeMap.some((r) => r.exact.test(po)), kinds: [], foundOn: [], texts: [] }; crawl.urls.push(u); }
  if (!u.kinds.includes(kind)) u.kinds.push(kind);
  if (from && !u.foundOn.includes(from)) u.foundOn.push(from);
  if (text && u.texts.length < 4 && !u.texts.includes(text)) u.texts.push(text);
  if (status != null) u.httpStatus = status;
}
for (const s of struct) {
  add(s.url, 'probe', 'R10-crawl', s.title + (s.chain && s.chain.length > 1 ? ' [chain ' + s.chain.join(' > ') + ']' : ''), s.status);
  for (const l of s.links || []) add(l, 'crawl-link', s.url, null, null);
  for (const f of s.forms || []) add(f[1], 'form ' + (f[0] || 'GET'), s.url, f[2], null);
}
// redirect targets and the probe notes (R10)
[['/admin-sekolah/pilih-sekolah', 'redirect target of every existing /admin-sekolah/* route for the platform admin → 500 "Ralat Pelayan"'],
 ['/admin-sekolah/dskp-heatmap', 'R10 S2 route (school-admin sidebar "DSKP Heatmap"; href INFERRED in user-nav.ts, confirmed by 302 vs control 404)'],
 ['/admin-sekolah/laporan-bulanan', 'R10 S3 route (school-admin sidebar "Laporan Bulanan"; href INFERRED in user-nav.ts, confirmed by 302 vs control 404)'],
 ['/sitemap.xml', 'read once: no heatmap / admin-sekolah URL'], ['/robots.txt', 'read once: Disallow /admin-sekolah, /murid/, /guru/, /ibu-bapa/, /sponsor/ …']].forEach(([u, k]) => add(u, k, 'R10 probe notes', null, null));
crawl.urls.sort((a, b) => a.module.localeCompare(b.module) || a.url.localeCompare(b.url));
crawl.total = crawl.urls.length; crawl.supplement = 'tools/jobs/R10-crawl-post.js: probes (with httpStatus and redirect chain) + in-page links of the structural crawl';
fs.writeFileSync(OUT, JSON.stringify(crawl, null, 1));
const mods = {}; crawl.urls.forEach((u) => { mods[u.module] = (mods[u.module] || 0) + 1; });
console.log('total', crawl.total, JSON.stringify(mods));
console.log('unknown:', crawl.urls.filter((u) => u.module === 'unknown').map((u) => u.url).join(' '));
