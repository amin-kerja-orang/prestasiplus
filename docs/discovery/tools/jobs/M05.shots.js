// M05 screenshot plan → docs/discovery/img/M05/. Run AFTER jobs/M05-guard.js (write guard), then:
//   addScriptTag(this file) then browser_run_code_unsafe{filename: tools/shoot.js}.
// sanitize is off (tools/sanitize.js would mask subject names in "Nama"-like columns); the only personal strings on M05
// screens are the teacher name / school on /latihan-berstruktur cards → replaced in the DOM by MASK before the pixels.
// The only account shown is the system account "Admin PRESTASI+". Client-side reveals only; nothing is submitted.
// Session-starting URLs (…/quiz, …/subjektif, /latihan-berstruktur/{id}/jawab, /practice/revision/{CODE}) are never opened.
(function () {
  var B = 'https://prestasiplus.my', D = 'docs/discovery/img/M05/';
  var W = function (ms) { return { wait: ms || 600 }; };
  var MASK = { eval: "(() => { let n=0; document.querySelectorAll('main .card p.line-clamp-3, main .card p').forEach(p => { if (p.classList.contains('line-clamp-3')) { p.textContent='<soalan — nama guru disembunyikan>'; n++; } else if (p.querySelector(':scope > i.fa-user-pen')) { p.innerHTML='<i class=\"fas fa-user-pen mr-0.5\"></i> &lt;penyumbang&gt; · &lt;sekolah&gt;'; n++; } }); return 'masked '+n; })()" };
  var CAR = 'main [x-data="bannerCarousel(5)"]';
  var TOP = { eval: "(() => { window.scrollTo(0,0); return 'top'; })()" }; // clicks scroll the page; reset before full-page shots
  var S = [];
  function s(file, url, width, actions, extra) { S.push(Object.assign({ file: D + file, url: B + url, width: width || 1280, actions: actions || [], sanitize: false, settle: 900 }, extra || {})); }
  var VP = function (h) { return { fullPage: false, height: h || 900 }; };
  // S1 dashboard
  s('dashboard-desktop.png', '/dashboard', 1280, [W(2200)]);
  s('dashboard-top-desktop.png', '/dashboard', 1280, [W(2200)], VP(1100));
  s('dashboard-carousel-slide2-expanded.png', '/dashboard', 1280, [{ click: CAR + ' button[\\@click="next()"]' }, W(700), { eval: "(() => { const b=[...document.querySelectorAll('main [x-data=\"bannerCarousel(5)\"] button')].filter(x=>x.offsetParent && /Baca Selanjutnya/.test(x.textContent))[0]; if(b) b.click(); return 'ok'; })()" }, W(500)], VP(700));
  s('dashboard-tablet.png', '/dashboard', 768, [W(2200)], VP(1400));
  s('dashboard-mobile.png', '/dashboard', 375, [W(2200)]);
  // S2 practice
  s('practice-desktop.png', '/practice', 1280, [], VP(1200));
  s('practice-tablet.png', '/practice', 768, [], VP(1200));
  s('practice-mobile.png', '/practice', 375, [], VP(1400));
  // S3 subject config
  s('subject-config-default-desktop.png', '/practice/MATH', 1280);
  s('subject-config-selected-desktop.png', '/practice/MATH', 1280, [{ click: 'main button[\\@click="selectedLevel = 2"]' }, { click: 'main button[\\@click="selectedDifficulty = 3"]' }, { click: 'main button[\\@click="questionCount = 20"]' }, W(), TOP, W()]);
  s('subject-config-insufficient-desktop.png', '/practice/MATH', 1280, [{ click: 'main button[\\@click="selectedDifficulty = 5"]' }, W(), TOP, W()]);
  s('subject-config-addmath-empty.png', '/practice/ADDMATH', 1280);
  s('subject-config-tablet.png', '/practice/MATH', 768);
  s('subject-config-mobile.png', '/practice/MATH', 375);
  // S4/S5 chapter mode
  s('chapter-index-desktop.png', '/practice/chapter', 1280);
  s('chapter-index-mobile.png', '/practice/chapter', 375);
  s('chapter-math-desktop.png', '/practice/chapter/MATH', 1280);
  s('chapter-bm-progress-desktop.png', '/practice/chapter/BM', 1280);
  s('chapter-addmath-empty.png', '/practice/chapter/ADDMATH', 1280, [], VP(700));
  s('chapter-math-tablet.png', '/practice/chapter/MATH', 768, [], VP(1200));
  s('chapter-math-mobile.png', '/practice/chapter/MATH', 375, [], VP(1400));
  // S6 revision list
  s('revision-desktop.png', '/practice/revision', 1280);
  s('revision-flash-none.png', '/practice/revision/MATH', 1280, [], VP(800));
  s('revision-mobile.png', '/practice/revision', 375);
  // S8 progress
  s('progress-empty-desktop.png', '/practice/progress', 1280, [], VP(900));
  s('progress-all-desktop.png', '/practice/progress?period=all', 1280, [W(1200)]);
  s('progress-all-tablet.png', '/practice/progress?period=all', 768, [W(1200)]);
  s('progress-all-mobile.png', '/practice/progress?period=all', 375, [W(1200)]);
  // S9 history
  s('history-desktop.png', '/practice/history', 1280);
  s('history-empty-desktop.png', '/practice/history?period=week', 1280, [], VP(900));
  s('history-mobile.png', '/practice/history', 375);
  // S10 structured
  s('berstruktur-desktop.png', '/latihan-berstruktur', 1280, [MASK], VP(1300));
  s('berstruktur-empty.png', '/latihan-berstruktur?subject_id=31', 1280, [], VP(700));
  s('berstruktur-tablet.png', '/latihan-berstruktur', 768, [MASK], VP(1300));
  s('berstruktur-mobile.png', '/latihan-berstruktur', 375, [MASK], VP(1400));
  // S11 pembetulan
  s('pembetulan-empty-desktop.png', '/pembetulan', 1280, [], VP(700));
  s('pembetulan-may-desktop.png', '/pembetulan?bulan=2026-05', 1280);
  s('pembetulan-may-mobile.png', '/pembetulan?bulan=2026-05', 375);
  // S12 penguasaan
  s('penguasaan-desktop.png', '/penguasaan', 1280);
  s('penguasaan-mobile.png', '/penguasaan', 375);
  // S13 / S14
  s('remedial-empty-desktop.png', '/remedial/saya', 1280, [], VP(700));
  s('remedial-empty-mobile.png', '/remedial/saya', 375, [], VP(800));
  s('misi-harian-empty-desktop.png', '/misi-harian', 1280, [], VP(700));
  s('misi-harian-empty-mobile.png', '/misi-harian', 375, [], VP(800));
  // S15 target SPM
  s('target-spm-desktop.png', '/target-spm', 1280);
  s('target-spm-mobile.png', '/target-spm', 375);
  window.__shots = S;
})();
