// M21 dated seed snapshot (read-only, GET only, >= 450 ms between requests, inside the M21-guarded context).
// Load: browser_run_code_unsafe: async (page) => page.addScriptTag({ path: '<abs>/docs/discovery/tools/jobs/M21-snapshot.js' })
// Run:  browser_evaluate: async () => await window.__m21snap()   (save with filename → inventory/M21/_snapshot-<date>.json)
// - Pages are fetched with fetch() + DOMParser (no navigation, no script execution, no form ever submitted). Every M21
//   URL goes through the guard cache, so a page already opened during the capture is NOT requested again.
// - NEVER returned: names of students, applicants and contact officers; e-mails; phone numbers; addresses; IC /
//   registration numbers; free-text application reasons (only their length and whether they equal one of the site's
//   own example texts). Presence flags are returned instead. Sponsor organisation names (companies) are kept.
// - Never requested: create / update / reactivate / assign / status / lulus / tolak endpoints, /admin/anak-angkat/cari-pelajar.
(function () {
  function T(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  async function doc(u) { await sleep(450); var r = await fetch(u, { credentials: 'same-origin' }); var t = await r.text(); return { status: r.status, final: r.url.replace(location.origin, ''), d: new DOMParser().parseFromString(t, 'text/html') }; }
  var EMAIL = /[^\s@]+@[^\s@]+\.[a-z]{2,}/i, PHONE = /(\+?6?0\s?1\d[\d\- ]{6,10}\d)/;
  function header(d) { var h = d.querySelector('header h1'); var p = h && h.parentElement && h.parentElement.querySelector('p'); return { title: T(d.title), h1: h ? T(h.textContent) : null, sub: p ? T(p.textContent) : null }; }
  function stats(d) { return Array.from(d.querySelectorAll('main .grid > div')).map(function (x) { return T(x.textContent); }).filter(function (x) { return x.length < 60; }); }
  function tabs(d) { return Array.from(d.querySelectorAll('main a[href^="?status="]')).map(function (a) { return a.getAttribute('href') + ' = ' + T(a.textContent) + (/bg-(indigo|blue|emerald|slate-8|violet|purple)-[5-9]|text-white/.test(a.className) ? ' [active]' : ''); }); }
  function cfEmail(el) { return !!(el && el.querySelector('.__cf_email__, [data-cfemail]')); }
  function cellFlags(td) { var t = T(td.textContent); return { hasEmail: EMAIL.test(t) || cfEmail(td), hasPhone: PHONE.test(t), len: t.length }; }
  var EXAMPLES = null;
  window.__m21snap = async function () {
    var out = { capturedAt: new Date().toISOString(), note: 'M21 seed snapshot; GET only (guard-cached); personal names / e-mails / phones / addresses / reasons never returned (flags and lengths only). Organisation names are companies.' };
    // ---- S6 examples (site copy) first, so reasons can be compared ----
    var d6 = await doc('/mohon-keluarga-angkat');
    EXAMPLES = Array.from(d6.d.querySelectorAll('main li[onclick]')).map(function (li) { return T(li.textContent); });
    out.S6_apply = { status: d6.status, header: header(d6.d), h1: T((d6.d.querySelector('main h1') || {}).textContent), examples: EXAMPLES,
      selects: Array.from(d6.d.querySelectorAll('main select')).map(function (s) { return s.name + ': ' + Array.from(s.options).map(function (o) { return o.value + '=' + T(o.textContent); }).join(' | '); }),
      required: Array.from(d6.d.querySelectorAll('main form [required]')).map(function (e) { return e.name; }),
      textareaAttrs: (function () { var t = d6.d.querySelector('textarea[name=reason]'); return t ? { rows: t.getAttribute('rows'), minlength: t.getAttribute('minlength'), maxlength: t.getAttribute('maxlength'), required: t.hasAttribute('required') } : null; })(),
      steps: Array.from(d6.d.querySelectorAll('main ol li, main ul li:not([onclick])')).map(function (li) { return T(li.textContent); }) };
    // ---- S1 sponsors list ----
    var a = await doc('/admin/sponsors');
    out.S1_sponsors = { status: a.status, header: header(a.d), stats: stats(a.d), count: T((Array.from(a.d.querySelectorAll('main p, main span, main div')).find(function (x) { return !x.children.length && /penaja dijumpai/.test(x.textContent); }) || {}).textContent), rows: [] };
    Array.from(a.d.querySelectorAll('main tbody tr')).forEach(function (tr) {
      var td = tr.children; if (td.length < 7) { out.S1_sponsors.rows.push({ emptyRow: T(tr.textContent) }); return; }
      var org = td[1]; var orgLeaves = Array.from(org.querySelectorAll('*')).filter(function (x) { return !x.children.length; }).map(function (x) { return T(x.textContent); }).filter(Boolean);
      out.S1_sponsors.rows.push({ id: T(td[0].textContent), organisation: orgLeaves.filter(function (x) { return !EMAIL.test(x) && !/email.protected/i.test(x); })[0] || null, orgEmailPresent: orgLeaves.some(function (x) { return EMAIL.test(x); }) || cfEmail(org), orgEmailCloudflareProtected: cfEmail(org),
        category: T(td[2].textContent), officer: T(td[3].textContent) === '-' ? '-' : Object.assign({ present: true }, cellFlags(td[3])), status: T(td[4].textContent), statusIcon: ((td[4].querySelector('i') || {}).className || ''), date: T(td[5].textContent),
        actions: Array.from(td[6].querySelectorAll('a,button')).map(function (x) { return T(x.textContent) + ' ' + (x.getAttribute('href') || '').replace(location.origin, ''); }) });
    });
    out.S1_sponsors.filters = {};
    var F = ['status=PENDING', 'status=APPROVED', 'status=REJECTED', 'status=SUSPENDED', 'status=pending', 'status=suspended', 'category=INDIVIDU', 'category=SYARIKAT_SWASTA', 'search=Kedai', 'search=zzqxv', 'page=2'];
    for (var f of F) { var df = await doc('/admin/sponsors?' + f); out.S1_sponsors.filters[f] = { status: df.status, stats: stats(df.d), ids: Array.from(df.d.querySelectorAll('main tbody tr')).filter(function (tr) { return tr.children.length >= 7; }).map(function (tr) { return T(tr.children[0].textContent); }),
      texts: Array.from(df.d.querySelectorAll('main *')).filter(function (x) { return !x.children.length && /penaja dijumpai|Tiada|Showing|Previous|Next|Reset/.test(x.textContent); }).map(function (x) { return T(x.textContent); }) }; }
    // ---- S3 sponsor edit pages (non-personal fields) ----
    out.S3_sponsorFields = {};
    for (var r of out.S1_sponsors.rows) { if (!r.id) continue;
      var e = await doc('/admin/sponsors/' + r.id + '/edit'); var fm = e.d.querySelector('main form[action$="/sponsors/' + r.id + '"]');
      var val = function (n) { var el = fm && fm.querySelector('[name="' + n + '"]'); if (!el) return undefined; if (el.tagName === 'SELECT') { var o = el.querySelector('option[selected]'); return o ? o.value : null; } if (el.tagName === 'TEXTAREA') return T(el.textContent); return el.getAttribute('value'); };
      var has = function (n) { var v = val(n); return v === undefined ? 'n/a' : !!(v && String(v).length); };
      var side = Array.from(e.d.querySelectorAll('main *')).filter(function (x) { return !x.children.length; }).map(function (x) { return T(x.textContent); });
      out.S3_sponsorFields[r.id] = { status: e.status, header: header(e.d), name: val('name'), category: val('category'), description: val('description'), tagline: val('tagline'), website: val('website'), logoUrl: val('logo_url'),
        registrationNumberPresent: has('registration_number'), contactNamePresent: has('contact_person_name'), contactPositionPresent: has('contact_person_position'), contactEmailPresent: has('contact_email'), contactPhonePresent: has('contact_phone'),
        addressPresent: has('address'), cityPresent: has('city'), statePresent: has('state'), postcodePresent: has('postcode'),
        statusBlock: side.slice(side.indexOf('Poskod') + 1).filter(function (x) { return x && !EMAIL.test(x) && !PHONE.test(x); }).slice(0, 14),
        reactivateForm: !!e.d.querySelector('form[action$="/reactivate"]'), reactivateConfirm: (e.d.querySelector('form[action$="/reactivate"]') || { getAttribute: function () { return null; } }).getAttribute('onsubmit') };
    }
    var e404 = await doc('/admin/sponsors/999999/edit'); out.S3_unknown = { status: e404.status, title: T(e404.d.title) };
    // ---- S2 create ----
    var c2 = await doc('/admin/sponsors/create'); out.S2_create = { status: c2.status, header: header(c2.d), required: Array.from(c2.d.querySelectorAll('main form [required]')).map(function (x) { return x.name; }) };
    // ---- S4 anak angkat ----
    var d4 = await doc('/admin/anak-angkat');
    out.S4_anakAngkat = { status: d4.status, header: header(d4.d), stats: stats(d4.d), tabs: tabs(d4.d), sponsorOptions: Array.from(d4.d.querySelectorAll('select[name=sponsor_id] option')).map(function (o) { return o.value + '=' + T(o.textContent); }), rows: [], filters: {} };
    Array.from(d4.d.querySelectorAll('main tbody tr')).forEach(function (tr) { var td = tr.children; if (td.length < 8) { out.S4_anakAngkat.rows.push({ emptyRow: T(tr.textContent) }); return; }
      var sp = Array.from(td[1].querySelectorAll('*')).filter(function (x) { return !x.children.length; }).map(function (x) { return T(x.textContent); });
      out.S4_anakAngkat.rows.push({ id: T(td[0].textContent), sponsorOrganisation: sp[0], sponsorCategoryRaw: sp[1], student: Object.assign({ masked: true }, cellFlags(td[2]), { schoolLinePresent: td[2].querySelectorAll('div,p,span').length > 2 }), category: T(td[3].textContent), channel: T(td[4].textContent), status: T(td[5].textContent), date: T(td[6].textContent),
        actions: Array.from(td[7].querySelectorAll('form')).map(function (fm) { return T(fm.textContent) + ' → POST ' + fm.getAttribute('action').replace(location.origin, '') + ' status=' + ((fm.querySelector('[name=status]') || {}).value || '') + (fm.getAttribute('onsubmit') ? ' confirm:' + fm.getAttribute('onsubmit') : ''); }) }); });
    for (var s4 of ['all', 'active', 'graduated', 'withdrawn', 'expired']) { var q4 = await doc('/admin/anak-angkat?status=' + s4); out.S4_anakAngkat.filters[s4] = { status: q4.status, stats: stats(q4.d), tabs: tabs(q4.d), rows: Array.from(q4.d.querySelectorAll('main tbody tr')).map(function (tr) { return tr.children.length >= 8 ? 'row ' + T(tr.children[0].textContent) : 'empty: ' + T(tr.textContent); }) }; }
    // ---- S5 applications ----
    var d5 = await doc('/admin/anak-angkat/permohonan');
    out.S5_applications = { status: d5.status, header: header(d5.d), tabs: tabs(d5.d), rows: [], filters: {} };
    Array.from(d5.d.querySelectorAll('main tbody tr')).forEach(function (tr) { var td = tr.children; if (td.length < 7) { out.S5_applications.rows.push({ emptyRow: T(tr.textContent) }); return; }
      var reason = T(td[4].textContent); var full = td[4].getAttribute('title') || (td[4].querySelector('[title]') || { getAttribute: function () { return null; } }).getAttribute('title');
      var ex = EXAMPLES.findIndex(function (x) { return reason.replace(/\.\.\.$/, '').length > 20 && x.indexOf(reason.replace(/\.\.\.$/, '')) === 0; });
      var app = Array.from(td[2].querySelectorAll('*')).filter(function (x) { return !x.children.length; }).map(function (x) { return T(x.textContent); });
      out.S5_applications.rows.push({ id: T(td[0].textContent), student: Object.assign({ masked: true }, cellFlags(td[1]), { lines: Array.from(td[1].querySelectorAll('*')).filter(function (x) { return !x.children.length && T(x.textContent); }).length, emailCloudflareProtected: cfEmail(td[1]) }),
        applicantRole: app[app.length - 1], applicantIsStudentSelf: (function () { var st = Array.from(td[1].querySelectorAll('*')).filter(function (x) { return !x.children.length && T(x.textContent); }).map(function (x) { return T(x.textContent); })[0]; return st === app[0]; })(), category: T(td[3].textContent),
        reason: { shownLength: reason.length, truncatedWithEllipsis: /\.\.\.$/.test(reason), fullTextInTitle: !!full, equalsExample: ex >= 0 ? ex + 1 : null, text: ex >= 0 ? reason : '<free text masked>' }, status: T(td[5].textContent),
        actions: Array.from(td[6].querySelectorAll('form')).map(function (fm) { return T(fm.textContent) + ' → POST ' + fm.getAttribute('action').replace(location.origin, '') + (fm.getAttribute('onsubmit') ? ' confirm:' + fm.getAttribute('onsubmit') : ''); }) }); });
    for (var s5 of ['pending', 'approved', 'matched', 'rejected']) { var q5 = await doc('/admin/anak-angkat/permohonan?status=' + s5); out.S5_applications.filters[s5] = { status: q5.status, tabs: tabs(q5.d), rows: Array.from(q5.d.querySelectorAll('main tbody tr')).map(function (tr) { return tr.children.length >= 7 ? 'row ' + T(tr.children[0].textContent) : 'empty: ' + T(tr.textContent); }) }; }
    // ---- S7 register ----
    var d7 = await doc('/sponsor/register'); out.S7_register = { status: d7.status, header: header(d7.d), required: Array.from(d7.d.querySelectorAll('form [required]')).map(function (x) { return x.name + (x.getAttribute('minlength') ? ' minlength=' + x.getAttribute('minlength') : ''); }) };
    // ---- cross-module figures (read-only, not M21 pages) ----
    var m17 = await doc('/admin'); var L = Array.from(m17.d.querySelectorAll('main *')).filter(function (x) { return !x.children.length; }).map(function (x) { return T(x.textContent); });
    var i = L.indexOf('Jumlah Penaja'); out.M17_sponsorCards = i >= 0 ? L.slice(i - 2, i + 14) : 'not found';
    var m02 = await doc('/admin/users?role=sponsor'); out.M02_sponsorUsers = { status: m02.status, rowCount: m02.d.querySelectorAll('main tbody tr').length, countTexts: Array.from(m02.d.querySelectorAll('main *')).filter(function (x) { return !x.children.length && /pengguna|Penaja|Showing|dijumpai/i.test(x.textContent) && T(x.textContent).length < 40; }).map(function (x) { return T(x.textContent); }).slice(0, 20) };
    return out;
  };
})();
