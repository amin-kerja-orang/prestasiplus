// Compact console view of a raw inventory file. usage: node view.js <file> [region=content|shell|all] [onlyHidden]
const fs = require('fs');
const j = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const reg = process.argv[3] || 'all', onlyHidden = process.argv[4] === 'hidden';
console.log(JSON.stringify(j.meta.counts), j.meta.repeats && JSON.stringify(j.meta.repeats));
for (const e of j.elements) {
  if (reg !== 'all' && e.region !== reg && !(reg === 'content' && e.region === 'page')) continue;
  if (onlyHidden && e.visible) continue;
  const x = e.options ? ' OPTS=' + e.options.map(o => o.value + ':' + o.text).join(',') : '';
  const f = ['required','maxlength','minlength','min','max','pattern','accept','inputmode','autocomplete','readonly','disabled','optionValue','checked','valueType','action','method','spoofedMethod','enctype','columns','firstRowActions','rowCount'].filter(k => e[k] !== undefined).map(k => k + '=' + JSON.stringify(e[k])).join(' ');
  console.log([e.id.slice(-3), e.kind, e.visible ? 'V' : 'H', (e.text || e.label || e.alt || '').slice(0, 90), e.href || '', e.name || '', e.type || '', e.placeholder || '', e.icon || '', (e.hiddenBy || []).join(), e.showWhen || '', e.alpine ? JSON.stringify(e.alpine).slice(0, 160) : '', f + x].filter((v, i) => i < 3 || v !== '').join(' | '));
}
if (process.argv[5] !== 'nomsg') { console.log('MSG', JSON.stringify(j.messages.map(m => m.text))); console.log('URLS', JSON.stringify(j.urls)); console.log('ALPINE', JSON.stringify(j.alpine.map(a => [a.component || a.xData.slice(0, 60), a.keys.join(','), a.region, a.visible]))); }
