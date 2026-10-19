// M18 responsive measurements (read-only). Load tools/jobs/M18.js first (window.__M18_HELPERS), then run with
// browser_run_code_unsafe { filename: this file }. For every M18 route x width (375 / 768 / 1280): page scrollWidth,
// table wrappers (clipped vs scrollable), text rendered under 12px inside <main> (distinct strings + px, table cells and
// masked person nodes excluded), grid column counts, h1/h2 size and tab/pill row counts. M18MASK runs first so no
// person name can be sampled. GET only; >= 350 ms between navigations.
async (page) => {
const B = 'https://prestasiplus.my';
const MASK = await page.evaluate(() => window.__M18_HELPERS.MASK);
const urls = (await page.evaluate(() => window.__m18measureUrls)) || ['/ppd/dashboard', '/ppd/command-center', '/ppd/statistik-penggunaan', '/ppd/ranking-kebangsaan', '/ppd/benchmark-sekolah', '/ppd/peta-haba', '/ppd/export-laporan', '/ppd/leaderboard-sekolah', '/ppd/sekolah/8880',
  '/jpn/dashboard', '/jpn/command-center', '/jpn/statistik-penggunaan', '/jpn/ranking-kebangsaan', '/jpn/daerah/PPD%20KLUANG', '/jpn/sekolah/8765',
  '/amaran', '/amaran/kelas/1156', '/amaran/ppd', '/amaran/jpn', '/amaran/keberkesanan/ppd', '/amaran/keberkesanan', '/amaran/sekolah/7780', '/amaran/ringkasan-eksekutif?scope=school&school_id=8880', '/amaran/intervensi/2229',
  '/analisa-item/ppd', '/analisa-item/jpn', '/sekolah/8880/prestasi', '/sekolah/8880/amaran', '/sekolah/8880/kombo', '/sekolah/8880/analisa-item', '/kombo/ppd', '/kombo/jpn', '/kombo/sekolah/7780'];
const widths = [375, 768, 1280];
const ctx = page.context();
const t = ctx.pages().find((p) => p !== page) || (await ctx.newPage());
const out = {};
for (const u of urls) for (const w of widths) {
  await t.setViewportSize({ width: w, height: 800 });
  const r = await t.goto(B + u, { waitUntil: 'networkidle' }).catch(() => null);
  await t.waitForTimeout(450);
  await t.evaluate(MASK);
  out[u + ' @' + w] = await t.evaluate(() => {
    const main = document.querySelector('main') || document.body;
    const T = (s) => String(s || '').replace(/\s+/g, ' ').trim();
    const box = (el) => { const b = el.getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)]; };
    const small = {};
    main.querySelectorAll('*').forEach((el) => {
      if (el.closest('[x-data="tournamentBanner()"], td, .m18n, select, option')) return;
      const own = Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.nodeValue).join('').trim();
      if (!own || el.offsetParent === null && getComputedStyle(el).position !== 'fixed') return;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs < 12) { const k = fs + 'px'; small[k] = small[k] || new Set(); small[k].add(T(own).slice(0, 40)); }
    });
    const smallOut = {}; Object.keys(small).forEach((k) => { smallOut[k] = { n: small[k].size, sample: Array.from(small[k]).slice(0, 15) }; });
    const tables = Array.from(main.querySelectorAll('table')).filter((tb) => tb.offsetParent !== null).map((tb) => {
      let wr = tb.parentElement; while (wr && wr !== main && !/auto|scroll|hidden/.test(getComputedStyle(wr).overflowX)) wr = wr.parentElement;
      wr = wr || tb.parentElement; const cs = getComputedStyle(wr);
      const sec = tb.closest('.card, [id^="sec-"]'), h = sec && sec.querySelector('h2, h3');
      return { section: h ? T(h.textContent).slice(0, 50) : null, tableW: Math.round(tb.scrollWidth), wrapperW: wr.clientWidth, overflowX: cs.overflowX, clipped: tb.scrollWidth > wr.clientWidth + 1 && cs.overflowX === 'hidden', scrollable: /auto|scroll/.test(cs.overflowX) && tb.scrollWidth > wr.clientWidth + 1 };
    });
    const grids = Array.from(main.querySelectorAll('.grid')).filter((g) => g.offsetParent !== null).slice(0, 8).map((g) => ({ cls: (String(g.className).match(/(^|\s)((sm|md|lg|xl):)?grid-cols-\S+/g) || []).map((s) => s.trim()).join(' '), cols: getComputedStyle(g).gridTemplateColumns.split(' ').length }));
    const h = main.querySelector('h1') || main.querySelector('h2');
    const pills = Array.from(main.querySelectorAll('a[href*="period="], a[href*="tingkatan"], button')).filter((b) => b.offsetParent !== null && b.getBoundingClientRect().height < 60);
    return { scrollWidth: document.documentElement.scrollWidth, overflow: document.documentElement.scrollWidth > innerWidth,
      heading: h ? { tag: h.tagName, text: T(h.textContent).slice(0, 60), fontPx: parseFloat(getComputedStyle(h).fontSize), box: box(h) } : null,
      tables, grids, small: smallOut, buttonRows: [...new Set(pills.map((p) => Math.round(p.getBoundingClientRect().y)))].length };
  });
  out[u + ' @' + w].httpStatus = r ? r.status() : null;
  await t.waitForTimeout(350);
}
await page.evaluate((o) => { window.__m18measure = o; }, out);
return Object.entries(out).map(([k, v]) => k + ' sw=' + v.scrollWidth + (v.overflow ? ' OVERFLOW' : '') + ' h=' + (v.heading ? v.heading.fontPx : '-') + ' tables=' + JSON.stringify(v.tables.map((x) => [x.tableW, x.wrapperW, x.overflowX, x.clipped ? 'CLIPPED' : x.scrollable ? 'scroll' : ''])) + ' small=' + JSON.stringify(Object.fromEntries(Object.entries(v.small).map(([a, b]) => [a, b.n]))));
}
