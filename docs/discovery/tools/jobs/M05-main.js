// M05 helper: print the <main> content of a saved page (tournament banner removed), trimmed lines.
// usage: node M05-main.js <page.html> [--compact]  (compact drops class/style attrs and svg paths)
const fs = require('fs');
const f = process.argv[2], compact = process.argv.includes('--compact'); let h = fs.readFileSync(f, 'utf8');
const hdr = h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/g) || [];
const a = h.indexOf('<main'), b = h.lastIndexOf('</main>');
let m = h.slice(a, b + 7);
m = m.replace(/<div x-data="tournamentBanner\(\)"[\s\S]*?function tournamentBanner\(\)[\s\S]*?<\/script>/, '[[tournamentBanner]]');
if (compact) m = m.replace(/\s(class|style)="[^"]*"/g, '').replace(/<path[^>]*\/?>(<\/path>)?/g, '').replace(/<svg[^>]*>|<\/svg>/g, '');
console.log('HEADER h1:', hdr.map((x) => x.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()).join(' | '));
console.log(m.split('\n').map((l) => l.trim()).filter((l) => l && !/^<\/?(div|span)>$/.test(l)).join('\n'));
