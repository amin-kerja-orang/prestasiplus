// M09 capture plan — Content (Articles, Notes, Banners, Video, Audio KBAT, Perutusan, Panduan).
// Load:  browser_run_code_unsafe: async (page) => page.addScriptTag({ path: '<abs>/docs/discovery/tools/jobs/M09.js' })
// then:  browser_evaluate: () => { window.__jobs = window.__M09_JOBS.filter(j => j.group === 'A'); }
// then run tools/run-state.js, save window.__invs to docs/discovery/inventory/_raw/M09/_batch-<g>.json, split-batch.js,
// merge-inventory.js M09 tools/jobs/M09.screens.json.
//
// SAFETY (live production, admin, browser lane 3): read-only. No form is submitted except GET filter/search forms (by URL).
// Actions are client-side reveals only: <select> changes (Alpine x-show), typing into an unsubmitted field, radio/label clicks,
// Quill toolbar pickers, the Quill "HTML" toggle, panduan role cards / FAQ accordions, the article "copy link" button.
// Never clicked: Simpan / Kemaskini / Terbitkan / Hantar / Padam / Suka / Cinta / Terima Kasih / file inputs / drop zones.
//
// VIEW COUNTERS: opening /artikel/{slug}, /video/{id} or /perutusan/{id} increments a public counter (OBSERVED: article #10
// 595 -> 596 after one open). Each of the three detail pages was opened ONCE; its HTML is served from a Playwright route cache
// (tools/jobs/M09-cache.js) for every later state and screenshot, so no further server hit happens. S16/S18/S23 jobs
// REQUIRE that cache to be installed first (run-state does not check it).
//
// Personal data: M09MASK (below) replaces author / poster display names (article cards, "Oleh: …", admin show pages,
// video uploader, perutusan poster) with '<person>' and teacher names inside copy ("Cikgu X", "Chekgu X") with
// 'Cikgu <name>', then tools/sanitize.js runs. "Admin PRESTASI+" (the platform account) is kept. No real name is written here.
(function () {
  var B = 'https://prestasiplus.my';
  var jobs = [];
  var M09MASK = "(() => { var KEEP = /^(Admin PRESTASI\\+|Admin|admin|PRESTASIPLUS|Sekolah|Pengetua)$/; var names = new Set(); var add = function (s) { s = (s || '').replace(/\\s+/g, ' ').trim(); if (s.length >= 3 && !KEEP.test(s) && !/^<.*>$/.test(s)) names.add(s); };" +
    // (a) avatar initial circle (1-2 capitals) followed by a name element
    " document.querySelectorAll('main *, body > div *').forEach(function (el) { if (el.children.length) return; var t = (el.textContent || '').trim(); if (!/^[A-Z]{1,2}$/.test(t)) return; var c = (el.getAttribute('class') || '') + ' ' + ((el.parentElement && el.parentElement.getAttribute('class')) || ''); if (!/rounded-full|rounded-xl|rounded-lg|avatar/.test(c)) return; var host = /rounded|avatar/.test(el.getAttribute('class') || '') ? el : el.parentElement; var n = host.nextElementSibling; if (!n) return; var leaf = n.children.length ? [...n.querySelectorAll('*')].find(function (x) { return !x.children.length && (x.textContent || '').trim(); }) : n; if (leaf) add(leaf.textContent); });" +
    // (b) "Oleh: X" lines in admin tables
    " var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), t; while ((t = w.nextNode())) { var m = t.nodeValue.match(/Oleh:\\s*(.+)$/); if (m) add(m[1]); }" +
    // (c) admin show pages: text next to fa-user icon
    " document.querySelectorAll('main i.fa-user').forEach(function (i) { var p = i.parentElement; add(p.textContent); });" +
    " var list = Array.from(names).sort(function (a, b) { return b.length - a.length; }); var n = 0;" +
    " var TEACH = /\\b(Cikgu|Chekgu|Teacher)\\s+(?!Alesa\\b|Suara\\b|AI\\b)[A-Z][A-Za-z']+(\\s*\\([^)]*\\))?/g;" +
    " function scrub(s) { var o = s; list.forEach(function (x) { if (o.indexOf(x) >= 0) o = o.split(x).join('<person>'); var e = encodeURIComponent(x).replace(/%20/g, '+'); if (o.indexOf(e) >= 0) o = o.split(e).join('%3Cperson%3E'); }); o = o.replace(TEACH, '$1 <name>').replace(/youtube\\.com\\/@[A-Za-z0-9_.-]+/g, 'youtube.com/@<channel>'); return o; }" +
    " var w2 = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT), t2; while ((t2 = w2.nextNode())) { var ns = scrub(t2.nodeValue); if (ns !== t2.nodeValue) { t2.nodeValue = ns; n++; } }" +
    " document.querySelectorAll('*').forEach(function (el) { for (var j = 0; j < el.attributes.length; j++) { var a = el.attributes[j]; if (a.name === 'class' || a.name === 'style') continue; var nv = scrub(a.value); if (nv !== a.value) { el.setAttribute(a.name, nv); n++; } } });" +
    " document.querySelectorAll('input,textarea').forEach(function (i) { if (i.value && scrub(i.value) !== i.value) { i.value = scrub(i.value); n++; } });" +
    " document.querySelectorAll('template').forEach(function (tp) { tp.content.querySelectorAll('*').forEach(function (el) { for (var j = 0; j < el.attributes.length; j++) { var a = el.attributes[j]; var nv = scrub(a.value); if (nv !== a.value) el.setAttribute(a.name, nv); } }); });" +
    " document.title = scrub(document.title);" +
    " try { var prev = window.__m09names || []; Object.defineProperty(window, '__m09names', { value: prev.concat(list), configurable: true, enumerable: false }); } catch (e) {}" +
    " var html = document.documentElement.outerHTML; var leaks = (window.__m09names || []).filter(function (x) { return html.indexOf(x) >= 0; }).length;" +
    " return 'm09mask: names=' + list.length + ' replaced=' + n + ' leaks=' + leaks; })()";
  // form validity (native `required`), no submit
  var VAL = { eval: "(() => { var f = [...document.querySelectorAll('main form')].find(x => (x.method || '').toLowerCase() === 'post' && !x.querySelector('input[name=_method][value=DELETE]')); if (!f) return 'no post form'; var inv = [...f.querySelectorAll(':invalid')].filter(e => e.name).map(e => e.name); return 'novalidate=' + f.noValidate + ' valid=' + f.checkValidity() + ' invalid(' + inv.length + ')=' + inv.slice(0, 12).join(','); })()" };
  // selected values of every select + checked boxes (does edit preload saved values?)
  var SELS = { eval: "(() => [...document.querySelectorAll('main select')].filter(s => s.name).map(s => s.name + '=' + JSON.stringify(s.value) + (s.selectedIndex >= 0 ? '(' + s.options[s.selectedIndex].text.trim() + ')' : '')).concat([...document.querySelectorAll('main input[type=checkbox],main input[type=radio]')].filter(c => c.name).map(c => c.name + ':' + c.value + '=' + c.checked)).join(' ; '))()" };
  // observed colours (computed) of pills / badges / headings in main
  var COL = { eval: "(() => { var seen = {}, out = []; document.querySelectorAll('main span, main div, main a, main h1, main h2, main p').forEach(function (e) { var t = (e.childElementCount ? [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.nodeValue).join('') : e.textContent).replace(/\\s+/g, ' ').trim(); if (!t || t.length > 40) return; var c = e.getAttribute('class') || ''; if (!/rounded-full|rounded-md|rounded-lg|badge|^h[12]$/.test(c + ' ' + e.tagName.toLowerCase()) && !/^H[12]$/.test(e.tagName)) return; var cs = getComputedStyle(e); var k = t + '|' + cs.backgroundColor + '|' + cs.color; if (seen[k]) return; seen[k] = 1; out.push(t.slice(0, 30) + ' {bg:' + cs.backgroundColor + (cs.backgroundImage !== 'none' ? ' ' + cs.backgroundImage.slice(0, 70) : '') + ' fg:' + cs.color + '}'); }); return out.slice(0, 45).join(' ; '); })()" };
  // layout of form action buttons (Batal / submit) — row or stacked, order
  var BTNS = { eval: "(() => [...document.querySelectorAll('main a, main button')].filter(b => /^(Batal|Kembali|Simpan|Kemaskini|Terbitkan|Hantar|Tapis|Cari|Reset|Tambah)/.test(b.textContent.trim())).map(b => { var r = b.getBoundingClientRect(); return b.textContent.trim().replace(/\\s+/g, ' ').slice(0, 26) + '@' + Math.round(r.x) + ',' + Math.round(r.y) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height); }).join(' ; ') + ' | docW=' + document.documentElement.scrollWidth)()" };
  // horizontal scroll inside cards (tables)
  var SCR = { eval: "(() => [...document.querySelectorAll('main *')].filter(e => { var s = getComputedStyle(e).overflowX; return (s === 'auto' || s === 'scroll') && e.scrollWidth > e.clientWidth + 2; }).map(e => e.tagName + '.' + (e.getAttribute('class') || '').split(' ').slice(0, 3).join('.') + ' ' + e.scrollWidth + '>' + e.clientWidth).join(' ; ') || 'no inner h-scroll')()" };
  var ALPINE = function (sel, keys) { return { eval: "(() => { var el = document.querySelector(" + JSON.stringify(sel) + "); if (!el) return 'no ' + " + JSON.stringify(sel) + "; var d = Alpine.$data(el); return " + JSON.stringify(keys) + ".map(k => k + '=' + JSON.stringify(d[k])).join(' '); })()" }; };

  function J(group, file, url, state, actions, extra, opts) {
    var s = file.split('-')[0];
    var pre = [{ eval: M09MASK }];
    var j = { group: group, file: file, url: B + url, actions: pre.concat(actions || [], [{ eval: M09MASK }]), sanitize: { titleName: false },
              opts: Object.assign({ state: state, prefix: 'EL-M09-' + s, repeat: { 'main tbody tr': 3 }, redact: [] }, opts || {}) };
    Object.assign(j, extra || {});
    j.opts.state = state + (j.width === 375 ? ' @375' : j.width === 768 ? ' @768' : '') + (j.guest ? ' (guest)' : '');
    jobs.push(j);
  }
  var M = { width: 375 }, T = { width: 768 }, G = { guest: true };
  var W = function (ms) { return { wait: ms || 400 }; };
  var SEL = function (n, v) { return { select: ['main select[name="' + n + '"]', v] }; };
  var ART_REPEAT = { 'main tbody tr': 3, 'main div.grid:not(.mb-10) > a.article-card': 1, 'main div.grid.mb-10 > a.article-card': 2 };
  var VID_REPEAT = { 'main div.grid > a[href*="/video/"]': 2 };

  // ================= ADMIN =================
  // S1 /admin/articles
  var A = '/admin/articles';
  J('A', 'S1-admin-articles__default__1280', A, 'default (72, page 1 of 4, 20/page)', [COL, BTNS]);
  J('A', 'S1-admin-articles__draf-empty__1280', A + '?published=0', 'published=0 Draf (0 -> empty state)');
  J('A', 'S1-admin-articles__category__1280', A + '?category=MOTIVASI', 'category=MOTIVASI (14, one page)', [SELS]);
  J('A', 'S1-admin-articles__search__1280', A + '?search=sifir', 'search=sifir (2)', [SELS]);
  J('A', 'S1-admin-articles__filtered-page-2__1280', A + '?category=TIPS_BELAJAR&page=2', 'TIPS_BELAJAR page 2 (21 -> 1 row; pager drops filter)', [SELS, { eval: "[...document.querySelectorAll('main a[href*=\"page=\"]')].map(a => a.getAttribute('href').replace(/^https?:\\/\\/[^/]+/, '')).join(' ')" }]);
  J('A', 'S1-admin-articles__last-page__1280', A + '?page=4', 'page 4 (12 rows; ids 70-72, 9, 1-8)');
  J('A', 'S1-admin-articles__not-found-flash__1280', A + '/9999', 'unknown id -> redirect to list + flash "Artikel tidak dijumpai."');
  J('A', 'S1-admin-articles__default__375', A, 'default', [BTNS, SCR], M);
  J('A', 'S1-admin-articles__default__768', A, 'default', [BTNS, SCR], T);
  // S2 /admin/articles/create
  J('A', 'S2-admin-article-create__default__1280', A + '/create', 'default (CKEditor blocked by CSP -> plain textarea)', [VAL, SELS, BTNS, { eval: "'ClassicEditor=' + typeof ClassicEditor + ' ck=' + !!document.querySelector('.ck-editor')" }]);
  J('A', 'S2-admin-article-create__filled__1280', A + '/create', 'title + content typed (not submitted): category still required', [{ fill: ['main input[name=title]', 'x'] }, { fill: ['main textarea[name=content]', 'x'] }, VAL]);
  J('A', 'S2-admin-article-create__default__375', A + '/create', 'default', [BTNS], M);
  J('A', 'S2-admin-article-create__default__768', A + '/create', 'default', [BTNS], T);
  // S3 /admin/articles/{id}/edit
  J('B', 'S3-admin-article-edit__default__1280', A + '/10/edit', '#10 (featured, published, DARJAH_4) — selects preloaded', [VAL, SELS, BTNS]);
  J('B', 'S3-admin-article-edit__not-featured__1280', A + '/11/edit', '#11 (not featured)', [SELS]);
  J('B', 'S3-admin-article-edit__default__375', A + '/10/edit', '#10', [BTNS], M);
  J('B', 'S3-admin-article-edit__default__768', A + '/10/edit', '#10', [], T);
  // S4 /admin/articles/{id}
  J('B', 'S4-admin-article-show__default__1280', A + '/10', '#10 (Featured badge; content shown as escaped HTML)', [COL]);
  J('B', 'S4-admin-article-show__not-featured__1280', A + '/11', '#11 (no Featured badge)');
  J('B', 'S4-admin-article-show__default__375', A + '/10', '#10', [], M);
  J('B', 'S4-admin-article-show__default__768', A + '/10', '#10', [], T);
  // S5 /admin/notes
  var N = '/admin/notes';
  J('C', 'S5-admin-notes__default__1280', N, 'default (10 notes, one page)', [COL]);
  J('C', 'S5-admin-notes__subject__1280', N + '?subject=matematik', 'subject=matematik (3)', [SELS]);
  J('C', 'S5-admin-notes__type-empty__1280', N + '?note_type=summary', 'note_type=summary (0: stored types differ)', [SELS]);
  J('C', 'S5-admin-notes__search__1280', N + '?search=sifir', 'search=sifir (1)');
  J('C', 'S5-admin-notes__not-found__1280', N + '/9999', 'unknown id -> redirect to list');
  J('C', 'S5-admin-notes__default__375', N, 'default', [SCR], M);
  J('C', 'S5-admin-notes__default__768', N, 'default', [SCR], T);
  // S6 /admin/notes/create (live: HTTP 500) · S7 /admin/notes/{id}/edit (live: HTTP 500)
  J('C', 'S6-admin-note-create__server-error__1280', N + '/create', 'HTTP 500 "Ralat Pelayan"');
  J('C', 'S6-admin-note-create__server-error__375', N + '/create', 'HTTP 500', [], M);
  J('C', 'S7-admin-note-edit__server-error__1280', N + '/1/edit', 'HTTP 500 (#1)');
  J('C', 'S7-admin-note-edit__server-error-2__1280', N + '/2/edit', 'HTTP 500 (#2)');
  // S8 /admin/notes/{id}
  J('C', 'S8-admin-note-show__default__1280', N + '/1', '#1 Sifir (FORMULA, DARJAH 2)', [COL]);
  J('C', 'S8-admin-note-show__default__375', N + '/1', '#1', [], M);
  J('C', 'S8-admin-note-show__default__768', N + '/1', '#1', [], T);
  // S9 /admin/banners
  var BN = '/admin/banners';
  J('D', 'S9-admin-banners__default__1280', BN, 'default (5 banners)', [COL]);
  J('D', 'S9-admin-banners__not-found-flash__1280', BN + '/99/edit', 'unknown id -> redirect + flash "Banner tidak dijumpai."');
  J('D', 'S9-admin-banners__default__375', BN, 'default', [SCR], M);
  J('D', 'S9-admin-banners__default__768', BN, 'default', [SCR], T);
  // S10 /admin/banners/create
  J('D', 'S10-admin-banner-create__default__1280', BN + '/create', 'default (link_type none, external_url hidden)', [VAL, SELS, BTNS]);
  J('D', 'S10-admin-banner-create__external__1280', BN + '/create', 'link_type=external -> "https://example.com" field shown', [SEL('link_type', 'external'), W(), VAL]);
  J('D', 'S10-admin-banner-create__article__1280', BN + '/create', 'link_type=article (no extra field)', [SEL('link_type', 'article'), W(), SELS]);
  J('D', 'S10-admin-banner-create__external-back__1280', BN + '/create', 'external typed, then back to none (value kept, field hidden)', [SEL('link_type', 'external'), W(), { fill: ['main input[name=external_url]', 'https://example.com/x'] }, SEL('link_type', 'none'), W(), { eval: "'external_url=' + document.querySelector('main input[name=external_url]').value" }]);
  J('D', 'S10-admin-banner-create__default__375', BN + '/create', 'default', [BTNS], M);
  J('D', 'S10-admin-banner-create__default__768', BN + '/create', 'default', [BTNS], T);
  // S11 /admin/banners/{id}/edit
  J('D', 'S11-admin-banner-edit__default__1280', BN + '/1/edit', '#1 HERO/ALL — type/link/audience NOT preloaded', [VAL, SELS, ALPINE('main [x-data]', ['linkType']), BTNS]);
  J('D', 'S11-admin-banner-edit__feature__1280', BN + '/2/edit', '#2 FEATURE/STUDENT', [SELS]);
  J('D', 'S11-admin-banner-edit__external__1280', BN + '/1/edit', '#1 + link_type=external', [SEL('link_type', 'external'), W()]);
  J('D', 'S11-admin-banner-edit__default__375', BN + '/1/edit', '#1', [BTNS], M);
  // S12 /admin/audio-kbat
  var AK = '/admin/audio-kbat';
  J('E', 'S12-admin-audio-kbat__default__1280', AK, 'default (0 sets: empty state)', [COL, SELS]);
  J('E', 'S12-admin-audio-kbat__filtered__1280', AK + '?education_level_id=10&subject_id=2&status=approved&search=x', 'all filters set (selects keep values)', [SELS]);
  J('E', 'S12-admin-audio-kbat__default__375', AK, 'default', [BTNS], M);
  J('E', 'S12-admin-audio-kbat__default__768', AK, 'default', [], T);
  // S13 /admin/audio-kbat/create (30 identical question blocks: first kept, count in meta.repeats)
  var AKREP = { 'main tbody tr': 3, 'main div.space-y-3 > div.rounded-xl': 1 };
  J('E', 'S13-admin-audio-kbat-create__default__1280', AK + '/create', 'default (4 sections, 30 questions; status default approved)', [VAL, SELS, BTNS, { eval: "[...document.querySelectorAll('main input[name$=\"[title]\"]')].map(i => i.name + '=' + i.value).join(' ') + ' | q=' + document.querySelectorAll('main textarea[name$=\"[question_text]\"]').length + ' marks=' + document.querySelector('main input[name=\"questions[30][marks]\"]').value + ' kbat=' + document.querySelector('main input[name=\"questions[30][kbat_level]\"]').value" }], {}, { repeat: AKREP });
  J('E', 'S13-admin-audio-kbat-create__default__375', AK + '/create', 'default', [BTNS], M, { repeat: AKREP });
  J('E', 'S13-admin-audio-kbat-create__default__768', AK + '/create', 'default', [], T, { repeat: AKREP });
  // S14 /admin/tools/screenshots
  J('E', 'S14-admin-screenshots__default__1280', '/admin/tools/screenshots', 'default (0 files) — drop zone / file input never used');
  J('E', 'S14-admin-screenshots__default__375', '/admin/tools/screenshots', 'default', [], M);
  J('E', 'S14-admin-screenshots__default__768', '/admin/tools/screenshots', 'default', [], T);

  // ================= USER PORTAL =================
  // S15 /artikel
  var AR = '/artikel';
  J('F', 'S15-artikel__default__1280', AR, 'default (6 random "Paling Hangat" + 18 grid; 72, 4 pages)', [COL], {}, { repeat: ART_REPEAT });
  J('F', 'S15-artikel__category__1280', AR + '?category=BERITA', 'category=BERITA (active pill)', [COL], {}, { repeat: ART_REPEAT });
  J('F', 'S15-artikel__search__1280', AR + '?search=sifir', 'search=sifir', [], {}, { repeat: ART_REPEAT });
  J('F', 'S15-artikel__empty__1280', AR + '?search=zzzqqq', 'search no match -> "Tiada Artikel Dijumpai"', [], {}, { repeat: ART_REPEAT });
  J('F', 'S15-artikel__filtered-page-2__1280', AR + '?category=TIPS_BELAJAR&page=2', 'TIPS_BELAJAR page 2 (pager keeps category)', [{ eval: "[...document.querySelectorAll('main a[href*=\"page=\"]')].map(a => a.getAttribute('href').replace(/^https?:\\/\\/[^/]+/, '')).join(' ')" }], {}, { repeat: ART_REPEAT });
  J('F', 'S15-artikel__last-page__1280', AR + '?page=4', 'page 4', [], {}, { repeat: ART_REPEAT });
  J('F', 'S15-artikel__guest__1280', AR, 'guest (public page)', [], G, { repeat: ART_REPEAT, contentRoot: 'main' });
  J('F', 'S15-artikel__default__375', AR, 'default', [SCR], M, { repeat: ART_REPEAT });
  J('F', 'S15-artikel__default__768', AR, 'default', [SCR], T, { repeat: ART_REPEAT });
  // S16 /artikel/{slug} — CACHED (see header)
  var AD = '/artikel/teknik-pomodoro-belajar-25-minit-rehat-5-minit';
  J('G', 'S16-artikel-detail__default__1280', AD, '#10 Teknik Pomodoro (cached; 596 Pembaca)', [COL]);
  J('G', 'S16-artikel-detail__link-copied__1280', AD, 'copy-link button clicked -> "Link Disalin!" (2 s)', [{ click: 'main button:has(.fa-link)' }, W(300)]);
  J('G', 'S16-artikel-detail__not-found__1280', '/artikel/tiada-slug-zzz', 'unknown slug -> 404');
  J('G', 'S16-artikel-detail__default__375', AD, 'cached', [SCR], M);
  J('G', 'S16-artikel-detail__default__768', AD, 'cached', [], T);
  // S17 /video
  var V = '/video';
  J('G', 'S17-video__default__1280', V, 'default (2260, 24/page, 95 pages)', [COL], {}, { repeat: VID_REPEAT });
  J('G', 'S17-video__category__1280', V + '?category=motivasi', 'category=motivasi (3)', [COL], {}, { repeat: VID_REPEAT });
  J('G', 'S17-video__subject__1280', V + '?subject=5', 'subject=5 Sejarah (97)', [{ eval: "[...document.querySelectorAll('main a[href*=\"page=\"]')].slice(0, 3).map(a => a.getAttribute('href').replace(/^https?:\\/\\/[^/]+/, '')).join(' ')" }], {}, { repeat: VID_REPEAT });
  J('G', 'S17-video__empty__1280', V + '?search=zzzqqq', 'search no match -> "Tiada Video Dijumpai"', [], {}, { repeat: VID_REPEAT });
  J('G', 'S17-video__lain-lain__1280', V + '?category=lain-lain', 'category=lain-lain (0; pill href is "#")', [], {}, { repeat: VID_REPEAT });
  J('G', 'S17-video__last-page__1280', V + '?page=95', 'page 95', [], {}, { repeat: VID_REPEAT });
  J('G', 'S17-video__guest__1280', V, 'guest (public page)', [], G, { repeat: VID_REPEAT });
  J('G', 'S17-video__default__375', V, 'default', [SCR], M, { repeat: VID_REPEAT });
  J('G', 'S17-video__default__768', V, 'default', [SCR], T, { repeat: VID_REPEAT });
  // S18 /video/{id} — CACHED
  J('H', 'S18-video-detail__default__1280', '/video/2224', '#2224 YouTube embed (cached; player not played)', [COL], {}, { repeat: VID_REPEAT });
  J('H', 'S18-video-detail__not-found__1280', '/video/999999', 'unknown id -> 404');
  J('H', 'S18-video-detail__default__375', '/video/2224', 'cached', [SCR], M, { repeat: VID_REPEAT });
  J('H', 'S18-video-detail__default__768', '/video/2224', 'cached', [], T, { repeat: VID_REPEAT });
  // S19 /video/{id}/edit
  J('H', 'S19-video-edit__default__1280', '/video/2224/edit', '#2224 edit (not submitted) — preloaded values', [VAL, SELS, BTNS]);
  J('H', 'S19-video-edit__not-found__1280', '/video/9999999/edit', 'unknown id -> 404');
  J('H', 'S19-video-edit__default__375', '/video/2224/edit', '#2224', [BTNS], M);
  // S20 /video/tambah
  var VT = '/video/tambah';
  J('H', 'S20-video-tambah__default__1280', VT, 'default (vis=global; "Sekolah Saya" disabled: "Tiada sekolah")', [VAL, SELS, BTNS]);
  J('H', 'S20-video-tambah__youtube__1280', VT, 'YouTube URL typed -> thumbnail + "Platform dikesan: YouTube"', [{ fill: ['main input[name=video_url]', 'https://www.youtube.com/watch?v=iqtUCV6AHuI'] }, W(1200), ALPINE('main form', ['preview', 'previewPlatform', 'previewThumb'])]);
  J('H', 'S20-video-tambah__vimeo__1280', VT, 'Vimeo URL -> platform shown, no thumbnail', [{ fill: ['main input[name=video_url]', 'https://vimeo.com/123456'] }, W(1200), ALPINE('main form', ['preview', 'previewPlatform', 'previewThumb'])]);
  J('H', 'S20-video-tambah__unknown-url__1280', VT, 'unsupported URL -> no preview', [{ fill: ['main input[name=video_url]', 'https://example.com/abc'] }, W(1200), ALPINE('main form', ['preview', 'previewPlatform']), VAL]);
  J('H', 'S20-video-tambah__school-clicked__1280', VT, '"Sekolah Saya" (disabled) label clicked', [{ click: 'main label:has-text("Sekolah Saya")' }, W(), { eval: "[...document.querySelectorAll('main input[name=visibility]')].map(r => r.value + '=' + r.checked + (r.disabled ? '(disabled)' : '')).join(' ') + ' vis=' + Alpine.$data(document.querySelector('main [x-data*=vis]')).vis" }]);
  J('H', 'S20-video-tambah__default__375', VT, 'default', [BTNS], M);
  J('H', 'S20-video-tambah__default__768', VT, 'default', [BTNS], T);
  // S21 /audio-kbat (student)
  J('I', 'S21-audio-kbat__default__1280', '/audio-kbat', 'default (no approved set: empty state)', [COL, SELS]);
  J('I', 'S21-audio-kbat__filtered__1280', '/audio-kbat?education_level_id=10&subject_id=2', 'filters set (selects keep values)', [SELS]);
  J('I', 'S21-audio-kbat__default__375', '/audio-kbat', 'default', [BTNS], M);
  J('I', 'S21-audio-kbat__default__768', '/audio-kbat', 'default', [], T);
  // S22 /perutusan
  J('I', 'S22-perutusan__default__1280', '/perutusan', 'default (3 posts, 2 pinned)', [COL]);
  J('I', 'S22-perutusan__default__375', '/perutusan', 'default', [BTNS, SCR], M);
  J('I', 'S22-perutusan__default__768', '/perutusan', 'default', [], T);
  // S23 /perutusan/{id} — CACHED
  J('I', 'S23-perutusan-detail__default__1280', '/perutusan/4', '#4 (cached; pinned, public, YouTube embed)', [COL]);
  J('I', 'S23-perutusan-detail__not-found__1280', '/perutusan/99999', 'unknown id -> 404');
  J('I', 'S23-perutusan-detail__default__375', '/perutusan/4', 'cached', [SCR], M);
  J('I', 'S23-perutusan-detail__default__768', '/perutusan/4', 'cached', [], T);
  // S24 /perutusan/tulis
  var PT = '/perutusan/tulis';
  J('J', 'S24-perutusan-tulis__default__1280', PT, 'default (status published; Quill editor)', [VAL, SELS, BTNS]);
  J('J', 'S24-perutusan-tulis__scheduled__1280', PT, '"Jadualkan" chosen -> "Tarikh & Masa Penerbitan" shown', [{ click: 'main label:has-text("Jadualkan")' }, W(), SELS, VAL]);
  J('J', 'S24-perutusan-tulis__draft__1280', PT, '"Draf" chosen', [{ click: 'main label:has-text("Draf")' }, W(), SELS]);
  J('J', 'S24-perutusan-tulis__html-mode__1280', PT, 'HTML toggle on (Quill hidden, raw textarea shown)', [{ click: '#btn-toggle-html' }, W()]);
  J('J', 'S24-perutusan-tulis__header-picker__1280', PT, 'Quill header picker open', [{ click: 'main .ql-header .ql-picker-label' }, W()]);
  J('J', 'S24-perutusan-tulis__color-picker__1280', PT, 'Quill colour picker open', [{ click: 'main .ql-color .ql-picker-label' }, W()]);
  J('J', 'S24-perutusan-tulis__align-picker__1280', PT, 'Quill align picker open', [{ click: 'main .ql-align .ql-picker-label' }, W()]);
  J('J', 'S24-perutusan-tulis__title-only__1280', PT, 'title typed, body empty (form valid: body not required)', [{ fill: ['main input[name=title]', 'x'] }, VAL]);
  J('J', 'S24-perutusan-tulis__default__375', PT, 'default', [BTNS], M);
  J('J', 'S24-perutusan-tulis__default__768', PT, 'default', [BTNS], T);
  // S25 /perutusan/saya
  J('J', 'S25-perutusan-saya__default__1280', '/perutusan/saya', 'default (admin has none: empty state)');
  J('J', 'S25-perutusan-saya__default__375', '/perutusan/saya', 'default', [BTNS], M);
  // S26 /panduan (standalone layout, no <main>)
  var PAN = '/panduan', PO = { contentRoot: 'body' };
  var ROLE = function (t) { return { click: 'text=' + t }; };
  J('K', 'S26-panduan__default__1280', PAN, 'default role Pelajar', [COL], { sanitize: false }, PO);
  J('K', 'S26-panduan__guru__1280', PAN, 'role Guru', [ROLE('Guru Mata Pelajaran'), W()], { sanitize: false }, PO);
  J('K', 'S26-panduan__ibubapa__1280', PAN, 'role Ibu Bapa', [ROLE('Pemantauan Anak'), W()], { sanitize: false }, PO);
  J('K', 'S26-panduan__admin__1280', PAN, 'role Admin Sekolah', [ROLE('Pengetua / GPK'), W()], { sanitize: false }, PO);
  J('K', 'S26-panduan__ppd__1280', PAN, 'role PPD / JPN', [ROLE('Pegawai Daerah / Negeri'), W()], { sanitize: false }, PO);
  J('K', 'S26-panduan__faq-open__1280', PAN, 'FAQ 1 and 2 open (independent accordions)', [{ click: 'text=Macam mana nak reset kata laluan?' }, W(300), { click: 'text=Saya tak ada e-mel. Boleh daftar?' }, W()], { sanitize: false }, PO);
  J('K', 'S26-panduan__guest__1280', PAN, 'guest (public page)', [], { sanitize: false, guest: true }, PO);
  J('K', 'S26-panduan__default__375', PAN, 'default', [SCR], { sanitize: false, width: 375 }, PO);
  J('K', 'S26-panduan__menu-open__375', PAN, 'mobile menu (fa-bars) open', [{ click: 'button:has(.fa-bars)' }, W()], { sanitize: false, width: 375 }, PO);
  J('K', 'S26-panduan__default__768', PAN, 'default', [], { sanitize: false, width: 768 }, PO);
  // S27 /pusat-tuisyen/panduan (same page)
  J('K', 'S27-tuisyen-panduan__default__1280', '/pusat-tuisyen/panduan', 'default (identical to /panduan)', [], { sanitize: false }, PO);
  J('K', 'S27-tuisyen-panduan__guest__1280', '/pusat-tuisyen/panduan', 'guest -> /login', [], { sanitize: false, guest: true }, PO);
  J('K', 'S27-tuisyen-panduan__default__375', '/pusat-tuisyen/panduan', 'default', [], { sanitize: false, width: 375 }, PO);

  window.__M09_JOBS = jobs;
  window.__M09_HELPERS = { MASK: M09MASK, COL: COL, BTNS: BTNS };
})();
