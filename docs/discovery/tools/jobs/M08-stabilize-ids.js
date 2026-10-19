// Keeps pre-top-up EL IDs stable after a re-merge: elements matching an element of the backup (same signature +
// occurrence) get the old id; new elements get ids after the old maximum. usage: node stabilize-ids.js <backupDir> <mergedDir>
const fs = require('fs'), path = require('path');
const [bdir, mdir] = process.argv.slice(2);
const norm = (s) => String(s || '').replace(/\/\d+(?=[\/|?"']|$)/g, '/{id}').replace(/\d{3,}/g, 'N');
const sig = (e) => [e.kind, e.tag, e.name || '', norm(e.href), norm(e.action), (/^[\d,.%+ -]+$/.test(e.text || '') ? '<num>' : (e.text || e.label || e.placeholder || '')), e.showWhen || '', e.landmark || ''].join('|');
let report = [];
for (const f of fs.readdirSync(mdir).filter((f) => /^(S\d+|SH)/.test(f) && f.endsWith('.json'))) {
  const cur = JSON.parse(fs.readFileSync(path.join(mdir, f), 'utf8'));
  const bf = path.join(bdir, f);
  const prefix = cur.elements.length ? cur.elements[0].id.replace(/-\d+$/, '') : '';
  if (!fs.existsSync(bf)) { report.push(f + ': new screen, ' + cur.elements.length + ' ids'); continue; }
  const old = JSON.parse(fs.readFileSync(bf, 'utf8'));
  const pool = {}; let max = 0;
  for (const e of old.elements) { const n = +e.id.split('-').pop(); max = Math.max(max, n); (pool[sig(e)] = pool[sig(e)] || []).push(e.id); }
  const used = new Set(); let kept = 0, added = 0; const assign = [];
  // pass 1: exact signature matches in order
  for (const e of cur.elements) { const q = pool[sig(e)]; if (q && q.length) { const id = q.shift(); assign.push(id); used.add(id); kept++; } else assign.push(null); }
  // pass 2: new ids
  cur.elements.forEach((e, i) => { if (!assign[i]) { assign[i] = prefix + '-' + String(++max).padStart(3, '0'); added++; } e.id = assign[i]; });
  const lost = old.elements.filter((e) => !used.has(e.id)).map((e) => e.id + ' ' + e.kind + ' ' + String(e.text || e.label || '').slice(0, 40));
  // keep DOM order but ids stable
  fs.writeFileSync(path.join(mdir, f), JSON.stringify(cur, null, 1));
  report.push(f + ': kept ' + kept + ', added ' + added + (lost.length ? ', UNMATCHED OLD ' + lost.length + ': ' + lost.slice(0, 6).join(' ; ') : ''));
}
console.log(report.join('\n'));
