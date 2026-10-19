// M16 post-merge helper (Node, CommonJS; run from a .cjs copy). The single-player game pages (S13–S17) embed a random
// question-bank payload in their Alpine component (betulSalah.statements[40], speedChallenge.questions[30],
// tembakJawapan.questions[30], susunJawapan.puzzles[20], memoryGame.cards[12]). inventory.js harvests every string literal of
// inline scripts into jsMessages, so each merged file carries hundreds of question / option / answer strings that change on
// every load. They are question-bank DATA (store owner M04), not UI copy, so this helper moves them out of jsMessages into
// `payloadStrings` {count, sources, note}; UI literals of the same scripts (result titles, colours, URLs, headers) stay.
// A jsMessage is kept when its text occurs in the page sources with the payload arrays removed (the "UI corpus").
// usage: node M16-payload.cjs <inventory/M16 dir> <ui-corpus.txt>
//   ui-corpus.txt = the raw page sources of the M16 pages with the payload arrays stripped (built in the agent's temporary folder).
const fs = require('fs'), path = require('path');
const [dir, corpusPath] = process.argv.slice(2);
const corpus = fs.readFileSync(corpusPath, 'utf8');
const dec = (s) => s.replace(/\\u([0-9a-fA-F]{4})/g, (m, h) => String.fromCharCode(parseInt(h, 16))).replace(/\\\//g, '/');
const ui = corpus + '\n' + dec(corpus);
for (const f of ['S13-betul-salah.json', 'S14-cabaran-kilat.json', 'S15-tembak-jawapan.json', 'S16-susun-jawapan.json', 'S17-kad-memori.json']) {
  const p = path.join(dir, f); const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (j.payloadStrings) { console.log(f, 'already processed (payload); re-marking data rows'); }
  const keep = [], moved = [];
  for (const m of j.jsMessages || []) {
    const fromAttr = m.sources.every((s) => /^attr:/.test(s));
    if (fromAttr || ui.includes(m.text)) keep.push(m); else moved.push(m);
  }
  j.jsMessages = keep;
  // rendered payload items (the current statement / question / option / falling tile / puzzle tiles / memory cards) are data rows
  const DATA = /statements\[currentIndex\]|questions\[currentIndex\]\.question_text|currentQ\?\.question|puzzles\[currentIndex\]\.question|"x-text":"tile(\.text)?"|answer\(opt\.id|flipCard\(index\)|removeLastPlaced|removeTile\(ti\)|":key":"currentIndex"/;
  let rows = 0;
  for (const e of j.elements) if (DATA.test(JSON.stringify(e.alpine || {}))) { e.dataRow = true; e.note = 'question-bank payload item rendered by the game (random per load; M04 data)'; rows++; }
  const prev = j.payloadStrings || { count: 0, sources: [] };
  j.payloadStrings = { count: prev.count + moved.length, sources: [...new Set(prev.sources.concat(moved.flatMap((m) => m.sources)))], note: 'question-bank payload strings (random per load; M04 data) removed from jsMessages by tools/jobs/M16-payload.js; shape documented in the narrative §6.4' };
  fs.writeFileSync(p, JSON.stringify(j, null, 1));
  console.log(f, 'kept', keep.length, 'moved', moved.length, 'dataRows', rows);
}
