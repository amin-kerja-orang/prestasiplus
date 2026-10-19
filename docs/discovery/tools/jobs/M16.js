// M16 capture plan — Battle, Games & Competitions. Every screen x every UI state that reveals different elements.
// Load:  browser_run_code_unsafe: async (page) => page.addScriptTag({ path: '<abs>/docs/discovery/tools/jobs/M16.js' })
// then:  browser_evaluate: () => { window.__jobs = window.__M16_JOBS.filter(j => j.group === 'A'); }
// then run tools/run-state.js, save window.__invs to docs/discovery/inventory/_raw/M16/_batch.json, split-batch, merge-inventory.
//
// SAFETY: live production admin, browser lane 3 (playwright3). READ-ONLY.
//   - BEFORE any job runs, the logged-in browser context gets a route guard that ABORTS every non-GET/HEAD request to
//     prestasiplus.my (context.route, verified with a POST probe → "Failed to fetch"). This matters because several game pages
//     auto-start on load (x-init startCountdown / startGame / init timer) and POST their result to …/submit when the timer ends
//     (betul-salah 45 s, cabaran-kilat 60 s, tembak-jawapan lives, kad-memori on completion). Nothing can be submitted.
//   - Never clicked: Quick Match / Battle Sekolah (POST /api/battle/quick-match|school-battle), sending a challenge
//     (POST /api/battle/invite), Terima/Tolak, "Cipta Bilik" / "Masuk" / "Masuk Bilik" room forms, "🔍 Cari Lawan Sekarang"
//     (POST /papan-bijak/quick-match), "🎯 SPIN!" (POST /permainan/roda-nasib/spin), "Sertai" / "Sertai Liga Ini" (POST /liga/sertai),
//     "Cipta Liga", "Simpan Draf" / "Cipta & Buka Pendaftaran" (POST /tournament/admin), "Simpan Tetapan" (PUT /admin/permainan),
//     any answer button, any card, any Jutawan subject link (/permainan/jutawan/main?… starts a game) and any room URL.
//   - States that need a server answer (searching, incoming challenger, waiting, error, invitations, prize, done …) are revealed by
//     setting the page's own Alpine state in the worker tab (client-only; no request is made). Fake values are placeholders
//     ('<name>', '<school>') — never real people.
//   - Form validity: form.reportValidity() only (native bubbles; not submitted).
//
// PERSONAL DATA (students are minors): M16MASK runs after the actions and before inventory / screenshot:
//   - lobby "🏆 Pendahulu" rows → "🥇 <name>", Papan Bijak top-10 name + initials, Pertandingan Mingguan names,
//     school-detail "Battle Terkini" player names, liga "Dicipta oleh <name>", Cabar Kawan results, Cloudflare e-mail payloads, avatars;
//   - school names (<school>) in every text node, attribute and <title>; the school-detail h2/title.
//   Then tools/sanitize.js {selectors:['.m16n'], titleName:false} (not on S1 / S7, see J()). No real name is written in this file.
(function () {
  var B = 'https://prestasiplus.my';
  var jobs = [];
  function mask() {
    var n = 0, main = document.querySelector('main') || document.body;
    function T(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
    function setOwnText(el, v) { var done = false; Array.from(el.childNodes).forEach(function (c) { if (c.nodeType === 3 && T(c.nodeValue)) { c.nodeValue = done ? '' : v; done = true; } }); if (!done) el.textContent = v; n++; }
    document.querySelectorAll('a.__cf_email__, [data-cfemail]').forEach(function (a) { a.removeAttribute('data-cfemail'); a.textContent = '<email>'; a.setAttribute('href', '/cdn-cgi/l/email-protection'); n++; });
    // lobby "Pendahulu" lists (perang-fakta, benteng-ilmu, perlumbaan-matematik, kuiz-relay, teka-silang-kata)
    main.querySelectorAll('h2').forEach(function (h) {
      if (!/Pendahulu/.test(h.textContent)) return;
      var box = h.nextElementSibling; if (!box) return;
      box.querySelectorAll(':scope > div > span:first-child').forEach(function (s) { var t = T(s.textContent), m = t.match(/^(🥇|🥈|🥉|\d+\.)\s/); s.textContent = (m ? m[1] + ' ' : '') + '<name>'; n++; });
    });
    // Papan Bijak "Top 10 Juara" table: initials circle + name
    main.querySelectorAll('table tbody tr td:nth-child(2)').forEach(function (td) {
      if (!/papan-bijak/.test(location.pathname)) return;
      td.querySelectorAll('div > div').forEach(function (d) { if (/width: ?32px/.test(d.getAttribute('style') || '')) { d.textContent = '··'; n++; } });
      td.querySelectorAll('span').forEach(function (s) { s.textContent = '<name>'; n++; });
    });
    // Pertandingan Mingguan ranking names
    if (/pertandingan/.test(location.pathname)) main.querySelectorAll('p.font-bold.text-sm.truncate').forEach(function (p) { setOwnText(p, '<name>'); });
    // school detail: "Battle Terkini" player names; school name header
    if (/\/battle\/ranking-sekolah\/\d+/.test(location.pathname)) {
      main.querySelectorAll('.space-y-2 > div > span.font-semibold').forEach(function (s) { s.textContent = '<name>'; n++; });
      main.querySelectorAll('h2').forEach(function (h) { h.textContent = '<school>'; n++; });
      document.title = '<school>'; n++;
    }
    // liga detail: creator
    main.querySelectorAll('p').forEach(function (p) { if (/Dicipta oleh/.test(p.textContent)) { p.textContent = T(p.textContent).replace(/Dicipta oleh .*? ·/, 'Dicipta oleh <name> ·'); n++; } });
    // battle "Cabar Kawan" results / invitations / incoming challenger (only placeholders are ever injected, masked anyway)
    main.querySelectorAll('[x-text="user.name"], [x-text="user.school"], [x-text="inv.sender_name"], [x-text="inv.sender_school"], [x-text="incomingChallenger.name"], [x-text="incomingChallenger.school"], [x-text="challengerTargetName"]').forEach(function (e) { e.classList.add('m16n'); n++; });
    // avatars
    document.querySelectorAll('img').forEach(function (im) { var s = im.getAttribute('src') || ''; if (/ui-avatars|avatar|storage\/(avatars|profile)/.test(s)) { im.setAttribute('src', 'data:image/gif;base64,R0lGODlhAQABAAAAACw='); im.setAttribute('alt', '<person>'); n++; } });
    // school names (public institutions → token) in text, attributes and <title>
    var SCH = /\b(SEKOLAH [A-Z(][A-Z0-9 ()'.@&\/-]*[A-Z0-9)]|SMK [A-Za-z][A-Za-z0-9 ()'.@-]*[A-Za-z0-9)]|SMT [A-Z][A-Z0-9 ()'.-]*[A-Z0-9)]|SJKC? ?\(?[CT]?\)? [A-Z][A-Z0-9 ()'.-]*[A-Z0-9)]|SK [A-Z][A-Z0-9 ()'.-]*[A-Z0-9)]|SAM [A-Z][A-Z0-9 ()'.-]*[A-Z0-9)]|KOLEJ [A-Z][A-Z0-9 ()'.-]*[A-Z0-9)]|MAKTAB [A-Z][A-Z0-9 ()'.-]*[A-Z0-9)]|SBP [A-Z][A-Z0-9 ()'.-]*[A-Z0-9)]|MRSM [A-Z][A-Z0-9 ()'.-]*[A-Z0-9)])/g;
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), t;
    while ((t = w.nextNode())) { if (t.parentNode && /SCRIPT|STYLE/.test(t.parentNode.tagName)) continue; var v = t.nodeValue, nv = v.replace(SCH, '<school>'); if (nv !== v) { t.nodeValue = nv; n++; } }
    document.querySelectorAll('[title],[alt],[aria-label]').forEach(function (e) { ['title', 'alt', 'aria-label'].forEach(function (k) { var v = e.getAttribute(k); if (v) { var nv = v.replace(SCH, '<school>'); if (nv !== v) { e.setAttribute(k, nv); n++; } } }); });
    if (SCH.test(document.title)) { document.title = document.title.replace(SCH, '<school>'); n++; }
    return 'm16mask: ' + n;
  }
  var M16MASK = '(' + mask.toString() + ')()';
  var SAN = { selectors: ['.m16n'], titleName: false };
  function J(group, file, url, state, actions, extra, opts) {
    var s = file.split('-')[0];
    var j = { group: group, file: file, url: B + url, actions: (actions || []).concat([{ eval: M16MASK }]), sanitize: SAN,
              opts: Object.assign({ state: state, prefix: 'EL-M16-' + s, redact: [] }, opts || {}) };
    Object.assign(j, extra || {});
    // S1 (battle) and S7 (papan-bijak) hold no personal data, but sanitize.js would rewrite their non-personal Alpine literals
    // (selectedSubjectName = 'Matematik', selectedDomainName, autoGradeName = 'Darjah 4') to '<name>' and replace those subject
    // names page-wide. M16MASK alone runs there (it still masks the Papan Bijak top-10 names, e-mail payloads and schools).
    if (/^S(1|7)-/.test(file)) j.sanitize = false;
    j.opts.state = state + (j.width === 375 ? ' @375' : j.width === 768 ? ' @768' : '');
    jobs.push(j);
  }
  var M = { width: 375 }, T = { width: 768 };
  var W = function (ms) { return { wait: ms || 500 }; };
  function EV(js) { return { eval: '(() => { ' + js + ' })()' }; }
  function CLK(sel) { return EV("var e = document.querySelector(" + JSON.stringify(sel) + "); if (!e) return 'missing " + sel.replace(/'/g, '') + "'; e.click(); return 'clicked';"); }
  // set Alpine state of the component rooted at x-data=<xd> (client-only reveal)
  function AL(xd, obj) { return EV("var e = document.querySelector('[x-data=\"" + xd + "\"]'); if (!e) return 'missing " + xd.replace(/"/g, '') + "'; var d = Alpine.$data(e); var o = " + JSON.stringify(obj) + "; for (var k in o) d[k] = o[k]; return 'alpine set " + Object.keys(obj).join(',') + "';"); }
  function VALID(sel) { return EV("var f = document.querySelector(" + JSON.stringify(sel) + "); if (!f) return 'no form'; return 'reportValidity=' + f.reportValidity();"); }

  // ---------------- S1 /battle (Battle Arena lobby) ----------------
  var BL = 'battleLobby()';
  var PICK3 = CLK('main button[\\@click^="selectedSubject = 3;"]');
  J('A', 'S1-battle__default__1280', '/battle', 'Biasa (default), no subject selected → mode buttons disabled');
  J('A', 'S1-battle__more-subjects__1280', '/battle', '"Lagi 24 subjek lain" expanded (Tutup)', [CLK('main [x-data="{ showMore: false }"] > button'), W()]);
  J('A', 'S1-battle__subject-selected__1280', '/battle', 'Matematik selected → Quick Match / Cabar Kawan / Battle Sekolah enabled', [PICK3, W()]);
  J('A', 'S1-battle__pksk__1280', '/battle', 'question type PKSK (domains + Tahap)', [CLK('main button[\\@click="questionType = \'pksk\'"]'), W()]);
  J('A', 'S1-battle__pksk-selected__1280', '/battle', 'PKSK domain 1 + Tahap 1 selected (enabled)', [CLK('main button[\\@click="questionType = \'pksk\'"]'), W(), CLK('main button[\\@click^="selectedPkskDomain = 1;"]'), CLK('main button[\\@click="selectedPkskLevel = \'T1\'"]'), W()]);
  J('A', 'S1-battle__spm-tip__1280', '/battle', 'SPM button clicked → tooltip only (type stays Biasa)', [CLK('main button[\\@click="showTip = !showTip"]'), W()]);
  J('A', 'S1-battle__open-to-all__1280', '/battle', 'Keterlihatan Barisan toggled → Terbuka', [{ check: 'main input[x-model="openToAll"]' }, W()]);
  J('A', 'S1-battle__challenge-modal__1280', '/battle', 'Cabar Kawan modal (after selecting Matematik)', [PICK3, W(300), CLK('main button[\\@click="showChallengeModal = true"]'), W()]);
  J('A', 'S1-battle__challenge-none__1280', '/battle', 'Cabar Kawan search "zzqxv" → "Tiada pelajar dijumpai" (GET /api/battle/search-opponent)', [PICK3, W(300), CLK('main button[\\@click="showChallengeModal = true"]'), W(300), { type: ['main input[x-model="searchQuery"]', 'zzqxv'] }, W(1500)]);
  J('A', 'S1-battle__searching__1280', '/battle', 'searching (Alpine searching=true, timer 1:05, same grade) — client-only', [PICK3, AL(BL, { searching: true, searchTimer: 65 }), W()]);
  J('A', 'S1-battle__searching-open__1280', '/battle', 'searching with openToAll=true — client-only', [PICK3, AL(BL, { searching: true, searchTimer: 7, openToAll: true }), W()]);
  J('A', 'S1-battle__incoming__1280', '/battle', 'incoming challenger card (Alpine placeholder data) — client-only', [PICK3, AL(BL, { searching: true, incomingChallenger: { name: '<name>', grade_label: 'Darjah 4', school: '<school>' } }), W()]);
  J('A', 'S1-battle__waiting__1280', '/battle', 'Menunggu Kelulusan (challengerWaiting=true) — client-only', [AL(BL, { challengerWaiting: true, challengerTargetName: '<name>', challengerTargetGrade: 'Darjah 4' }), W()]);
  J('A', 'S1-battle__error__1280', '/battle', 'error banner (errorMsg set to a source string) — client-only', [AL(BL, { errorMsg: 'Tiada lawan dijumpai dalam masa 2 minit. Sila cuba lagi.' }), W()]);
  J('A', 'S1-battle__invitations__1280', '/battle', 'Cabaran Masuk modal (showInvitations=true; no UI opens it) — client-only', [AL(BL, { showInvitations: true }), W()]);
  J('A', 'S1-battle__default__375', '/battle', 'default', [], M);
  J('A', 'S1-battle__challenge-modal__375', '/battle', 'Cabar Kawan modal', [PICK3, W(300), CLK('main button[\\@click="showChallengeModal = true"]'), W()], M);
  J('A', 'S1-battle__searching__375', '/battle', 'searching — client-only', [PICK3, AL(BL, { searching: true, searchTimer: 65 }), W()], M);
  J('A', 'S1-battle__default__768', '/battle', 'default', [], T);

  // ---------------- S2 /battle/leaderboard ----------------
  J('B', 'S2-battle-leaderboard__default__1280', '/battle/leaderboard', 'Mingguan (default), empty');
  J('B', 'S2-battle-leaderboard__monthly-click__1280', '/battle/leaderboard', 'Bulanan pill clicked (client-only; table unchanged)', [CLK('main button[\\@click="period = \'monthly\'"]'), W()]);
  J('B', 'S2-battle-leaderboard__query-monthly__1280', '/battle/leaderboard?period=monthly', '?period=monthly (ignored; Mingguan still active)');
  J('B', 'S2-battle-leaderboard__default__375', '/battle/leaderboard', 'default', [], M);
  J('B', 'S2-battle-leaderboard__default__768', '/battle/leaderboard', 'default', [], T);

  // ---------------- S3 /battle/ranking-sekolah ----------------
  var R3 = { repeat: { 'main tbody tr': 3 } };
  J('B', 'S3-ranking-sekolah__default__1280', '/battle/ranking-sekolah', 'Mingguan (default), empty', [], null, R3);
  J('B', 'S3-ranking-sekolah__monthly__1280', '/battle/ranking-sekolah?period=monthly', 'Bulanan (1 school)', [], null, R3);
  J('B', 'S3-ranking-sekolah__all-time__1280', '/battle/ranking-sekolah?period=all_time', 'Sepanjang Masa (7 schools, podium)', [], null, R3);
  J('B', 'S3-ranking-sekolah__state-johor__1280', '/battle/ranking-sekolah?period=weekly&state=Johor', 'Mingguan + Johor (empty; select shows Johor)', [], null, R3);
  J('B', 'S3-ranking-sekolah__state-all-time-johor__1280', '/battle/ranking-sekolah?period=all_time&state=Johor', 'Sepanjang Masa + Johor', [], null, R3);
  J('B', 'S3-ranking-sekolah__period-bogus__1280', '/battle/ranking-sekolah?period=bogus', 'unknown period → all-time data, no pill active', [], null, R3);
  J('B', 'S3-ranking-sekolah__all-time__375', '/battle/ranking-sekolah?period=all_time', 'Sepanjang Masa', [], M, R3);
  J('B', 'S3-ranking-sekolah__default__375', '/battle/ranking-sekolah', 'default (empty)', [], M, R3);
  J('B', 'S3-ranking-sekolah__all-time__768', '/battle/ranking-sekolah?period=all_time', 'Sepanjang Masa', [], T, R3);

  // ---------------- S4 /battle/ranking-sekolah/{id} (new) ----------------
  var R4 = { repeat: { 'main .space-y-2 > div.flex': 2 } };
  J('C', 'S4-ranking-sekolah-show__default__1280', '/battle/ranking-sekolah/8106', 'school with battles (all-time #1)', [], null, R4);
  J('C', 'S4-ranking-sekolah-show__other__1280', '/battle/ranking-sekolah/8080', 'another school with battles', [], null, R4);
  J('C', 'S4-ranking-sekolah-show__empty__1280', '/battle/ranking-sekolah/900', 'school with no battle (all empty states)', [], null, R4);
  J('C', 'S4-ranking-sekolah-show__not-found__1280', '/battle/ranking-sekolah/99999999', 'unknown school id (404)');
  J('C', 'S4-ranking-sekolah-show__default__375', '/battle/ranking-sekolah/8106', 'default', [], M, R4);
  J('C', 'S4-ranking-sekolah-show__default__768', '/battle/ranking-sekolah/8106', 'default', [], T, R4);

  // ---------------- S5 /battle/history (new) ----------------
  J('C', 'S5-battle-history__default__1280', '/battle/history', 'no battle (empty state)');
  J('C', 'S5-battle-history__default__375', '/battle/history', 'default', [], M);
  J('C', 'S5-battle-history__default__768', '/battle/history', 'default', [], T);

  // ---------------- S6 /permainan (hub) ----------------
  J('C', 'S6-permainan__default__1280', '/permainan', 'hub: no open room, 17 game cards');
  J('C', 'S6-permainan__default__375', '/permainan', 'default', [], M);
  J('C', 'S6-permainan__default__768', '/permainan', 'default', [], T);

  // ---------------- S7 /papan-bijak (lobby) ----------------
  var R7 = { repeat: { 'main table tbody tr': 3 } };
  var QM = 'quickMatch()';
  J('D', 'S7-papan-bijak__default__1280', '/papan-bijak', 'lobby: auto grade (Darjah 4), Tahap sama sahaja', [], null, R7);
  J('D', 'S7-papan-bijak__manual__1280', '/papan-bijak', '"Tukar" → manual grade select + "← Guna auto"', [CLK('main button[\\@click="manualMode = true"]'), W()], null, R7);
  J('D', 'S7-papan-bijak__custom-range__1280', '/papan-bijak', 'Siapa Boleh Join = Pilih julat khas → Dari / Hingga', [{ select: ['main select[name="match_mode"]', 'custom'] }, W()], null, R7);
  J('D', 'S7-papan-bijak__manual-tingkatan__1280', '/papan-bijak', 'manual grade Tingkatan 2 → option label "Semua Tingkatan (1-5)"', [CLK('main button[\\@click="manualMode = true"]'), W(200), { select: ['main select[x-model="gradeLevel"]', 'TINGKATAN_2'] }, W()], null, R7);
  J('D', 'S7-papan-bijak__searching__1280', '/papan-bijak', 'Cari Lawan Auto searching (Alpine searching=true, elapsed 12) — client-only', [AL(QM, { searching: true, elapsed: 12 }), W()], null, R7);
  J('D', 'S7-papan-bijak__search-error__1280', '/papan-bijak', 'error text with searching=true (the only state where it is visible) — client-only', [AL(QM, { searching: true, elapsed: 30, error: 'Tiada lawan dijumpai. Cuba lagi!' }), W()], null, R7);
  J('D', 'S7-papan-bijak__validity__1280', '/papan-bijak', 'join form reportValidity() (empty required room code)', [VALID('main form[action$="/papan-bijak/join"]'), W()], null, R7);
  J('D', 'S7-papan-bijak__default__375', '/papan-bijak', 'default', [], M, R7);
  J('D', 'S7-papan-bijak__default__768', '/papan-bijak', 'default', [], T, R7);

  // ---------------- S8–S12 multiplayer lobbies (same template) ----------------
  var RL = { repeat: {} };
  RL.repeat['main h2 + div > div'] = 4;
  [['S8-perang-fakta', '/perang-fakta'], ['S9-benteng-ilmu', '/benteng-ilmu'], ['S10-perlumbaan-matematik', '/perlumbaan-matematik'], ['S11-kuiz-relay', '/kuiz-relay'], ['S12-teka-silang-kata', '/teka-silang-kata']].forEach(function (p) {
    J('E', p[0] + '__default__1280', p[1], 'lobby default (auto grade)', [], null, RL);
    J('E', p[0] + '__manual__1280', p[1], '"Tukar" → manual grade select', [CLK('main button[\\@click="manualMode=true"]'), W()], null, RL);
    J('E', p[0] + '__room-not-found__1280', p[1] + '/ZZZZZ9', 'unknown room code URL → redirected to lobby (no message)', [], null, RL);
    J('E', p[0] + '__default__375', p[1], 'default', [], M, RL);
    J('E', p[0] + '__default__768', p[1], 'default', [], T, RL);
  });

  // ---------------- S13–S17 single-player games (auto-start; submit POST blocked by the context guard) ----------------
  function game(sx, path, xd, extraStates) {
    J('F', sx + '__picker__1280', path, 'no ?darjah → darjah picker overlay (game runs underneath)', [W(300)]);
    J('F', sx + '__countdown__1280', path + '?darjah=4', '?darjah=4 → countdown', [W(100)]);
    J('F', sx + '__playing__1280', path + '?darjah=4', '?darjah=4 → playing (after countdown)', [W(3200)]);
    (extraStates || []).forEach(function (st) { J('F', sx + '__' + st[0] + '__1280', path + '?darjah=4', st[1], [W(3200)].concat(st[2])); });
    J('F', sx + '__done__1280', path + '?darjah=4', 'result screen (Alpine phase=done, isNewRecord=true) — client-only', [W(3200), AL(xd, { phase: 'done', isNewRecord: true }), W(600)]);
    J('F', sx + '__picker__375', path, 'picker overlay', [W(300)], M);
    J('F', sx + '__playing__375', path + '?darjah=4', 'playing', [W(3200)], M);
    J('F', sx + '__playing__768', path + '?darjah=4', 'playing', [W(3200)], T);
  }
  game('S13-betul-salah', '/permainan/betul-salah', 'betulSalah()', [['streak', 'kombo badge (Alpine streak=6 → hot) — client-only', [AL('betulSalah()', { streak: 6 }), W()]]]);
  game('S14-cabaran-kilat', '/permainan/cabaran-kilat', 'speedChallenge()', [['combo', 'combo badge (Alpine combo=6 → fire) — client-only', [AL('speedChallenge()', { combo: 6 }), W()]], ['low-time', 'timer ≤ 10 s (danger) — client-only', [AL('speedChallenge()', { timeLeft: 8 }), W()]]]);
  game('S15-tembak-jawapan', '/permainan/tembak-jawapan', 'tembakJawapan()', [['level-up', 'LEVEL banner (Alpine showLevelUp, level 2, lives 1) — client-only', [AL('tembakJawapan()', { showLevelUp: true, level: 2, lives: 1 }), W(300)]]]);
  // Susun Jawapan: no countdown, phase starts 'playing'
  J('F', 'S16-susun-jawapan__picker__1280', '/permainan/susun-jawapan', 'no ?darjah → darjah picker overlay', [W(300)]);
  J('F', 'S16-susun-jawapan__playing__1280', '/permainan/susun-jawapan?darjah=4', 'puzzle 1, nothing placed', [W(600)]);
  J('F', 'S16-susun-jawapan__placed__1280', '/permainan/susun-jawapan?darjah=4', 'one tile placed (client-only)', [W(600), CLK('main span[\\@click="placeTile(ti)"]'), W()]);
  J('F', 'S16-susun-jawapan__wrong__1280', '/permainan/susun-jawapan?darjah=4', 'checkResult=wrong (Cuba Lagi / Langkau) — client-only', [W(600), CLK('main span[\\@click="placeTile(ti)"]'), AL('susunJawapan()', { checkResult: 'wrong' }), W()]);
  J('F', 'S16-susun-jawapan__correct__1280', '/permainan/susun-jawapan?darjah=4', 'checkResult=correct (BETUL! +n mata, Seterusnya) — client-only', [W(600), CLK('main span[\\@click="placeTile(ti)"]'), AL('susunJawapan()', { checkResult: 'correct' }), W()]);
  J('F', 'S16-susun-jawapan__done__1280', '/permainan/susun-jawapan?darjah=4', 'result (Alpine phase=done) — client-only', [W(600), AL('susunJawapan()', { phase: 'done', resultEmoji: '🧩', resultTitle: 'BIJAK!' }), W()]);
  J('F', 'S16-susun-jawapan__picker__375', '/permainan/susun-jawapan', 'picker', [W(300)], M);
  J('F', 'S16-susun-jawapan__playing__375', '/permainan/susun-jawapan?darjah=4', 'playing', [W(600)], M);
  J('F', 'S16-susun-jawapan__playing__768', '/permainan/susun-jawapan?darjah=4', 'playing', [W(600)], T);
  // Kad Memori: no picker, timer starts on load
  J('F', 'S17-kad-memori__default__1280', '/permainan/kad-memori', '12 face-down cards, timer running', [W(600)]);
  J('F', 'S17-kad-memori__flipped__1280', '/permainan/kad-memori', 'one card flipped (client-only)', [W(400), CLK('main [\\@click="flipCard(index)"]'), W(300)]);
  J('F', 'S17-kad-memori__complete__1280', '/permainan/kad-memori', 'result overlay (Alpine gameComplete=true) — client-only', [W(400), AL('memoryGame()', { gameComplete: true, syilingEarned: 0, resultAccuracy: 0 }), W(600)]);
  J('F', 'S17-kad-memori__default__375', '/permainan/kad-memori', 'default', [W(600)], M);
  J('F', 'S17-kad-memori__default__768', '/permainan/kad-memori', 'default', [W(600)], T);

  // ---------------- S18 /permainan/roda-nasib ----------------
  var RN = 'spinWheel()';
  J('G', 'S18-roda-nasib__default__1280', '/permainan/roda-nasib', 'wheel, SPIN! enabled');
  J('G', 'S18-roda-nasib__spinning__1280', '/permainan/roda-nasib', 'spinning (button label) — client-only', [AL(RN, { spinning: true }), W()]);
  J('G', 'S18-roda-nasib__already__1280', '/permainan/roda-nasib', 'alreadySpun=true — client-only', [AL(RN, { alreadySpun: true }), W()]);
  J('G', 'S18-roda-nasib__prize-syiling__1280', '/permainan/roda-nasib', 'prize modal, type syiling (segment "5 Syiling") — client-only', [AL(RN, { showPrize: true, prizeType: 'syiling', prizeValue: 5, prizeLabel: '5 Syiling', prizeIcon: '💎', alreadySpun: true }), W()]);
  J('G', 'S18-roda-nasib__prize-nothing__1280', '/permainan/roda-nasib', 'prize modal, type nothing ("Cuba Lagi") — client-only', [AL(RN, { showPrize: true, prizeType: 'nothing', prizeValue: 0, prizeLabel: 'Cuba Lagi', prizeIcon: '😅', alreadySpun: true }), W()]);
  J('G', 'S18-roda-nasib__default__375', '/permainan/roda-nasib', 'default', [], M);
  J('G', 'S18-roda-nasib__default__768', '/permainan/roda-nasib', 'default', [], T);

  // ---------------- S19 /permainan/jutawan ----------------
  J('G', 'S19-jutawan__picker__1280', '/permainan/jutawan', 'no ?darjah → picker overlay + "Pilih darjah atau tingkatan di atas untuk mula."');
  J('G', 'S19-jutawan__subjects__1280', '/permainan/jutawan?darjah=4', '?darjah=4 → PILIH SUBJEK (10 subjects with question counts)');
  J('G', 'S19-jutawan__picker__375', '/permainan/jutawan', 'picker', [], M);
  J('G', 'S19-jutawan__subjects__375', '/permainan/jutawan?darjah=4', 'subjects', [], M);
  J('G', 'S19-jutawan__subjects__768', '/permainan/jutawan?darjah=4', 'subjects', [], T);

  // ---------------- S20 /permainan/pertandingan ----------------
  var R20 = { repeat: { 'main .divide-y > div': 4 } };
  J('G', 'S20-pertandingan__default__1280', '/permainan/pertandingan', 'this week (21–27 Sep 2026), admin not ranked, top-20 list', [], null, R20);
  J('G', 'S20-pertandingan__query-ignored__1280', '/permainan/pertandingan?week=1', '?week=1 ignored', [], null, R20);
  J('G', 'S20-pertandingan__default__375', '/permainan/pertandingan', 'default', [], M, R20);
  J('G', 'S20-pertandingan__default__768', '/permainan/pertandingan', 'default', [], T, R20);

  // ---------------- S21 /permainan/uji-minda, S22 /permainan/sambung-kata ----------------
  J('G', 'S21-uji-minda__default__1280', '/permainan/uji-minda', 'no challenge from parent (empty state)');
  J('G', 'S21-uji-minda__default__375', '/permainan/uji-minda', 'default', [], M);
  J('G', 'S21-uji-minda__default__768', '/permainan/uji-minda', 'default', [], T);
  J('G', 'S22-sambung-kata__default__1280', '/permainan/sambung-kata', 'HTTP 500 (empty body)');
  J('G', 'S22-sambung-kata__default__375', '/permainan/sambung-kata', 'HTTP 500', [], M);

  // ---------------- S23 /tournament, S30 tournament banner ----------------
  J('H', 'S23-tournament__default__1280', '/tournament', 'no active tournament; admin create button');
  J('H', 'S23-tournament__default__375', '/tournament', 'default', [], M);
  J('H', 'S23-tournament__default__768', '/tournament', 'default', [], T);
  var TB = 'tournamentBanner()';
  var FAKE = [
    { uuid: 'u-reg', title: 'Contoh Tournament Pendaftaran', status: 'registration', live_match: null },
    { uuid: 'u-ongoing', title: 'Contoh Tournament Berlangsung', status: 'ongoing', live_match: null },
    { uuid: 'u-live', title: 'Contoh Tournament LIVE', status: 'ongoing', live_match: { school_a: '<school>', school_b: '<school>' } }
  ];
  J('H', 'S30-tournament-banner__three-states__1280', '/tournament', 'banner with 3 placeholder tournaments (registration / ongoing / live_match) — client-only', [AL(TB, { tournaments: FAKE }), W()]);
  J('H', 'S30-tournament-banner__registration__1280', '/permainan', 'banner, one registration tournament on another page — client-only', [AL(TB, { tournaments: [FAKE[0]] }), W()]);
  J('H', 'S30-tournament-banner__three-states__375', '/tournament', 'banner 3 states', [AL(TB, { tournaments: FAKE }), W()], M);
  J('H', 'S30-tournament-banner__three-states__768', '/tournament', 'banner 3 states', [AL(TB, { tournaments: FAKE }), W()], T);

  // ---------------- S24 /tournament/admin/create (new) ----------------
  var TF = 'tournamentForm()';
  J('H', 'S24-tournament-create__default__1280', '/tournament/admin/create', 'format Hibrid (default) → Bilangan Kumpulan; Mengikut Mata Pelajaran');
  J('H', 'S24-tournament-create__single__1280', '/tournament/admin/create', 'format Perlawanan Tunggal', [{ check: 'main input[name="format"][value="single_match"]' }, W()]);
  J('H', 'S24-tournament-create__knockout__1280', '/tournament/admin/create', 'format Kalah Mati', [{ check: 'main input[name="format"][value="knockout"]' }, W()]);
  J('H', 'S24-tournament-create__league__1280', '/tournament/admin/create', 'format Liga', [{ check: 'main input[name="format"][value="league"]' }, W()]);
  J('H', 'S24-tournament-create__exam-paper__1280', '/tournament/admin/create', 'Sumber Soalan = Mengikut Kertas Peperiksaan (empty select)', [{ check: 'main input[name="question_mode"][value="exam_paper"]' }, W()]);
  J('H', 'S24-tournament-create__random-mix__1280', '/tournament/admin/create', 'Sumber Soalan = Campuran Rawak (31 checkboxes)', [{ check: 'main input[name="question_mode"][value="random_mix"]' }, W()]);
  J('H', 'S24-tournament-create__spm-note__1280', '/tournament/admin/create', 'subject Bahasa Melayu → 25 + "Standard SPM Kertas 1: 25 soalan"', [{ select: ['main select[name="subject_id"]', '1'] }, W()]);
  J('H', 'S24-tournament-create__no-spm__1280', '/tournament/admin/create', 'subject Bahasa Arab (no SPM count → unchanged)', [{ select: ['main select[name="subject_id"]', '18'] }, W()]);
  J('H', 'S24-tournament-create__validity__1280', '/tournament/admin/create', 'reportValidity() on the empty form', [VALID('main form[action$="/tournament/admin"]'), W()]);
  J('H', 'S24-tournament-create__default__375', '/tournament/admin/create', 'default', [], M);
  J('H', 'S24-tournament-create__default__768', '/tournament/admin/create', 'default', [], T);

  // ---------------- S25 /liga, S26 /liga/cipta, S27 /liga/{id} ----------------
  J('I', 'S25-liga__default__1280', '/liga', 'tab Liga Saya (0) — empty');
  J('I', 'S25-liga__open__1280', '/liga', 'tab Liga Terbuka (1)', [CLK('main button[\\@click="tab = \'open\'"]'), W()]);
  J('I', 'S25-liga__join-modal__1280', '/liga', 'Sertai dengan Kod modal', [CLK('main button[\\@click="showJoinModal = true"]'), W()]);
  J('I', 'S25-liga__join-validity__1280', '/liga', 'join modal + reportValidity() (required code)', [CLK('main button[\\@click="showJoinModal = true"]'), W(300), VALID('main form[action$="/liga/sertai"]'), W()]);
  J('I', 'S25-liga__default__375', '/liga', 'default', [], M);
  J('I', 'S25-liga__join-modal__375', '/liga', 'join modal', [CLK('main button[\\@click="showJoinModal = true"]'), W()], M);
  J('I', 'S25-liga__default__768', '/liga', 'default', [], T);
  J('I', 'S26-liga-cipta__default__1280', '/liga/cipta', 'create form');
  J('I', 'S26-liga-cipta__validity__1280', '/liga/cipta', 'reportValidity() on the empty form', [VALID('main form[action$="/liga/cipta"]'), W()]);
  J('I', 'S26-liga-cipta__default__375', '/liga/cipta', 'default', [], M);
  J('I', 'S26-liga-cipta__default__768', '/liga/cipta', 'default', [], T);
  J('I', 'S27-liga-show__upcoming__1280', '/liga/1', 'liga 1 "Akan Datang", not a member → Sertai Liga Ini; no leaderboard');
  J('I', 'S27-liga-show__ended__1280', '/liga/2', 'liga 2 "Tamat", level tabs T4 (default)');
  J('I', 'S27-liga-show__ended-t5__1280', '/liga/2', 'liga 2, tab T5', [CLK('main button[\\@click="activeLevel = \'T5\'"]'), W()]);
  J('I', 'S27-liga-show__not-found__1280', '/liga/999', 'unknown id (404)');
  J('I', 'S27-liga-show__upcoming__375', '/liga/1', 'liga 1', [], M);
  J('I', 'S27-liga-show__ended__375', '/liga/2', 'liga 2', [], M);
  J('I', 'S27-liga-show__ended__768', '/liga/2', 'liga 2', [], T);

  // ---------------- S28 /sekolah-bersaing, S29 /admin/permainan (admin shell) ----------------
  var R28 = { repeat: { 'main .lb-row:not(.head):not(.gold):not(.silver):not(.bronze)': 2 } };
  J('J', 'S28-sekolah-bersaing__default__1280', '/sekolah-bersaing', 'week of 21 Sep 2026, 49 schools', [], null, R28);
  J('J', 'S28-sekolah-bersaing__query-ignored__1280', '/sekolah-bersaing?week=2026-09-14', '?week=2026-09-14 → week of 14 Sep 2026 (48 schools; state label kept from the first run, the query is NOT ignored)', [], null, R28);
  J('J', 'S28-sekolah-bersaing__default__375', '/sekolah-bersaing', 'default', [], M, R28);
  J('J', 'S28-sekolah-bersaing__default__768', '/sekolah-bersaing', 'default', [], T, R28);
  J('J', 'S29-admin-permainan__default__1280', '/admin/permainan', 'settings (35 tiles), stats, game list');
  J('J', 'S29-admin-permainan__tiles-38__1280', '/admin/permainan', 'tiles typed 38 (live breakdown; not saved)', [{ fill: ['main input[name="boardgame_quiz_tiles"]', '38'] }, W()]);
  J('J', 'S29-admin-permainan__tiles-0__1280', '/admin/permainan', 'tiles typed 0 (not saved)', [{ fill: ['main input[name="boardgame_quiz_tiles"]', '0'] }, W()]);
  J('J', 'S29-admin-permainan__tiles-invalid__1280', '/admin/permainan', 'tiles 50 + reportValidity() (max 38; not submitted)', [{ fill: ['main input[name="boardgame_quiz_tiles"]', '50'] }, W(200), VALID('main form[action$="/admin/permainan"]'), W()]);
  J('J', 'S29-admin-permainan__default__375', '/admin/permainan', 'default', [], M);
  J('J', 'S29-admin-permainan__default__768', '/admin/permainan', 'default', [], T);

  // ---------------- K: top-up states found while reconciling (2026-09-26) ----------------
  J('K', 'S28-sekolah-bersaing__week-past__1280', '/sekolah-bersaing?week=2026-09-07', '?week=2026-09-07 → that week (48 schools); no week navigation in the UI', [], null, R28);
  J('K', 'S28-sekolah-bersaing__week-empty__1280', '/sekolah-bersaing?week=2025-01-06', 'week with no generated data → "Data minggu ini belum dijana…"', [], null, R28);
  J('K', 'S28-sekolah-bersaing__week-empty__375', '/sekolah-bersaing?week=2025-01-06', 'week with no generated data', [], M, R28);
  J('K', 'S28-sekolah-bersaing__week-bogus__1280', '/sekolah-bersaing?week=bogus', '?week=bogus → HTTP 500');

  window.__M16_JOBS = jobs;
  window.__M16_HELPERS = { MASK: M16MASK, SAN: SAN, AL: AL, CLK: CLK, EV: EV, W: W, FAKE: FAKE };
})();
