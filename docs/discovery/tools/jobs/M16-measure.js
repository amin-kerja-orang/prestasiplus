// M16 responsive measurements (read-only). Run with browser_run_code_unsafe { filename: this file } AFTER the non-GET route guard
// is installed on the context (see M16.js header). For every M16 screen x width (375 / 768 / 1280): page scrollWidth, <main>
// content clipping (tables / grids in overflow-hidden wrappers, elements whose right edge passes the viewport), text rendered under
// 12px inside <main> (distinct strings + px), grid column counts, key control boxes, native `required` fields.
// Personal data: tools/jobs/M16.js is injected and its M16MASK runs before anything is read, so samples carry placeholders only.
async (page) => {
const B = 'https://prestasiplus.my';
const JOBS = 'D:/Dev Projects/pretasiplus-app/docs/discovery/tools/jobs/M16.js';
const urls = ['/battle', '/battle/leaderboard', '/battle/ranking-sekolah?period=all_time', '/battle/ranking-sekolah/8106', '/battle/history', '/permainan', '/papan-bijak', '/perang-fakta', '/kuiz-relay',
  '/permainan/betul-salah', '/permainan/betul-salah?darjah=4', '/permainan/cabaran-kilat?darjah=4', '/permainan/tembak-jawapan?darjah=4', '/permainan/susun-jawapan?darjah=4', '/permainan/kad-memori', '/permainan/roda-nasib',
  '/permainan/jutawan?darjah=4', '/permainan/pertandingan', '/permainan/uji-minda', '/tournament', '/tournament/admin/create', '/liga', '/liga/cipta', '/liga/1', '/liga/2', '/sekolah-bersaing', '/admin/permainan'];
const widths = [375, 768, 1280];
const ctx = page.context();
const t = ctx.pages().find((p) => p !== page) || (await ctx.newPage());
const out = {};
for (const u of urls) for (const w of widths) {
  await t.setViewportSize({ width: w, height: 800 });
  await t.goto(B + u, { waitUntil: 'networkidle' });
  await t.waitForTimeout(/darjah=/.test(u) ? 3000 : 400);
  await t.addScriptTag({ path: JOBS });
  await t.evaluate(() => { try { (0, eval)(window.__M16_HELPERS.MASK); } catch (e) {} });
  out[u + ' @' + w] = await t.evaluate(() => {
    const main = document.querySelector('main') || document.body;
    const T = (s) => String(s || '').replace(/\s+/g, ' ').trim();
    const r = (el) => { const b = el.getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)]; };
    const small = {};
    main.querySelectorAll('*').forEach((el) => {
      if (el.closest('[x-data="tournamentBanner()"]')) return;
      const own = Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.nodeValue).join('').trim();
      if (!own || el.offsetParent === null && getComputedStyle(el).position !== 'fixed') return;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs < 12) { const k = fs + 'px'; small[k] = small[k] || new Set(); small[k].add(T(own).slice(0, 40)); }
    });
    const smallOut = {}; Object.keys(small).forEach((k) => { smallOut[k] = { n: small[k].size, sample: Array.from(small[k]).slice(0, 14) }; });
    const tables = Array.from(main.querySelectorAll('table')).filter((tb) => tb.offsetParent !== null).map((tb) => { const wr = tb.parentElement; const cs = getComputedStyle(wr);
      const ths = Array.from(tb.querySelectorAll('thead th')); const vis = ths.filter((th) => th.getBoundingClientRect().right <= Math.min(wr.getBoundingClientRect().right, innerWidth) + 1).map((th) => T(th.textContent));
      return { tableW: Math.round(tb.scrollWidth), wrapperW: wr.clientWidth, wrapperOverflowX: cs.overflowX, clipped: tb.scrollWidth > wr.clientWidth + 1 && !/auto|scroll/.test(cs.overflowX), headersVisible: vis.length + '/' + ths.length }; });
    const offRight = Array.from(main.querySelectorAll('a,button,input,select,textarea,canvas,h1,h2,h3,p,span,td,th')).filter((e) => e.offsetParent !== null && e.getBoundingClientRect().right > innerWidth + 1 && e.getBoundingClientRect().width > 0).slice(0, 8).map((e) => e.tagName.toLowerCase() + ':' + T(e.textContent).slice(0, 24) + ':' + r(e).join(','));
    const grids = Array.from(main.querySelectorAll('.grid')).filter((g) => g.offsetParent !== null).slice(0, 8).map((g) => ({ cls: (g.className.match(/(sm:|md:|lg:|xl:)?grid-cols-\S+/g) || []).join(' '), cols: getComputedStyle(g).gridTemplateColumns.split(' ').length }));
    const hiddenCols = Array.from(main.querySelectorAll('.lb-row.head > div')).map((d) => T(d.textContent) + ':' + getComputedStyle(d).display);
    const req = Array.from(main.querySelectorAll('[required]')).map((e) => (e.name || e.getAttribute('x-model') || e.tagName) + (e.type ? '(' + e.type + ')' : ''));
    const canvas = main.querySelector('canvas'); const fall = document.getElementById('fallZone');
    const overlay = document.getElementById('darjah-picker-overlay');
    const cards = Array.from(main.querySelectorAll('[\\@click="flipCard(index)"]')); const cardBox = cards.length ? r(cards[0]) : null;
    const h1 = main.querySelector('h1,h2');
    return { scrollWidth: document.documentElement.scrollWidth, overflow: document.documentElement.scrollWidth > innerWidth, tables, offRight, grids, hiddenCols: hiddenCols.length ? hiddenCols : undefined, required: req, small: smallOut,
      canvas: canvas ? r(canvas) : undefined, fallZone: fall ? r(fall) : undefined, overlay: overlay ? { display: getComputedStyle(overlay).display, box: r(overlay) } : undefined, firstCard: cardBox || undefined,
      heading: h1 ? { text: T(h1.textContent).slice(0, 40), fontPx: parseFloat(getComputedStyle(h1).fontSize) } : undefined };
  });
  await t.waitForTimeout(350);
}
await page.evaluate((o) => { window.__m16measure = o; }, out);
return Object.entries(out).map(([k, v]) => k + ' sw=' + v.scrollWidth + (v.overflow ? ' OVERFLOW' : '') + ' tables=' + JSON.stringify(v.tables.map((x) => [x.tableW, x.wrapperW, x.wrapperOverflowX, x.clipped ? 'CLIPPED' : '', x.headersVisible])) + ' off=' + v.offRight.length + ' small=' + JSON.stringify(Object.fromEntries(Object.entries(v.small).map(([a, b]) => [a, b.n]))));
}
