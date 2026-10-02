// Splits a saved batch (array of inventory results) into one raw file per state: <dir>/<meta.file>.json
// usage: node split-batch.js <batch.json> [outDir]
const fs = require('fs'), path = require('path');
const src = process.argv[2], dir = process.argv[3] || path.dirname(src);
const arr = JSON.parse(fs.readFileSync(src, 'utf8'));
for (const inv of arr) {
  const f = path.join(dir, (inv.meta.file || inv.meta.state.replace(/\W+/g, '_')) + '.json');
  fs.writeFileSync(f, JSON.stringify(inv, null, 1));
  console.log('wrote', path.basename(f), inv.meta.total);
}
fs.unlinkSync(src);
