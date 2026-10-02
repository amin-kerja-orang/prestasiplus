// M21 masked screenshot plan → docs/discovery/img/M21/. Run M21-guard.js first; load tools/jobs/M21.js FIRST
// (window.__M21_HELPERS), then addScriptTag(this file), then browser_run_code_unsafe{filename: tools/shoot.js}.
// Every shot runs the client-side reveal actions, then M21MASK (e-mails, phones, BIN / BINTI names, the Pelajar / Pemohon /
// Pegawai / Penaja / Sebab table columns, contact / address inputs) and tools/sanitize.js with the M21 options.
// Read-only: no save, reactivate, assign, graduate, withdraw, approve, reject or submit. All M21 pages come from the guard cache.
// Note: sanitize.js blanks the input named "name" (organisation name on S2 / S3) and masks the list item after "Ibu bapa"
// on S6 ("Guru / Kaunselor — …"); these are over-masking, not personal data (real copy in the narrative).
(function () {
  var B = 'https://prestasiplus.my', D = 'docs/discovery/img/M21/';
  var H = window.__M21_HELPERS;
  var MK = { eval: H.MASK };
  function EV(js) { return { eval: '(() => { ' + js + ' })()' }; }
  var S = [];
  function s(file, url, width, actions, extra) { S.push(Object.assign({ file: D + file, url: B + url, width: width || 1280, actions: (actions || []).concat([{ wait: 400 }, MK]), sanitize: H.SAN, settle: 600 }, extra || {})); }
  var VP = { fullPage: false };
  var EX2 = EV("var li = document.querySelectorAll('main li[onclick]')[1]; if (li) li.click(); return 'ex2';");
  var STEP2 = EV("var t = Array.from(document.querySelectorAll('[\\\\@click]')).find(function (d) { return /selectedCategory = 'SYARIKAT_SWASTA'/.test(d.getAttribute('@click')); }); if (t) t.click(); var b = Array.from(document.querySelectorAll('button')).find(function (x) { return /step = 2; else alert/.test(x.getAttribute('@click') || ''); }); if (b) b.click(); return 'step2';");
  var STEP3 = EV("var b = Array.from(document.querySelectorAll('button')).find(function (x) { return (x.getAttribute('@click') || '') === 'step = 3'; }); if (b) b.click(); return 'step3';");
  s('admin-sponsors-desktop.png', '/admin/sponsors', 1280);
  s('admin-sponsors-tablet.png', '/admin/sponsors', 768, [], VP);
  s('admin-sponsors-mobile.png', '/admin/sponsors', 375);
  s('admin-sponsors-empty.png', '/admin/sponsors?status=pending', 1280, [], VP);
  s('admin-sponsors-page-2.png', '/admin/sponsors?page=2', 1280, [], VP);
  s('admin-sponsor-create-desktop.png', '/admin/sponsors/create', 1280);
  s('admin-sponsor-create-tablet.png', '/admin/sponsors/create', 768, [], VP);
  s('admin-sponsor-create-mobile.png', '/admin/sponsors/create', 375);
  s('admin-sponsor-edit-desktop.png', '/admin/sponsors/6/edit', 1280);
  s('admin-sponsor-edit-tablet.png', '/admin/sponsors/6/edit', 768, [], VP);
  s('admin-sponsor-edit-mobile.png', '/admin/sponsors/6/edit', 375);
  s('admin-sponsor-show-500.png', '/admin/sponsors/6', 1280, [], VP);
  s('admin-anak-angkat-desktop.png', '/admin/anak-angkat', 1280);
  s('admin-anak-angkat-tablet.png', '/admin/anak-angkat', 768, [], VP);
  s('admin-anak-angkat-mobile.png', '/admin/anak-angkat', 375);
  s('admin-anak-angkat-empty.png', '/admin/anak-angkat?status=graduated', 1280, [], VP);
  s('admin-anak-angkat-show-405.png', '/admin/anak-angkat/2', 1280, [], VP);
  s('admin-permohonan-desktop.png', '/admin/anak-angkat/permohonan', 1280);
  s('admin-permohonan-tablet.png', '/admin/anak-angkat/permohonan', 768, [], VP);
  s('admin-permohonan-mobile.png', '/admin/anak-angkat/permohonan', 375);
  s('admin-permohonan-empty.png', '/admin/anak-angkat/permohonan?status=approved', 1280, [], VP);
  s('mohon-keluarga-angkat-desktop.png', '/mohon-keluarga-angkat', 1280);
  s('mohon-keluarga-angkat-tablet.png', '/mohon-keluarga-angkat', 768, [], VP);
  s('mohon-keluarga-angkat-mobile.png', '/mohon-keluarga-angkat', 375);
  s('mohon-keluarga-angkat-example.png', '/mohon-keluarga-angkat', 1280, [EX2], VP);
  s('sponsor-register-desktop.png', '/sponsor/register', 1280);
  s('sponsor-register-tablet.png', '/sponsor/register', 768, [], VP);
  s('sponsor-register-mobile.png', '/sponsor/register', 375);
  s('sponsor-register-step-2.png', '/sponsor/register', 1280, [STEP2]);
  s('sponsor-register-step-3.png', '/sponsor/register', 1280, [STEP2, { wait: 300 }, STEP3]);
  s('sponsor-register-step-2-mobile.png', '/sponsor/register', 375, [STEP2]);
  s('sponsor-register-step-3-mobile.png', '/sponsor/register', 375, [STEP2, { wait: 300 }, STEP3]);
  window.__shots = S;
})();
