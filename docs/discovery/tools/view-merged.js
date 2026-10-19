// Compact console view of a merged screen inventory. usage: node view-merged.js <file> [filterStatus]
const j = require(require('path').resolve(process.argv[2]));
const fs = process.argv[3];
console.log(j.key, JSON.stringify(j.summary));
for (const e of j.elements) {
  if (fs && e.status !== fs && e.viewport !== fs) continue;
  const extra = ['name','type','placeholder','href','action','icon','showWhen','hiddenBy','repeatCount'].filter(k => e[k] !== undefined).map(k => k + '=' + JSON.stringify(e[k]).slice(0, 90)).join(' ');
  console.log([e.id.split('-').pop(), e.kind, e.status, e.viewport || '', (e.text || e.label || e.alt || e.ariaLabel || '').slice(0, 70), extra, 'vis:' + e.visibleIn.join(',').slice(0, 120)].join(' | '));
}
