// Merge raw per-state inventory captures into one file per screen, with final stable IDs,
// and build the link crawl (every internal URL / form action / harvested endpoint, classified by module).
//
// usage: node merge-inventory.js <module> <screens.json>
//   screens.json: { "S1": {"key":"S1-login","route":"/login","title":"Log Masuk"}, ..., "shells": {"SHU": {...}} }
// reads:  docs/discovery/inventory/_raw/<module>/<S#>-*__<state>__<width>.json
// writes: docs/discovery/inventory/<module>/<S#-key>.json, <module>/SH*-*.json (layout chrome), <module>/_crawl.json
//
// Element identity across states = kind|tag|name|href|action|text/label/placeholder|landmark (+ occurrence #n).
// Data-driven list rows (DATA_ROWS) are collapsed to one sample element with repeatCount.
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../../..');
const mod = process.argv[2];
const cfg = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const RAW = path.join(ROOT, 'docs/discovery/inventory/_raw', mod);
const OUT = path.join(ROOT, 'docs/discovery/inventory', mod);
fs.mkdirSync(OUT, { recursive: true });

const DATA_ROWS = (cfg.dataRows || []).map((s) => new RegExp(s));
const SKIP_PROPS = new Set(['id', 'key', 'visible', 'hiddenBy', 'showWhen', 'checked', 'region', 'valueType', 'selectedIsFirst']);

// ---------- module map from TRACKER.md ----------
const tracker = fs.readFileSync(path.join(ROOT, 'docs/TRACKER.md'), 'utf8');
const routeMap = []; // [{re, module, route}]
let cur = null;
for (const line of tracker.split('\n')) {
  const h = line.match(/^### (M\d\d) /); if (h) { cur = h[1]; continue; }
  if (/^## /.test(line)) cur = null;
  if (!cur || !/^- \[[ x]\]/.test(line)) continue;
  for (const m of line.matchAll(/`(\/[^`\s]*)`/g)) {
    let r = m[1].replace(/\{[^}]+\}/g, '[^/]+').replace(/\/\*$/, '(/.*)?').replace(/\.\.\.$/, '');
    if (r.startsWith('.')) continue;
    routeMap.push({ re: new RegExp('^' + r + '(/.*)?$'), exact: new RegExp('^' + r + '/?$'), module: cur, route: m[1] });
  }
}
const EXTRA = (cfg.extraModuleRules || []).map(([re, module, note]) => ({ re: new RegExp(re), module, route: note }));
function classify(p) {
  const pathOnly = p.split('?')[0].replace(/\$\{[^}]+\}/g, '{id}');
  for (const r of EXTRA) if (r.re.test(pathOnly)) return { module: r.module, via: r.route };
  // longest matching tracker route wins
  let best = null;
  for (const r of routeMap) if (r.re.test(pathOnly) && (!best || r.route.length > best.route.length)) best = r;
  return best ? { module: best.module, via: 'TRACKER ' + best.route } : { module: 'unknown', via: '' };
}
function norm(u) {
  if (!u) return null;
  u = u.replace(/^https?:\/\/(www\.)?prestasiplus\.my/, '');
  if (/^(https?:|mailto:|tel:|javascript:|#)/.test(u) || u === '') return null;
  if (!u.startsWith('/')) return null;
  return u.replace(/#.*$/, '');
}

// ---------- load raw ----------
const files = fs.readdirSync(RAW).filter((f) => f.endsWith('.json') && !f.startsWith('_'));
const bySid = {};
for (const f of files) {
  const sid = f.split('-')[0];
  (bySid[sid] = bySid[sid] || []).push(f);
}

const crawl = {}; // url -> {url, kinds:Set, from:Set, texts:Set}
function addCrawl(url, kind, from, text) {
  const u = norm(url); if (!u) return;
  const c = crawl[u] = crawl[u] || { url: u, kinds: new Set(), from: new Set(), texts: new Set() };
  c.kinds.add(kind); c.from.add(from); if (text) c.texts.add(text.slice(0, 60));
}

const shells = {}; // shellId -> {states:[], elements map}
const report = [];

function mergeInto(target, e, stateLabel, width, order) {
  // target: {map, list}
  // normalise data-dependent parts of the identity: numbers inside Alpine expressions, pure-number texts
  let key = e.key.replace(/(x-show:|x-text:)([^|]*)/, (m, a, b) => a + b.replace(/\d+/g, 'N'));
  if (/^(text|badge)$/.test(e.kind) && /^[\d,.+ ]+$/.test(e.text || '')) key = key.replace('|' + e.text + '|', '|<number>|');
  // optional (M02+): record ids and counts inside hrefs/actions/Alpine args/texts differ per page → normalise so
  // list rows and stat cards merge across states (screens.json: "normalizeIds": true). Off by default (M01 unchanged).
  if (cfg.normalizeIds) {
    key = key.replace(/\/\d+(?=[\/|?`'"]|$)/g, '/{id}').replace(/\d{3,}/g, 'N').replace(/([?&]page=)\d+/g, '$1N');
    // Laravel paginator links: identity = position class only (number / prev / next), not the filtered href
    if (e.kind === 'pagination' || (e.kind === 'text' && /pagination|navigation/i.test(e.landmark || '') && /^(\d+|\.\.\.|« Previous|Next »)$/.test(e.text || ''))) {
      const t = (e.text || '').trim();
      key = [e.kind, e.tag, 'PAGINATION', /^\d+$/.test(t) ? 'N' : t || (e.icon || 'icon'), e.landmark || ''].join('|');
    }
  }
  let collapse = false;
  if (cfg.collapseKeys && cfg.collapseKeys.some((s) => new RegExp(s).test(key))) collapse = true;
  const click = e.alpine && (e.alpine['@click'] || e.alpine['x-on:click']);
  let dataRow = false;
  if (click && DATA_ROWS.some((re) => re.test(click))) { key = [e.kind, e.tag, 'DATA-ROW', click, e.landmark || ''].join('|'); dataRow = true; }
  if (collapse) dataRow = true;
  // occurrence index within this state
  target.seen[stateLabel] = target.seen[stateLabel] || {};
  const n = (target.seen[stateLabel][key] = (target.seen[stateLabel][key] || 0) + 1);
  if (dataRow) {
    const k1 = key + '#1';
    if (n > 1) { const m = target.map[k1]; if (m) m.repeatCount = Math.max(m.repeatCount || 1, n); return; }
  }
  const fk = key + '#' + n;
  let m = target.map[fk];
  if (!m) {
    m = target.map[fk] = { _order: order, _first: e, visibleIn: [], hiddenIn: [], widthsVisible: new Set(), widthsSeen: new Set() };
    if (dataRow) { m.dataRow = true; m.repeatCount = 1; }
    target.list.push(m);
  }
  if (e.visible && !m._firstVisible) m._firstVisible = e;
  (e.visible ? m.visibleIn : m.hiddenIn).push(stateLabel);
  m.widthsSeen.add(width); if (e.visible) m.widthsVisible.add(width);
  if (!e.visible && e.hiddenBy) m.hiddenBy = Array.from(new Set([...(m.hiddenBy || []), ...e.hiddenBy]));
  if (e.showWhen) m.showWhen = e.showWhen;
  if (e.kind === 'checkbox' || e.kind === 'radio') { m.checkedIn = m.checkedIn || []; if (e.checked) m.checkedIn.push(stateLabel); }
}

function finalize(target, prefix, defaultLabel, has375) {
  target.list.sort((a, b) => a._order - b._order);
  let i = 0;
  return target.list.map((m) => {
    const src = m._firstVisible || m._first;
    const o = { id: prefix + '-' + String(++i).padStart(3, '0') };
    for (const [k, v] of Object.entries(src)) if (!SKIP_PROPS.has(k)) o[k] = v;
    const visDefault = m.visibleIn.includes(defaultLabel);
    const vis1280 = m.widthsVisible.has(1280), vis375 = m.widthsVisible.has(375);
    o.status = visDefault ? 'visible-default' : (m.visibleIn.length ? 'conditional' : 'hidden-only');
    // mobile-only: visible in some 375 state, never visible in any 1280 state.
    // desktop-only: visible in the default 1280 state but not in the default 375 state (only judged on default states).
    const d375 = target.default375;
    if (has375 && vis375 && !vis1280) o.viewport = 'mobile-only';
    else if (d375 && visDefault && !m.visibleIn.includes(d375)) o.viewport = 'desktop-only';
    else if (!visDefault && vis1280 && !vis375) o.viewport = 'state captured @1280 only';
    o.visibleIn = m.visibleIn;
    if (m.hiddenIn.length) o.hiddenIn = m.hiddenIn;
    if (m.hiddenBy && o.status !== 'visible-default') o.hiddenBy = m.hiddenBy;
    if (m.showWhen) o.showWhen = m.showWhen;
    if (m.checkedIn) o.checkedIn = m.checkedIn;
    if (m.dataRow) { o.dataRow = true; o.repeatCount = m.repeatCount; o.note = 'data-driven list row; one sample kept'; }
    return o;
  });
}

const screens = Object.entries(cfg.screens);
for (const [sid, sc] of screens) {
  const fl = (bySid[sid] || []).sort();
  if (!fl.length) { console.log('no raw for', sid); continue; }
  const raws = fl.map((f) => ({ f, j: JSON.parse(fs.readFileSync(path.join(RAW, f), 'utf8')) }));
  // base first: default__1280, then other 1280 states, then 375
  const rank = (r) => (r.f.includes('__default__1280') ? 0 : r.j.meta.viewport.width >= 1000 ? (r.j.meta.session === 'admin' && sc.guest ? 2 : 1) : 3);
  raws.sort((a, b) => rank(a) - rank(b) || (sc.order ? 0 : 0));
  const target = { map: {}, list: [], seen: {} };
  const states = [], alpine = {}, messages = {}, urls = {};
  let has375 = false, defaultLabel = null;
  raws.forEach((r, si) => {
    const meta = r.j.meta, w = meta.viewport.width >= 1000 ? 1280 : meta.viewport.width;
    if (w === 375) has375 = true;
    const label = r.f.replace(/^S\d+-[^_]+__/, '').replace(/\.json$/, '');
    if (si === 0) defaultLabel = label;
    if (label === 'default__375') target.default375 = label;
    states.push({ label, description: meta.state, file: '_raw/' + mod + '/' + r.f, width: w, session: meta.session, url: meta.url, finalUrl: meta.finalUrl, httpStatus: meta.httpStatus,
      title: meta.title, horizontalOverflow: meta.hasHorizontalOverflow ? meta.scrollWidth + 'px > ' + meta.viewport.width + 'px' : false, actions: meta.actions, actionLog: meta.actionLog, repeats: meta.repeats });
    r.j.elements.forEach((e, ei) => {
      if (e.region === 'shell') {
        const shellId = meta.session === 'guest' ? null : (sc.shell || 'SHU');
        if (!shellId) return;
        const sh = shells[shellId] = shells[shellId] || { target: { map: {}, list: [], seen: {} }, states: [], has375: false, defaultLabel: null };
        const slabel = sid + ':' + label;
        if (!sh.states.includes(slabel)) { sh.states.push(slabel); if (w === 375) sh.has375 = true; if (!sh.defaultLabel && w === 1280) sh.defaultLabel = slabel; if (!sh.target.default375 && label === 'default__375') sh.target.default375 = slabel; }
        mergeInto(sh.target, e, slabel, w, sh.states.length * 10000 + ei);
      } else {
        mergeInto(target, e, label, w, si * 10000 + ei);
      }
      // crawl
      if (e.href) addCrawl(e.absHref || e.href, e.kind === 'pagination' ? 'pagination' : e.kind === 'filter' ? 'filter-link' : 'link', sid + (e.region === 'shell' ? '(shell)' : ''), e.text || e.ariaLabel || e.title);
      if (e.kind === 'form' && e.action) addCrawl(e.action, 'form ' + (e.spoofedMethod || e.method), sid, (e.fields || []).join(','));
      if (e.alpine) for (const v of Object.values(e.alpine)) for (const m of String(v).matchAll(/['"`](\/[a-z][\w\-\/{}$.]*)/g)) addCrawl(m[1], 'alpine-attr', sid, '');
    });
    for (const a of r.j.alpine) { const k = a.component || a.xData.slice(0, 120); if (!alpine[k]) alpine[k] = Object.assign({}, a, { seenIn: [label] }); else if (!alpine[k].seenIn.includes(label)) alpine[k].seenIn.push(label); }
    for (const m of r.j.messages) messages[m.text] = messages[m.text] || m;
    for (const u of r.j.urls) { urls[u.url] = urls[u.url] || u; addCrawl(u.url, 'js-endpoint', sid, (u.sources || []).join(',')); }
    addCrawl(meta.finalUrl, 'visited', sid, meta.title);
  });
  const elements = finalize(target, 'EL-' + mod + '-' + sid, defaultLabel, has375);
  const byKind = {};
  for (const e of elements) byKind[e.kind] = (byKind[e.kind] || 0) + 1;
  const summary = {
    total: elements.length,
    visibleDefault: elements.filter((e) => e.status === 'visible-default').length,
    conditional: elements.filter((e) => e.status === 'conditional').length,
    hiddenOnly: elements.filter((e) => e.status === 'hidden-only').length,
    mobileOnly: elements.filter((e) => e.viewport === 'mobile-only').length,
    desktopOnly: elements.filter((e) => e.viewport === 'desktop-only').length,
    byKind,
  };
  const out = { screen: sid, key: sc.key, route: sc.route, name: sc.title, module: mod, generatedAt: new Date().toISOString(),
    notes: sc.notes, shell: sc.shell || (sc.guest ? 'none (auth layout)' : 'SHU'), summary, states,
    alpineComponents: Object.values(alpine).filter((a) => a.region !== 'shell'),
    jsMessages: Object.values(messages), jsEndpoints: Object.values(urls), elements };
  fs.writeFileSync(path.join(OUT, sc.key + '.json'), JSON.stringify(out, null, 1));
  report.push([sc.key, summary.total, summary.visibleDefault, summary.conditional, summary.hiddenOnly, summary.mobileOnly, summary.desktopOnly, states.length]);
}

for (const [shid, sh] of Object.entries(shells)) {
  const meta = (cfg.shells || {})[shid] || { key: shid };
  const elements = finalize(sh.target, 'EL-' + mod + '-' + shid, sh.defaultLabel, sh.has375);
  const summary = { total: elements.length, visibleDefault: elements.filter((e) => e.status === 'visible-default').length, conditional: elements.filter((e) => e.status === 'conditional').length,
    hiddenOnly: elements.filter((e) => e.status === 'hidden-only').length, mobileOnly: elements.filter((e) => e.viewport === 'mobile-only').length, desktopOnly: elements.filter((e) => e.viewport === 'desktop-only').length };
  fs.writeFileSync(path.join(OUT, meta.key + '.json'), JSON.stringify({ screen: shid, key: meta.key, name: meta.title, owner: meta.owner, note: meta.note, summary, states: sh.states, elements }, null, 1));
  report.push([meta.key, summary.total, summary.visibleDefault, summary.conditional, summary.hiddenOnly, summary.mobileOnly, summary.desktopOnly, sh.states.length]);
}

// ---------- crawl ----------
const crawlList = Object.values(crawl).map((c) => {
  const cl = classify(c.url);
  const pathOnly = c.url.split('?')[0];
  const inTracker = routeMap.some((r) => r.exact.test(pathOnly.replace(/\$\{[^}]+\}/g, 'x')));
  return { url: c.url, module: cl.module, via: cl.via, inTracker, kinds: [...c.kinds].sort(), foundOn: [...c.from].sort(), texts: [...c.texts].slice(0, 4) };
}).sort((a, b) => a.module.localeCompare(b.module) || a.url.localeCompare(b.url));
fs.writeFileSync(path.join(OUT, '_crawl.json'), JSON.stringify({ module: mod, generatedAt: new Date().toISOString(), total: crawlList.length, urls: crawlList }, null, 1));

console.log('key | total | visible-default | conditional | hidden-only | mobile-only | desktop-only | states');
for (const r of report) console.log(r.join(' | '));
console.log('crawl urls:', crawlList.length, 'unknown:', crawlList.filter((c) => c.module === 'unknown').map((c) => c.url).join(' '));
