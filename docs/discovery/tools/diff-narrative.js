// Lists inventoried strings/attributes that the narrative discovery doc does not mention.
// usage: node diff-narrative.js <inventoryDir> <narrative.md> [screenKey...]
const fs = require('fs'), path = require('path');
const [dir, md, ...only] = process.argv.slice(2);
const doc = fs.readFileSync(md, 'utf8').toLowerCase().replace(/\s+/g, ' ');
const norm = (s) => String(s).toLowerCase().replace(/\s+/g, ' ').replace(/[🚀🔑🌟👋🇲🇾💾⚙️🕌🌍]/gu, '').trim();
// placeholder-only strings (masked personal data, e.g. '<person> (<email>)') carry no UI copy → skipped (added M02)
const has = (s) => { const n = norm(s); return !n || n.length < 2 || /^(\s|[(),.·-]|<[a-z:0-9_]+>)*$/.test(n) || doc.includes(n); };
for (const f of fs.readdirSync(dir).filter((f) => /^S\d+-.*\.json$/.test(f))) {
  const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  if (only.length && !only.includes(j.key)) continue;
  const miss = [];
  for (const e of j.elements) {
    const checks = [];
    if (e.text && !/^<(masked|email)>$/.test(e.text) && !/^[\d,.+ ]+$/.test(e.text) && !e.dataRow) checks.push(['text', e.text]);
    if (e.label) checks.push(['label', e.label]);
    if (e.placeholder) checks.push(['placeholder', e.placeholder]);
    if (e.name) checks.push(['name', e.name]);
    if (e.icon) checks.push(['icon', e.icon.split(' ')[0]]);
    if (e.alpine && e.alpine['x-text']) for (const m of e.alpine['x-text'].matchAll(/'([^']{3,})'/g)) checks.push(['x-text', m[1].trim()]);
    for (const k of ['maxlength', 'minlength', 'accept', 'autocomplete', 'inputmode', 'pattern', 'min', 'max']) if (e[k]) checks.push([k, k + '=' + e[k] + ' → ' + e[k]]);
    if (e.options) for (const o of e.options) checks.push(['option', o.text]);
    for (const [t, v] of checks) {
      const probe = t === 'maxlength' || t === 'minlength' || t === 'accept' || t === 'autocomplete' || t === 'inputmode' || t === 'pattern' || t === 'min' || t === 'max' ? String(v).split(' → ')[1] : v;
      if (!has(probe)) miss.push([e.id, e.kind, e.status + (e.viewport ? '/' + e.viewport : ''), t, String(v).slice(0, 110)].join(' | '));
    }
  }
  for (const m of j.jsMessages || []) if (!has(m.text)) miss.push(['(js)', 'message', '', m.sources.join(','), m.text.slice(0, 110)].join(' | '));
  console.log('\n## ' + j.key + ' — ' + miss.length + ' candidate(s)');
  miss.forEach((m) => console.log(m));
}
