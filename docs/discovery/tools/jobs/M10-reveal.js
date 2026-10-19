// M10 read-only reveal scanner: for each path in window.__probe, lists what can be revealed client-side
// (x-show / x-if expressions, @click / @change / onclick / onchange handlers, selects with option counts, x-data roots,
// fixed overlays, <details>, required fields, inline-script fetch targets). No clicks; GETs >= 800 ms apart.
async (page) => {
const urls = await page.evaluate(() => window.__probe || []);
const t = page.context().pages().find((p) => p !== page) || (await page.context().newPage());
await t.setViewportSize({ width: 1280, height: 800 });
const out = [];
for (const u of urls) {
  const r = await t.goto('https://prestasiplus.my' + u, { waitUntil: 'networkidle' }).catch(() => null);
  await t.waitForTimeout(400);
  out.push(Object.assign({ u, status: r ? r.status() : null }, await t.evaluate(() => {
    const m = document.querySelector('main') || document.body;
    const q = (s) => Array.from(m.querySelectorAll(s));
    const uniq = (a) => Array.from(new Set(a));
    const cut = (s, n) => (s || '').replace(/\s+/g, ' ').trim().slice(0, n || 90);
    const handlers = [];
    q('*').forEach((e) => { for (const a of e.attributes) if (/^(@click|@change|x-on:click|x-on:change|onclick|onchange|@input|@submit\.prevent|@submit|onsubmit)/.test(a.name)) handlers.push(e.tagName.toLowerCase() + '[' + a.name + '] ' + cut(a.value, 80) + ' «' + cut(e.textContent, 25) + '»'); });
    return {
      xdata: uniq(q('[x-data]').map((e) => cut(e.getAttribute('x-data'), 120))),
      xshow: uniq(q('[x-show]').map((e) => cut(e.getAttribute('x-show'), 80))),
      xif: uniq(q('template[x-if]').map((e) => cut(e.getAttribute('x-if'), 80))),
      handlers: uniq(handlers).slice(0, 80),
      selects: q('select').map((s) => (s.name || s.getAttribute('x-model') || '?') + ':' + s.options.length + (s.required ? '*' : '')),
      required: q('[required]').map((e) => e.name || e.id),
      overlays: q('.fixed').map((e) => cut(e.className, 60) + ' «' + cut(e.textContent, 40) + '»').slice(0, 12),
      details: q('details').length,
      fetches: uniq((Array.from(document.querySelectorAll('script:not([src])')).map((s) => s.textContent).join(' ').match(/(fetch|axios\.\w+)\s*\(\s*[`'"][^`'"]{2,120}/g) || []).filter((f) => !/tournament|fcm|unread|chatbot/.test(f))),
    };
  })));
  await t.waitForTimeout(400);
}
return out;
}
