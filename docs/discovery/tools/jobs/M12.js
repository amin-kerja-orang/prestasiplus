// M12 capture plan — Kirkpatrick Evaluation. Every screen x every UI state that reveals different elements.
// Load:  browser_run_code_unsafe: async (page) => page.addScriptTag({ path: '<abs>/docs/discovery/tools/jobs/M12.js' })
// then:  browser_evaluate: () => { window.__jobs = window.__M12_JOBS.filter(j => j.group === 'A'); }
// then run tools/run-state.js, save window.__invs to docs/discovery/inventory/_raw/M12/_batch.json, split-batch.js, merge-inventory.js.
//
// SAFETY: live production admin, browser lane 3 (playwright3). READ-ONLY.
//   - Never clicked / opened: "Muat Turun Laporan" (/admin/kirkpatrick/export-pdf, target=_blank), the filter "Tapis" submit
//     buttons (filters are GET forms; they are driven by URL query strings instead), "Simpan Intervensi" (POST
//     /admin/kirkpatrick/interventions). /maklum-balas is only opened (the admin account already answered this month, so
//     the server shows the thank-you state; no form exists to submit).
//   - Client-side actions only: the "Rekod Intervensi Baru" toggle (broken on live: Alpine error, stays closed) and one
//     FORCED reveal of the collapsed form (DOM attribute change in the worker tab only, documented as not reachable live).
//
// PERSONAL DATA (students are minors): M12MASK runs first (eval) and
//   - tags student links (/pelajar/{id}) and the ALESA "Pelajar" cell with class "m12n" (sanitize.js masks them);
//   - on /kirkpatrick/pelajar/{id}: replaces the student name (h1) in every text node and in <title> with "<person>";
//   - replaces school names ("<school>") and school codes ("<kod>") in text, option labels and attributes;
//   - rewrites person-record ids in links and in the location (history.replaceState) to {id}.
// No real name is written in this file.
(function () {
  var B = 'https://prestasiplus.my';
  var jobs = [];
  function mask() {
    var n = 0, main = document.querySelector('main') || document.body;
    function tag(el) { if (el && !el.classList.contains('m12n')) { el.classList.add('m12n'); n++; } }
    var SCH = /\b(SEKOLAH (MENENGAH |KEBANGSAAN |JENIS |AGAMA |RENDAH |SENI |SUKAN |BERASRAMA )[A-Z0-9 ()'.@&\/-]*[A-Z0-9)]|SMK [A-Za-z][A-Za-z0-9 ()'.@-]*[A-Za-z0-9)]|SMKA? [A-Z][A-Z0-9 ()'.-]*[A-Z0-9)]|SMT [A-Z][A-Z0-9 ()'.-]*[A-Z0-9)]|SMS [A-Z][A-Z0-9 ()'.-]*[A-Z0-9)]|SJKC? ?\(?[CT]?\)? [A-Z][A-Z0-9 ()'.-]*[A-Z0-9)]|SK [A-Z][A-Z0-9 ()'.-]*[A-Z0-9)]|SAM [A-Z][A-Z0-9 ()'.-]*[A-Z0-9)]|KOLEJ [A-Z][A-Z0-9 ()'.-]*[A-Z0-9)]|MAKTAB [A-Z][A-Z0-9 ()'.-]*[A-Z0-9)]|SBP [A-Z][A-Z0-9 ()'.-]*[A-Z0-9)]|MRSM [A-Z][A-Z0-9 ()'.-]*[A-Z0-9)])/g;
    var KOD = /\b[A-Z]{3}\d{4}\b/g;
    var path = location.pathname;
    // --- student detail page: name in h1, <title>, AI paragraph
    if (/\/kirkpatrick\/pelajar\/\d+/.test(path)) {
      var h1 = main.querySelector('h1'); var nm = h1 ? h1.textContent.replace(/\s+/g, ' ').trim() : '';
      if (nm.length > 2) {
        var w0 = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), t0;
        while ((t0 = w0.nextNode())) { if (t0.parentNode && /SCRIPT|STYLE/.test(t0.parentNode.tagName)) continue; if (t0.nodeValue.indexOf(nm) >= 0) { t0.nodeValue = t0.nodeValue.split(nm).join('<person>'); n++; } }
        document.title = document.title.split(nm).join('<person>'); n++;
      }
    }
    // --- student links (T4 prediction table) and ALESA student cell (name span + school line)
    main.querySelectorAll('a[href*="/pelajar/"]').forEach(function (a) { tag(a); });
    main.querySelectorAll('tbody tr td:nth-child(2) > span.font-medium').forEach(function (s) { tag(s); });
    // --- school names / codes in text nodes (incl. <option>), attributes and title
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), t;
    while ((t = w.nextNode())) { if (t.parentNode && /SCRIPT|STYLE/.test(t.parentNode.tagName)) continue; var v = t.nodeValue, nv = v.replace(SCH, '<school>').replace(KOD, '<kod>'); if (nv !== v) { t.nodeValue = nv; n++; } }
    document.querySelectorAll('[title],[alt],[aria-label]').forEach(function (e) { ['title', 'alt', 'aria-label'].forEach(function (k) { var v = e.getAttribute(k); if (v) { var nv = v.replace(SCH, '<school>').replace(KOD, '<kod>'); if (nv !== v) { e.setAttribute(k, nv); n++; } } }); });
    var tv = document.title.replace(SCH, '<school>'); if (tv !== document.title) { document.title = tv; n++; }
    // --- avatars
    main.querySelectorAll('img').forEach(function (im) { var s = im.getAttribute('src') || ''; if (/ui-avatars|avatar|storage/.test(s)) { im.removeAttribute('src'); im.setAttribute('alt', '<person>'); n++; } });
    // --- person-record ids in links and location
    document.querySelectorAll('a[href]').forEach(function (a) { var v = a.getAttribute('href'), nv = v.replace(/\/pelajar\/\d+(?=$|[?#/])/g, '/pelajar/{id}'); if (nv !== v) { a.setAttribute('href', nv); n++; } });
    if (/\/pelajar\/\d+/.test(path)) { history.replaceState(null, '', location.href.replace(/\/pelajar\/\d+/, '/pelajar/{id}')); n++; }
    return 'm12mask: ' + n;
  }
  var M12MASK = '(' + mask.toString() + ')()';
  var SAN = { selectors: ['.m12n'], titleName: false };
  function J(group, file, url, state, actions, extra, opts) {
    var s = file.split('-')[0];
    var j = { group: group, file: file, url: B + url, actions: (actions || []).concat([{ eval: M12MASK }]), sanitize: SAN,
              opts: Object.assign({ state: state, prefix: 'EL-M12-' + s, redact: [] }, opts || {}) };
    Object.assign(j, extra || {});
    j.opts.state = state + (j.width === 375 ? ' @375' : j.width === 768 ? ' @768' : '');
    jobs.push(j);
  }
  var M = { width: 375 }, T = { width: 768 };
  var W = function (ms) { return { wait: ms || 500 }; };
  function EV(js) { return { eval: '(() => { ' + js + ' })()' }; }

  // ---------- repeated rows: one sample per visual variant ----------
  var TAHAP = ['15803d', '2563eb', 'ca8a04', 'ea580c', 'dc2626'];
  // S3 learning: subject bars (Mastered / Developing), school rows by accuracy colour
  var R3 = { repeat: { 'main .space-y-2 > div:has(.bg-green-100)': 2, 'main .space-y-2 > div:has(.bg-amber-100)': 2,
                       'main tbody tr:has(td.text-green-600)': 2, 'main tbody tr:has(td.text-amber-600)': 2, 'main tbody tr:has(td.text-red-600)': 2 } };
  // S4 behaviour: school rows per tahap colour (+ zero-activity row), alerts per kind
  var R4 = { repeat: { 'main .space-y-2 > div.bg-green-50': 2, 'main .space-y-2 > div.bg-red-50': 30 } };
  TAHAP.forEach(function (c) { R4.repeat['main tbody tr:has(span[style*="' + c + '"]):not(:has(td.text-slate-300))'] = 1; });
  R4.repeat['main tbody tr:has(td.text-slate-300)'] = 1;
  // S5 results: school rows per tahap (+ inactive), prediction rows per colour, ALESA rows per grade colour
  var R5 = { repeat: {} };
  TAHAP.forEach(function (c) { R5.repeat['main tbody tr:not(.opacity-50):has(td:nth-child(7)[style*="' + c + '"])'] = 1; });
  R5.repeat['main tbody tr.opacity-50'] = 1;
  TAHAP.forEach(function (c) { R5.repeat['main tbody tr:has(a[href*="/pelajar/"]):has(td:nth-child(6) span[style*="' + c + '"])'] = 1; });
  ['15803d', '16a34a', '22c55e', '2563eb', '3b82f6', 'ca8a04', 'eab308', 'ea580c', 'dc2626'].forEach(function (c) { R5.repeat['main tbody tr:has(td.max-w-xs):has(td:nth-child(4) span[style*="' + c + '"])'] = 1; });

  // ---------------- S1 overview ----------------
  J('A', 'S1-overview__default__1280', '/admin/kirkpatrick', 'Semua Sekolah / Semua Negeri (default)');
  J('A', 'S1-overview__school__1280', '/admin/kirkpatrick?school_id=8080', 'school_id=8080 (GET by URL): Reset shown, decline comparison (red)');
  J('A', 'S1-overview__state-empty__1280', '/admin/kirkpatrick?state=Kelantan', 'state=Kelantan (GET by URL): no data, "Tiada Data vs Tiada Data"');
  J('A', 'S1-overview__guru__1280', '/guru/kirkpatrick', 'teacher route /guru/kirkpatrick (same template, admin shell)');
  J('A', 'S1-overview__default__375', '/admin/kirkpatrick', 'default', [], M);
  J('A', 'S1-overview__default__768', '/admin/kirkpatrick', 'default', [], T);

  // ---------------- S2 reaction ----------------
  J('A', 'S2-reaction__default__1280', '/admin/kirkpatrick/reaction', 'default (4 NPS/satisfaction cards)');
  J('A', 'S2-reaction__guru__1280', '/guru/kirkpatrick/reaction', 'teacher route');
  J('A', 'S2-reaction__default__375', '/admin/kirkpatrick/reaction', 'default', [], M);
  J('A', 'S2-reaction__default__768', '/admin/kirkpatrick/reaction', 'default', [], T);

  // ---------------- S3 learning ----------------
  J('B', 'S3-learning__default__1280', '/admin/kirkpatrick/learning', 'default (all schools)', [], null, R3);
  J('B', 'S3-learning__school__1280', '/admin/kirkpatrick/learning?school_id=8080', 'school_id=8080 (URL only; no filter form on page)', [], null, R3);
  J('B', 'S3-learning__guru__1280', '/guru/kirkpatrick/learning', 'teacher route', [], null, R3);
  J('B', 'S3-learning__default__375', '/admin/kirkpatrick/learning', 'default', [], M, R3);
  J('B', 'S3-learning__default__768', '/admin/kirkpatrick/learning', 'default', [], T, R3);

  // ---------------- S4 behaviour ----------------
  J('C', 'S4-behavior__default__1280', '/admin/kirkpatrick/behavior', 'Semua Sekolah (default): alerts card shown', [], null, R4);
  J('C', 'S4-behavior__school__1280', '/admin/kirkpatrick/behavior?school_id=8080', 'school_id=8080 (GET by URL): Reset, no alerts card, empty heat cells', [], null, R4);
  J('C', 'S4-behavior__guru__1280', '/guru/kirkpatrick/behavior', 'teacher route', [], null, R4);
  J('C', 'S4-behavior__default__375', '/admin/kirkpatrick/behavior', 'default', [], M, R4);
  J('C', 'S4-behavior__default__768', '/admin/kirkpatrick/behavior', 'default', [], T, R4);

  // ---------------- S5 results ----------------
  J('D', 'S5-results__default__1280', '/admin/kirkpatrick/results', 'default (all schools)', [], { settle: 1200 }, R5);
  J('D', 'S5-results__school__1280', '/admin/kirkpatrick/results?school_id=8080', 'school_id=8080 (URL only; no filter form on page)', [], { settle: 800 }, R5);
  J('D', 'S5-results__default__375', '/admin/kirkpatrick/results', 'default', [], { width: 375, settle: 1200 }, R5);
  J('D', 'S5-results__default__768', '/admin/kirkpatrick/results', 'default', [], { width: 768, settle: 1200 }, R5);
  J('E', 'S5-results__guru__1280', '/guru/kirkpatrick/results', 'teacher route', [], { settle: 1200 }, R5);

  // ---------------- S6 chain ----------------
  J('E', 'S6-chain__default__1280', '/admin/kirkpatrick/chain', 'default');
  J('E', 'S6-chain__guru__1280', '/guru/kirkpatrick/chain', 'teacher route');
  J('E', 'S6-chain__default__375', '/admin/kirkpatrick/chain', 'default', [], M);
  J('E', 'S6-chain__default__768', '/admin/kirkpatrick/chain', 'default', [], T);

  // ---------------- S7 interventions ----------------
  var TOGGLE = { click: 'main button:has-text("Rekod Intervensi Baru")' };
  var FORCE = EV("var d = document.querySelector('main [x-show=\"open\"]'); if (!d) return 'missing'; d.hidden = false; d.removeAttribute('style'); d.style.display = 'block'; return 'FORCED open (not reachable on live)';");
  J('E', 'S7-interventions__default__1280', '/admin/kirkpatrick/interventions', 'default: 0 interventions, form collapsed');
  J('E', 'S7-interventions__toggle__1280', '/admin/kirkpatrick/interventions', '"Rekod Intervensi Baru" clicked: stays collapsed (Alpine error)', [TOGGLE, W(800)]);
  J('E', 'S7-interventions__forced-open__1280', '/admin/kirkpatrick/interventions', 'FORCED reveal of the collapsed form (DOM only; not reachable on live)', [FORCE, W(300)]);
  J('E', 'S7-interventions__guru__1280', '/guru/kirkpatrick/interventions', 'teacher route');
  J('E', 'S7-interventions__method-405__1280', '/admin/kirkpatrick/interventions/1', 'GET /admin/kirkpatrick/interventions/{id} → 405 Method Not Allowed');
  J('E', 'S7-interventions__default__375', '/admin/kirkpatrick/interventions', 'default', [], M);
  J('E', 'S7-interventions__forced-open__375', '/admin/kirkpatrick/interventions', 'FORCED reveal (layout only)', [FORCE, W(300)], M);
  J('E', 'S7-interventions__default__768', '/admin/kirkpatrick/interventions', 'default', [], T);

  // ---------------- S8 student Kirkpatrick detail (new route) ----------------
  J('F', 'S8-pelajar__default__1280', '/admin/kirkpatrick/pelajar/4664', 'student with 1 Head Count TOV and 3 platform subjects');
  J('F', 'S8-pelajar__low__1280', '/admin/kirkpatrick/pelajar/4644', 'student with several TOVs, weakest subject 0%');
  J('F', 'S8-pelajar__guru__1280', '/guru/kirkpatrick/pelajar/4664', 'teacher route /guru/kirkpatrick/pelajar/{id}');
  J('F', 'S8-pelajar__unknown-403__1280', '/admin/kirkpatrick/pelajar/99999999', 'unknown student id → 403 Akses Ditolak');
  J('F', 'S8-pelajar__default__375', '/admin/kirkpatrick/pelajar/4664', 'default', [], M);
  J('F', 'S8-pelajar__default__768', '/admin/kirkpatrick/pelajar/4664', 'default', [], T);

  // ---------------- S9 student page /kirkpatrick (new route) ----------------
  J('F', 'S9-prestasi-saya__default__1280', '/kirkpatrick', 'admin viewing own data: no Head Count, 30 grey activity cells');
  J('F', 'S9-prestasi-saya__default__375', '/kirkpatrick', 'default', [], M);
  J('F', 'S9-prestasi-saya__default__768', '/kirkpatrick', 'default', [], T);

  // ---------------- S10 monthly feedback /maklum-balas (new route; T1 data source) ----------------
  J('F', 'S10-maklum-balas__submitted__1280', '/maklum-balas', 'already answered this month → thank-you state');
  J('F', 'S10-maklum-balas__submitted__375', '/maklum-balas', 'thank-you state', [], M);

  window.__M12_JOBS = jobs;
  window.__M12_HELPERS = { MASK: M12MASK, SAN: SAN };
})();
