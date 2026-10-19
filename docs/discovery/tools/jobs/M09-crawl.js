// M09 helper: re-classifies inventory/M09/_crawl.json by module.
// Why: merge-inventory.js builds one regex per TRACKER route as '^' + route + '(/.*)?$'. A TRACKER entry written with
// alternatives (e.g. M08 "`/prestasi/sekolah|tingkatan|...`") then becomes '^/prestasi/sekolah|tingkatan|…' and matches
// every URL, so the whole crawl was classified as M08. This helper applies the same rules with each route wrapped in a
// non-capturing group. The shared tool is not modified.
// usage: node tools/jobs/M09-crawl.js   (run from docs/discovery)
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../../../..');
const tracker = fs.readFileSync(path.join(ROOT, 'docs/TRACKER.md'), 'utf8');
const routeMap = [];
let cur = null;
for (const line of tracker.split('\n')) {
  const h = line.match(/^### (M\d\d) /); if (h) { cur = h[1]; continue; }
  if (/^## /.test(line)) cur = null;
  if (!cur || !/^- \[[ x]\]/.test(line)) continue;
  for (const m of line.matchAll(/`(\/[^`\s]*)`/g)) {
    let r = m[1].replace(/\{[^}]+\}/g, '[^/]+').replace(/\/\*$/, '(/.*)?').replace(/\.\.\.$/, '');
    routeMap.push({ re: new RegExp('^(?:' + r + ')(/.*)?$'), exact: new RegExp('^(?:' + r + ')/?$'), module: cur, route: m[1] });
  }
}
// M09 sub-routes found by this crawl (not yet in the TRACKER checklist) + shared/global URLs
const EXTRA = [
  ['^/admin/(articles|notes|banners|audio-kbat|tools/screenshots)(/.*)?$', 'M09'],
  ['^/(artikel|video|audio-kbat|perutusan)(/.*)?$', 'M09'],
  ['^/(panduan|pusat-tuisyen/panduan)$', 'M09'],
  ['^/guru/artikel(/.*)?$', 'M10'],
  ['^/$', 'global'],
].map(([re, module]) => ({ re: new RegExp(re), module }));
const file = path.join(ROOT, 'docs/discovery/inventory/M09/_crawl.json');
const c = JSON.parse(fs.readFileSync(file, 'utf8'));
for (const u of c.urls) {
  const p = u.url.split('?')[0].replace(/\$\{[^}]+\}/g, '{id}');
  let best = null;
  for (const r of routeMap) if (r.re.test(p) && (!best || r.route.length > best.route.length)) best = r;
  const ex = EXTRA.find((r) => r.re.test(p));
  if (ex && (ex.module === 'M09' || ex.module === 'M10' || !best)) { u.module = ex.module; u.via = best && best.module === ex.module ? 'TRACKER ' + best.route : 'M09-crawl rule'; }
  else if (best) { u.module = best.module; u.via = 'TRACKER ' + best.route; }
  else { u.module = 'unknown'; u.via = ''; }
  u.inTracker = routeMap.some((r) => r.exact.test(p.replace(/\{id\}/g, 'x')));
}
c.urls.sort((a, b) => a.module.localeCompare(b.module) || a.url.localeCompare(b.url));
c.reclassifiedBy = 'tools/jobs/M09-crawl.js';
fs.writeFileSync(file, JSON.stringify(c, null, 1));
const by = {}; for (const u of c.urls) by[u.module] = (by[u.module] || 0) + 1;
console.log(c.total, JSON.stringify(by));
console.log('unknown:', c.urls.filter((u) => u.module === 'unknown').map((u) => u.url).join(' '));
console.log('M09 not in TRACKER:');
const seen = new Set();
for (const u of c.urls.filter((x) => x.module === 'M09' && !x.inTracker)) {
  const k = u.url.split('?')[0].replace(/\/\d+(?=\/|$)/g, '/{id}').replace(/^\/artikel\/[a-z0-9-]+$/, '/artikel/{slug}');
  if (seen.has(k)) continue; seen.add(k); console.log('  ' + k + '  [' + u.kinds.join(',') + '] from ' + u.foundOn.slice(0, 4).join(','));
}
