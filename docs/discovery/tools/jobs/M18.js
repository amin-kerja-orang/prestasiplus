// M18 capture plan — PPD & JPN (district / state education office portals) + Amaran Awal (early warning) + the school
// drill-downs linked from the PPD dashboard. Every screen x every UI state that reveals different elements.
// Load:  browser_run_code_unsafe: async (page) => page.addScriptTag({ path: '<abs>/docs/discovery/tools/jobs/M18.js' })
// then:  browser_evaluate: () => { window.__jobs = window.__M18_JOBS.filter(j => j.group === 'A'); }
// then run tools/run-state.js, save window.__invs to docs/discovery/inventory/_raw/M18/_batch.json, split-batch.js, merge-inventory.js.
//
// SAFETY: live production, admin account, browser lane 2 (playwright2). READ-ONLY.
//   - Never clicked / submitted: "Muat Turun CSV" / "Eksport CSV" / "Muat Turun Laporan CSV" (GET downloads:
//     /ppd/export-laporan?format=csv, /amaran/export/{class|school|district}/{id}), "Cetak / PDF" (window.print),
//     "Tapis" buttons of the GET filter forms (filters are driven by URL query strings instead), "Simpan Intervensi"
//     (POST /amaran/intervensi), the per-record effectiveness <select> (onchange="this.form.submit()" → PATCH), the
//     follow-up "Simpan" (PATCH), the trash button (DELETE, confirm('Padam intervensi ini?')), "Tunjuk IC Penuh"
//     (confirm() + claims a PDPA audit record), the /amaran/keberkesanan/ppd school <select> (GET form; driven by URL).
//   - Actions are client-side reveals only: Alpine tabs (leaderboard "Ikut Subjek", ranking "Ikut Subjek"), the class
//     accordion of /ppd/sekolah/{id} (open = !open), the follow-up pencil toggle (showFollowUp), the "klik untuk lihat"
//     student lists and subject pills of /sekolah/{id}/analisa-item, the tablePager "next" button, typing in the JPN
//     school search box and choosing a district in its client-side filter select (no request).
//
// PERSONAL DATA (students are minors): M18MASK runs first (eval) and tags person-name nodes with class "m18n":
//   R1 links to person pages (/prestasi/{id}, /headcount/student/{id}, /amaran/intervensi/{id}, /prestasi/sekolah/{id}/guru/{id},
//      /pelajar/{id}) whose text is a name (not the action label "Intervensi");
//   R2 tables whose header is exactly "PELAJAR": the name leaf in each row (the "Tingkatan n" / "Darjah n" sub-line is kept);
//   R3 intervention rows (containers of an /amaran/intervensi/{id} link): the name line;
//   R4 /amaran/intervensi/{id}: history notes and meta lines (class m18l → sanitize localSelectors: masked in place, their text is
//      NOT scrubbed globally, so UI copy that happens to equal a note — e.g. the notes placeholder — survives); the student
//      name in the <title> is replaced everywhere;
//   R5 JPN command center: .student-name / .feed-name;
//   R6 Cloudflare-protected e-mails, avatar images;
//   R7 leaf stat labels that sanitize.js would read as "label → person value" (e.g. "Guru" under a count) get an empty <wbr>
//      child so sanitize.js leaves the next stat card alone.
// then tools/sanitize.js {selectors:['.m18n'], keepCols:'^pelajar$', titleName:false} masks the tagged nodes (and scrubs the
// same strings everywhere) plus every personal column ("Nama", "Nama Pelajar", "No. IC", "Email", "Guru", "Nama" …).
// The "PELAJAR" header is kept for column masking because in school tables it is a count column; R2 masks the name cells.
// School, PPD and state names are public anchors and are kept.
(function () {
  var B = 'https://prestasiplus.my';
  var jobs = [];
  function mask() {
    var n = 0, main = document.querySelector('main') || document.body;
    function tag(el) { if (el && el.classList && !el.classList.contains('m18n')) { el.classList.add('m18n'); n++; } }
    var NUM = /^[\d\s,.%+\-\/:()—–]*$/, KEEP = /^(Tingkatan|Darjah)\s*\d+$|^(-|—|Tiada)$/;
    // R6 e-mails + avatars
    document.querySelectorAll('a.__cf_email__, [data-cfemail]').forEach(function (a) { a.removeAttribute('data-cfemail'); a.textContent = '<email>'; a.setAttribute('href', '/cdn-cgi/l/email-protection'); n++; });
    document.querySelectorAll('img').forEach(function (im) { var s = im.getAttribute('src') || ''; if (/ui-avatars|avatar|storage\/(avatars|profile)/.test(s)) { im.setAttribute('src', 'data:image/gif;base64,R0lGODlhAQABAAAAACw='); im.setAttribute('alt', '<person>'); n++; } });
    // R1 person links
    var PL = /\/(prestasi\/\d+|headcount\/student\/\d+|amaran\/intervensi\/\d+|prestasi\/sekolah\/\d+\/guru\/\d+|pelajar\/\d+)(\?|$)/;
    main.querySelectorAll('a[href]').forEach(function (a) {
      var h = (a.getAttribute('href') || '').replace(/^https?:\/\/[^/]+/, ''), t = a.textContent.replace(/\s+/g, ' ').trim();
      if (!PL.test(h) || !t || NUM.test(t) || /^Intervensi$/i.test(t)) return;
      tag(a);
    });
    // R2 "PELAJAR" name cells
    main.querySelectorAll('table').forEach(function (tb) {
      var idx = -1; tb.querySelectorAll('thead th').forEach(function (th, i) { if (/^pelajar$/i.test(th.textContent.replace(/\s+/g, ' ').trim())) idx = i; });
      if (idx < 0) return;
      tb.querySelectorAll('tbody tr').forEach(function (tr) {
        var td = tr.children[idx]; if (!td) return;
        var w = document.createTreeWalker(td, NodeFilter.SHOW_TEXT), x, list = [];
        while ((x = w.nextNode())) list.push(x);
        list.forEach(function (tn) {
          var v = tn.nodeValue.replace(/\s+/g, ' ').trim();
          if (!v || NUM.test(v) || KEEP.test(v) || /^\d+ pelajar/.test(v)) return;
          var p = tn.parentElement;
          if (p === td || p.childNodes.length > 1) { var sp = document.createElement('span'); sp.className = 'm18n'; tn.parentNode.insertBefore(sp, tn); sp.appendChild(tn); n++; }
          else tag(p);
        });
      });
    });
    // R3 intervention rows (keberkesanan lists)
    main.querySelectorAll('a[href*="/amaran/intervensi/"]').forEach(function (a) {
      var row = a.closest('.justify-between'); if (!row) return;
      row.querySelectorAll('p.font-semibold, .font-semibold.text-slate-700').forEach(tag);
    });
    // R4 intervention log page
    var tm = document.title.match(/^Log Intervensi\s+[—-]\s+(.+?)(\s+\|\s+.*)?$/);
    if (tm) {
      var nm = tm[1].trim();
      main.querySelectorAll('.divide-y > div p.text-sm, .divide-y > div .text-\\[10px\\].text-slate-400.mt-1').forEach(function (el) { el.classList.add('m18l'); n++; });
      var ww = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), y;
      while ((y = ww.nextNode())) if (y.nodeValue.indexOf(nm) >= 0) { y.nodeValue = y.nodeValue.split(nm).join('<name>'); n++; }
      document.querySelectorAll('*').forEach(function (el) { for (var i = 0; i < el.attributes.length; i++) { var at = el.attributes[i]; if (at.value.indexOf(nm) >= 0) el.setAttribute(at.name, at.value.split(nm).join('<name>')); } });
      document.title = document.title.split(nm).join('<name>');
    }
    // R5 JPN command center
    document.querySelectorAll('.student-name, .feed-name').forEach(tag);
    // R7 protect stat labels from sanitize.js label→value rule
    var PERSONAL_LABEL = /^(nama( penuh)?|name|username|nama pengguna|e-?mel|email|telefon|no\.? ?tel(efon)?|phone|ic|no\.? ?(ic|k\/?p|kp|mykad)|mykad|kad pengenalan|ibu ?bapa|penjaga|waris|anak|cikgu|guru|guru kelas|pic|pegawai)\s*:?$/i;
    document.querySelectorAll('body *').forEach(function (el) {
      if (el.children.length || !el.textContent || el.textContent.length > 40) return;
      if (!PERSONAL_LABEL.test(el.textContent.replace(/\s+/g, ' ').trim())) return;
      if (el.closest('table,select,label,button,a,nav,aside,header')) return;
      el.appendChild(document.createElement('wbr')); n++;
    });
    return 'm18mask: ' + n;
  }
  var M18MASK = '(' + mask.toString() + ')()';
  var SAN = { selectors: ['.m18n'], localSelectors: ['.m18l'], keepCols: '^pelajar$', titleName: false };
  function J(group, file, url, state, actions, extra, opts) {
    var s = file.split('-')[0];
    var j = { group: group, file: file, url: B + url, actions: (actions || []).concat([{ eval: M18MASK }]), sanitize: SAN, settle: 700,
              opts: Object.assign({ state: state, prefix: 'EL-M18-' + s, redact: [], repeat: { 'main tbody tr': 3, 'main div[title^="20"]': 3, 'main .divide-y > div.p-4.space-y-2': 3 } }, opts || {}) };
    Object.assign(j, extra || {});
    j.opts.state = state + (j.width === 375 ? ' @375' : j.width === 768 ? ' @768' : '');
    jobs.push(j);
  }
  var M = { width: 375 }, T = { width: 768 };
  var W = function (ms) { return { wait: ms || 400 }; };
  function EV(js) { return { eval: '(() => { ' + js + ' })()' }; }
  function CLICKBTN(re) { return EV("var b = Array.from(document.querySelectorAll('main button')).find(function (x) { return " + re + ".test(x.textContent.replace(/\\s+/g, ' ').trim()); }); if (b) { b.click(); return 'clicked ' + b.textContent.trim().slice(0, 30); } return 'no button';"); }
  function CLICKAT(attrRe) { return EV("var b = Array.from(document.querySelectorAll('main button')).find(function (x) { return " + attrRe + ".test(x.getAttribute('@click') || x.getAttribute('x-on:click') || ''); }); if (b) { b.click(); return 'clicked'; } return 'no button';"); }
  function all3(g, key, url, state, actions, opts) { J(g, key + '__default__1280', url, state, actions, null, opts); J(g, key + '__default__375', url, state, actions, M, opts); J(g, key + '__default__768', url, state, actions, T, opts); }

  // ================= A: PPD portal =================
  all3('A', 'S1-ppd-dashboard', '/ppd/dashboard', 'PPD dashboard (admin → PPD KLUANG, Johor)');
  J('A', 'S1-ppd-dashboard__pager-next__1280', '/ppd/dashboard', 'first tablePager "next" clicked (GPS table page 2, client-side)', [CLICKAT('/^next\\(\\)$/'), W()]);
  J('A', 'S2-ppd-command-center__forbidden__1280', '/ppd/command-center', '403 "Akses Ditolak" for the admin account');
  J('A', 'S2-ppd-command-center__forbidden__375', '/ppd/command-center', '403', [], M);
  all3('A', 'S3-ppd-statistik', '/ppd/statistik-penggunaan', 'no period (default 30 Hari)');
  ['today', '7days', '30days', 'bogus'].forEach(function (p) { J('A', 'S3-ppd-statistik__period-' + p + '__1280', '/ppd/statistik-penggunaan?period=' + p, 'period=' + p + ' (GET by URL)'); });
  all3('A', 'S4-ppd-ranking', '/ppd/ranking-kebangsaan', 'no period (default 30 Hari)');
  ['today', '7days'].forEach(function (p) { J('A', 'S4-ppd-ranking__period-' + p + '__1280', '/ppd/ranking-kebangsaan?period=' + p, 'period=' + p + ' (GET by URL)'); });
  all3('A', 'S5-ppd-benchmark', '/ppd/benchmark-sekolah', 'all subjects');
  J('A', 'S5-ppd-benchmark__subject-3__1280', '/ppd/benchmark-sekolah?subject_id=3', 'subject_id=3 Matematik (Teras) (GET by URL)');
  J('A', 'S5-ppd-benchmark__subject-bogus__1280', '/ppd/benchmark-sekolah?subject_id=99999', 'unknown subject_id (GET by URL)');
  all3('A', 'S6-ppd-peta-haba', '/ppd/peta-haba', 'heat map 7 core subjects x schools');
  all3('A', 'S7-ppd-export', '/ppd/export-laporan', 'export page (CSV link NOT followed)');
  all3('A', 'S8-ppd-leaderboard', '/ppd/leaderboard-sekolah', 'tab Keseluruhan (default)');
  J('A', 'S8-ppd-leaderboard__tab-subjek__1280', '/ppd/leaderboard-sekolah', 'Alpine tab "Ikut Subjek" clicked', [CLICKBTN('/^Ikut Subjek$/'), W()]);
  J('A', 'S8-ppd-leaderboard__subject-3__1280', '/ppd/leaderboard-sekolah?subject_id=3', 'subject_id=3 (GET by URL)');
  all3('A', 'S9-ppd-sekolah', '/ppd/sekolah/8880', 'school statistics (SMK TINGGI KLUANG, id 8880)');
  J('A', 'S9-ppd-sekolah__school-8765__1280', '/ppd/sekolah/8765', 'school 8765 SMK LAYANG-LAYANG (from ranking/benchmark)');
  J('A', 'S9-ppd-sekolah__rank-subjek__1280', '/ppd/sekolah/8880', 'ranking tab "Ikut Subjek" clicked', [CLICKBTN('/^Ikut Subjek$/'), W()]);
  J('A', 'S9-ppd-sekolah__class-open__1280', '/ppd/sekolah/8880', 'first class accordion opened (student table, IC masked)', [CLICKAT('/^open = !open$/'), W()]);
  J('A', 'S9-ppd-sekolah__grade-t5__1280', '/ppd/sekolah/8880?grade=T5', 'grade=T5 (GET by URL)');
  J('A', 'S9-ppd-sekolah__class-516__1280', '/ppd/sekolah/8880?class_id=516', 'class_id=516 (GET by URL)');
  J('A', 'S9-ppd-sekolah__subject-3__1280', '/ppd/sekolah/8880?subject_id=3', 'subject_id=3 (GET by URL)');
  J('A', 'S9-ppd-sekolah__not-found__1280', '/ppd/sekolah/99999999', 'unknown id → 404');

  // ================= B: JPN portal =================
  all3('B', 'S10-jpn-dashboard', '/jpn/dashboard', 'JPN dashboard (admin → Johor)');
  J('B', 'S10-jpn-dashboard__search__1280', '/jpn/dashboard', 'typed "KLUANG" in the client-side school search', [{ type: ['#school-search-input', 'KLUANG'] }, W(600)]);
  J('B', 'S10-jpn-dashboard__district__1280', '/jpn/dashboard', 'district filter select "PPD KLUANG" (client-side)', [{ select: ['#district-filter-select', 'PPD KLUANG'] }, W(600)]);
  J('B', 'S10-jpn-dashboard__search-empty__1280', '/jpn/dashboard', 'search with no match', [{ type: ['#school-search-input', 'zzzz'] }, W(600)]);
  all3('B', 'S11-jpn-command-center', '/jpn/command-center', 'JPN command center (standalone page, polls /jpn/command-center/live-data every 10 s)', [W(1500)]);
  all3('B', 'S12-jpn-statistik', '/jpn/statistik-penggunaan', 'state usage statistics (empty)');
  all3('B', 'S13-jpn-ranking', '/jpn/ranking-kebangsaan', 'no period (default 30 Hari)');
  ['today', '7days'].forEach(function (p) { J('B', 'S13-jpn-ranking__period-' + p + '__1280', '/jpn/ranking-kebangsaan?period=' + p, 'period=' + p + ' (GET by URL)'); });
  all3('B', 'S14-jpn-daerah', '/jpn/daerah/PPD%20KLUANG', 'district statistics PPD KLUANG');
  J('B', 'S14-jpn-daerah__not-found__1280', '/jpn/daerah/BOGUS', 'unknown district → 404');
  all3('B', 'S15-jpn-sekolah', '/jpn/sekolah/8765', 'school statistics (JPN route), school 8765');

  // ================= C: Amaran Awal =================
  all3('C', 'S16-amaran', '/amaran', 'class list (admin sees every class)', [], { repeat: { 'main tbody tr': 3, 'main div[title^="20"]': 3, 'main a[href*="/amaran/kelas/"]': 3 } });
  all3('C', 'S17-amaran-kelas', '/amaran/kelas/1156', 'class 1156 (1 student)');
  J('C', 'S17-amaran-kelas__forbidden__1280', '/amaran/kelas/99999999', 'unknown class → 403');
  all3('C', 'S18-amaran-ppd', '/amaran/ppd', 'PPD early warning (admin → PPD BATANG PADANG, Perak)');
  all3('C', 'S19-amaran-jpn', '/amaran/jpn', 'JPN early warning (admin → Perak)');
  all3('C', 'S20-amaran-keberkesanan-ppd', '/amaran/keberkesanan/ppd', 'intervention effectiveness, PPD KLUANG, all schools');
  J('C', 'S20-amaran-keberkesanan-ppd__school-8880__1280', '/amaran/keberkesanan/ppd?school_id=8880', 'school_id=8880 (GET by URL)');
  all3('C', 'S21-amaran-keberkesanan', '/amaran/keberkesanan', 'school-level effectiveness (admin → own school, empty)');
  all3('C', 'S22-amaran-sekolah', '/amaran/sekolah/7780', 'school early warning 7780');
  J('C', 'S23-amaran-ringkasan__district__1280', '/amaran/ringkasan-eksekutif?scope=district&district=PPD%20BATANG%20PADANG&state=Perak', 'scope=district');
  J('C', 'S23-amaran-ringkasan__state__1280', '/amaran/ringkasan-eksekutif?scope=state&state=Perak', 'scope=state');
  J('C', 'S23-amaran-ringkasan__school__1280', '/amaran/ringkasan-eksekutif?scope=school&school_id=8880', 'scope=school');
  J('C', 'S23-amaran-ringkasan__noscope__1280', '/amaran/ringkasan-eksekutif', 'no query');
  J('C', 'S23-amaran-ringkasan__district__375', '/amaran/ringkasan-eksekutif?scope=district&district=PPD%20BATANG%20PADANG&state=Perak', 'scope=district', [], M);
  J('C', 'S23-amaran-ringkasan__district__768', '/amaran/ringkasan-eksekutif?scope=district&district=PPD%20BATANG%20PADANG&state=Perak', 'scope=district', [], T);
  all3('C', 'S24-amaran-intervensi', '/amaran/intervensi/2229', 'intervention log of one student (2 records); forms NOT submitted');
  J('C', 'S24-amaran-intervensi__followup__1280', '/amaran/intervensi/2229', 'pencil toggle → follow-up textarea shown (Alpine only; nothing saved)', [CLICKAT('/showFollowUp = !showFollowUp/'), W()]);

  // ================= D: school drill-downs + PPD/JPN item analysis =================
  // critical-question cards (20, question-bank data owned by M04): 3 samples inventoried, totals in meta.repeats
  var RQ = { repeat: { 'main tbody tr': 3, 'main div[title^="20"]': 3, 'main .space-y-3 > div.rounded-xl.border': 3, 'main .space-y-4.mt-3 > div.rounded-2xl': 3 } };
  all3('D', 'S25-analisa-item-ppd', '/analisa-item/ppd', 'PPD item analysis', [], RQ);
  J('D', 'S25-analisa-item-ppd__show-all__1280', '/analisa-item/ppd', 'showAll toggle clicked', [CLICKAT('/showAll/'), W()], null, RQ);
  all3('D', 'S26-analisa-item-jpn', '/analisa-item/jpn', 'JPN item analysis', [], RQ);
  all3('D', 'S27-sekolah-prestasi', '/sekolah/8880/prestasi', 'school performance dashboard 8880');
  all3('D', 'S28-sekolah-amaran', '/sekolah/8880/amaran', 'school early warning 8880, Semua Tingkatan');
  J('D', 'S28-sekolah-amaran__t4__1280', '/sekolah/8880/amaran?tingkatan=T4', 'tingkatan=T4');
  J('D', 'S28-sekolah-amaran__t5__1280', '/sekolah/8880/amaran?tingkatan=T5', 'tingkatan=T5');
  all3('D', 'S29-sekolah-kombo', '/sekolah/8880/kombo', 'school daily combo 8880');
  all3('D', 'S30-sekolah-analisa-item', '/sekolah/8880/analisa-item', 'school item analysis 8880', [], RQ);
  J('D', 'S30-sekolah-analisa-item__t4__1280', '/sekolah/8880/analisa-item?tingkatan=T4', 'tingkatan=T4', [], null, RQ);
  J('D', 'S30-sekolah-analisa-item__subject-pill__1280', '/sekolah/8880/analisa-item', 'subject pill "Sains (6)" clicked (Alpine subjectFilter)', [CLICKBTN('/^Sains \\(\\d+\\)$/'), W()], null, RQ);
  J('D', 'S30-sekolah-analisa-item__students-open__1280', '/sekolah/8880/analisa-item', 'first question card clicked (open = !open) → answer options + "pelajar salah" list (names masked)', [EV("var c = document.querySelector('main .space-y-4.mt-3 > div.rounded-2xl'); if (c) { c.click(); return 'opened'; } return 'no card';"), W()], null, RQ);
  J('D', 'S30-sekolah-analisa-item__not-found__1280', '/sekolah/99999999/analisa-item', 'unknown school id (200, empty page)', [], null, RQ);

  // ================= E: Kombo Harian officer views (found via the JPN dashboard link "Kombo Harian" → /kombo/jpn) =================
  all3('E', 'S31-kombo-ppd', '/kombo/ppd', 'PPD daily combo (admin → PPD BATANG PADANG, Perak)');
  all3('E', 'S32-kombo-jpn', '/kombo/jpn', 'JPN daily combo (admin → Perak)');
  all3('E', 'S33-kombo-sekolah', '/kombo/sekolah/7780', 'school daily combo via /kombo/sekolah/{id} (7780)');
  J('E', 'S33-kombo-sekolah__server-error__1280', '/kombo/sekolah/99999999', 'unknown school id → 500 "Ralat Pelayan"');

  window.__M18_JOBS = jobs;
  window.__M18_HELPERS = { MASK: M18MASK, SAN: SAN };
})();
