// M03 screenshot plan → docs/discovery/img/M03/. Run: addScriptTag(this file) then browser_run_code_unsafe{filename: tools/shoot.js}.
// Curriculum data is not personal and the only account name shown is the system account "Admin PRESTASI+", so
// sanitize is off (tools/sanitize.js would mask subject names in "Nama (BM)" columns). Client-side reveals only.
(function () {
  var B = 'https://prestasiplus.my', D = 'docs/discovery/img/M03/';
  var W = function (ms) { return { wait: ms || 600 }; };
  var TOPIC1 = { click: 'main [x-data^="{ topicOpen"] button[\\@click="topicOpen = !topicOpen"]' };
  var ADDSUB1 = { click: 'main [x-data^="{ topicOpen"] button[\\@click="showAddSubtopic = !showAddSubtopic"]' };
  var EDITSUB1 = { click: 'main button[\\@click^="editingSubtopic = "]' };
  var REVEAL = { eval: "(() => { document.querySelectorAll('.island-node').forEach(x=>{x.style.opacity='1';x.style.transform='translateY(0px)'}); return 'ok'; })()" };
  var MT4 = '/admin/curriculum?subject_id=3&education_level_id=10', BMD1 = '/admin/curriculum?subject_id=1&education_level_id=1';
  var S = [];
  function s(file, url, width, actions, extra) { S.push(Object.assign({ file: D + file, url: B + url, width: width || 1280, actions: actions || [], sanitize: false }, extra || {})); }
  var VP = function (h) { return { fullPage: false, height: h || 900 }; };
  // admin curriculum
  s('curriculum-default-desktop.png', '/admin/curriculum', 1280, [], VP());
  s('curriculum-tree-desktop.png', MT4, 1280, [TOPIC1, W(), ADDSUB1, W()], VP(1300));
  s('curriculum-subtopics-desktop.png', BMD1, 1280, [TOPIC1, W(), EDITSUB1, W()], VP(1100));
  s('curriculum-no-chapters.png', '/admin/curriculum?subject_id=2&education_level_id=9', 1280, [], VP());
  s('curriculum-flash-error.png', '/admin/curriculum/topics/create', 1280, [], VP(600));
  s('curriculum-tree-tablet.png', MT4, 768, [TOPIC1, W()], VP(1100));
  s('curriculum-tree-mobile.png', MT4, 375, [TOPIC1, W()], VP(1400));
  s('curriculum-default-mobile.png', '/admin/curriculum', 375, [], VP());
  s('chapter-create-desktop.png', '/admin/curriculum/chapters/create?subject_id=3&education_level_id=10', 1280);
  s('chapter-edit-desktop.png', '/admin/curriculum/chapters/91/edit', 1280);
  s('chapter-create-mobile.png', '/admin/curriculum/chapters/create?subject_id=3&education_level_id=10', 375);
  s('topic-create-desktop.png', '/admin/curriculum/topics/create?chapter_id=91', 1280);
  s('topic-edit-desktop.png', '/admin/curriculum/topics/126/edit', 1280);
  s('topic-edit-mobile.png', '/admin/curriculum/topics/126/edit', 375);
  // subjects
  s('subjects-desktop.png', '/admin/subjects', 1280);
  s('subjects-tablet.png', '/admin/subjects', 768, [], VP(1000));
  s('subjects-mobile.png', '/admin/subjects', 375, [], VP(1000));
  s('subjects-flash-error.png', '/admin/subjects/999/edit', 1280, [], VP(600));
  s('subject-create-desktop.png', '/admin/subjects/create', 1280);
  s('subject-edit-desktop.png', '/admin/subjects/3/edit', 1280);
  s('subject-edit-mobile.png', '/admin/subjects/3/edit', 375);
  // levels
  s('levels-desktop.png', '/admin/education-levels', 1280);
  s('levels-mobile.png', '/admin/education-levels', 375, [], VP(1000));
  s('level-create-desktop.png', '/admin/education-levels/create', 1280);
  s('level-edit-desktop.png', '/admin/education-levels/10/edit', 1280);
  // student topics
  s('topics-desktop.png', '/topics', 1280, [], VP(1300));
  s('topics-tablet.png', '/topics', 768, [], VP(1200));
  s('topics-mobile.png', '/topics', 375, [], VP(1400));
  s('topics-filter-d1-sains.png', '/topics?grade_level=DARJAH_1&subject=SAINS', 1280, [], VP(1100));
  s('topics-empty.png', '/topics?grade_level=TINGKATAN_2', 1280, [], VP(700));
  s('topic-show-desktop.png', '/topics/7', 1280);
  s('topic-show-mobile.png', '/topics/7', 375);
  // peta belajar
  s('peta-belajar-desktop.png', '/peta-belajar', 1280, [REVEAL, W(800)]);
  s('peta-belajar-math-d1.png', '/peta-belajar?subject=MATEMATIK&grade=DARJAH_1', 1280, [REVEAL, W(800)]);
  s('peta-belajar-empty.png', '/peta-belajar?subject=GEOGRAFI&grade=DARJAH_1', 1280, [REVEAL, W(800)]);
  s('peta-belajar-tablet.png', '/peta-belajar', 768, [REVEAL, W(800)]);
  s('peta-belajar-mobile.png', '/peta-belajar', 375, [REVEAL, W(800)]);
  window.__shots = S;
})();
