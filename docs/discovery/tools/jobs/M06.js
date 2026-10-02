// M06 capture plan — SPM. Every screen x every UI state that reveals different elements.
// Load:  browser_run_code_unsafe: async (page) => page.addScriptTag({ path: '<abs>/docs/discovery/tools/jobs/M06.js' })
// then:  browser_evaluate: () => { window.__jobs = window.__M06_JOBS.filter(j => j.group === 'A'); }
// then run tools/run-state.js, save window.__invs to docs/discovery/inventory/_raw/M06/_batch.json, split-batch.js, merge-inventory.js.
//
// SAFETY: live production admin, browser lane 3. Pre-start pages only. NO quiz / practice / mock / walkthrough session is
// started: no job opens /quiz, /jawab, /start, /mula, /spm-mock/{id} (in-progress "Sambung") or /spm/ramalan/{CODE}?year=&set=
// (Tracking A set start), and no form is submitted except the GET filter form of /latihan-berstruktur (read-only list).
// Actions are client-side reveals only (Alpine option buttons on the Latih Tubi config page, tab buttons, <select> changes).
// "Jana Mock SPM" (POST /spm-mock/jana) and "Bagi Walkthrough" (POST /pusat-ai/spm/solve) are never clicked.
//
// Personal data: M06MASK runs first (eval) and masks
//   - Duta / "Cikgu Maestro" recommendation cards (.duta-card): name, avatar initials and the /bilik-duta/<slug> href;
//   - structured-set author lines (p with fa-user-pen: "<teacher> · <school>") on /latihan-berstruktur lists;
// then tools/sanitize.js runs (job.sanitize). No real name is written in this file.
(function () {
  var B = 'https://prestasiplus.my';
  var jobs = [];
  var M06MASK = "(() => { var n = 0;" +
    " document.querySelectorAll('.duta-card').forEach(function (c) { var h = c.querySelector('.name'); if (h) { h.textContent = '<person>'; n++; } var a = c.querySelector('.av-img'); if (a) { if (a.tagName === 'IMG') { a.removeAttribute('src'); a.setAttribute('alt', '<person>'); } else a.textContent = '<in>'; n++; } });" +
    " document.querySelectorAll('a[href*=\"/bilik-duta/\"]').forEach(function (a) { a.setAttribute('href', a.getAttribute('href').replace(/\\/bilik-duta\\/[^/?#]+/, '/bilik-duta/{slug}')); n++; });" +
    " document.querySelectorAll('main i.fa-user-pen').forEach(function (i) { var p = i.parentElement; p.textContent = ''; p.appendChild(i); p.appendChild(document.createTextNode(' <person> · <school>')); n++; });" +
    " return 'm06mask: ' + n; })()";
  function J(group, file, url, state, actions, extra, opts) {
    var s = file.split('-')[0];
    var j = { group: group, file: file, url: B + url, actions: [{ eval: M06MASK }].concat(actions || []), sanitize: true,
              opts: Object.assign({ state: state, prefix: 'EL-M06-' + s, repeat: { 'main .grid > .card': 3, 'main .q-review': 3 }, redact: [] }, opts || {}) };
    Object.assign(j, extra || {});
    j.opts.state = state + (j.width === 375 ? ' @375' : j.width === 768 ? ' @768' : '');
    jobs.push(j);
  }
  var M = { width: 375 }, T = { width: 768 };
  var W = function (ms) { return { wait: ms || 500 }; };
  function three(g, key, url, state, actions) { J(g, key + '__default__1280', url, state, actions); J(g, key + '__default__375', url, state, actions, M); J(g, key + '__default__768', url, state, actions, T); }

  // ---------------- S1 /spm hub ----------------
  three('A', 'S1-spm-hub', '/spm', 'default (hub + my SPM stats)');

  // ---------------- S2 /spm/tahun-lepas (databank) ----------------
  three('A', 'S2-databank', '/spm/tahun-lepas', 'default (18 subject cards, set 5/10/20 links)');

  // ---------------- S3 /spm/latih-tubi (subject list) ----------------
  three('A', 'S3-latih-tubi', '/spm/latih-tubi', 'default (7 teras + 12 elektif, BA locked)');

  // ---------------- S4 /spm/latih-tubi/{code} (quiz settings, pre-start) ----------------
  var LV = function (n) { return { click: 'main [\\@click*="selectedLevel === ' + n + '"]' }; };
  var DF = function (n) { return { click: 'main [\\@click*="selectedDifficulty === ' + n + '"]' }; };
  var HREF = { eval: "(() => { var a = document.querySelector('main a[href*=\"/quiz\"]'); return 'start href=' + (a ? a.getAttribute('href') : 'none'); })()" };
  J('B', 'S4-latih-tubi-subject__default__1280', '/spm/latih-tubi/MATH', 'MATH default (Target SPM 40, no level/difficulty)', [HREF]);
  J('B', 'S4-latih-tubi-subject__level-t4__1280', '/spm/latih-tubi/MATH', 'MATH Tingkatan 4 selected (difficulty counts per level)', [LV(10), W(), HREF]);
  J('B', 'S4-latih-tubi-subject__level-t5-sukar__1280', '/spm/latih-tubi/MATH', 'MATH Tingkatan 5 + Sukar selected', [LV(11), W(), DF(4), W(), HREF]);
  J('B', 'S4-latih-tubi-subject__level-toggle-off__1280', '/spm/latih-tubi/MATH', 'MATH Tingkatan 4 clicked twice (deselect)', [LV(10), W(), LV(10), W(), HREF]);
  J('B', 'S4-latih-tubi-subject__custom-bm__1280', '/spm/latih-tubi/BM', 'BM (Target Custom 34)', [HREF]);
  J('B', 'S4-latih-tubi-subject__latihan-addmath__1280', '/spm/latih-tubi/ADDMATH', 'ADDMATH (Target Latihan 20)', [HREF]);
  J('B', 'S4-latih-tubi-subject__free-count__1280', '/spm/latih-tubi/PERNIAGA', 'PERNIAGA (no target: 5..60 options, default 10)', [HREF]);
  J('B', 'S4-latih-tubi-subject__free-count-30__1280', '/spm/latih-tubi/PERNIAGA', 'PERNIAGA count 30 clicked', [{ click: 'main [\\@click="questionCount = option.value"] >> nth=3' }, W(), HREF]);
  J('B', 'S4-latih-tubi-subject__hub-locked-ba__1280', '/spm/latih-tubi/BA', 'BA (locked on hub, page still reachable)', [HREF]);
  J('B', 'S4-latih-tubi-subject__not-found__1280', '/spm/latih-tubi/XYZ', 'unknown subject code (404 page)');
  J('B', 'S4-latih-tubi-subject__default__375', '/spm/latih-tubi/MATH', 'MATH default', [HREF], M);
  J('B', 'S4-latih-tubi-subject__free-count__375', '/spm/latih-tubi/PERNIAGA', 'PERNIAGA free count', [HREF], M);
  J('B', 'S4-latih-tubi-subject__default__768', '/spm/latih-tubi/MATH', 'MATH default', [HREF], T);

  // ---------------- S5 /spm/ramalan (Tracking A hub) ----------------
  three('C', 'S5-tracking-a', '/spm/ramalan', 'default (objektif lane, admin readiness, bahasa lane, open subjects)');

  // ---------------- S6 /spm/ramalan/{code} (Tracking A set list, pre-start) ----------------
  J('C', 'S6-tracking-a-subject__default__1280', '/spm/ramalan/GEO', 'GEO (default sample): 1 Ready Bank Besar + 9 Belum Cukup');
  J('C', 'S6-tracking-a-subject__clean-akaun__1280', '/spm/ramalan/AKAUN', 'AKAUN: 16 Set Bersih (no target)');
  J('C', 'S6-tracking-a-subject__mixed-psi__1280', '/spm/ramalan/PSI', 'PSI: 1 Set Bersih + 5 Belum Cukup (Target Latihan)');
  J('C', 'S6-tracking-a-subject__all-locked-math__1280', '/spm/ramalan/MATH', 'MATH: all 11 sets Belum Cukup (not linked from hub)');
  J('C', 'S6-tracking-a-subject__empty-ba__1280', '/spm/ramalan/BA', 'BA: no sets (empty state)');
  J('C', 'S6-tracking-a-subject__not-found__1280', '/spm/ramalan/XYZ', 'unknown code (404)');
  J('C', 'S6-tracking-a-subject__default__375', '/spm/ramalan/GEO', 'GEO', [], M);
  J('C', 'S6-tracking-a-subject__default__768', '/spm/ramalan/GEO', 'GEO', [], T);

  // ---------------- S7 Tracking A Bahasa list (/latihan-berstruktur?scope=spm&track=bahasa) ----------------
  J('D', 'S7-tracking-bahasa__default__1280', '/latihan-berstruktur?subject_id=1&scope=spm&track=bahasa', 'BM (hub "Buka Tracking A Bahasa", also /spm/ramalan/BM redirect)');
  J('D', 'S7-tracking-bahasa__bi-redirect__1280', '/spm/ramalan/BI', 'BI via /spm/ramalan/BI redirect');
  J('D', 'S7-tracking-bahasa__all-subjects__1280', '/latihan-berstruktur?subject_id=&scope=spm&track=bahasa', 'Semua Subjek (BM then BI)');
  J('D', 'S7-tracking-bahasa__kbat-6__1280', '/latihan-berstruktur?subject_id=1&scope=spm&track=bahasa&kbat_level=6', 'kbat_level=6 (Mencipta) filter (3 sets)');
  J('D', 'S7-tracking-bahasa__page-2__1280', '/latihan-berstruktur?subject_id=1&scope=spm&track=bahasa&page=2', 'page=2');
  J('D', 'S7-tracking-bahasa__default__375', '/latihan-berstruktur?subject_id=1&scope=spm&track=bahasa', 'BM', [], M);
  J('D', 'S7-tracking-bahasa__default__768', '/latihan-berstruktur?subject_id=1&scope=spm&track=bahasa', 'BM', [], T);

  // ---------------- S8 /spm/subjektif ----------------
  J('E', 'S8-subjektif__default__1280', '/spm/subjektif', 'tab Semua (default)');
  J('E', 'S8-subjektif__tab-core__1280', '/spm/subjektif', 'tab Teras', [{ click: "main [\\@click=\"tab = 'core'\"]" }, W()]);
  J('E', 'S8-subjektif__tab-elective__1280', '/spm/subjektif', 'tab Elektif', [{ click: "main [\\@click=\"tab = 'elective'\"]" }, W()]);
  J('E', 'S8-subjektif__default__375', '/spm/subjektif', 'tab Semua', [], M);
  J('E', 'S8-subjektif__tab-core__375', '/spm/subjektif', 'tab Teras', [{ click: "main [\\@click=\"tab = 'core'\"]" }, W()], M);
  J('E', 'S8-subjektif__default__768', '/spm/subjektif', 'tab Semua', [], T);

  // ---------------- S9 Subjektif SPM list (/latihan-berstruktur?subject_id=N&scope=spm) ----------------
  J('E', 'S9-subjektif-list__default__1280', '/latihan-berstruktur?subject_id=3&scope=spm', 'Matematik (subject card link)');
  J('E', 'S9-subjektif-list__all-subjects__1280', '/latihan-berstruktur?subject_id=&scope=spm', 'Semua Subjek');
  J('E', 'S9-subjektif-list__sains-komputer__1280', '/latihan-berstruktur?subject_id=17&scope=spm', 'Sains Komputer (22 sets)');
  J('E', 'S9-subjektif-list__kbat-6__1280', '/latihan-berstruktur?subject_id=3&scope=spm&kbat_level=6', 'Matematik + kbat_level=6');
  J('E', 'S9-subjektif-list__page-2__1280', '/latihan-berstruktur?subject_id=3&scope=spm&page=2', 'Matematik page=2');
  J('E', 'S9-subjektif-list__default__375', '/latihan-berstruktur?subject_id=3&scope=spm', 'Matematik', [], M);
  J('E', 'S9-subjektif-list__default__768', '/latihan-berstruktur?subject_id=3&scope=spm', 'Matematik', [], T);

  // ---------------- S10 /spm/history ----------------
  J('F', 'S10-history__default__1280', '/spm/history', 'Semua (4 sessions)');
  J('F', 'S10-history__past-year__1280', '/spm/history?type=past_year', 'type=past_year');
  J('F', 'S10-history__latih-tubi__1280', '/spm/history?type=latih_tubi', 'type=latih_tubi');
  J('F', 'S10-history__tracking-a-empty__1280', '/spm/history?type=ramalan', 'type=ramalan (empty state)');
  J('F', 'S10-history__default__375', '/spm/history', 'Semua', [], M);
  J('F', 'S10-history__tracking-a-empty__375', '/spm/history?type=ramalan', 'empty', [], M);
  J('F', 'S10-history__default__768', '/spm/history', 'Semua', [], T);

  // ---------------- S11 /spm-mock ----------------
  J('G', 'S11-mock__default__1280', '/spm-mock', 'default (maestro card, form, 2 previous mocks)');
  J('G', 'S11-mock__selected__1280', '/spm-mock', 'subject Matematik + Paper 2 selected (NOT submitted)', [{ select: ['main select[name=subject]', 'Matematik'] }, { select: ['main select[name=paper_number]', '2'] }, W()]);
  J('G', 'S11-mock__default__375', '/spm-mock', 'default', [], M);
  J('G', 'S11-mock__default__768', '/spm-mock', 'default', [], T);

  // ---------------- S12 /spm-mock/{id}/result ----------------
  J('G', 'S12-mock-result__default__1280', '/spm-mock/16/result', 'submitted mock 16 (BM Paper 1, 0/30, grade G)');
  J('G', 'S12-mock-result__not-found__1280', '/spm-mock/99999/result', 'unknown id (404)');
  J('G', 'S12-mock-result__default__375', '/spm-mock/16/result', 'mock 16', [], M);
  J('G', 'S12-mock-result__default__768', '/spm-mock/16/result', 'mock 16', [], T);

  // ---------------- S13 /pusat-ai/spm (walkthrough, pre-submit) ----------------
  J('H', 'S13-walkthrough__default__1280', '/pusat-ai/spm', 'default (form, hidden #result)');
  J('H', 'S13-walkthrough__subject__1280', '/pusat-ai/spm', 'subject Fizik selected (NOT submitted)', [{ select: ['main select[name=subject]', 'Fizik'] }, W()]);
  J('H', 'S13-walkthrough__default__375', '/pusat-ai/spm', 'default', [], M);
  J('H', 'S13-walkthrough__default__768', '/pusat-ai/spm', 'default', [], T);

  window.__M06_JOBS = jobs;
  window.__M06_HELPERS = { MASK: M06MASK };
})();
