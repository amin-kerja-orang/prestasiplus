// M05 helper: turns the remaining diff-narrative candidates into Appendix C of the narrative (grouped, de-duplicated).
// usage: node tools/jobs/M05-appendixC.js   (run from docs/discovery; rewrites everything after "## Appendix C")
const fs = require('fs'), cp = require('child_process');
const MD = 'M05-practice.md';
const out = cp.execSync('node tools/diff-narrative.js inventory/M05 ' + MD).toString();
const groups = { icon: new Set(), card: new Set(), data: new Set(), name: new Set(), js: new Set() };
let screen = '';
for (const line of out.split('\n')) {
  const h = line.match(/^## (S\d+)/); if (h) { screen = h[1]; continue; }
  const p = line.split(' | '); if (p.length < 5) continue;
  const [id, kind, , type, val] = [p[0], p[1], p[2], p[3], p.slice(4).join(' | ')];
  if (id === '(js)') groups.js.add(val);
  else if (type === 'icon') groups.icon.add(val);
  else if (type === 'name') groups.name.add(screen + ': `' + val + '`');
  else if (kind === 'link' || kind === 'card' || kind === 'button') groups.card.add(screen + ': ' + val);
  else groups.data.add(screen + ': ' + val);
}
const md = fs.readFileSync(MD, 'utf8').split('## Appendix C')[0];
const L = (s) => [...s].map((x) => '- ' + x).join('\n');
const C = '## Appendix C — Inventory reconciliation strings\n\n' +
  'Strings the scripted inventory holds that are not quoted verbatim above. They are covered by the screen descriptions as data-driven concatenations or values, icons, field names, or shell script literals.\n\n' +
  '### C.1 Icons used by M05 content (Font Awesome 6 classes)\n\n' + [...groups.icon].sort().map((x) => '`' + x + '`').join(' · ') + '\n\n' +
  '### C.2 Whole-link / button text concatenations and data-driven labels (cards, selectors, pills)\n\n' + L(groups.card) + '\n\n' +
  '### C.3 Data values rendered in text (live counts, dates, percentages for the admin account)\n\n' + L(groups.data) + '\n\n' +
  '### C.4 Field names\n\n' + L(groups.name) + '\n\n' +
  '### C.5 Shell script literals harvested on M05 pages (global shell / PWA / chatbot; not M05 copy)\n\n' + [...groups.js].map((x) => '`' + x + '`').join(' · ') + '\n';
fs.writeFileSync(MD, md + C);
console.log('icons', groups.icon.size, 'cards', groups.card.size, 'data', groups.data.size, 'names', groups.name.size, 'js', groups.js.size);
