// R10 dated seed snapshot (read-only, GET only, >= 450 ms between requests, inside the R10-guarded context).
// Load: browser_run_code_unsafe: async (page) => page.addScriptTag({ path: '<abs>/docs/discovery/tools/jobs/R10-snapshot.js' })
// Run:  browser_evaluate: async () => await window.__r10snap()   (save with filename → inventory/R10/_snapshot-<date>.json)
// - Pages are fetched with fetch() + DOMParser (no navigation, no script execution, no form submitted). Every URL goes
//   through the guard's load-once cache, so a page already opened during the capture is NOT requested again.
// - NEVER returned: the "Cikgu Pakar" ambassador's display name and avatar initials (person), e-mails, phones.
//   Returned instead: presence flags, the profile slug, tier / subject / state / rating pills and tagline.
// - Cross-module figures read (GET list pages only, never a quiz / session start): /buku-nota (M25 sibling tab),
//   /practice/chapter/BM (M05 S5 chapter stats of the same account).
(function () {
  function T(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  async function doc(u) { await sleep(450); var r = await fetch(u, { credentials: 'same-origin' }); var t = await r.text(); return { status: r.status, final: r.url.replace(location.origin, ''), d: new DOMParser().parseFromString(t, 'text/html') }; }
  window.__r10snap = async function () {
    var out = { capturedAt: new Date().toISOString(), account: 'platform admin (id 1); the heatmap shows this account\'s own practice data', note: 'R10 seed snapshot; GET only (guard-cached); the ambassador card person name / initials are never returned.' };
    // ---- S1 /buku-nota/heatmap ----
    var a = await doc('/buku-nota/heatmap');
    var m = a.d.querySelector('main') || a.d.body;
    var card = m.querySelector('.duta-card');
    out.S1_heatmap = { status: a.status, final: a.final, title: T(a.d.title), shellHeaderH1: T((a.d.querySelector('header h1') || {}).textContent),
      h1: T((m.querySelector('.hm-hero h1') || {}).textContent), intro: T((m.querySelector('.hm-hero p') || {}).textContent),
      legend: Array.from(m.querySelectorAll('.hm-hero .legend .pill')).map(function (p) { return { text: T(p.textContent), cls: p.className, style: p.getAttribute('style') }; }),
      dutaBlock: card ? { heading: T((m.querySelector('.duta-recommend-block > div') || {}).textContent), href: (card.getAttribute('href') || '').replace(location.origin, ''), cardClass: card.className,
        namePresent: !!T((card.querySelector('.name') || {}).textContent), initialsPresent: !!T((card.querySelector('.av-img') || {}).textContent), initialsLength: T((card.querySelector('.av-img') || {}).textContent).length,
        tagline: T((card.querySelector('.tagline') || {}).textContent), pills: Array.from(card.querySelectorAll('.pill')).map(function (p) { return { text: T(p.textContent), cls: p.className }; }), cardCount: m.querySelectorAll('.duta-card').length } : null,
      subjects: Array.from(m.querySelectorAll('.subj-block')).map(function (b) { return { subject: T((b.querySelector('h2') || {}).textContent), cells: Array.from(b.querySelectorAll('.topic-cell')).map(function (c) {
        var acc = T((c.querySelector('.topic-acc') || {}).textContent); var mm = acc.match(/^(\d+) cuba · (\d+)% betul$/);
        return { topic: T((c.querySelector('.topic-name') || {}).textContent), acc: acc, attempts: mm ? +mm[1] : null, pct: mm ? +mm[2] : null, colour: (c.className.match(/\b(red|amber|green|grey|gray|none)\b/) || [])[1] || c.className, href: (c.getAttribute('href') || '').replace(location.origin, ''), title: c.getAttribute('title') }; }) }; }),
      forms: Array.from(m.querySelectorAll('form')).length, inlineScriptsInMain: Array.from(m.querySelectorAll('script:not([src])')).map(function (s) { return T(s.textContent).slice(0, 80); }) };
    var cells = [].concat.apply([], out.S1_heatmap.subjects.map(function (s) { return s.cells; }));
    out.S1_heatmap.derived = { cellCount: cells.length, attemptsTotal: cells.reduce(function (x, c) { return x + (c.attempts || 0); }, 0),
      correctEstimate: cells.map(function (c) { return c.topic + ': round(' + c.pct + '% × ' + c.attempts + ') = ' + Math.round(c.pct * c.attempts / 100); }),
      bandCheck: cells.map(function (c) { var exp = c.pct < 50 ? 'red' : c.pct < 80 ? 'amber' : 'green'; return c.topic + ' ' + c.pct + '% → ' + c.colour + (exp === c.colour ? ' ✓' : ' ≠ ' + exp); }),
      orderWithinSubject: out.S1_heatmap.subjects.map(function (s) { return s.subject + ': ' + s.cells.map(function (c) { return c.pct; }).join(' ≤ '); }) };
    // ---- /buku-nota (sibling tab, M25) ----
    var b = await doc('/buku-nota');
    var mb = b.d.querySelector('main') || b.d.body;
    out.bukuNota = { status: b.status, title: T(b.d.title), h1: T((mb.querySelector('h1') || {}).textContent),
      tabs: Array.from(mb.querySelectorAll('a[href]')).filter(function (x) { return /^(Senarai|Heatmap Topik Lemah)$/.test(T(x.textContent)); }).map(function (x) { return T(x.textContent) + ' → ' + x.getAttribute('href').replace(location.origin, '') + ' [' + x.className.slice(0, 80) + ']'; }),
      stats: Array.from(mb.querySelectorAll('*')).filter(function (x) { return !x.children.length && /^(Jumlah Nota|Dikuasai|Perlu Ulangkaji)$/.test(T(x.textContent)); }).map(function (x) { return T(x.parentElement.textContent); }) };
    // ---- /practice/chapter/BM (M05 S5, same account; list page only) ----
    var c = await doc('/practice/chapter/BM');
    var mc = c.d.querySelector('main') || c.d.body;
    out.M05_chapterBM = { status: c.status, levelOptions: Array.from(mc.querySelectorAll('select[name=level] option')).map(function (o) { return o.value + '=' + T(o.textContent); }),
      chapters: Array.from(mc.querySelectorAll('*')).filter(function (x) { return !x.children.length && /^Bab \d+:/.test(T(x.textContent)); }).map(function (x) { var box = x.closest('div.rounded-2xl, div.rounded-xl, li, article') || x.parentElement; return T(box.textContent).slice(0, 200); }) };
    // ---- side-effect ledger: the guard's cache (filled by R10-ledger step) ----
    return out;
  };
})();
