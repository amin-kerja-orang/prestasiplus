// M16 seed snapshot builder (Node, CommonJS; run from a .cjs copy because the repo package.json is "type": "module").
// usage: node M16-snapshot.cjs <snap-src.json> <out.json>
//   <snap-src.json> = one read-only GET pass over the M16 data pages made in the browser (fetch, credentials included; kept only in the
//   agent's temporary folder and deleted afterwards). This script parses it with jsdom and writes ONLY non-personal values:
//   - students → "<student:n>" (n = order of first appearance in this snapshot; the same person keeps the same n across pages);
//   - schools → "<school:{id}>" when the live id is known from a /battle/ranking-sekolah/{id} link, else "<school:sb-r{rank}>"
//     (sekolah-bersaing, no id on the page) — names are never written; states / PPD / type codes are kept;
//   - question-bank items are summarised by counts and enumerations only.
const fs = require('fs');
const { JSDOM } = require('D:/Dev Projects/pretasiplus-app/node_modules/jsdom');
const [src, outPath] = process.argv.slice(2);
const S = JSON.parse(fs.readFileSync(src, 'utf8'));
const T = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const num = (s) => { const v = T(s).replace(/[,%#]/g, ''); return v === '' || isNaN(+v) ? T(s) : +v; };
const people = new Map(); const P = (name) => { const k = T(name).toUpperCase().replace(/\.\.\.$/, ''); if (!k) return null; if (!people.has(k)) people.set(k, people.size + 1); return '<student:' + people.get(k) + '>'; };
const schoolIds = new Map(); // upper name -> id
const SCH = (name, id) => { const k = T(name).toUpperCase(); if (id) schoolIds.set(k, id); const i = id || schoolIds.get(k); return i ? '<school:' + i + '>' : null; };
function doc(path) { const p = S.pages[path]; if (!p || !p.body) return null; return new JSDOM(p.body).window.document; }
const main = (d) => d.querySelector('main') || d.body;
const out = { module: 'M16', capturedFrom: 'https://prestasiplus.my (read-only GET pass, admin session, browser lane 3)', startedAt: S.startedAt, endedAt: S.endedAt, timezoneNote: 'timestamps are UTC; MYT = UTC+8', privacy: 'students tokenised <student:n>; schools <school:{id}> or <school:sb-r{rank}>; no names or e-mails', pages: {} };

// ---- battle ranking sekolah (all periods) ----
function ranking(path) {
  const d = doc(path); if (!d) return null; const m = main(d);
  const active = Array.from(m.querySelectorAll('a[href*="ranking-sekolah?period="]')).filter((a) => /bg-blue-500/.test(a.className)).map((a) => T(a.textContent));
  const stateSel = m.querySelector('select option[selected]');
  const rows = Array.from(m.querySelectorAll('tbody tr')).map((tr) => {
    const a = tr.querySelector('a[href*="/ranking-sekolah/"]'); if (!a) return { empty: T(tr.textContent) };
    const id = +a.getAttribute('href').match(/ranking-sekolah\/(\d+)/)[1]; const ps = a.querySelectorAll('p'); SCH(ps[0].textContent, id);
    const td = tr.querySelectorAll('td'); const msk = Array.from(td[3].querySelectorAll('span')).map((s) => +T(s.textContent));
    return { rank: num(td[0].textContent), school: '<school:' + id + '>', schoolId: id, stateAndType: T(ps[1] && ps[1].textContent), battles: num(td[2].textContent), menang: msk[0], seri: msk[1], kalah: msk[2], ketepatan: T(td[4].textContent), pelajar: num(td[5].textContent), skor: num(td[6].textContent) };
  });
  const podium = []; const podBox = m.querySelector('.grid.grid-cols-3');
  if (podBox) Array.from(podBox.children).forEach((c, i) => { const ps = c.querySelectorAll('p'); const nm = ps[0] ? T(ps[0].textContent) : ''; podium.push({ column: i + 1, school: SCH(nm) || '<school:?>', state: ps[1] ? T(ps[1].textContent) : null, points: num((c.textContent.match(/(\d[\d,]*)\s*mata/) || [])[1]) }); });
  return { status: S.pages[path].status, activePill: active, stateSelected: stateSel ? stateSel.getAttribute('value') : '', rows, podium };
}
['/battle/ranking-sekolah', '/battle/ranking-sekolah?period=monthly', '/battle/ranking-sekolah?period=all_time', '/battle/ranking-sekolah?period=all_time&state=Johor', '/battle/ranking-sekolah?period=all_time&state=Selangor'].forEach((p) => { out.pages[p] = ranking(p); });
{ const d = doc('/battle/ranking-sekolah'); const h = d && d.querySelector('h1'); out.pages['/battle/ranking-sekolah'].shellSubtitle = h ? T(h.parentElement.querySelector('p') && h.parentElement.querySelector('p').textContent) : null; }

// ---- school detail ----
['8106', '8090', '8078', '8082', '8880', '8080', '2710'].forEach((id) => {
  const path = '/battle/ranking-sekolah/' + id; const d = doc(path); if (!d) return; const m = main(d);
  const sub = T(m.querySelector('h2') && m.querySelector('h2').nextElementSibling && m.querySelector('h2').nextElementSibling.textContent);
  const cards = {}; m.querySelectorAll('div.text-center.shadow').forEach((c) => { const v = c.querySelector('div.font-bold'); const l = c.querySelector('p'); if (v && l) cards[T(l.textContent)] = num(v.textContent); });
  const periods = {}; m.querySelectorAll('h4').forEach((h) => { const box = h.parentElement; const o = {}; box.querySelectorAll('div > span:first-child').forEach((s) => { if (s.nextElementSibling) o[T(s.textContent)] = T(s.nextElementSibling.textContent); }); const e = box.querySelector('p'); periods[T(h.textContent)] = Object.keys(o).length ? o : { empty: e ? T(e.textContent) : null }; });
  const fighters = []; const h3s = Array.from(m.querySelectorAll('h3'));
  const hp = h3s.find((h) => /Pejuang/.test(h.textContent)); if (hp) { const e = hp.parentElement.querySelector('p'); fighters.push(e ? { empty: T(e.textContent) } : { rows: 'present' }); }
  const hb = h3s.find((h) => /Battle Terkini/.test(h.textContent));
  const battles = hb ? Array.from(hb.parentElement.querySelectorAll('.space-y-2 > div')).map((r) => { const sp = r.querySelectorAll('span'); return { playerA: P(sp[0].textContent), playerAColor: /blue/.test(sp[0].className) ? 'blue' : 'slate', scoreA: num(sp[1].textContent), scoreAWinner: /green/.test(sp[1].className), scoreB: num(sp[3].textContent), scoreBWinner: /green/.test(sp[3].className), playerB: P(sp[4].textContent), when: T(sp[5].textContent) }; }) : [];
  out.pages[path] = { status: S.pages[path].status, school: '<school:' + id + '>', subtitle: sub, cards, periods, pejuangTerbaik: fighters, battleTerkini: battles };
});

// ---- battle leaderboard / history / tournament / api ----
{ const d = doc('/battle/leaderboard'); out.pages['/battle/leaderboard'] = { status: S.pages['/battle/leaderboard'].status, rows: Array.from(main(d).querySelectorAll('tbody tr')).map((tr) => T(tr.textContent)) }; }
{ const d = doc('/battle/history'); out.pages['/battle/history'] = { status: S.pages['/battle/history'].status, text: T(main(d).querySelector('h3') && main(d).querySelector('h3').textContent) }; }
{ const d = doc('/tournament'); const m = main(d); out.pages['/tournament'] = { status: S.pages['/tournament'].status, empty: T(Array.from(m.querySelectorAll('p')).map((p) => p.textContent).find((t) => /Tiada tournament/.test(t))), createLink: !!m.querySelector('a[href$="/tournament/admin/create"]') }; }
['/api/tournament/active', '/api/battle/invitations'].forEach((p) => { out.pages[p] = { status: S.pages[p].status, body: JSON.parse(S.pages[p].body) }; });

// ---- permainan hub ----
{ const d = doc('/permainan'); const m = main(d); out.pages['/permainan'] = { status: S.pages['/permainan'].status, openRoomsText: Array.from(m.querySelectorAll('p')).slice(1, 3).map((p) => T(p.textContent)),
  cards: Array.from(m.querySelectorAll('div[onclick]')).map((c) => ({ href: (c.getAttribute('onclick').match(/'(https?:\/\/[^']+)'/) || [])[1].replace('https://prestasiplus.my', ''), badge: T(c.querySelector(':scope > span') && c.querySelector(':scope > span').textContent) || null, title: T(c.querySelector('h3').textContent), chips: Array.from(c.querySelectorAll('h3 ~ p + div span, h3 ~ div span')).map((s) => T(s.textContent)), button: T(c.querySelector('a').textContent) })) }; }

// ---- lobbies (Pendahulu) ----
['/perang-fakta', '/benteng-ilmu', '/perlumbaan-matematik', '/kuiz-relay', '/teka-silang-kata'].forEach((p) => {
  const d = doc(p); const m = main(d); const h = Array.from(m.querySelectorAll('h2')).find((x) => /Pendahulu/.test(x.textContent));
  const rows = h && h.nextElementSibling ? Array.from(h.nextElementSibling.children).map((r) => { const sp = r.querySelectorAll('span'); const t = T(sp[0].textContent); const mm = t.match(/^(🥇|🥈|🥉|\d+\.)\s+(.*)$/); return { rank: mm ? mm[1] : null, player: P(mm ? mm[2] : t), value: T(sp[1].textContent) }; }) : [];
  out.pages[p] = { status: S.pages[p].status, finalUrl: S.pages[p].url, autoGrade: T((m.querySelector('[x-show="!manualMode"] span') || {}).textContent), leaderboard: rows, note: 'ties: the order of equal values differs between requests (observed on two loads)' };
});

// ---- papan bijak top 10 ----
{ const d = doc('/papan-bijak'); const m = main(d); out.pages['/papan-bijak'] = { status: S.pages['/papan-bijak'].status, top10: Array.from(m.querySelectorAll('table tbody tr')).map((tr) => { const td = tr.querySelectorAll('td'); const nm = td[1].querySelector('span'); const kad = td[4].querySelector('span');
  return { rank: T(td[0].textContent), player: P(nm.textContent), nameTruncatedOnLive: /\.\.\.$/.test(T(nm.textContent)), initialsLength: T(td[1].querySelector('div > div').textContent).length, menang: num(td[2].textContent), jumlah: num(td[3].textContent), kadar: T(kad.textContent), kadarPill: (kad.getAttribute('style').match(/background: ?(#[0-9A-F]+)/i) || [])[1], skor: num(td[5].textContent), betul: num(td[6].textContent) }; }) }; }

// ---- pertandingan mingguan ----
{ const d = doc('/permainan/pertandingan'); const m = main(d); const ps = Array.from(m.querySelectorAll('p')).map((p) => T(p.textContent));
  const rows = Array.from(m.querySelectorAll('.divide-y > div')).map((r) => { const nm = r.querySelector('p.font-bold'); const ps2 = r.querySelectorAll('p'); return { rank: T(r.firstElementChild.textContent), rowHighlight: (r.className.match(/from-\w+-50|bg-\w+-50/) || [null])[0], player: P(nm.textContent), sesi: T(ps2[1].textContent), betul: num(ps2[2].textContent), tepat: T(ps2[4].textContent) }; });
  const sc = (S.pages['/permainan/pertandingan'].body.match(/new Date\('([^']+)'\)/) || [])[1];
  out.pages['/permainan/pertandingan'] = { status: S.pages['/permainan/pertandingan'].status, weekLabel: ps[ps.indexOf('📅 Minggu Ini') + 1], weekEndLiteral: sc, prizes: ps.filter((t) => /🪙$/.test(t)), myState: ps.find((t) => /Belum mula|Kedudukan/.test(t)) || null, rows }; }

// ---- roda nasib / jutawan / betul-salah / cabaran-kilat personal stats (admin account) ----
{ const b = S.pages['/permainan/roda-nasib'].body; const seg = JSON.parse(b.match(/const segments = (\[[\s\S]*?\]);/)[1]); const d = doc('/permainan/roda-nasib');
  out.pages['/permainan/roda-nasib'] = { status: 200, statChips: Array.from(main(d).querySelectorAll('div[style*="border-radius:12px"]')).map((x) => T(x.textContent)), alreadySpunInitial: /alreadySpun: (true|false)/.exec(b)[1], segments: seg, weightTotal: seg.reduce((a, s) => a + s.weight, 0) }; }
{ const out2 = {}; for (let dj = 1; dj <= 11; dj++) { const p = '/permainan/jutawan?darjah=' + dj; const d = doc(p); const m = main(d); out2[dj] = { status: S.pages[p].status, heading: T((Array.from(m.querySelectorAll('p')).find((x) => /PILIH SUBJEK/.test(x.textContent)) || {}).textContent) || null,
  subjects: Array.from(m.querySelectorAll('a[href*="/jutawan/main"]')).map((a) => ({ subjectId: +a.getAttribute('href').match(/subject=(\d+)/)[1], name: T(a.querySelector('p').textContent), soalan: T(a.querySelector('span:not(:first-child)') ? Array.from(a.querySelectorAll('span')).map((s) => T(s.textContent)).find((t) => /soalan/.test(t)) : '') })), stats: Array.from(m.querySelectorAll('p')).slice(0, 8).map((x) => T(x.textContent)).filter((t) => /^(L\d+|\d[\d,]*|1,000🪙)$/.test(t)) }; }
  out.pages['/permainan/jutawan?darjah=1..11'] = out2; }
['/permainan/betul-salah?darjah=4', '/permainan/cabaran-kilat?darjah=4'].forEach((p) => { const b = S.pages[p].body; const arr = JSON.parse((b.match(/(?:statements|questions): (\[\{[\s\S]*?\}\]),\n/) || [])[1] || '[]');
  out.pages[p] = { status: S.pages[p].status, personalBest: +((b.match(/personalBest: (\d+)/) || [])[1]), items: arr.length, byDifficulty: arr.reduce((a, q) => { a[q.difficulty] = (a[q.difficulty] || 0) + 1; return a; }, {}), trueFalse: arr[0] && 'is_true' in arr[0] ? arr.reduce((a, q) => { a[q.is_true] = (a[q.is_true] || 0) + 1; return a; }, {}) : undefined, sampleIds: arr.slice(0, 5).map((q) => q.id), note: 'item set is random per request' }; });

// ---- sekolah bersaing ----
{ const d = doc('/sekolah-bersaing'); const m = main(d); const hdr = T((Array.from(m.querySelectorAll('div')).find((x) => /^Minggu /.test(T(x.textContent)) && x.children.length <= 2) || {}).textContent);
  const rows = Array.from(m.querySelectorAll('.lb-row:not(.head)')).map((r) => { const sc = r.querySelector('.school'); const nm = Array.from(sc.childNodes).filter((n) => n.nodeType === 3).map((n) => n.nodeValue).join(' '); const rank = T(r.querySelector('.rank').textContent); const nums = r.querySelectorAll('.num');
    const tok = SCH(nm) || '<school:sb-r' + rank.replace(/[#🥇🥈🥉]/gu, '') + '>';
    return { rank, rowClass: T(r.className.replace('lb-row', '')), school: tok, schoolClass: T(sc.className), state: T(sc.querySelector('.state') && sc.querySelector('.state').textContent), aktif: T(nums[0].childNodes[0].nodeValue), streakAvg: T(nums[1].textContent), notaPer10: T(nums[2].childNodes[0].nodeValue) }; });
  rows.forEach((r, i) => { if (/sb-r/.test(r.school)) r.school = '<school:sb-r' + (i + 1) + '>'; });
  out.pages['/sekolah-bersaing'] = { status: 200, header: hdr, rowCount: rows.length, rows }; }

// ---- liga ----
{ const d = doc('/liga'); const m = main(d); out.pages['/liga'] = { status: 200, tabs: Array.from(m.querySelectorAll('button[\\@click^="tab ="]')).map((b) => T(b.textContent)), open: Array.from(m.querySelectorAll('a[href*="/liga/"]')).filter((a) => /\/liga\/\d+$/.test(a.getAttribute('href'))).map((a) => ({ id: +a.getAttribute('href').match(/(\d+)$/)[1], title: T(a.querySelector('h3').textContent), chips: Array.from(a.querySelectorAll('span')).map((s) => T(s.textContent)).filter(Boolean) })) }; }
['/liga/1', '/liga/2'].forEach((p) => { const d = doc(p); const m = main(d); const txt = Array.from(m.querySelectorAll('span, p')).map((x) => T(x.textContent));
  const code = txt[txt.indexOf('Kod Jemputan') + 1];
  const peserta = []; const hp = Array.from(m.querySelectorAll('h3')).find((h) => /Sekolah Peserta/.test(h.textContent)); if (hp) hp.parentElement.querySelectorAll(':scope > div > span').forEach((x) => { const s = SCH(T(x.textContent)); peserta.push({ school: s || '<school:?>', highlighted: !/bg-slate-100/.test(x.className) }); });
  const boards = {}; m.querySelectorAll('[x-show^="activeLevel"]').forEach((b) => { const lvl = b.getAttribute('x-show').match(/'(\w+)'/)[1]; boards[lvl] = Array.from(b.querySelectorAll('tbody tr')).map((tr) => { const td = tr.querySelectorAll('td'); const nm = T(td[1].textContent); const k = Array.from(schoolIds.keys()).find((n) => nm.toUpperCase().startsWith(n)); return { rank: T(td[0].textContent), school: k ? '<school:' + schoolIds.get(k) + '>' : '<school:?>', ppdState: T(td[1].querySelector('p:last-child, div:last-child') ? td[1].querySelector('p:last-child, div:last-child').textContent : ''), peserta: num(td[2].textContent), skor: T(td[3].textContent), purata: T(td[4].textContent) }; }); });
  const creator = (txt.find((t) => /Dicipta oleh/.test(t)) || '').replace(/Dicipta oleh .*? ·/, 'Dicipta oleh <creator> ·');
  out.pages[p] = { status: S.pages[p].status, title: T(d.title), shellSubtitle: T((d.querySelector('h1') || {}).parentElement && d.querySelector('h1').parentElement.querySelector('p') ? d.querySelector('h1').parentElement.querySelector('p').textContent : ''), chips: txt.filter((t) => /^(Akan Datang|Tamat|Sedang Berlangsung|Aktif)$|\/\d{4}$|sekolah$|Markah|Ketepatan|Kemenangan/.test(t)).slice(0, 8), creatorLine: creator, creatorIsSystemAdmin: /Dicipta oleh Admin/.test(txt.join(' ')), inviteCode: code, sertaiButton: !!m.querySelector('form[action$="/liga/sertai"]'), peserta, leaderboards: boards, leaderboardEmpty: T((Array.from(m.querySelectorAll('p')).find((x) => /Belum ada data/.test(x.textContent)) || {}).textContent) || null }; });

// ---- admin permainan ----
{ const d = doc('/admin/permainan'); const m = main(d); const stats = {}; m.querySelectorAll('.grid > div').forEach((c) => { const ds = c.querySelectorAll(':scope > div'); if (ds.length === 2) stats[T(ds[1].textContent)] = num(ds[0].textContent); });
  out.pages['/admin/permainan'] = { status: 200, stats, boardgame_quiz_tiles: +m.querySelector('input[name="boardgame_quiz_tiles"]').getAttribute('value'), games: Array.from(m.querySelectorAll('h4')).map((h) => T(h.textContent)) }; }

out.people = { distinctStudentTokens: people.size, note: 'tokens only; the name map is not stored' };
fs.writeFileSync(outPath, JSON.stringify(out, null, 1));
console.log('pages', Object.keys(out.pages).length, 'students', people.size, 'schools with id', schoolIds.size);
