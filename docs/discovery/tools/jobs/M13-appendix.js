// M13 helper (copy of M11-appendix.js): prints the FULL strings that tools/diff-narrative.js would flag (same matching rules, untruncated),
// grouped by screen, as Markdown bullets for the narrative's Appendix A. usage:
//   node tools/jobs/M13-appendix.js inventory/M13 M13-cikgu-alesa.md > appendix.md
const fs = require('fs'), path = require('path');
const [dir, md] = process.argv.slice(2);
const doc = fs.readFileSync(md, 'utf8').toLowerCase().replace(/\s+/g, ' ');
const norm = (s) => String(s).toLowerCase().replace(/\s+/g, ' ').replace(/[🚀🔑🌟👋🇲🇾💾⚙️🕌🌍]/gu, '').trim();
const has = (s) => { const n = norm(s); return !n || n.length < 2 || /^(\s|[(),.·-]|<[a-z:0-9_]+>)*$/.test(n) || doc.includes(n); };
const esc = (s) => String(s).replace(/\s+/g, ' ').trim().replace(/`/g, "'");
const seen = new Set(); // de-duplicated across screens (shared layout strings listed once)
for (const f of fs.readdirSync(dir).filter((f) => /^S\d+-.*\.json$/.test(f)).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)))) {
  const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  const out = [];
  const add = (kind, v) => { const k = norm(v); if (seen.has(k) || has(v)) return; seen.add(k); out.push('- ' + kind + ': `' + esc(v) + '`'); };
  for (const e of j.elements) {
    if (e.text && !/^<(masked|email)>$/.test(e.text) && !/^[\d,.+ ]+$/.test(e.text) && !e.dataRow) add(e.kind, e.text);
    if (e.label) add('label', e.label);
    if (e.placeholder) add('placeholder', e.placeholder);
    if (e.name) add('name', e.name);
    if (e.icon) add('icon', e.icon.split(' ')[0]);
    if (e.alpine && e.alpine['x-text']) for (const m of e.alpine['x-text'].matchAll(/'([^']{3,})'/g)) add('x-text literal', m[1].trim());
    if (e.options) for (const o of e.options) add('option', o.text);
  }
  for (const m of j.jsMessages || []) add('inline-script string (' + m.sources.slice(0, 2).join(',') + ')', m.text);
  if (out.length) { console.log('\n### ' + j.key + ' (`' + j.route + '`)'); console.log(out.join('\n')); }
}
