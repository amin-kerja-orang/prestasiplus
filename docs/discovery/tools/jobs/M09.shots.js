// M09 masked screenshot plan → docs/discovery/img/M09/. Load tools/jobs/M09.js FIRST (it exposes window.__M09_HELPERS),
// then addScriptTag(this file), then browser_run_code_unsafe{filename: tools/shoot.js}.
// Every shot runs M09MASK (author / poster names, "Cikgu X" in copy) before and after its actions, then tools/sanitize.js
// {titleName:false} (panduan: sanitize off — no personal data, and sanitize rule 1e would mask the role labels).
// /artikel/{slug}, /video/{id}, /perutusan/{id} are served from the M09 route cache (no extra view is recorded).
// Client-side reveals only; nothing is submitted.
(function () {
  var B = 'https://prestasiplus.my', D = 'docs/discovery/img/M09/';
  var H = window.__M09_HELPERS;
  var MK = { eval: H.MASK };
  var W = function (ms) { return { wait: ms || 500 }; };
  var S = [];
  function s(file, url, width, actions, extra) { S.push(Object.assign({ file: D + file, url: B + url, width: width || 1280, actions: [MK].concat(actions || [], [MK]), sanitize: { titleName: false } }, extra || {})); }
  var VP = { fullPage: false };
  var SEL = function (n, v) { return { select: ['main select[name="' + n + '"]', v] }; };
  var AD = '/artikel/teknik-pomodoro-belajar-25-minit-rehat-5-minit';
  // admin
  s('admin-articles-desktop.png', '/admin/articles', 1280);
  s('admin-articles-mobile.png', '/admin/articles', 375, [], VP);
  s('admin-articles-tablet.png', '/admin/articles', 768, [], VP);
  s('admin-articles-empty.png', '/admin/articles?published=0', 1280, [], VP);
  s('admin-articles-not-found-flash.png', '/admin/articles/9999', 1280, [], VP);
  s('admin-article-create.png', '/admin/articles/create', 1280);
  s('admin-article-create-mobile.png', '/admin/articles/create', 375);
  s('admin-article-edit.png', '/admin/articles/10/edit', 1280);
  s('admin-article-show.png', '/admin/articles/10', 1280);
  s('admin-article-show-mobile.png', '/admin/articles/10', 375, [], VP);
  s('admin-notes-desktop.png', '/admin/notes', 1280);
  s('admin-notes-mobile.png', '/admin/notes', 375, [], VP);
  s('admin-note-create-500.png', '/admin/notes/create', 1280, [], VP);
  s('admin-note-show.png', '/admin/notes/1', 1280);
  s('admin-banners-desktop.png', '/admin/banners', 1280);
  s('admin-banners-mobile.png', '/admin/banners', 375, [], VP);
  s('admin-banner-create-external.png', '/admin/banners/create', 1280, [SEL('link_type', 'external'), W()]);
  s('admin-banner-edit.png', '/admin/banners/1/edit', 1280);
  s('admin-banner-create-mobile.png', '/admin/banners/create', 375);
  s('admin-audio-kbat.png', '/admin/audio-kbat', 1280);
  s('admin-audio-kbat-mobile.png', '/admin/audio-kbat', 375);
  s('admin-audio-kbat-create-top.png', '/admin/audio-kbat/create', 1280, [], VP);
  s('admin-audio-kbat-create-mobile.png', '/admin/audio-kbat/create', 375, [], VP);
  s('admin-screenshots.png', '/admin/tools/screenshots', 1280);
  // user portal
  s('artikel-desktop.png', '/artikel', 1280);
  s('artikel-tablet.png', '/artikel', 768, [], VP);
  s('artikel-mobile.png', '/artikel', 375, [], VP);
  s('artikel-category.png', '/artikel?category=BERITA', 1280, [], VP);
  s('artikel-empty.png', '/artikel?search=zzzqqq', 1280, [], VP);
  s('artikel-detail-desktop.png', AD, 1280);
  s('artikel-detail-mobile.png', AD, 375, [], VP);
  s('video-desktop.png', '/video', 1280, [], VP);
  s('video-mobile.png', '/video', 375, [], VP);
  s('video-empty.png', '/video?search=zzzqqq', 1280, [], VP);
  s('video-detail.png', '/video/2224', 1280);
  s('video-edit.png', '/video/2224/edit', 1280);
  s('video-tambah-youtube.png', '/video/tambah', 1280, [{ fill: ['main input[name=video_url]', 'https://www.youtube.com/watch?v=iqtUCV6AHuI'] }, W(1500)]);
  s('video-tambah-mobile.png', '/video/tambah', 375);
  s('audio-kbat-student.png', '/audio-kbat', 1280, [], VP);
  s('perutusan-desktop.png', '/perutusan', 1280);
  s('perutusan-mobile.png', '/perutusan', 375, [], VP);
  s('perutusan-detail.png', '/perutusan/4', 1280);
  s('perutusan-tulis.png', '/perutusan/tulis', 1280);
  s('perutusan-tulis-scheduled.png', '/perutusan/tulis', 1280, [{ click: 'main label:has-text("Jadualkan")' }, W()]);
  s('perutusan-tulis-mobile.png', '/perutusan/tulis', 375);
  s('perutusan-saya.png', '/perutusan/saya', 1280, [], VP);
  s('panduan-desktop.png', '/panduan', 1280, [], { sanitize: false });
  s('panduan-guru.png', '/panduan', 1280, [{ click: 'text=Guru Mata Pelajaran' }, W()], { sanitize: false });
  s('panduan-mobile.png', '/panduan', 375, [{ click: 'button:has(.fa-bars)' }, W()], { sanitize: false, fullPage: false });
  window.__shots = S;
})();
