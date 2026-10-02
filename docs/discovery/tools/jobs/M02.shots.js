// M02 masked screenshot plan → docs/discovery/img/M02/. Run: addScriptTag(this file) then browser_run_code_unsafe{filename: tools/shoot.js}.
// Every shot is sanitized (tools/sanitize.js) before capture. Client-side reveals only; nothing is submitted.
(function () {
  var B = 'https://prestasiplus.my', D = 'docs/discovery/img/M02/';
  var UX = { localSelectors: ['main [x-show="selectedSchool"]'], scriptKeys: ['name', 'state', 'district', 'code', 'type'] };
  var CX = { labels: 'sekolah asal|tingkatan', cols: 'kelas|subjek', noDefaultKeep: true };
  var SCH = { keepCols: '.', blankInputs: false };
  var W = function (ms) { return { wait: ms || 2500 }; };
  var TYPE = function (sel, txt) { return [{ click: sel }, { type: [sel, txt] }, W()]; };
  var R = function (v) { return { select: ['select[name=role]', v] }; };
  var S = [];
  function s(file, url, width, actions, san, extra) { S.push(Object.assign({ file: D + file, url: B + url, width: width || 1280, actions: actions || [], sanitize: san || true }, extra || {})); }
  // users
  s('users-list-desktop.png', '/admin/users', 1280);
  s('users-list-tablet.png', '/admin/users', 768);
  s('users-list-mobile.png', '/admin/users', 375);
  s('users-list-bulk-bar.png', '/admin/users', 1280, [{ check: 'main tbody input[type=checkbox]' }], null, { fullPage: false });
  s('users-delete-modal.png', '/admin/users', 1280, [{ click: 'main button[\\@click^="showDeleteModal = true"]' }, W(600)], null, { fullPage: false });
  s('users-list-school-admin.png', '/admin/users?role=school_admin', 1280, [], null, { fullPage: false });
  s('users-create-default.png', '/admin/users/create', 1280);
  s('users-create-student.png', '/admin/users/create', 1280, [R('student'), W(500)]);
  s('users-create-school-admin-generated.png', '/admin/users/create', 1280, [R('school_admin')].concat(TYPE('input[x-model=schoolSearch]', 'bangi'), [{ click: 'main [\\@click^="selectSchool"]' }, W(500), { click: 'main button[\\@click="generateCredentials()"]' }, W(500)]));
  s('users-create-ppd-officer.png', '/admin/users/create', 1280, [R('ppd_officer'), W(500), { select: ['select[x-model=selectedJpnId]', '15'] }, W(2000)]);
  s('users-create-parent-search.png', '/admin/users/create', 1280, [R('parent')].concat(TYPE('input[x-model=parentStudentSearch]', 'ah')), null, { fullPage: false });
  s('users-create-mobile.png', '/admin/users/create', 375, [R('student'), W(500)]);
  s('users-edit-student.png', '/admin/users/5661/edit', 1280, [], UX);
  s('users-edit-parent.png', '/admin/users/5658/edit', 1280, [], UX);
  s('users-edit-mobile.png', '/admin/users/5661/edit', 375, [], UX);
  s('user-packages-desktop.png', '/admin/users/5404/packages', 1280);
  // imports
  s('bulk-import-desktop.png', '/admin/users/bulk-import', 1280, [{ click: 'main label:has(input[name=role][value=teacher])' }, W(400)]);
  s('bulk-import-csv-mobile.png', '/admin/users/bulk-import', 375, [{ click: 'main button[\\@click="mode = \'csv\'"]' }, W(400)]);
  s('import-students-desktop.png', '/admin/import-students', 1280);
  s('import-students-quota.png', '/admin/import-students', 1280, TYPE('main input[x-model=searchQuery]', 'BEA4603').concat([{ click: 'main [\\@click^="selectSchool"]' }, W(2000), { click: 'main button[\\@click^="showStudents"]' }, W(2500)]));
  s('import-students-nosub-sk.png', '/admin/import-students', 1280, TYPE('main input[x-model=searchQuery]', 'BBA4025').concat([{ click: 'main [\\@click^="selectSchool"]' }, W(2000)]));
  s('import-students-mobile.png', '/admin/import-students', 375);
  // complimentary
  s('comp-students-desktop.png', '/admin/comp-students', 1280, [], null, { fullPage: false });
  s('comp-students-bulk-bar.png', '/admin/comp-students', 1280, [{ check: 'main tbody input[type=checkbox]' }], null, { fullPage: false });
  s('comp-students-mobile.png', '/admin/comp-students', 375, [], null, { fullPage: false });
  s('comp-create-desktop.png', '/admin/comp-students/create', 1280, [{ select: ['main select[x-model=teacherId]', { index: 2 }] }, W(2000)]);
  s('comp-show-desktop.png', '/admin/comp-students/5208', 1280, [], CX);
  // schools
  s('schools-list-desktop.png', '/admin/schools', 1280, [], SCH, { fullPage: false });
  s('schools-list-mobile.png', '/admin/schools', 375, [], SCH, { fullPage: false });
  s('schools-empty.png', '/admin/schools?search=zzqxv', 1280, [], SCH);
  s('schools-create-desktop.png', '/admin/schools/create', 1280, [], SCH);
  s('schools-edit-desktop.png', '/admin/schools/987/edit', 1280, [], SCH);
  // subscriptions
  s('subscriptions-list-desktop.png', '/admin/school-subscriptions', 1280, [], SCH);
  s('subscriptions-list-mobile.png', '/admin/school-subscriptions', 375, [], SCH);
  s('subscriptions-create-full.png', '/admin/school-subscriptions/create', 1280, [{ click: 'main label:has(input[name=package_tier][value=full])' }, { click: 'main label:has(input[name=school_package_id][value="1"])' }, W(400)], SCH);
  s('subscription-show-basic.png', '/admin/school-subscriptions/14', 1280, [{ click: 'main button[\\@click="showUpgrade = !showUpgrade"]' }, { click: 'main button[\\@click="showExtend=!showExtend"]' }, W(400)], null, { fullPage: false, height: 1400 });
  s('subscription-show-full.png', '/admin/school-subscriptions/10', 1280, [{ click: 'main button[\\@click="showAdjust = !showAdjust"]' }, W(400)], null, { fullPage: false, height: 1100 });
  s('subscription-show-mobile.png', '/admin/school-subscriptions/14', 375, [], null, { fullPage: false, height: 1600 });
  s('renewal-invoice-desktop.png', '/admin/school-subscriptions/14/renewal-invoice', 1280, [], { titleName: false }, { fullPage: false, height: 1200 });
  s('renewal-invoice-mobile.png', '/admin/school-subscriptions/14/renewal-invoice', 375, [], { titleName: false }, { fullPage: false, height: 1000 });
  window.__shots = S;
})();
