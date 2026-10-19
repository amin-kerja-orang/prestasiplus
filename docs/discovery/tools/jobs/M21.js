// M21 capture plan — Sponsorship & Anak Angkat (admin sponsors list / create / edit, admin anak-angkat assignments,
// admin foster-family applications, student / parent "Mohon Keluarga Angkat" form, public sponsor registration).
// Guard first:  browser_run_code_unsafe { filename: docs/discovery/tools/jobs/M21-guard.js }
//   (aborts every non-GET but POST /login, gateway hosts, downloads and write-shaped GETs; every M21 document GET reaches
//    the server once per context and is then served from the guard cache, so no page is counted twice).
//   Re-run the guard after creating the guest context (it installs itself on every context).
// Load:  browser_run_code_unsafe: async (page) => page.addScriptTag({ path: '<abs>/docs/discovery/tools/jobs/M21.js' })
// then:  browser_evaluate: () => { window.__jobs = window.__M21_JOBS.filter(j => j.group === 'A'); }
// then run tools/run-state.js, save window.__invs to docs/discovery/inventory/_raw/M21/_batch-<g>.json, split-batch.js,
// merge-inventory.js.
//
// SAFETY: live production admin, browser lane 1 (playwright). READ-ONLY.
//   - Never clicked / submitted: sponsor create (POST /admin/sponsors), sponsor update (PUT /admin/sponsors/{id}),
//     sponsor "Aktifkan Semula" (POST /admin/sponsors/{id}/reactivate), anak-angkat "Assign" (POST /admin/anak-angkat/assign),
//     "Graduate" / "Tarik" (POST /admin/anak-angkat/{id}/status), application "Lulus" / "Tolak"
//     (POST /admin/anak-angkat/permohonan/{id}/lulus|tolak), "Hantar Permohonan" on /mohon-keluarga-angkat
//     (POST /mohon-keluarga-angkat) and on /sponsor/register (POST /sponsor/register).
//   - The anak-angkat student search box (GET /admin/anak-angkat/cari-pelajar?q=, returns student names / e-mails) is
//     never typed into; its dropdown is inventoried from the Alpine template only.
//   - Client-side reveals only: the "Mohon Keluarga Angkat" example reasons (onclick copies the text into the textarea;
//     nothing is sent), the sponsor-registration wizard steps (Alpine step 1 → 2 → 3, category tile click).
//
// PERSONAL DATA: sponsor contact officers (name / e-mail / phone / address), students and applicants (parents / students)
// are real people. M21MASK tags (.m21n → masked and scrubbed globally) every e-mail-shaped leaf, every phone-shaped leaf
// or token, leaves with BIN / BINTI / BTE / BT / A/L / A/P, every cell of a table column headed Pelajar / Pemohon /
// Pegawai / Penaja / Sebab (application reasons are family circumstances written by parents), and blanks every
// contact / address input value; tools/sanitize.js then runs with SAN. Organisation (sponsor) names are companies,
// not people, and are kept in the "Organisasi" column.
(function () {
  var B = 'https://prestasiplus.my';
  var jobs = [];
  function mask() {
    var n = 0;
    var tag = function (el, c) { c = c || 'm21n'; if (el && el.classList && !el.classList.contains(c)) { el.classList.add(c); n++; } };
    var T = function (s) { return String(s || '').replace(/\s+/g, ' ').trim(); };
    var PHONE = /(\+?6?0\s?1\d[\d\- ]{6,10}\d)/;
    document.querySelectorAll('body *').forEach(function (el) {
      if (el.children.length || el.closest('script,style,template,select,option')) return;
      var t = T(el.textContent); if (!t) return;
      if (/[^\s@]+@[^\s@]+\.[a-z]{2,}/i.test(t)) tag(el);
      else if (PHONE.test(t) && !/RM\s?\d/.test(t)) tag(el);
      else if (/\b(BIN|BINTI|BTE|BT|A\/L|A\/P)\b/i.test(t) && t.length < 90 && !el.closest('label,button,nav,aside,header,th')) tag(el);
    });
    // person / free-text columns of the M21 tables
    document.querySelectorAll('main table').forEach(function (tb) {
      var heads = Array.from(tb.querySelectorAll('thead th')).map(function (th) { return T(th.textContent); });
      heads.forEach(function (h, i) {
        if (!/^(Pelajar|Pemohon|Pegawai|Penaja|Sebab)$/i.test(h)) return;
        tb.querySelectorAll('tbody tr').forEach(function (tr) { var td = tr.children[i]; if (td && tr.children.length === heads.length) td.querySelectorAll('*').forEach(function (x) { if (!x.children.length && T(x.textContent) && !x.closest('form,button')) tag(x); }); if (td && !td.children.length && T(td.textContent) && T(td.textContent) !== '-') tag(td); });
      });
    });
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    var tn; while ((tn = w.nextNode())) { if (tn.parentElement && tn.parentElement.closest('script,style,template')) continue; if (PHONE.test(tn.nodeValue) && !/RM\s?\d/.test(tn.nodeValue)) { tn.nodeValue = tn.nodeValue.replace(new RegExp(PHONE.source, 'g'), '<phone>'); n++; } }
    document.querySelectorAll('input, textarea').forEach(function (i) { var nm = (i.name || '') + ' ' + (i.id || ''); if (/phone|telefon|email|emel|contact_person|address|alamat|postcode|poskod|city|bandar|registration|ic_|bank|account|akaun/i.test(nm) && i.type !== 'hidden' && (i.value || i.textContent)) { i.setAttribute('data-m21', 'masked'); i.value = ''; i.setAttribute('value', ''); if (i.tagName === 'TEXTAREA') i.textContent = ''; n++; } });
    document.querySelectorAll('a[href^="tel:"], a[href^="mailto:"], a[href*="wa.me"]').forEach(function (a) { a.setAttribute('href', a.getAttribute('href').replace(/(wa\.me\/|tel:)\+?\d+/, '$160XXXXXXXXX').replace(/^mailto:.*/, 'mailto:<email>')); n++; });
    document.querySelectorAll('a.__cf_email__, [data-cfemail]').forEach(function (a) { a.removeAttribute('data-cfemail'); a.textContent = '<email>'; n++; });
    document.querySelectorAll('[href*="/users/"], [href*="/student/"], [href*="/pelajar/"]').forEach(function (el) { el.setAttribute('href', el.getAttribute('href').replace(/\/(users|student|pelajar)\/\d+/g, '/$1/{id}')); });
    document.querySelectorAll('img').forEach(function (im) { var s = im.getAttribute('src') || ''; if (/ui-avatars|avatar|storage\/(avatars|profile)/.test(s)) { im.setAttribute('src', 'data:image/gif;base64,R0lGODlhAQABAAAAACw='); im.setAttribute('alt', '<person>'); n++; } });
    return 'm21mask: ' + n;
  }
  var M21MASK = '(' + mask.toString() + ')()';
  var SAN = { selectors: ['.m21n'], titleName: false, keepSelects: 'student_category|family_income_range|channel' };
  window.__M21_HELPERS = { MASK: M21MASK, SAN: SAN };
  function J(group, file, url, state, actions, extra, opts) {
    var s = file.split('-')[0];
    var j = { group: group, file: file, url: B + url, actions: (actions || []).concat([{ wait: 500 }, { eval: M21MASK }]), sanitize: SAN, settle: 500,
              opts: Object.assign({ state: state, prefix: 'EL-M21-' + s, redact: [] }, opts || {}) };
    Object.assign(j, extra || {});
    j.opts.state = state + (j.width === 375 ? ' @375' : j.width === 768 ? ' @768' : '') + (j.guest ? ' (guest)' : '');
    jobs.push(j);
  }
  var M = { width: 375 }, T = { width: 768 }, G = { guest: true };
  function EV(js) { return { eval: '(() => { ' + js + ' })()' }; }
  var R = function (sel, n) { var o = {}; o[sel] = n || 3; return { repeat: o }; };
  var RT = R('main tbody tr', 3);
  // client-side only
  var EX2 = EV("var li = document.querySelectorAll('main li[onclick]')[1]; if (!li) return 'no example'; li.click(); return 'example 2 copied (' + document.querySelector('textarea[name=reason]').value.length + ' chars)';");
  var STEP2 = EV("var t = Array.from(document.querySelectorAll('[\\\\@click]')).find(function (d) { return /selectedCategory = 'SYARIKAT_SWASTA'/.test(d.getAttribute('@click')); }); if (t) t.click(); var b = Array.from(document.querySelectorAll('button')).find(function (x) { return /step = 2; else alert/.test(x.getAttribute('@click') || ''); }); if (b) b.click(); return 'step2 ' + !!t + !!b;");
  var STEP3 = EV("var b = Array.from(document.querySelectorAll('button')).find(function (x) { return (x.getAttribute('@click') || '') === 'step = 3'; }); if (b) b.click(); return 'step3 ' + !!b;");
  var TILE = EV("var t = Array.from(document.querySelectorAll('[\\\\@click]')).find(function (d) { return /selectedCategory = 'NGO'/.test(d.getAttribute('@click')); }); if (t) t.click(); return 'tile NGO ' + !!t;");
  var EYE = EV("var b = Array.from(document.querySelectorAll('button')).find(function (x) { return (x.getAttribute('@click') || '') === 'showPassword = !showPassword'; }); if (b) b.click(); return 'eye ' + !!b;");

  // ---------------- S1 /admin/sponsors ----------------
  J('A', 'S1-admin-sponsors__default__1280', '/admin/sponsors', 'list (6 sponsors, all Digantung)', [], null, RT);
  J('A', 'S1-admin-sponsors__status-pending__1280', '/admin/sponsors?status=pending', 'status=pending (lower-case) → empty "Tiada penaja dijumpai" + Reset', [], null, RT);
  J('A', 'S1-admin-sponsors__status-approved__1280', '/admin/sponsors?status=approved', 'status=approved → empty', [], null, RT);
  J('A', 'S1-admin-sponsors__status-rejected__1280', '/admin/sponsors?status=rejected', 'status=rejected → empty', [], null, RT);
  J('A', 'S1-admin-sponsors__status-suspended__1280', '/admin/sponsors?status=suspended', 'status=suspended → 6', [], null, RT);
  J('A', 'S1-admin-sponsors__status-pending-uc__1280', '/admin/sponsors?status=PENDING', 'status=PENDING (select value) → empty', [], null, RT);
  J('A', 'S1-admin-sponsors__status-suspended-uc__1280', '/admin/sponsors?status=SUSPENDED', 'status=SUSPENDED (select value)', [], null, RT);
  J('A', 'S1-admin-sponsors__cat-individu__1280', '/admin/sponsors?category=INDIVIDU', 'category=INDIVIDU → empty', [], null, RT);
  J('A', 'S1-admin-sponsors__cat-swasta__1280', '/admin/sponsors?category=SYARIKAT_SWASTA', 'category=SYARIKAT_SWASTA → 6', [], null, RT);
  J('A', 'S1-admin-sponsors__search-match__1280', '/admin/sponsors?search=Kedai', 'search=Kedai → 1', [], null, RT);
  J('A', 'S1-admin-sponsors__search-none__1280', '/admin/sponsors?search=zzqxv', 'search with no match → empty', [], null, RT);
  J('A', 'S1-admin-sponsors__page-2__1280', '/admin/sponsors?page=2', '?page=2 → empty + English pager "Showing 0 of 6 results"', [], null, RT);
  J('A', 'S1-admin-sponsors__default__375', '/admin/sponsors', 'default', [], M, RT);
  J('A', 'S1-admin-sponsors__default__768', '/admin/sponsors', 'default', [], T, RT);

  // ---------------- S2 /admin/sponsors/create ----------------
  J('B', 'S2-admin-sponsor-create__default__1280', '/admin/sponsors/create', 'create form (never submitted)', []);
  J('B', 'S2-admin-sponsor-create__default__375', '/admin/sponsors/create', 'create form', [], M);
  J('B', 'S2-admin-sponsor-create__default__768', '/admin/sponsors/create', 'create form', [], T);

  // ---------------- S3 /admin/sponsors/{id}/edit (+ show → 500) ----------------
  J('C', 'S3-admin-sponsor-edit__default__1280', '/admin/sponsors/6/edit', 'edit #6 (Digantung; "Aktifkan Semula" never clicked)', []);
  J('C', 'S3-admin-sponsor-edit__with-officer__1280', '/admin/sponsors/11/edit', 'edit #11 (contact officer filled; masked)', []);
  J('C', 'S3-admin-sponsor-edit__not-found__1280', '/admin/sponsors/999999/edit', 'unknown id → 404', []);
  J('C', 'S3-admin-sponsor-edit__show-500__1280', '/admin/sponsors/6', 'row "Lihat" → GET /admin/sponsors/{id} → 500 "Ralat Pelayan"', []);
  J('C', 'S3-admin-sponsor-edit__default__375', '/admin/sponsors/6/edit', 'edit #6', [], M);
  J('C', 'S3-admin-sponsor-edit__default__768', '/admin/sponsors/6/edit', 'edit #6', [], T);

  // ---------------- S4 /admin/anak-angkat ----------------
  J('D', 'S4-admin-anak-angkat__default__1280', '/admin/anak-angkat', 'assignments (1 active; stats; assign form never submitted)', [], null, RT);
  J('D', 'S4-admin-anak-angkat__status-all__1280', '/admin/anak-angkat?status=all', 'status=all', [], null, RT);
  J('D', 'S4-admin-anak-angkat__status-active__1280', '/admin/anak-angkat?status=active', 'status=active', [], null, RT);
  J('D', 'S4-admin-anak-angkat__status-graduated__1280', '/admin/anak-angkat?status=graduated', 'status=graduated → empty', [], null, RT);
  J('D', 'S4-admin-anak-angkat__status-withdrawn__1280', '/admin/anak-angkat?status=withdrawn', 'status=withdrawn → empty', [], null, RT);
  J('D', 'S4-admin-anak-angkat__status-expired__1280', '/admin/anak-angkat?status=expired', 'status=expired → empty', [], null, RT);
  J('D', 'S4-admin-anak-angkat__show-405__1280', '/admin/anak-angkat/2', 'GET /admin/anak-angkat/{id} → 405 Symfony page', []);
  J('D', 'S4-admin-anak-angkat__default__375', '/admin/anak-angkat', 'default', [], M, RT);
  J('D', 'S4-admin-anak-angkat__default__768', '/admin/anak-angkat', 'default', [], T, RT);

  // ---------------- S5 /admin/anak-angkat/permohonan ----------------
  J('E', 'S5-admin-permohonan__default__1280', '/admin/anak-angkat/permohonan', 'applications (default = pending, 3)', [], null, RT);
  J('E', 'S5-admin-permohonan__status-pending__1280', '/admin/anak-angkat/permohonan?status=pending', 'status=pending', [], null, RT);
  J('E', 'S5-admin-permohonan__status-approved__1280', '/admin/anak-angkat/permohonan?status=approved', 'status=approved ("Dalam Pool") → empty', [], null, RT);
  J('E', 'S5-admin-permohonan__status-matched__1280', '/admin/anak-angkat/permohonan?status=matched', 'status=matched ("Ditaja") → empty', [], null, RT);
  J('E', 'S5-admin-permohonan__status-rejected__1280', '/admin/anak-angkat/permohonan?status=rejected', 'status=rejected → empty', [], null, RT);
  J('E', 'S5-admin-permohonan__not-found__1280', '/admin/anak-angkat/permohonan/1', 'GET /admin/anak-angkat/permohonan/{id} → 404', []);
  J('E', 'S5-admin-permohonan__default__375', '/admin/anak-angkat/permohonan', 'default', [], M, RT);
  J('E', 'S5-admin-permohonan__default__768', '/admin/anak-angkat/permohonan', 'default', [], T, RT);

  // ---------------- S6 /mohon-keluarga-angkat ----------------
  J('F', 'S6-mohon-keluarga-angkat__default__1280', '/mohon-keluarga-angkat', 'apply form (never submitted)', []);
  J('F', 'S6-mohon-keluarga-angkat__example-2__1280', '/mohon-keluarga-angkat', 'example reason 2 clicked (copied into textarea client-side)', [EX2]);
  J('F', 'S6-mohon-keluarga-angkat__default__375', '/mohon-keluarga-angkat', 'default', [], M);
  J('F', 'S6-mohon-keluarga-angkat__default__768', '/mohon-keluarga-angkat', 'default', [], T);

  // ---------------- S7 /sponsor/register ----------------
  J('G', 'S7-sponsor-register__default__1280', '/sponsor/register', 'wizard step 1 "Maklumat Organisasi" (admin session)', []);
  J('G', 'S7-sponsor-register__tile__1280', '/sponsor/register', 'category tile NGO selected (client-side)', [TILE]);
  J('G', 'S7-sponsor-register__step-2__1280', '/sponsor/register', 'step 2 "Maklumat Hubungan & Alamat" (client-side)', [STEP2]);
  J('G', 'S7-sponsor-register__step-3__1280', '/sponsor/register', 'step 3 "Akaun Log Masuk" (client-side)', [STEP2, { wait: 300 }, STEP3]);
  J('G', 'S7-sponsor-register__step-3-eye__1280', '/sponsor/register', 'step 3, password eye toggled (client-side)', [STEP2, { wait: 300 }, STEP3, { wait: 300 }, EYE]);
  J('G', 'S7-sponsor-register__default__375', '/sponsor/register', 'step 1', [], M);
  J('G', 'S7-sponsor-register__step-2__375', '/sponsor/register', 'step 2', [STEP2], M);
  J('G', 'S7-sponsor-register__step-3__375', '/sponsor/register', 'step 3', [STEP2, { wait: 300 }, STEP3], M);
  J('G', 'S7-sponsor-register__default__768', '/sponsor/register', 'step 1', [], T);

  // ---------------- guest (fresh context, no login) ----------------
  // S1-S6 and the sponsor portal redirect a guest to /login (302; probed directly, not inventoried: the page is M01's login).
  J('H', 'S7-sponsor-register__guest__1280', '/sponsor/register', 'step 1', [], G);
  J('H', 'S7-sponsor-register__guest__375', '/sponsor/register', 'step 1', [], Object.assign({ width: 375 }, G));

  window.__M21_JOBS = jobs;
})();
