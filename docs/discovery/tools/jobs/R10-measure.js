// R10 responsive measurements (adapted from M21-measure.js; read-only, GET navigation only in the R10-guarded context; every page comes from the guard's load-once cache, so no page is requested again). Run with browser_run_code_unsafe { filename: this file }.
// For every R10 screen x width (375 / 768 / 1280): page scrollWidth vs viewport, elements wider than the viewport,
// tables (own width vs wrapper, overflow-x of the wrapper), text rendered under 12px (count + px sizes only; no text is
// returned, so no personal data leaves the page), grid column counts, visible panel count, and the h1 box.
// GET navigation only; live polling pages are measured after their first render (1.8 s).
async (page) => {
const B = 'https://prestasiplus.my';
const urls = ['/buku-nota/heatmap', '/admin-sekolah/dskp-heatmap', '/admin-sekolah/laporan-bulanan'];
const widths = [375, 768, 1280];
const ctx = page.context();
const t = ctx.pages().find((p) => p !== page) || (await ctx.newPage());
const out = {};
for (const u of urls) for (const w of widths) {
  await t.setViewportSize({ width: w, height: 800 });
  await t.goto(B + u, { waitUntil: 'networkidle' });
  await t.waitForTimeout(700);
  out[u + ' @' + w] = await t.evaluate(() => {
    const root = document.querySelector('main') || document.body;
    const vw = innerWidth;
    const r = (el) => { const b = el.getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)]; };
    const small = {};
    let smallN = 0;
    root.querySelectorAll('*').forEach((el) => {
      const own = Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.nodeValue).join('').trim();
      if (!own || el.offsetParent === null || el.closest('script,style')) return;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs < 12) { small[fs + 'px'] = (small[fs + 'px'] || 0) + 1; smallN++; }
    });
    const wide = []; root.querySelectorAll('*').forEach((el) => { if (el.offsetParent === null) return; const b = el.getBoundingClientRect(); if (b.right > vw + 1 && b.width > 0 && !el.closest('table') && wide.length < 8) wide.push(el.tagName.toLowerCase() + '.' + String(el.className || '').split(' ').slice(0, 2).join('.') + ' right=' + Math.round(b.right)); });
    const tables = Array.from(root.querySelectorAll('table')).filter((tb) => tb.offsetParent !== null).map((tb) => { const wr = tb.parentElement; const cs = getComputedStyle(wr);
      return { tableW: Math.round(tb.scrollWidth), wrapperW: wr.clientWidth, wrapperOverflowX: cs.overflowX, cols: tb.querySelectorAll('thead th').length, clipped: tb.scrollWidth > wr.clientWidth + 1 && !/auto|scroll/.test(cs.overflowX), overflowsViewport: tb.getBoundingClientRect().right > vw + 1 }; });
    const chipSemua = Array.from(root.querySelectorAll('a')).find((a) => a.textContent.trim() === 'Semua'); const grids = Array.from(root.querySelectorAll('.grid, .topic-grid, .legend, .meta')).filter((g) => g.offsetParent !== null).slice(0, 8).map((g) => ({ cls: String(g.className).slice(0, 60), cols: getComputedStyle(g).gridTemplateColumns.split(' ').filter(Boolean).length }));
    const panels = Array.from(root.querySelectorAll('.subj-block, .duta-card, .topic-cell')).length;
    const panelsVisible = Array.from(root.querySelectorAll('.subj-block, .duta-card, .topic-cell')).filter((p) => p.offsetParent !== null && getComputedStyle(p).display !== 'none').length;
    const h1 = root.querySelector('h1');
    return { chipSemua: chipSemua ? chipSemua.className.replace(/\s+/g, ' ') : null, scrollWidth: document.documentElement.scrollWidth, overflow: document.documentElement.scrollWidth > vw, wide, tables, grids, panels, panelsVisible, smallN, small, h1: h1 ? { fontPx: parseFloat(getComputedStyle(h1).fontSize), box: r(h1) } : null };
  });
  await t.waitForTimeout(350);
}
await page.evaluate((o) => { window.__r10measure = o; }, out);
return Object.entries(out).map(([k, v]) => k + ' sw=' + v.scrollWidth + (v.overflow ? ' OVERFLOW' : '') + ' panels=' + v.panelsVisible + '/' + v.panels + ' tables=' + JSON.stringify(v.tables.map((x) => [x.tableW, x.wrapperW, x.wrapperOverflowX, x.clipped ? 'CLIPPED' : '', x.overflowsViewport ? 'PASTVP' : ''])) + ' small=' + v.smallN + ' wide=' + v.wide.length);
}
