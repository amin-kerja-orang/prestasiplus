// M15 responsive measurements (read-only). Run with browser_run_code_unsafe { filename: this file }.
// For every M15 screen x width (375 / 768 / 1280): page scrollWidth, <main> content clipping (tables in overflow-hidden
// wrappers), text rendered under 12px inside <main> (distinct strings + px), grid column counts, and the bounding boxes
// of key controls. Client-side only: on /admin/hadiah one row checkbox is ticked (updateBulkUI) to measure the bulk toolbar.
// Personal data: only the /admin/hadiah/tebusan?status=all table is measured by size; no cell text is returned for the
// Pelajar column (texts from td:first-child are skipped).
async (page) => {
const B = 'https://prestasiplus.my';
const urls = ['/admin/hadiah', '/admin/hadiah/tebusan?status=all', '/admin/hadiah/baharu', '/admin/hadiah/1/edit', '/gamification/rewards', '/gamification/mystery-box', '/cabutan', '/cikgu/kelulusan-hadiah'];
const widths = [375, 768, 1280];
const ctx = page.context();
const t = ctx.pages().find((p) => p !== page) || (await ctx.newPage());
const out = {};
for (const u of urls) for (const w of widths) {
  await t.setViewportSize({ width: w, height: 800 });
  await t.goto(B + u, { waitUntil: 'networkidle' });
  await t.waitForTimeout(400);
  if (u === '/admin/hadiah') await t.evaluate(() => { const c = document.querySelector('main .row-check'); c.checked = true; updateBulkUI(); });
  out[u + ' @' + w] = await t.evaluate(() => {
    const main = document.querySelector('main');
    const T = (s) => String(s || '').replace(/\s+/g, ' ').trim();
    const r = (el) => { const b = el.getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)]; };
    const small = {};
    main.querySelectorAll('*').forEach((el) => {
      if (el.closest('[x-data="tournamentBanner()"]') || el.closest('td:first-child') && /tebusan/.test(location.pathname)) return;
      const own = Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.nodeValue).join('').trim();
      if (!own || el.offsetParent === null) return;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs < 12) { const k = fs + 'px'; small[k] = small[k] || new Set(); small[k].add(T(own).slice(0, 40)); }
    });
    const smallOut = {}; Object.keys(small).forEach((k) => { smallOut[k] = { n: small[k].size, sample: Array.from(small[k]).slice(0, 12) }; });
    const clips = Array.from(main.querySelectorAll('table')).map((tb) => { const wr = tb.parentElement; const cs = getComputedStyle(wr);
      const ths = Array.from(tb.querySelectorAll('thead th')); const vis = ths.filter((th) => th.getBoundingClientRect().right <= wr.getBoundingClientRect().right + 1).map((th) => T(th.textContent));
      return { tableW: Math.round(tb.scrollWidth), wrapperW: wr.clientWidth, wrapperOverflowX: cs.overflowX, clipped: tb.scrollWidth > wr.clientWidth + 1 && cs.overflowX === 'hidden', scrollable: /auto|scroll/.test(cs.overflowX), headersFullyVisible: vis, headersTotal: ths.length }; });
    const grids = Array.from(main.querySelectorAll('.grid, .box-grid')).filter((g) => g.offsetParent !== null).slice(0, 6).map((g) => ({ cls: (g.className.match(/grid-cols-\S+|md:grid-cols-\S+|box-grid/g) || []).join(' '), cols: getComputedStyle(g).gridTemplateColumns.split(' ').length }));
    const ctl = {};
    const tb = document.getElementById('bulk-toolbar'); if (tb && tb.offsetParent !== null) { ctl.bulkToolbar = r(tb); ctl.bulkButtons = Array.from(tb.querySelectorAll('button')).map((b) => T(b.textContent) + ':' + r(b).join(',')); }
    const pills = Array.from(main.querySelectorAll('a[href*="?cat="], a[href*="?status="]')); if (pills.length) ctl.pillRows = [...new Set(pills.map((p) => Math.round(p.getBoundingClientRect().y)))].length;
    const hdrBtns = Array.from(main.querySelectorAll('a[href$="/tebusan"], a[href$="/baharu"], a[href$="/admin/hadiah"]')).filter((a) => a.offsetParent !== null).map((a) => T(a.textContent) + ':' + r(a).join(','));
    if (hdrBtns.length) ctl.headerLinks = hdrBtns;
    const form = main.querySelector('form.space-y-4'); if (form) { ctl.formW = r(form); ctl.firstGridCols = getComputedStyle(form.querySelector('.grid')).gridTemplateColumns.split(' ').length; ctl.submit = Array.from(form.querySelectorAll('button[type=submit], a')).map((b) => T(b.textContent) + ':' + r(b).join(',')); }
    const boxes = Array.from(main.querySelectorAll('form.box-card')); if (boxes.length) ctl.boxes = boxes.map((b) => r(b).join(','));
    const h1 = main.querySelector('h1'); if (h1) ctl.h1 = { text: T(h1.textContent), fontPx: parseFloat(getComputedStyle(h1).fontSize), box: r(h1) };
    return { scrollWidth: document.documentElement.scrollWidth, overflow: document.documentElement.scrollWidth > innerWidth, tables: clips, grids, small: smallOut, ctl };
  });
  await t.waitForTimeout(350);
}
await page.evaluate((o) => { window.__m15measure = o; }, out);
return Object.entries(out).map(([k, v]) => k + ' sw=' + v.scrollWidth + (v.overflow ? ' OVERFLOW' : '') + ' tables=' + JSON.stringify(v.tables.map((x) => [x.tableW, x.wrapperW, x.wrapperOverflowX, x.clipped ? 'CLIPPED' : '', x.headersFullyVisible.length + '/' + x.headersTotal])) + ' small=' + JSON.stringify(Object.fromEntries(Object.entries(v.small).map(([a, b]) => [a, b.n]))));
}
