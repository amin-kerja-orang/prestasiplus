// M02 capture plan — Users & Schools Management. Every screen × every UI state that reveals different elements.
// Load:  browser_run_code_unsafe: async (page) => page.addScriptTag({ path: '<abs>/docs/discovery/tools/jobs/M02.js' })
// then:  browser_evaluate: () => { window.__jobs = window.__M02_JOBS.filter(j => j.group === 'A'); }
// then run tools/run-state.js, save window.__invs to docs/discovery/inventory/_raw/M02/_batch.json, split-batch.js, merge-inventory.js.
//
// SAFETY: live production admin with real (minor) students' personal data.
//  - All actions are client-side reveals only: open modals/toggles/dropdowns, pick radio/select values, type into
//    search boxes. Nothing is submitted, saved, toggled, deleted, imported, impersonated or downloaded.
//    Native confirm() dialogs (toggle-active, Login As, Lanjutkan) are never triggered — their text is read from the DOM.
//  - Every job sets sanitize:true → tools/sanitize.js scrubs names/emails/phones/IC from the DOM (tables, detail
//    label/values, Alpine x-text, attributes, inline scripts, person pickers) BEFORE the inventory runs;
//    run-state.js then reports meta.piiLeakCheck. Default passwords shown in the UI are redacted.
//  - Detail/edit pages opened: users 2 (a student, a parent) + 1 school-admin package page, comp-students 1, schools 1,
//    subscriptions 2 (+ their invoice views).
(function () {
  var B = 'https://prestasiplus.my';
  var jobs = [];
  var REDACT = []; // default-password literals are masked generically by sanitize.js (password placeholders), never listed here
  function J(group, file, url, state, actions, extra, opts) {
    var s = file.split('-')[0];
    var j = { group: group, file: file, url: B + url, actions: actions || [], sanitize: true,
              opts: Object.assign({ state: state, prefix: 'EL-M02-' + s, repeat: { 'main tbody tr': 3 }, redact: REDACT }, opts || {}) };
    Object.assign(j, extra || {});
    if (j.sanitize === true && extra && extra.san) j.sanitize = extra.san;
    j.opts.state = state + (j.width === 375 ? ' @375' : j.width === 768 ? ' @768' : '');
    jobs.push(j);
  }
  var M = { width: 375 }, T = { width: 768 };
  var W = function (ms) { return { wait: ms || 2500 }; };
  var TYPE = function (sel, txt) { return [{ click: sel }, { type: [sel, txt] }, W()]; };

  // ---------------- S1 /admin/users ----------------
  var ROWCK = 'main tbody input[type=checkbox]', ALLCK = 'main thead input[type=checkbox]';
  J('A', 'S1-users__default__1280', '/admin/users', 'default (all roles, page 1)');
  J('A', 'S1-users__role-student__1280', '/admin/users?role=student', 'role=student (stat card active)');
  J('A', 'S1-users__role-parent__1280', '/admin/users?role=parent', 'role=parent');
  J('A', 'S1-users__role-school_admin__1280', '/admin/users?role=school_admin', 'role=school_admin');
  J('A', 'S1-users__role-jpn_officer__1280', '/admin/users?role=jpn_officer', 'role=jpn_officer (not offered in the filter; probe)');
  J('A', 'S1-users__inactive__1280', '/admin/users?is_active=0', 'is_active=0 (Tidak Aktif)');
  J('A', 'S1-users__school-filter__1280', '/admin/users?school=987', 'school=987 (a public school)');
  J('A', 'S1-users__search-empty__1280', '/admin/users?search=zzqxv', 'search with no result (empty state)');
  J('A', 'S1-users__page-2__1280', '/admin/users?page=2', 'page=2');
  J('A', 'S1-users__page-last__1280', '/admin/users?page=207', 'last page');
  J('A', 'S1-users__select-one__1280', '/admin/users', '1 row ticked (bulk bar)', [{ check: ROWCK }]);
  J('A', 'S1-users__select-all__1280', '/admin/users', 'header checkbox ticked (all on page)', [{ check: ALLCK }]);
  J('A', 'S1-users__delete-modal__1280', '/admin/users', 'row delete modal open (not confirmed)', [{ click: 'main button[\\@click^="showDeleteModal = true"]' }, W(500)]);
  J('A', 'S1-users__bulk-delete-modal__1280', '/admin/users', 'bulk delete modal open (not confirmed)', [{ check: ROWCK }, { click: 'main button[\\@click="showBulkDeleteModal = true"]' }, W(500)]);
  J('A', 'S1-users__default__375', '/admin/users', 'default', [], M);
  J('A', 'S1-users__select-one__375', '/admin/users', '1 row ticked', [{ check: ROWCK }], M);
  J('A', 'S1-users__default__768', '/admin/users', 'default', [], T);

  // ---------------- S2 /admin/users/create ----------------
  var ROLE = 'select[name=role]';
  var R = function (v) { return { select: [ROLE, v] }; };
  J('B', 'S2-users-create__default__1280', '/admin/users/create', 'default (no role)');
  ['student', 'teacher', 'parent', 'sponsor', 'school_admin', 'ppd_officer', 'jpn_officer', 'admin'].forEach(function (r) {
    J('B', 'S2-users-create__role-' + r + '__1280', '/admin/users/create', 'role=' + r, [R(r), W(600)]);
  });
  J('B', 'S2-users-create__sa-search__1280', '/admin/users/create', 'school_admin + school search results', [R('school_admin')].concat(TYPE('input[x-model=schoolSearch]', 'bangi')));
  J('B', 'S2-users-create__sa-search-empty__1280', '/admin/users/create', 'school_admin + school search no result', [R('school_admin')].concat(TYPE('input[x-model=schoolSearch]', 'zzqxv')));
  J('B', 'S2-users-create__sa-generated__1280', '/admin/users/create', 'school_admin + school picked + credentials generated (client only)', [R('school_admin')].concat(TYPE('input[x-model=schoolSearch]', 'bangi'), [{ click: 'main [\\@click^="selectSchool"]' }, W(500), { click: 'main button[\\@click="generateCredentials()"]' }, W(500)]));
  J('B', 'S2-users-create__ppd-jpn-selected__1280', '/admin/users/create', 'ppd_officer + JPN Selangor chosen (PPD list loaded)', [R('ppd_officer'), W(600), { select: ['select[x-model=selectedJpnId]', '15'] }, W(2000)]);
  J('B', 'S2-users-create__jpn-jpn-selected__1280', '/admin/users/create', 'jpn_officer + JPN chosen', [R('jpn_officer'), W(600), { select: ['select[x-model=selectedJpnId]', '15'] }, W(2000)]);
  J('B', 'S2-users-create__parent-search__1280', '/admin/users/create', 'parent + student search results (masked)', [R('parent')].concat(TYPE('input[x-model=parentStudentSearch]', 'ah')));
  J('B', 'S2-users-create__parent-linked__1280', '/admin/users/create', 'parent + 1 student linked (client only, masked)', [R('parent')].concat(TYPE('input[x-model=parentStudentSearch]', 'ah'), [{ click: 'main [\\@click^="addLinkedStudent"]' }, W(500)]));
  J('B', 'S2-users-create__std-school-search__1280', '/admin/users/create', 'student + school search results', [R('student')].concat(TYPE('input[x-model=stdSchoolSearch]', 'bangi')));
  J('B', 'S2-users-create__std-school-selected__1280', '/admin/users/create', 'student + school picked', [R('student')].concat(TYPE('input[x-model=stdSchoolSearch]', 'bangi'), [{ click: 'main [\\@click^="selectStdSchool"]' }, W(500)]));
  J('B', 'S2-users-create__default__375', '/admin/users/create', 'default', [], M);
  J('B', 'S2-users-create__role-student__375', '/admin/users/create', 'role=student', [R('student'), W(600)], M);
  J('B', 'S2-users-create__role-school_admin__375', '/admin/users/create', 'role=school_admin', [R('school_admin'), W(600)], M);
  J('B', 'S2-users-create__role-student__768', '/admin/users/create', 'role=student', [R('student'), W(600)], T);

  // ---------------- S3 /admin/users/{id}/edit ----------------
  var STU = '/admin/users/5661/edit', PAR = '/admin/users/5658/edit';
  // the student's school is a school-student association → masked in place (chip) and inside the inline init JSON
  var UX = { san: { localSelectors: ['main [x-show="selectedSchool"]'], scriptKeys: ['name', 'state', 'district', 'code', 'type'] } };
  var UXM = Object.assign({ width: 375 }, UX), UXT = Object.assign({ width: 768 }, UX);
  J('C', 'S3-users-edit__default__1280', STU, 'student user (default)', [], UX);
  J('C', 'S3-users-edit__student-password-open__1280', STU, 'student + "Tukar Kata Laluan" opened', [{ click: 'main button[\\@click="showPasswordFields = !showPasswordFields"]' }, W(500)], UX);
  J('C', 'S3-users-edit__student-school-search__1280', STU, 'student + school cleared + search results', [{ click: 'main button[\\@click="clearSchool()"]' }].concat(TYPE('main input[x-model=searchQuery]', 'bangi')), UX);
  J('C', 'S3-users-edit__student-school-state__1280', STU, 'student + school cleared + state filter Perlis', [{ click: 'main button[\\@click="clearSchool()"]' }, { select: ['main select[x-model=stateFilter]', 'Perlis'] }, { click: 'main input[x-model=searchQuery]' }, W()], UX);
  J('C', 'S3-users-edit__student-school-empty__1280', STU, 'student + school cleared + search no result', [{ click: 'main button[\\@click="clearSchool()"]' }].concat(TYPE('main input[x-model=searchQuery]', 'zzqxv')), UX);
  J('C', 'S3-users-edit__student-role-teacher__1280', STU, 'student record with role select switched to teacher (client only)', [R('teacher'), W(500)], UX);
  J('C', 'S3-users-edit__parent__1280', PAR, 'parent user (linked children panel)', [], UX);
  J('C', 'S3-users-edit__parent-search__1280', PAR, 'parent + student search results (masked)', TYPE('main [x-data^=parentStudentLinker] input', 'ah'), UX);
  J('C', 'S3-users-edit__parent-search-empty__1280', PAR, 'parent + student search no result', TYPE('main [x-data^=parentStudentLinker] input', 'zzqxv'), UX);
  J('C', 'S3-users-edit__parent-role-student__1280', PAR, 'parent record with role switched to student (client only)', [R('student'), W(500)], UX);
  J('C', 'S3-users-edit__default__375', STU, 'student user', [], UXM);
  J('C', 'S3-users-edit__parent__375', PAR, 'parent user', [], UXM);
  J('C', 'S3-users-edit__default__768', STU, 'student user', [], UXT);

  // ---------------- S4 /admin/users/bulk-import ----------------
  var BI = '/admin/users/bulk-import', RR = function (v) { return { click: 'main label:has(input[name=role][value=' + v + '])' }; };
  J('D', 'S4-bulk-import__default__1280', BI, 'default (mode paste, no role)');
  J('D', 'S4-bulk-import__mode-csv__1280', BI, 'mode = csv', [{ click: 'main button[\\@click="mode = \'csv\'"]' }, W(400)]);
  ['teacher', 'parent', 'school_admin', 'ppd_officer'].forEach(function (r) { J('D', 'S4-bulk-import__role-' + r + '__1280', BI, 'role=' + r, [RR(r), W(400)]); });
  J('D', 'S4-bulk-import__school-search__1280', BI, 'role=teacher + school search results', [RR('teacher')].concat(TYPE('main input[x-model=query]', 'bangi')));
  J('D', 'S4-bulk-import__school-search-empty__1280', BI, 'role=teacher + school search no result', [RR('teacher')].concat(TYPE('main input[x-model=query]', 'zzqxv')));
  J('D', 'S4-bulk-import__school-selected__1280', BI, 'role=teacher + school picked', [RR('teacher')].concat(TYPE('main input[x-model=query]', 'bangi'), [{ click: 'main [\\@click^="selectSchool"]' }, W(500)]));
  J('D', 'S4-bulk-import__default__375', BI, 'default', [], M);
  J('D', 'S4-bulk-import__mode-csv__375', BI, 'mode = csv', [{ click: 'main button[\\@click="mode = \'csv\'"]' }, W(400)], M);
  J('D', 'S4-bulk-import__default__768', BI, 'default', [], T);

  // ---------------- S5 /admin/import-students ----------------
  var IS = '/admin/import-students', SQ = 'main input[x-model=searchQuery]';
  var PICK = function (q) { return TYPE(SQ, q).concat([{ click: 'main [\\@click^="selectSchool"]' }, W(2000)]); };
  J('E', 'S5-import-students__default__1280', IS, 'default (mode paste)');
  J('E', 'S5-import-students__mode-csv__1280', IS, 'mode = csv', [{ click: 'main button[\\@click="mode = \'csv\'"]' }, W(400)]);
  J('E', 'S5-import-students__class-t5__1280', IS, 'class_level T5 ticked', [{ click: 'main label:has(input[name=class_level][value=T5])' }]);
  J('E', 'S5-import-students__school-search__1280', IS, 'school search results', TYPE(SQ, 'bangi'));
  J('E', 'S5-import-students__school-search-empty__1280', IS, 'school search no result', TYPE(SQ, 'zzqxv'));
  J('E', 'S5-import-students__school-state__1280', IS, 'state filter Perlis, empty query', [{ select: ['main select[x-model=stateFilter]', 'Perlis'] }, { click: SQ }, W()]);
  J('E', 'S5-import-students__school-subscribed__1280', IS, 'school with subscription picked (quota panel)', PICK('BEA4603'));
  J('E', 'S5-import-students__school-students__1280', IS, 'subscribed school + existing students list opened (masked)', PICK('BEA4603').concat([{ click: 'main button[\\@click^="showStudents"]' }, W(2500)]));
  J('E', 'S5-import-students__school-nosub-sk__1280', IS, 'SK school without subscription picked (no-quota panel, Darjah levels)', PICK('BBA4025'));
  J('E', 'S5-import-students__default__375', IS, 'default', [], M);
  J('E', 'S5-import-students__school-subscribed__375', IS, 'school with subscription picked', PICK('BEA4603'), M);
  J('E', 'S5-import-students__default__768', IS, 'default', [], T);

  // ---------------- S6 /admin/comp-students ----------------
  var CS = '/admin/comp-students';
  J('F', 'S6-comp-students__default__1280', CS, 'default (page 1)');
  J('F', 'S6-comp-students__select-one__1280', CS, '1 row ticked (bulk action bar)', [{ check: ROWCK }]);
  J('F', 'S6-comp-students__select-all__1280', CS, 'header checkbox ticked', [{ check: ALLCK }]);
  J('F', 'S6-comp-students__page-2__1280', CS + '?page=2', 'page=2 (last)');
  J('F', 'S6-comp-students__default__375', CS, 'default', [], M);
  J('F', 'S6-comp-students__select-one__375', CS, '1 row ticked', [{ check: ROWCK }], M);
  J('F', 'S6-comp-students__default__768', CS, 'default', [], T);
  // ---------------- S7 /admin/comp-students/create ----------------
  var CC = '/admin/comp-students/create', TSEL = 'main select[x-model=teacherId]';
  J('F', 'S7-comp-create__default__1280', CC, 'default');
  J('F', 'S7-comp-create__teacher-classes__1280', CC, 'teacher with classes chosen (classrooms loaded)', [{ select: [TSEL, { index: 2 }] }, W(2000)]);
  J('F', 'S7-comp-create__teacher-noclass__1280', CC, 'teacher without classes chosen', [{ select: [TSEL, { index: 4 }] }, W(2000)]);
  J('F', 'S7-comp-create__default__375', CC, 'default', [], M);
  J('F', 'S7-comp-create__default__768', CC, 'default', [], T);
  // ---------------- S8 /admin/comp-students/{id} ----------------
  var CD = '/admin/comp-students/5208';
  // original school + class list of one student = school-student association → masked
  var CX = { san: { labels: 'sekolah asal|tingkatan', cols: 'kelas|subjek', noDefaultKeep: true } };
  J('F', 'S8-comp-show__default__1280', CD, 'default', [], CX);
  J('F', 'S8-comp-show__default__375', CD, 'default', [], Object.assign({ width: 375 }, CX));
  J('F', 'S8-comp-show__default__768', CD, 'default', [], Object.assign({ width: 768 }, CX));

  // ---------------- S9 /admin/schools ----------------
  var SC = '/admin/schools', SCH = { san: { keepCols: '.', blankInputs: false } };
  var SCM = Object.assign({ width: 375 }, SCH), SCT = Object.assign({ width: 768 }, SCH);
  J('G', 'S9-schools__default__1280', SC, 'default', [], SCH);
  J('G', 'S9-schools__state-perlis__1280', SC + '?state=Perlis', 'state=Perlis', [], SCH);
  J('G', 'S9-schools__type-sk__1280', SC + '?type=SK', 'type=SK', [], SCH);
  J('G', 'S9-schools__search-empty__1280', SC + '?search=zzqxv', 'search no result (empty state)', [], SCH);
  J('G', 'S9-schools__search__1280', SC + '?search=bangi', 'search=bangi', [], SCH);
  J('G', 'S9-schools__page-2__1280', SC + '?page=2', 'page=2', [], SCH);
  J('G', 'S9-schools__page-last__1280', SC + '?page=341', 'last page', [], SCH);
  J('G', 'S9-schools__default__375', SC, 'default', [], SCM);
  J('G', 'S9-schools__default__768', SC, 'default', [], SCT);
  // ---------------- S10 /admin/schools/create ----------------
  J('G', 'S10-schools-create__default__1280', SC + '/create', 'default', [], SCH);
  J('G', 'S10-schools-create__default__375', SC + '/create', 'default', [], SCM);
  J('G', 'S10-schools-create__default__768', SC + '/create', 'default', [], SCT);
  // ---------------- S11 /admin/schools/{id}/edit ----------------
  J('G', 'S11-schools-edit__default__1280', SC + '/987/edit', 'default (public school record)', [], SCH);
  J('G', 'S11-schools-edit__default__375', SC + '/987/edit', 'default', [], SCM);

  // ---------------- S12 /admin/school-subscriptions ----------------
  var SS = '/admin/school-subscriptions';
  J('H', 'S12-subscriptions__default__1280', SS, 'default', [], SCH);
  ['active', 'grace', 'expired', 'cancelled'].forEach(function (s) { J('H', 'S12-subscriptions__status-' + s + '__1280', SS + '?status=' + s, 'status=' + s, [], SCH); });
  J('H', 'S12-subscriptions__form-t4__1280', SS + '?form_level=t4', 'form_level=t4', [], SCH);
  J('H', 'S12-subscriptions__search-empty__1280', SS + '?search=zzqxv', 'search no result (empty state)', [], SCH);
  J('H', 'S12-subscriptions__default__375', SS, 'default', [], SCM);
  J('H', 'S12-subscriptions__default__768', SS, 'default', [], SCT);
  // ---------------- S13 /admin/school-subscriptions/create ----------------
  var SN = SS + '/create', QQ = 'main input[x-model=query]';
  J('H', 'S13-subscriptions-create__default__1280', SN, 'default (tier basic)', [], SCH);
  J('H', 'S13-subscriptions-create__tier-full__1280', SN, 'tier = full (Penuh)', [{ click: 'main label:has(input[name=package_tier][value=full])' }, W(400)], SCH);
  J('H', 'S13-subscriptions-create__package-t5__1280', SN, 'package T5 selected', [{ click: 'main label:has(input[name=school_package_id][value="2"])' }, W(400)], SCH);
  J('H', 'S13-subscriptions-create__full-package-t4__1280', SN, 'tier full + package T4 selected', [{ click: 'main label:has(input[name=package_tier][value=full])' }, { click: 'main label:has(input[name=school_package_id][value="1"])' }, W(400)], SCH);
  J('H', 'S13-subscriptions-create__school-search__1280', SN, 'school search results', TYPE(QQ, 'bangi'), SCH);
  J('H', 'S13-subscriptions-create__school-search-empty__1280', SN, 'school search no result', TYPE(QQ, 'zzqxv'), SCH);
  J('H', 'S13-subscriptions-create__school-selected__1280', SN, 'school picked', TYPE(QQ, 'bangi').concat([{ click: 'main [\\@click^="selectSchool"]' }, W(500)]), SCH);
  J('H', 'S13-subscriptions-create__default__375', SN, 'default', [], SCM);
  J('H', 'S13-subscriptions-create__default__768', SN, 'default', [], SCT);
  // ---------------- S14 /admin/school-subscriptions/{id} ----------------
  var S14 = SS + '/14', S10 = SS + '/10';
  J('I', 'S14-subscription-show__default__1280', S14, 'Pemantauan (basic) active subscription');
  J('I', 'S14-subscription-show__adjust-open__1280', S14, '"Ubah Kuota" panel open', [{ click: 'main button[\\@click="showAdjust = !showAdjust"]' }, W(400)]);
  J('I', 'S14-subscription-show__upgrade-open__1280', S14, '"Naik Taraf ke Penuh" panel open', [{ click: 'main button[\\@click="showUpgrade = !showUpgrade"]' }, W(400)]);
  J('I', 'S14-subscription-show__extend-open__1280', S14, '"Lanjutkan Tempoh" panel open + "1 Bulan" preset (client only)', [{ click: 'main button[\\@click="showExtend=!showExtend"]' }, W(400), { click: 'main form[action*="/extend"] button[type=button] >> nth=2' }]);
  J('I', 'S14-subscription-show__page-2__1280', S14 + '?page=2', 'student list page 2');
  J('I', 'S14-subscription-show__per-page-25__1280', S14 + '?per_page=25', 'per_page=25');
  J('I', 'S14-subscription-show__full-overquota__1280', S10, 'Penuh (full) active subscription, quota exceeded');
  J('I', 'S14-subscription-show__full-adjust-open__1280', S10, 'Penuh + "Ubah Kuota" open', [{ click: 'main button[\\@click="showAdjust = !showAdjust"]' }, W(400)]);
  J('I', 'S14-subscription-show__default__375', S14, 'default', [], M);
  J('I', 'S14-subscription-show__default__768', S14, 'default', [], T);
  // ---------------- S15 /admin/school-subscriptions/{id}/renewal-invoice ----------------
  var INV = S14 + '/renewal-invoice', INVX = { san: { titleName: false } };
  J('I', 'S15-renewal-invoice__default__1280', INV, 'basic subscription invoice view', [], INVX, { contentRoot: 'body' });
  J('I', 'S15-renewal-invoice__full__1280', S10 + '/renewal-invoice', 'full subscription invoice view', [], INVX, { contentRoot: 'body' });
  J('I', 'S15-renewal-invoice__default__375', INV, 'default', [], Object.assign({ width: 375 }, INVX), { contentRoot: 'body' });

  // ---------------- S16 /admin/users/{id}/packages (school_admin rows only: "Pakej") ----------------
  var PK = '/admin/users/5404/packages';
  J('J', 'S16-user-packages__default__1280', PK, 'school admin: assign SPM packages (T4/T5)');
  J('J', 'S16-user-packages__default__375', PK, 'default', [], M);
  J('J', 'S16-user-packages__default__768', PK, 'default', [], T);

  window.__M02_JOBS = jobs;
  window.__jobs = jobs;
})();
