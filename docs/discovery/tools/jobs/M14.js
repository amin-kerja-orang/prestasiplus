// M14 capture plan — Gamification (coins/syiling, tokens, tiers, challenges, achievements, streak/kombo, leaderboards,
// teacher gamification, reward control). Every screen x every UI state that reveals different elements.
// Load:  browser_run_code_unsafe: async (page) => page.addScriptTag({ path: '<abs>/docs/discovery/tools/jobs/M14.js' })
// then:  browser_evaluate: () => { window.__jobs = window.__M14_JOBS.filter(j => j.group === 'A'); }
// then run tools/run-state.js, save window.__invs to docs/discovery/inventory/_raw/M14/_batch.json, split-batch.js, merge-inventory.js.
//
// SAFETY: live production admin, browser lane 2 (playwright2). READ-ONLY.
//   - Never submitted / clicked: "Tukar Sekarang" (convert), "Hantar Permohonan Tebus Tunai", tier save / toggle / "Tambah Tier",
//     challenge "Simpan" / "Nyahaktif" / "Padam" / "Tambah Cabaran", "Berikan" (award syiling), badge "Simpan", ganjaran "Simpan",
//     tunai status PATCH, reward-control "Simpan Tetapan" / cost "Simpan" / "Cipta Cabutan", pengaturan "Simpan Tetapan", any
//     GET filter form button (filters are driven by URL query strings instead).
//   - Actions are client-side reveals only: badge "Edit" (Alpine editing), "Tambah Ganjaran" (Alpine showForm), <details> summary,
//     kad-kongsi tabs (Alpine tab), quick-amount buttons (type=button, JS preview only) and typing into the amount inputs (never
//     submitted), achievements share modal opened by calling the page's own openShareCard() (no badge is unlocked for admin).
//
// PERSONAL DATA (students are minors): M14MASK runs first (eval) and
//   - tags person-name nodes with class "m14n": overview Top-10 names, leaderboard podium/row names, avatar <img> (ui-avatars
//     URLs carry the name), tunai "Bank" cell (bank account number + account-holder name);
//   - replaces school names with "<school>" (guru leaderboard "Seluruh Malaysia" tab);
//   - sanitize.js then masks the tagged nodes and the Pelajar / Guru table columns (built-in PERSONAL_COL).
// "Admin PRESTASI+" is the logged-in admin account's display name (not a person) and the referral code is the admin's own.
(function () {
  var B = 'https://prestasiplus.my';
  var jobs = [];
  function mask() {
    var n = 0, main = document.querySelector('main') || document.body;
    function tag(el) { if (el && !el.classList.contains('m14n')) { el.classList.add('m14n'); n++; } }
    var SCH = /\b(SEKOLAH (MENENGAH |KEBANGSAAN |JENIS |AGAMA |RENDAH |SENI |SUKAN |BERASRAMA )[A-Z0-9 ()'.@&\/-]*[A-Z0-9)]|SMK [A-Za-z][A-Za-z0-9 ()'.@-]*[A-Za-z0-9)]|SJKC? ?\(?[CT]?\)? [A-Z][A-Z0-9 ()'.-]*[A-Z0-9)]|SK [A-Z][A-Z0-9 ()'.-]*[A-Z0-9)]|SAM [A-Z][A-Z0-9 ()'.-]*[A-Z0-9)]|KOLEJ [A-Z][A-Z0-9 ()'.-]*[A-Z0-9)]|MAKTAB [A-Z][A-Z0-9 ()'.-]*[A-Z0-9)]|SBP [A-Z][A-Z0-9 ()'.-]*[A-Z0-9)]|MRSM [A-Z][A-Z0-9 ()'.-]*[A-Z0-9)])/g;
    // overview Top 10 (/admin/gamification)
    main.querySelectorAll('.section-card .space-y-2 > div .font-semibold.truncate').forEach(tag);
    // student leaderboard podium + rows
    main.querySelectorAll('.lb-top-card .font-bold.truncate, .lb-row .font-bold.truncate').forEach(tag);
    // tunai "Bank" column: bank name kept, account number and holder masked
    main.querySelectorAll('tbody tr').forEach(function (tr) {
      var th = tr.closest('table').querySelectorAll('thead th'), bi = -1;
      th.forEach(function (h, i) { if (/^Bank$/i.test(h.textContent.trim())) bi = i; });
      if (bi >= 0 && tr.children[bi]) { var ds = tr.children[bi].querySelectorAll('div'); for (var i = 1; i < ds.length; i++) { ds[i].textContent = i === 1 ? '<account-no>' : '<person>'; n++; } }
    });
    // avatars
    document.querySelectorAll('img').forEach(function (im) { var s = im.getAttribute('src') || ''; if (/ui-avatars|avatar|storage\/(avatars|profile)/.test(s)) { im.setAttribute('src', 'data:image/gif;base64,R0lGODlhAQABAAAAACw='); im.setAttribute('alt', '<person>'); n++; } });
    // school names in text and attributes
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), t;
    while ((t = w.nextNode())) { if (t.parentNode && /SCRIPT|STYLE/.test(t.parentNode.tagName)) continue; var v = t.nodeValue, nv = v.replace(SCH, '<school>'); if (nv !== v) { t.nodeValue = nv; n++; } }
    return 'm14mask: ' + n;
  }
  var M14MASK = '(' + mask.toString() + ')()';
  var SAN = { selectors: ['.m14n'], titleName: false };
  function J(group, file, url, state, actions, extra, opts) {
    var s = file.split('-')[0];
    var j = { group: group, file: file, url: B + url, actions: (actions || []).concat([{ eval: M14MASK }]), sanitize: SAN,
              opts: Object.assign({ state: state, prefix: 'EL-M14-' + s, redact: [] }, opts || {}) };
    Object.assign(j, extra || {});
    // S6 (/admin/gamifikasi/guru) holds no personal data; sanitize.js would treat the badge-name inputs (name="name") as
    // person names and scrub the badge names from the page, so it is skipped there (M14MASK still runs).
    if (/^S6-/.test(file)) j.sanitize = false;
    j.opts.state = state + (j.width === 375 ? ' @375' : j.width === 768 ? ' @768' : '');
    jobs.push(j);
  }
  var M = { width: 375 }, T = { width: 768 };
  var W = function (ms) { return { wait: ms || 500 }; };
  function EV(js) { return { eval: '(() => { ' + js + ' })()' }; }
  function CLK(sel) { return EV("var e = document.querySelector(" + JSON.stringify(sel) + "); if (!e) return 'missing " + sel.replace(/'/g, '') + "'; e.click(); return 'clicked';"); }
  // three default widths for a screen
  function D3(group, key, url, state, opts) {
    J(group, key + '__default__1280', url, state || 'default', [], null, opts);
    J(group, key + '__default__375', url, state || 'default', [], M, opts);
    J(group, key + '__default__768', url, state || 'default', [], T, opts);
  }

  // repeated lists (first N kept; totals in meta.repeats). Rows are partitioned by variant where the variant carries UI rules.
  var R1 = { repeat: { 'main .section-card .space-y-2 > div': 3, 'main tbody tr': 3 } };
  var R4 = { repeat: {} };
  ['cd7f32', 'c0c0c0', 'ffd700', 'e5e4e2'].forEach(function (c) { R4.repeat['main tbody tr:has(span.tier-badge[style*="' + c + '" i])'] = 1; });
  var R5 = { repeat: {} };
  ['earn', 'spend', 'convert', 'bonus', 'refund'].forEach(function (c) { R5.repeat['main tbody tr:has(.type-badge.' + c + ')'] = 1; });
  var R8 = { repeat: { 'main tbody tr': 1 } };
  var R10 = { repeat: { 'main section tbody tr.border-b': 3 } };
  var R14 = { repeat: { '.lb-row': 3 } };
  var R17 = { repeat: { 'main .tx-row': 3 } };
  var R19 = { repeat: { 'main .space-y-2 > div.bg-emerald-50': 2, 'main .space-y-2 > div.bg-red-50': 1 } };
  var R22 = { repeat: { 'main tbody tr': 4 } };

  // ---------------- A: admin ----------------
  D3('A', 'S1-admin-overview', '/admin/gamification', 'default', R1);
  D3('A', 'S2-admin-tiers', '/admin/gamification/tiers', 'default (4 tiers + Tambah Tier Baru)');
  D3('A', 'S3-admin-challenges', '/admin/gamification/challenges', 'default (10 challenges + Tambah Cabaran Baru)');
  D3('A', 'S4-admin-students', '/admin/gamification/students', 'default (sort Jumlah Syiling, page 1)', R4);
  J('A', 'S4-admin-students__tier-silver__1280', '/admin/gamification/students?tier=silver', 'tier=silver (GET by URL)', [], null, R4);
  J('A', 'S4-admin-students__sort-level__1280', '/admin/gamification/students?sort=level', 'sort=level (GET by URL)', [], null, R4);
  J('A', 'S4-admin-students__search-none__1280', '/admin/gamification/students?search=zzzq', 'search=zzzq (no match)', [], null, R4);
  J('A', 'S4-admin-students__last-page__1280', '/admin/gamification/students?page=113', 'page=113 (last page)', [], null, R4);
  D3('A', 'S5-admin-transactions', '/admin/gamification/transactions', 'default (Semua Jenis, page 1)', R5);
  ['earn', 'spend', 'convert', 'bonus', 'refund'].forEach(function (ty) { J('A', 'S5-admin-transactions__type-' + ty + '__1280', '/admin/gamification/transactions?type=' + ty, 'type=' + ty + ' (GET by URL)', [], null, R5); });
  J('A', 'S5-admin-transactions__date-empty__1280', '/admin/gamification/transactions?type=&date_from=2020-01-01&date_to=2020-01-02', 'date range with no rows', [], null, R5);
  J('A', 'S5-admin-transactions__last-page__1280', '/admin/gamification/transactions?page=2118', 'page=2118 (last page)', [], null, R5);

  // ---------------- B: admin teacher gamification + reward control ----------------
  D3('B', 'S6-admin-guru', '/admin/gamifikasi/guru', 'default (8 lencana, Katalog Ganjaran empty)');
  J('B', 'S6-admin-guru__badge-edit__1280', '/admin/gamifikasi/guru', 'lencana row 1 "Edit" (Alpine editing=true)', [CLK('main tbody[x-data] button'), W()]);
  J('B', 'S6-admin-guru__ganjaran-form__1280', '/admin/gamifikasi/guru', '"Tambah Ganjaran" form open (Alpine showForm)', [CLK('main [x-data*="showForm"] > button'), W()]);
  J('B', 'S6-admin-guru__ganjaran-form__375', '/admin/gamifikasi/guru', '"Tambah Ganjaran" form open', [CLK('main [x-data*="showForm"] > button'), W()], M);
  D3('B', 'S7-admin-guru-tebusan', '/admin/gamifikasi/guru/tebusan', 'status=PENDING (default)');
  ['PROCESSING', 'DELIVERED', 'CANCELLED', 'all'].forEach(function (s) { J('B', 'S7-admin-guru-tebusan__status-' + s + '__1280', '/admin/gamifikasi/guru/tebusan?status=' + s, 'status=' + s, []); });
  D3('B', 'S8-admin-guru-tunai', '/admin/gamifikasi/guru/tunai', 'status=PENDING (default; 2 requests)', R8);
  ['APPROVED', 'PROCESSING', 'PAID', 'REJECTED', 'all'].forEach(function (s) { J('B', 'S8-admin-guru-tunai__status-' + s + '__1280', '/admin/gamifikasi/guru/tunai?status=' + s, 'status=' + s, [], null, R8); });
  D3('B', 'S9-admin-pengaturan', '/admin/gamifikasi/pengaturan', 'default (10 settings)');
  D3('B', 'S10-admin-reward-control', '/admin/reward-control', 'default (Cabutan details closed)', R10);
  J('B', 'S10-admin-reward-control__draw-open__1280', '/admin/reward-control', '"➕ Cipta Cabutan Baru" details open', [CLK('main details summary'), W()], null, R10);
  J('B', 'S10-admin-reward-control__draw-open__375', '/admin/reward-control', '"➕ Cipta Cabutan Baru" details open', [CLK('main details summary'), W()], M, R10);

  // ---------------- C: student pages ----------------
  D3('C', 'S11-gamification', '/gamification', 'default (admin wallet 256 syiling, Gangsa, Level 2)');
  D3('C', 'S12-convert', '/gamification/convert', 'default (input 50 → 1 token)');
  J('C', 'S12-convert__quick-250__1280', '/gamification/convert', 'quick amount "250 syiling" (JS preview)', [{ click: 'main .quick-amount-btn:nth-child(2)' }, W(300)]);
  J('C', 'S12-convert__quick-all__1280', '/gamification/convert', 'quick amount "Semua (256)"', [{ click: 'main .quick-amount-btn:nth-child(3)' }, W(300)]);
  J('C', 'S12-convert__below-min__1280', '/gamification/convert', 'typed 30 (< rate 50): preview 0, button disabled', [{ fill: ['#syilingInput', ''] }, { type: ['#syilingInput', '30'] }, W(300)]);
  J('C', 'S12-convert__above-max__1280', '/gamification/convert', 'typed 300 (> balance 256): button disabled', [{ fill: ['#syilingInput', ''] }, { type: ['#syilingInput', '300'] }, W(300)]);
  D3('C', 'S13-challenges', '/gamification/challenges', 'default (10 challenges, 0/10 selesai)');
  D3('C', 'S14-leaderboard', '/gamification/leaderboard', 'default (top 3 podium + rows #4–#50)', R14);
  J('C', 'S14-leaderboard__period-ignored__1280', '/gamification/leaderboard?period=week', 'period=week (ignored: same list)', [], null, R14);
  D3('C', 'S15-achievements', '/gamification/achievements', 'rarity Semua (default, 25 badges, 0 unlocked)');
  ['common', 'rare', 'epic', 'legendary', 'zzz'].forEach(function (r) { J('C', 'S15-achievements__rarity-' + r + '__1280', '/gamification/achievements?rarity=' + r, 'rarity=' + r, []); });
  J('C', 'S15-achievements__share-modal__1280', '/gamification/achievements', 'share modal opened via the page function openShareCard() with badge 1 data (no unlocked badge on admin)', [EV("openShareCard('👣','Langkah Pertama','Jawab kuiz pertama anda','common','#9ca3af','Biasa',5,3); return 'opened';"), W()]);
  J('C', 'S15-achievements__share-modal__375', '/gamification/achievements', 'share modal (forced)', [EV("openShareCard('👣','Langkah Pertama','Jawab kuiz pertama anda','common','#9ca3af','Biasa',5,3); return 'opened';"), W()], M);
  D3('C', 'S16-referral', '/gamification/referral', 'default (admin code, 0 rujukan)');
  J('C', 'S16-referral__copied__1280', '/gamification/referral', '"Salin Kod" clicked (clipboard; label → "✓ Disalin!")', [{ click: 'main .btn-copy' }, W(400)]);
  D3('C', 'S17-history', '/gamification/history', 'Semua (default)', R17);
  ['earn', 'spend', 'convert', 'bonus', 'zzz'].forEach(function (ty) { J('C', 'S17-history__type-' + ty + '__1280', '/gamification/history?type=' + ty, 'type=' + ty, [], null, R17); });
  D3('C', 'S18-kad-kongsi', '/gamification/kad-kongsi', 'tab Profil (default)');
  ['kombo', 'penguasaan', 'ranking'].forEach(function (tb) { J('C', 'S18-kad-kongsi__tab-' + tb + '__1280', '/gamification/kad-kongsi', 'tab ' + tb, [CLK("main button[\\@click=\"tab='" + tb + "'\"]"), W()]); });
  J('C', 'S18-kad-kongsi__tab-penguasaan__375', '/gamification/kad-kongsi', 'tab penguasaan', [CLK("main button[\\@click=\"tab='penguasaan'\"]"), W()], M);

  // ---------------- D: teacher pages ----------------
  D3('D', 'S19-guru-gamifikasi', '/guru/gamifikasi', 'default (admin teacher wallet 92,683; 7/8 lencana)', R19);
  D3('D', 'S20-guru-tebus-tunai', '/guru/gamifikasi/tebus-tunai', 'default (preview hidden, submit disabled)');
  J('D', 'S20-guru-tebus-tunai__quick-500__1280', '/guru/gamifikasi/tebus-tunai', 'quick "500 syiling" → preview RM4.00, submit enabled (not submitted)', [{ click: 'main form button[type=button]:nth-child(2)' }, W(300)]);
  J('D', 'S20-guru-tebus-tunai__below-min__1280', '/guru/gamifikasi/tebus-tunai', 'typed 50 (< min 100): preview hidden', [{ type: ['#coinsInput', '50'] }, W(300)]);
  D3('D', 'S21-guru-kedai', '/guru/gamifikasi/kedai', 'default (Tiada Hadiah Tersedia)');
  D3('D', 'S22-guru-leaderboard', '/guru/gamifikasi/leaderboard', 'tab sekolah (default)', R22);
  J('D', 'S22-guru-leaderboard__tab-global__1280', '/guru/gamifikasi/leaderboard?tab=global', 'tab=global (Seluruh Malaysia; extra Sekolah column)', [], null, R22);
  J('D', 'S22-guru-leaderboard__tab-global__375', '/guru/gamifikasi/leaderboard?tab=global', 'tab=global', [], M, R22);
  J('D', 'S22-guru-leaderboard__tab-invalid__1280', '/guru/gamifikasi/leaderboard?tab=zzz', 'tab=zzz (unknown value)', [], null, R22);

  window.__M14_JOBS = jobs;
  window.__M14_HELPERS = { MASK: M14MASK, SAN: SAN };
})();
