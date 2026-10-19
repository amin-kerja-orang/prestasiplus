// M11 helper (audit top-up): keeps element IDs stable after a re-merge. merge-inventory.js numbers elements in first-seen
// order, so new states can shift IDs. This script maps every merged element to the pre-top-up file by a content signature (kind, tag, name, href, text, label, placeholder, landmark, section, showWhen, icon; + occurrence),
// restores the old ID, and gives new elements IDs after the old maximum (appended at the end of the list).
// usage: node tools/jobs/M11-idpin.js <oldDir> <newDir>
const fs = require('fs'), path = require('path');
const [oldDir, newDir] = process.argv.slice(2);
for (const f of fs.readdirSync(newDir).filter((f) => /^S\d+-.*\.json$/.test(f))) {
  const op = path.join(oldDir, f);
  if (!fs.existsSync(op)) { console.log(f, 'no old file — unchanged'); continue; }
  const o = JSON.parse(fs.readFileSync(op, 'utf8')), n = JSON.parse(fs.readFileSync(path.join(newDir, f), 'utf8'));
  const sig = (e) => [e.kind, e.tag, e.name, e.href, e.action, e.text, e.label, e.placeholder, e.landmark, e.section, e.showWhen, e.icon].map((v) => v == null ? '' : String(v)).join('|');
  const oldMap = {}, seenO = {};
  for (const e of o.elements) { const k = sig(e); seenO[k] = (seenO[k] || 0) + 1; oldMap[k + '#' + seenO[k]] = e.id; }
  const prefix = o.elements[0].id.replace(/-\d+$/, '');
  let max = Math.max(...o.elements.map((e) => +e.id.split('-').pop()));
  const seenN = {}; let kept = 0, added = 0; const used = new Set();
  for (const e of n.elements) {
    const k = sig(e); seenN[k] = (seenN[k] || 0) + 1; const id = oldMap[k + '#' + seenN[k]];
    if (id && !used.has(id)) { e.id = id; used.add(id); kept++; } else { e.id = null; }
  }
  for (const e of n.elements) if (!e.id) { e.id = prefix + '-' + String(++max).padStart(3, '0'); e.addedInAuditTopUp = true; added++; }
  const lost = o.elements.filter((e) => !used.has(e.id)).map((e) => e.id);
  n.elements.sort((a, b) => +a.id.split('-').pop() - +b.id.split('-').pop());
  fs.writeFileSync(path.join(newDir, f), JSON.stringify(n, null, 1));
  console.log(f, 'kept', kept, 'added', added, 'old ids not matched', lost.length, lost.slice(0, 5).join(','));
}
