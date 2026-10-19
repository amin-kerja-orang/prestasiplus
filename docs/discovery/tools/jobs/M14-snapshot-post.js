// M14 snapshot post-processor. usage:
//   (package.json is "type": "module": copy to <scratchpad>/m14/snapshot-post.cjs and run that copy)
//   node <scratchpad>/m14/snapshot-post.cjs <raw.json from M14-snapshot-run.js> <extra.json> <out _snapshot-YYYY-MM-DD.json>
// Replaces the admin account display name with "<admin-account>", then refuses to write when a person-name marker
// (BIN/BINTI/A/L/A/P/@ e-mail) survives. Extractors never read student/teacher names (positional tokens only).
const fs = require('fs');
const [rawP, extraP, outP] = process.argv.slice(2);
let raw = fs.readFileSync(rawP, 'utf8').replace(/Admin PRESTASI\+/g, '<admin-account>');
const pages = JSON.parse(raw), extra = JSON.parse(fs.readFileSync(extraP, 'utf8'));
const out = {
  module: 'M14', date: '2026-09-26', source: 'https://prestasiplus.my (admin session, read-only GETs, browser lane 2)',
  privacy: 'Students "<student:{rank}>", teachers "<teacher:{rank}>", schools "<school:{n}>" (order of first appearance), bank account and holder "<masked>". The admin account name is "<admin-account>". The referral code is the admin account\'s own code.',
  pages: pages.map((p) => ({ url: p.url, finalUrl: p.finalUrl, status: p.status, extractor: p.extractor, data: p.data })),
  ...extra,
};
const s = JSON.stringify(out, null, 1);
const leak = s.match(/\b(BINTI|BIN|A\/L|A\/P|BT\.?|B\.)\s+[A-Z]{2,}|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi);
if (leak) { console.error('possible personal data, not written:', leak.slice(0, 5)); process.exit(1); }
fs.writeFileSync(outP, s);
console.log('wrote', outP, s.length, 'bytes,', out.pages.length, 'pages');
