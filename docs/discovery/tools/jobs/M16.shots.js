// M16 masked screenshot plan → docs/discovery/img/M16/. Load tools/jobs/M16.js FIRST (it exposes window.__M16_HELPERS),
// then addScriptTag(this file), then browser_run_code_unsafe{filename: tools/shoot.js}. The non-GET route guard (M16.js header)
// must be active on the context. Every shot runs its client-side reveal actions, then M16MASK (student names, school names,
// e-mail payloads, avatars), then tools/sanitize.js {selectors:['.m16n'], titleName:false} (S1 / S7: M16MASK only, see M16.js J()).
// Read-only: no room / match / spin / join / create / save action; Alpine state only.
(function () {
  var B = 'https://prestasiplus.my', D = 'docs/discovery/img/M16/';
  var H = window.__M16_HELPERS;
  var MK = { eval: H.MASK }, AL = H.AL, CLK = H.CLK, W = H.W;
  var S = [];
  function s(file, url, width, actions, extra) {
    var o = { file: D + file, url: B + url, width: width || 1280, actions: (actions || []).concat([MK]), sanitize: H.SAN };
    if (/^(battle|papan-bijak)/.test(file) && !/battle-(leaderboard|history|ranking)/.test(file)) o.sanitize = false;
    S.push(Object.assign(o, extra || {}));
  }
  var VP = { fullPage: false };
  var PICK3 = CLK('main button[\\@click^="selectedSubject = 3;"]');
  var BL = 'battleLobby()';
  // S1 battle
  s('battle-desktop.png', '/battle', 1280);
  s('battle-subject-selected.png', '/battle', 1280, [PICK3, W()], VP);
  s('battle-pksk.png', '/battle', 1280, [CLK('main button[\\@click="questionType = \'pksk\'"]'), W(), CLK('main button[\\@click^="selectedPkskDomain = 1;"]'), CLK('main button[\\@click="selectedPkskLevel = \'T1\'"]'), W()]);
  s('battle-spm-tip.png', '/battle', 1280, [CLK('main button[\\@click="showTip = !showTip"]'), W()], VP);
  s('battle-challenge-modal.png', '/battle', 1280, [PICK3, W(300), CLK('main button[\\@click="showChallengeModal = true"]'), W(300), { type: ['main input[x-model="searchQuery"]', 'zzqxv'] }, W(1500)], VP);
  s('battle-searching.png', '/battle', 1280, [PICK3, AL(BL, { searching: true, searchTimer: 65 }), W()], VP);
  s('battle-incoming.png', '/battle', 1280, [PICK3, AL(BL, { searching: true, incomingChallenger: { name: '<name>', grade_label: 'Darjah 4', school: '<school>' } }), W()], VP);
  s('battle-waiting.png', '/battle', 1280, [AL(BL, { challengerWaiting: true, challengerTargetName: '<name>', challengerTargetGrade: 'Darjah 4' }), W()], VP);
  s('battle-error.png', '/battle', 1280, [AL(BL, { errorMsg: 'Tiada lawan dijumpai dalam masa 2 minit. Sila cuba lagi.' }), W()], VP);
  s('battle-invitations.png', '/battle', 1280, [AL(BL, { showInvitations: true }), W()], VP);
  s('battle-mobile.png', '/battle', 375);
  s('battle-tablet.png', '/battle', 768, [], VP);
  // S2–S5
  s('battle-leaderboard-desktop.png', '/battle/leaderboard', 1280, [], VP);
  s('battle-leaderboard-mobile.png', '/battle/leaderboard', 375, [], VP);
  s('battle-ranking-sekolah-all-time.png', '/battle/ranking-sekolah?period=all_time', 1280);
  s('battle-ranking-sekolah-weekly-empty.png', '/battle/ranking-sekolah', 1280, [], VP);
  s('battle-ranking-sekolah-mobile.png', '/battle/ranking-sekolah?period=all_time', 375);
  s('battle-ranking-sekolah-show.png', '/battle/ranking-sekolah/8106', 1280);
  s('battle-ranking-sekolah-show-empty.png', '/battle/ranking-sekolah/900', 1280, [], VP);
  s('battle-ranking-sekolah-show-mobile.png', '/battle/ranking-sekolah/8106', 375);
  s('battle-history.png', '/battle/history', 1280, [], VP);
  // S6 hub, lobbies
  s('permainan-desktop.png', '/permainan', 1280);
  s('permainan-mobile.png', '/permainan', 375, [], VP);
  s('permainan-tablet.png', '/permainan', 768, [], VP);
  s('papan-bijak-desktop.png', '/papan-bijak', 1280);
  s('papan-bijak-custom.png', '/papan-bijak', 1280, [CLK('main button[\\@click="manualMode = true"]'), W(200), { select: ['main select[name="match_mode"]', 'custom'] }, W()], VP);
  s('papan-bijak-searching.png', '/papan-bijak', 1280, [AL('quickMatch()', { searching: true, elapsed: 12, error: 'Tiada lawan dijumpai. Cuba lagi!' }), W()], VP);
  s('papan-bijak-mobile.png', '/papan-bijak', 375);
  s('perang-fakta-desktop.png', '/perang-fakta', 1280);
  s('perang-fakta-manual.png', '/perang-fakta', 1280, [CLK('main button[\\@click="manualMode=true"]'), W()], VP);
  s('perang-fakta-mobile.png', '/perang-fakta', 375);
  s('benteng-ilmu-desktop.png', '/benteng-ilmu', 1280, [], VP);
  s('perlumbaan-matematik-desktop.png', '/perlumbaan-matematik', 1280, [], VP);
  s('kuiz-relay-desktop.png', '/kuiz-relay', 1280, [], VP);
  s('teka-silang-kata-desktop.png', '/teka-silang-kata', 1280, [], VP);
  // single-player games
  s('betul-salah-picker.png', '/permainan/betul-salah', 1280, [W(300)], VP);
  s('betul-salah-picker-mobile.png', '/permainan/betul-salah', 375, [W(300)], VP);
  s('betul-salah-countdown.png', '/permainan/betul-salah?darjah=4', 1280, [W(100)], VP);
  s('betul-salah-playing.png', '/permainan/betul-salah?darjah=4', 1280, [W(3200), AL('betulSalah()', { streak: 6 }), W(300)], VP);
  s('betul-salah-done.png', '/permainan/betul-salah?darjah=4', 1280, [W(3200), AL('betulSalah()', { phase: 'done', isNewRecord: true }), W(700)], VP);
  s('betul-salah-mobile.png', '/permainan/betul-salah?darjah=4', 375, [W(3200)], VP);
  s('cabaran-kilat-playing.png', '/permainan/cabaran-kilat?darjah=4', 1280, [W(3200), AL('speedChallenge()', { combo: 6, timeLeft: 8 }), W(300)], VP);
  s('cabaran-kilat-done.png', '/permainan/cabaran-kilat?darjah=4', 1280, [W(3200), AL('speedChallenge()', { phase: 'done', isNewRecord: true }), W(700)], VP);
  s('cabaran-kilat-mobile.png', '/permainan/cabaran-kilat?darjah=4', 375, [W(3200)], VP);
  s('tembak-jawapan-playing.png', '/permainan/tembak-jawapan?darjah=4', 1280, [W(5000)], VP);
  s('tembak-jawapan-level-up.png', '/permainan/tembak-jawapan?darjah=4', 1280, [W(3200), AL('tembakJawapan()', { showLevelUp: true, level: 2, lives: 1 }), W(300)], VP);
  s('tembak-jawapan-done.png', '/permainan/tembak-jawapan?darjah=4', 1280, [W(3200), AL('tembakJawapan()', { phase: 'done' }), W(700)], VP);
  s('tembak-jawapan-mobile.png', '/permainan/tembak-jawapan?darjah=4', 375, [W(5000)], VP);
  s('susun-jawapan-playing.png', '/permainan/susun-jawapan?darjah=4', 1280, [W(600), CLK('main span[\\@click="placeTile(ti)"]'), W()], VP);
  s('susun-jawapan-wrong.png', '/permainan/susun-jawapan?darjah=4', 1280, [W(600), CLK('main span[\\@click="placeTile(ti)"]'), AL('susunJawapan()', { checkResult: 'wrong' }), W()], VP);
  s('susun-jawapan-done.png', '/permainan/susun-jawapan?darjah=4', 1280, [W(600), AL('susunJawapan()', { phase: 'done', resultEmoji: '🧩', resultTitle: 'BIJAK!' }), W()], VP);
  s('susun-jawapan-mobile.png', '/permainan/susun-jawapan?darjah=4', 375, [W(600)], VP);
  s('kad-memori-desktop.png', '/permainan/kad-memori', 1280, [W(400), CLK('main [\\@click="flipCard(index)"]'), W(300)], VP);
  s('kad-memori-complete.png', '/permainan/kad-memori', 1280, [W(400), AL('memoryGame()', { gameComplete: true }), W(600)], VP);
  s('kad-memori-mobile.png', '/permainan/kad-memori', 375, [W(400)]);
  s('roda-nasib-desktop.png', '/permainan/roda-nasib', 1280, [W(300)]);
  s('roda-nasib-prize.png', '/permainan/roda-nasib', 1280, [AL('spinWheel()', { showPrize: true, prizeType: 'syiling', prizeValue: 5, prizeLabel: '5 Syiling', prizeIcon: '💎', alreadySpun: true }), W()], VP);
  s('roda-nasib-mobile.png', '/permainan/roda-nasib', 375, [W(300)]);
  s('jutawan-picker.png', '/permainan/jutawan', 1280, [], VP);
  s('jutawan-subjects.png', '/permainan/jutawan?darjah=4', 1280);
  s('jutawan-mobile.png', '/permainan/jutawan?darjah=4', 375);
  s('pertandingan-desktop.png', '/permainan/pertandingan', 1280);
  s('pertandingan-mobile.png', '/permainan/pertandingan', 375, [], VP);
  s('uji-minda.png', '/permainan/uji-minda', 1280, [], VP);
  // tournament, banner, liga
  s('tournament-desktop.png', '/tournament', 1280, [], VP);
  s('tournament-banner-states.png', '/tournament', 1280, [AL('tournamentBanner()', { tournaments: H.FAKE }), W()], VP);
  s('tournament-banner-mobile.png', '/tournament', 375, [AL('tournamentBanner()', { tournaments: H.FAKE }), W()], VP);
  s('tournament-create-desktop.png', '/tournament/admin/create', 1280);
  s('tournament-create-random-mix.png', '/tournament/admin/create', 1280, [{ check: 'main input[name="question_mode"][value="random_mix"]' }, W()]);
  s('tournament-create-spm-note.png', '/tournament/admin/create', 1280, [{ select: ['main select[name="subject_id"]', '1'] }, W(), { eval: "(() => { document.querySelector('main input[name=total_questions]').scrollIntoView({block:'center'}); return 'ok'; })()" }, W(300)], VP);
  s('tournament-create-mobile.png', '/tournament/admin/create', 375);
  s('liga-desktop.png', '/liga', 1280, [], VP);
  s('liga-open.png', '/liga', 1280, [CLK('main button[\\@click="tab = \'open\'"]'), W()], VP);
  s('liga-join-modal.png', '/liga', 1280, [CLK('main button[\\@click="showJoinModal = true"]'), W()], VP);
  s('liga-mobile.png', '/liga', 375, [CLK('main button[\\@click="tab = \'open\'"]'), W()], VP);
  s('liga-cipta-desktop.png', '/liga/cipta', 1280);
  s('liga-cipta-mobile.png', '/liga/cipta', 375);
  s('liga-show-upcoming.png', '/liga/1', 1280);
  s('liga-show-ended.png', '/liga/2', 1280);
  s('liga-show-ended-mobile.png', '/liga/2', 375);
  // admin layout
  s('sekolah-bersaing-desktop.png', '/sekolah-bersaing', 1280, [], VP);
  s('sekolah-bersaing-mobile.png', '/sekolah-bersaing', 375, [], VP);
  s('admin-permainan-desktop.png', '/admin/permainan', 1280);
  s('admin-permainan-mobile.png', '/admin/permainan', 375);
  // top-up (reconciliation): room-not-found flash (bottom of the lobby) and a week with no generated Sekolah Bersaing data
  s('perang-fakta-room-not-found.png', '/perang-fakta/ZZZZZ9', 1280);
  s('sekolah-bersaing-week-empty.png', '/sekolah-bersaing?week=2025-01-06', 1280, [], VP);
  window.__shots = S;
  window.__shotsTopUp = S.slice(-2);
})();
