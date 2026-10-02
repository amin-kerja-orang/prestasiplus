// M01 capture plan — every screen × every UI state that reveals different elements.
// Load into the MCP tab:  browser_run_code_unsafe: async (page) => page.addScriptTag({ path: '<abs>/docs/discovery/tools/jobs/M01.js' })
// then optionally filter:  browser_evaluate: () => { window.__jobs = window.__M01_JOBS.filter(j => j.group === 'A'); }
// then run tools/run-state.js and save window.__invs to docs/discovery/inventory/_raw/M01/_batch.json, then split-batch.js.
// All actions are client-side reveals only: nothing is submitted, saved, sent, marked read or deleted.
(function () {
  var B = 'https://prestasiplus.my';
  var LOADING = "(()=>{const f=document.querySelector('[x-data*=loading]');if(!f) return 'no loading comp';f._x_dataStack[0].loading=true;return 'loading=true (simulated)'})()";
  var NOTIF_TYPES = "(()=>{const s=new Set();document.querySelectorAll('.notif-item span,.notif-item div').forEach(e=>{if(!e.children.length){const x=e.textContent.trim();if(/^[A-Za-z]+(_[A-Za-z]+)+$/.test(x))s.add(x)}});const c=document.querySelectorAll('.notif-item').length;return 'items='+c+' types='+[...s].join(',')})()";
  var DRAWER = "(()=>{const b=document.querySelector('[onclick*=toggle-drawer]');if(!b) return 'no drawer btn';b.click();return 'drawer toggled'})()";
  var LAGI = "(()=>{const b=[...document.querySelectorAll('nav button, nav a')].find(x=>/Lagi/.test(x.textContent)&&x.getBoundingClientRect().width>0);if(!b) return 'no Lagi';b.click();return 'Lagi clicked'})()";
  var CLR = { click: 'main button[\\@click="clearSchool()"]' };
  var NOTIF = { repeat: { '.notif-item': 2 }, mask: ['.notif-item'] };
  var jobs = [];
  function J(group, file, url, state, actions, extra, opts) {
    var s = file.split('-')[0];
    var j = { group: group, file: file, url: B + url, actions: actions || [], opts: Object.assign({ state: state, prefix: 'EL-M01-' + s }, opts || {}) };
    Object.assign(j, extra || {});
    j.opts.state = state + (j.width === 375 ? ' @375' : '');
    jobs.push(j);
  }
  var G = { guest: true }, G375 = { guest: true, width: 375 }, M = { width: 375 };

  // S1 /login (guest)
  J('A', 'S1-login__default__1280', '/login', 'default', [], G);
  J('A', 'S1-login__pw-visible+loading__1280', '/login', 'password visible + loading', [{ click: 'button[\\@click*=showPassword]' }, { eval: LOADING }], G);
  J('A', 'S1-login__default__375', '/login', 'default', [], G375);
  J('A', 'S1-login__logged-in-admin__1280', '/login', 'opened while logged in (admin)', []);
  // S2 /register (guest)
  var SS = 'input[x-model=schoolSearch]';
  J('A', 'S2-register__default__1280', '/register', 'default (role=student)', [], G);
  J('A', 'S2-register__role-teacher__1280', '/register', 'role=teacher', [{ click: '[\\@click*="\'teacher\'"]' }], G);
  J('A', 'S2-register__role-parent__1280', '/register', 'role=parent', [{ click: '[\\@click*="\'parent\'"]' }], G);
  J('A', 'S2-register__grade-selected+pw-visible__1280', '/register', 'Darjah 1 selected + both password toggles on', [{ click: '[\\@click*="selectedGrade"]' }, { click: 'button[\\@click*="showPassword = "]' }, { click: 'button[\\@click*="showPasswordConfirm"]' }], G);
  J('A', 'S2-register__school-search-results__1280', '/register', 'school search typed, results dropdown', [{ click: SS }, { type: [SS, 'kebangsaan'] }, { wait: 2500 }], G);
  J('A', 'S2-register__school-search-empty__1280', '/register', 'school search, no result', [{ click: SS }, { type: [SS, 'zzqxv'] }, { wait: 2500 }], G);
  J('A', 'S2-register__school-state-filter__1280', '/register', 'state=Perlis, empty query', [{ select: ['select[x-model=stateFilter]', 'Perlis'] }, { click: SS }, { wait: 2500 }], G);
  J('A', 'S2-register__school-selected__1280', '/register', 'school picked (chip)', [{ click: SS }, { type: [SS, 'kebangsaan'] }, { wait: 2500 }, { click: '[x-show*=showSchoolDropdown] div[\\@click^=pickSchool]' }, { wait: 500 }], G);
  J('A', 'S2-register__loading__1280', '/register', 'loading', [{ eval: LOADING }], G);
  J('A', 'S2-register__query-role-teacher__1280', '/register?role=teacher', 'query ?role=teacher (does it preselect?)', [{ eval: "(()=>{const d=document.querySelector('[x-data*=selectedRole]')._x_dataStack[0];return 'selectedRole='+d.selectedRole})()" }], G);
  J('A', 'S2-register__query-ref__1280', '/register?ref=TEST', 'query ?ref=TEST (referral param handling)', [{ eval: "(()=>[...document.querySelectorAll('input')].map(i=>i.name).filter(Boolean).join(','))()" }], G);
  J('A', 'S2-register__default__375', '/register', 'default (role=student)', [], G375);
  J('A', 'S2-register__role-parent__375', '/register', 'role=parent', [{ click: '[\\@click*="\'parent\'"]' }], G375);
  // S3 /password/reset
  J('A', 'S3-password-reset__default__1280', '/password/reset', 'default', [], G);
  J('A', 'S3-password-reset__loading__1280', '/password/reset', 'loading', [{ eval: LOADING }], G);
  J('A', 'S3-password-reset__default__375', '/password/reset', 'default', [], G375);
  // S4 /password/reset/{token}
  J('A', 'S4-password-reset-token__default__1280', '/password/reset/inventory-dummy-token?email=user%40example.com', 'default (dummy token, ?email= placeholder)', [], G);
  J('A', 'S4-password-reset-token__pw-visible+loading__1280', '/password/reset/inventory-dummy-token', 'no ?email, both toggles on, loading', [{ click: 'button[\\@click*="showPass = "]' }, { click: 'button[\\@click*="showConfirm"]' }, { eval: LOADING }], G);
  J('A', 'S4-password-reset-token__default__375', '/password/reset/inventory-dummy-token?email=user%40example.com', 'default', [], G375);
  // S5 /password/reset-ic
  J('A', 'S5-password-reset-ic__default__1280', '/password/reset-ic', 'default', [], G);
  J('A', 'S5-password-reset-ic__loading__1280', '/password/reset-ic', 'loading', [{ eval: LOADING }], G);
  J('A', 'S5-password-reset-ic__default__375', '/password/reset-ic', 'default', [], G375);

  // S7 /profile (admin)
  J('B', 'S7-profile__default__1280', '/profile', 'default', []);
  J('B', 'S7-profile__default__375', '/profile', 'default', [], M);
  J('B', 'S7-profile__drawer-open__375', '/profile', 'user-shell drawer open', [{ eval: DRAWER }, { wait: 600 }], M);
  // S8 /profile/edit
  var SQ = 'input[x-model=searchQuery]';
  J('B', 'S8-profile-edit__default__1280', '/profile/edit', 'default (school selected)', []);
  J('B', 'S8-profile-edit__school-cleared__1280', '/profile/edit', 'school cleared', [CLR]);
  J('B', 'S8-profile-edit__school-search-results__1280', '/profile/edit', 'school cleared + search typed (results)', [CLR, { click: SQ }, { type: [SQ, 'kebangsaan'] }, { wait: 2500 }]);
  J('B', 'S8-profile-edit__school-search-empty__1280', '/profile/edit', 'school cleared + search no result', [CLR, { click: SQ }, { type: [SQ, 'zzqxv'] }, { wait: 2500 }]);
  J('B', 'S8-profile-edit__school-state-only__1280', '/profile/edit', 'school cleared + state=Perlis, empty query', [CLR, { select: ['select[x-model=stateFilter]', 'Perlis'] }, { click: SQ }, { wait: 2500 }]);
  J('B', 'S8-profile-edit__school-searching__1280', '/profile/edit', 'school search in flight (searching=true simulated)', [CLR, { eval: "(()=>{const d=document.querySelector('[x-data^=profileForm]')._x_dataStack[0];d.searchQuery='ke';d.showDropdown=true;d.searching=true;return 'searching'})()" }]);
  J('B', 'S8-profile-edit__bio-typed+file-chosen__1280', '/profile/edit', 'bio typed + picture chosen (upload button revealed, simulated) + avatar hover', [{ fill: ['textarea[name=bio]', 'Contoh bio'] }, { eval: "(()=>{document.getElementById('uploadBtn').classList.remove('hidden');return 'uploadBtn shown'})()" }, { hover: 'main label[for=profilePicInput].absolute' }]);
  J('B', 'S8-profile-edit__default__375', '/profile/edit', 'default', [], M);
  // S9 /tetapan
  J('B', 'S9-tetapan__default__1280', '/tetapan', 'default', []);
  J('B', 'S9-tetapan__all-on__1280', '/tetapan', 'all 4 checkboxes on (client only)', [{ check: 'input[name=spiritual_mode]' }, { check: 'input[name=show_bismillah_splash]' }, { check: 'input[name=subuh_push_enabled]' }, { check: 'input[name=ramadan_mode_enabled]' }]);
  J('B', 'S9-tetapan__default__375', '/tetapan', 'default', [], M);
  J('B', 'S9-tetapan__lagi-menu__375', '/tetapan', 'admin-shell "Lagi" menu open', [{ eval: LAGI }, { wait: 500 }], M);
  // S10 /settings
  J('B', 'S10-settings__default__1280', '/settings', '404 page', []);
  J('B', 'S10-settings__default__375', '/settings', '404 page', [], M);

  // S11 /notifikasi
  var PILIH = { click: 'main button[\\@click="selectMode = true"]' };
  J('C', 'S11-notifikasi__default__1280', '/notifikasi', 'Semua (default)', [{ eval: NOTIF_TYPES }], {}, NOTIF);
  J('C', 'S11-notifikasi__filter-unread__1280', '/notifikasi?filter=unread', 'filter=unread', [{ eval: NOTIF_TYPES }], {}, NOTIF);
  J('C', 'S11-notifikasi__filter-read__1280', '/notifikasi?filter=read', 'filter=read', [{ eval: NOTIF_TYPES }], {}, NOTIF);
  J('C', 'S11-notifikasi__type-system__1280', '/notifikasi?type=system', 'type=system', [{ eval: NOTIF_TYPES }], {}, NOTIF);
  J('C', 'S11-notifikasi__type-reminder__1280', '/notifikasi?type=reminder', 'type=reminder', [{ eval: NOTIF_TYPES }], {}, NOTIF);
  J('C', 'S11-notifikasi__type-milestone__1280', '/notifikasi?type=milestone', 'type=milestone', [{ eval: NOTIF_TYPES }], {}, NOTIF);
  J('C', 'S11-notifikasi__page-2__1280', '/notifikasi?page=2', 'page=2', [{ eval: NOTIF_TYPES }], {}, NOTIF);
  J('C', 'S11-notifikasi__page-last__1280', '/notifikasi?page=9', 'last page (page=9)', [{ eval: NOTIF_TYPES }], {}, NOTIF);
  J('C', 'S11-notifikasi__select-mode__1280', '/notifikasi', 'select mode (Pilih)', [PILIH], {}, NOTIF);
  J('C', 'S11-notifikasi__select-one__1280', '/notifikasi', 'select mode + 1 item ticked (client only)', [PILIH, { check: '.notif-item input[type=checkbox]' }], {}, NOTIF);
  J('C', 'S11-notifikasi__select-all__1280', '/notifikasi', 'select mode + Pilih Semua ticked (client only)', [PILIH, { check: 'main input[x-model=selectAll]' }], {}, NOTIF);
  J('C', 'S11-notifikasi__hover-item__1280', '/notifikasi', 'hover first item (trash icon)', [{ hover: '.notif-item button[\\@click^=deleteSingle]' }], {}, NOTIF);
  J('C', 'S11-notifikasi__default__375', '/notifikasi', 'Semua (default)', [], M, NOTIF);
  J('C', 'S11-notifikasi__select-one__375', '/notifikasi', 'select mode + 1 item ticked', [PILIH, { check: '.notif-item input[type=checkbox]' }], M, NOTIF);
  J('C', 'S11-notifikasi__type-milestone__375', '/notifikasi?type=milestone', 'type=milestone', [], M, NOTIF);

  window.__M01_JOBS = jobs;
  window.__jobs = jobs;
})();
