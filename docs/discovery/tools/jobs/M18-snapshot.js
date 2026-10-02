// M18 dated seed snapshot (read-only, GET only, >= 400 ms between requests). Returns NON-PERSONAL values only.
// Load: browser_run_code_unsafe: async (page) => page.addScriptTag({ path: '<abs>/docs/discovery/tools/jobs/M18-snapshot.js' })
// Run:  browser_evaluate: async () => await window.__m18snap()   (save with filename → inventory/M18/_snapshot-<date>.json)
// For every M18 page (admin account): the page <title>, every <table> (headers + ALL rows, cell text), every <select>
// (name + options), the main text with tables / selects / scripts removed (all KPI cards, labels, empty states), link-pattern
// counts, Chart.js data blocks, and the JSON of /jpn/command-center/live-data.
// PERSONAL DATA: before anything is read, person names are replaced IN THE PARSED COPY by tokens "<student:n>" / "<teacher:n>"
// (numbered per distinct person within this capture; the mapping lives only in memory and is discarded), e-mails by "<email>",
// IC numbers by "<ic>", the intervention notes / meta lines by "<note>". Nodes replaced: person-page links (/prestasi/{id},
// /headcount/student/{id}, /amaran/intervensi/{id}, /prestasi/sekolah/{id}/guru/{id}), the name leaf of "PELAJAR" table cells,
// columns headed Nama / Nama Pelajar / Guru / Email / No. IC, intervention rows, and the student name in the intervention
// page title. School / PPD / state names are public anchors and are kept.
(function () {
  function T(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var people = {}, pn = { student: 0, teacher: 0 };
  function tok(name, kind) { var k = kind + '|' + name.toLowerCase(); if (!people[k]) people[k] = '<' + kind + ':' + (++pn[kind]) + '>'; return people[k]; }
  var NUM = /^[\d\s,.%+\-\/:()—–]*$/, KEEP = /^(Tingkatan|Darjah)\s*\d+$|^(-|—|Tiada)$/;
  function maskDoc(d, u) {
    var main = d.querySelector('main') || d.body;
    d.querySelectorAll('[data-cfemail], a.__cf_email__').forEach(function (a) { a.textContent = '<email>'; });
    var PL = /\/(prestasi\/\d+|headcount\/student\/\d+|amaran\/intervensi\/\d+|pelajar\/\d+)(\?|$)/, GL = /\/prestasi\/sekolah\/\d+\/guru\/\d+/;
    main.querySelectorAll('a[href]').forEach(function (a) {
      var h = a.getAttribute('href') || '', t = T(a.textContent);
      if (!t || NUM.test(t) || /^Intervensi$/i.test(t)) return;
      if (GL.test(h)) a.textContent = tok(t, 'teacher'); else if (PL.test(h)) a.textContent = tok(t, 'student');
    });
    main.querySelectorAll('table').forEach(function (tb) {
      tb.querySelectorAll('thead th').forEach(function (th, i) {
        var hh = T(th.textContent).toLowerCase(), kind = /^(pelajar|nama pelajar)$/.test(hh) ? 'student' : /^(nama|guru)$/.test(hh) ? 'teacher' : /^email$/.test(hh) ? 'email' : /^no\. ic$/.test(hh) ? 'ic' : null;
        if (!kind) return;
        tb.querySelectorAll('tbody tr').forEach(function (tr) {
          var td = tr.children[i]; if (!td) return;
          var w = d.createTreeWalker(td, NodeFilter.SHOW_TEXT), x, list = []; while ((x = w.nextNode())) list.push(x);
          list.forEach(function (tn) {
            var v = T(tn.nodeValue); if (!v || NUM.test(v) && kind !== 'ic' || KEEP.test(v) || /^\d+ pelajar/.test(v) || /^<(student|teacher):\d+>$|^<email>$/.test(v)) return;
            if (kind === 'ic') tn.nodeValue = '<ic>'; else if (kind === 'email') tn.nodeValue = '<email>';
            else if (v.length === 1) tn.nodeValue = '<initial>';
            else tn.nodeValue = tok(v, /kombo/.test(u) && hh === "nama" ? "student" : kind);
          });
        });
      });
    });
    main.querySelectorAll('a[href*="/amaran/intervensi/"]').forEach(function (a) { var row = a.closest('.justify-between'); if (row) row.querySelectorAll('p.font-semibold').forEach(function (p) { if (!/^<student/.test(T(p.textContent))) p.textContent = tok(T(p.textContent), 'student'); }); });
    var tm = d.title.match(/^Log Intervensi\s+[—-]\s+(.+?)(\s+\|\s+.*)?$/);
    if (tm) { var nm = tm[1].trim(), tk = tok(nm, 'student'); d.title = d.title.split(nm).join(tk);
      main.querySelectorAll('.divide-y > div p.text-sm, .divide-y > div .text-\\[10px\\].text-slate-400.mt-1').forEach(function (p) { p.textContent = '<note>'; });
      var w2 = d.createTreeWalker(d.body, NodeFilter.SHOW_TEXT), y; while ((y = w2.nextNode())) if (y.nodeValue.indexOf(nm) >= 0) y.nodeValue = y.nodeValue.split(nm).join(tk); }
    return main;
  }
  function tables(main) {
    return Array.from(main.querySelectorAll('table')).map(function (tb) {
      var sec = tb.closest('.card, [id^="sec-"]'), h = sec ? sec.querySelector('h2, h3') : null;
      return { section: h ? T(h.textContent) : null, headers: Array.from(tb.querySelectorAll('thead th')).map(function (th) { return T(th.textContent); }),
        rows: Array.from(tb.querySelectorAll('tbody tr')).map(function (tr) { var a = tr.querySelector('a[href*="/sekolah/"], a[href*="/daerah/"], a[href*="/kelas/"]'); var cells = Array.from(tr.children).map(function (td) { return T(td.textContent); }); if (a) cells.push('href=' + a.getAttribute('href').replace(/^https?:\/\/[^/]+/, '')); return cells; }) };
    });
  }
  function text(main) {
    var c = main.cloneNode(true);
    c.querySelectorAll('table, select, script, style, template, [x-data="tournamentBanner()"]').forEach(function (e) { e.remove(); });
    var out = [], w = c.ownerDocument.createTreeWalker(c, NodeFilter.SHOW_TEXT), x; while ((x = w.nextNode())) { var v = T(x.nodeValue); if (v) out.push(v); }
    return out.join(' | ');
  }
  function linkPatterns(main) { var o = {}; main.querySelectorAll('a[href]').forEach(function (a) { var k = a.getAttribute('href').replace(/^https?:\/\/[^/]+/, '').replace(/\d+/g, '{n}'); o[k] = (o[k] || 0) + 1; }); return o; }
  function charts(d) { return Array.from(d.querySelectorAll('script:not([src])')).map(function (s) { return s.textContent; }).filter(function (s) { return /new Chart\(/.test(s); }).map(function (s) { return T(s).slice(0, 3000); }); }
  async function page(u) {
    await sleep(420);
    var r = await fetch(u, { credentials: 'same-origin' }), html = await r.text(), d = new DOMParser().parseFromString(html, 'text/html');
    var main = maskDoc(d, u);
    return { url: u, status: r.status, title: d.title, tables: tables(main), selects: Array.from(main.querySelectorAll('select')).map(function (s) { return { name: s.name || s.id, options: Array.from(s.options).map(function (o) { return o.value + '=' + T(o.text); }) }; }),
      text: text(main), links: linkPatterns(main), charts: charts(d) };
  }
  window.__m18snap = async function (only) {
    var out = { capturedAt: new Date().toISOString(), note: 'M18 seed snapshot; GET only; admin account; person names tokenised (<student:n>, <teacher:n>), e-mails, IC numbers and intervention notes removed.', pages: {} };
    var urls = ['/ppd/dashboard', '/ppd/statistik-penggunaan', '/ppd/statistik-penggunaan?period=today', '/ppd/statistik-penggunaan?period=7days', '/ppd/ranking-kebangsaan', '/ppd/ranking-kebangsaan?period=today', '/ppd/ranking-kebangsaan?period=7days',
      '/ppd/benchmark-sekolah', '/ppd/benchmark-sekolah?subject_id=3', '/ppd/peta-haba', '/ppd/export-laporan', '/ppd/leaderboard-sekolah', '/ppd/leaderboard-sekolah?subject_id=3', '/ppd/sekolah/8880', '/ppd/sekolah/8765',
      '/jpn/dashboard', '/jpn/statistik-penggunaan', '/jpn/ranking-kebangsaan', '/jpn/ranking-kebangsaan?period=today', '/jpn/ranking-kebangsaan?period=7days', '/jpn/sekolah/8765', '/jpn/command-center',
      '/amaran', '/amaran/kelas/1156', '/amaran/ppd', '/amaran/jpn', '/amaran/keberkesanan/ppd', '/amaran/keberkesanan', '/amaran/sekolah/7780', '/amaran/sekolah/1',
      '/amaran/ringkasan-eksekutif?scope=district&district=PPD%20BATANG%20PADANG&state=Perak', '/amaran/ringkasan-eksekutif?scope=state&state=Perak', '/amaran/ringkasan-eksekutif?scope=school&school_id=8880', '/amaran/ringkasan-eksekutif', '/amaran/intervensi/2229',
      '/analisa-item/ppd', '/analisa-item/jpn', '/sekolah/8880/prestasi', '/sekolah/8880/amaran', '/sekolah/8880/amaran?tingkatan=T4', '/sekolah/8880/amaran?tingkatan=T5', '/sekolah/8880/kombo', '/sekolah/8880/analisa-item', '/sekolah/8880/analisa-item?tingkatan=T4', '/kombo/ppd', '/kombo/jpn', '/kombo/sekolah/7780'];
    if (only) urls = only; else ['PPD BATU PAHAT', 'PPD JOHOR BAHRU', 'PPD KLUANG', 'PPD KOTA TINGGI', 'PPD KULAI', 'PPD MERSING', 'PPD MUAR', 'PPD PASIR GUDANG', 'PPD PONTIAN', 'PPD SEGAMAT', 'PPD TANGKAK'].forEach(function (p) { urls.push('/jpn/daerah/' + encodeURIComponent(p)); });
    for (var i = 0; i < urls.length; i++) { try { out.pages[urls[i]] = await page(urls[i]); } catch (e) { out.pages[urls[i]] = { error: String(e) }; } }
    if (only) { out.people = { students: pn.student, teachers: pn.teacher }; people = {}; return out; }
    await sleep(420);
    try { var lr = await fetch('/jpn/command-center/live-data'); var lj = await lr.json(); out.jpnLiveData = JSON.parse(JSON.stringify(lj, function (k, v) { return /^(student|student_name)$/.test(k) ? '<student>' : v; })); out.jpnLiveDataStatus = lr.status; } catch (e) { out.jpnLiveData = { error: String(e) }; }
    out.people = { students: pn.student, teachers: pn.teacher };
    people = {}; // mapping discarded
    return out;
  };
})();
