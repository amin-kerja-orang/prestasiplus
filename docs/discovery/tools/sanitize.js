/*
 * PrestasiPlus discovery — in-page personal-data scrubber (added for M02; reusable).
 *
 * Runs INSIDE the page. Defines window.__sanitize(opts) which rewrites the live DOM so that
 * neither the element inventory nor a screenshot can carry personal data:
 *   1. Table columns whose header matches PERSONAL_COL (Nama, Emel, Telefon, IC, Ibu Bapa, …) have
 *      every non-numeric text node replaced with a placeholder (<name>, <email>, <phone>, <ic>, <person>).
 *      Avatar <img> inside them lose src/alt.
 *   2. Values of personal form fields (name/email/phone/ic_number/…) are collected (not returned).
 *   3. Every collected string (+ URL-encoded variants) is replaced in ALL text nodes and ALL attributes
 *      of the document (Alpine @click args, confirm('Login sebagai X?'), title, alt, ui-avatars URLs …).
 *   4. Attribute literals of the form  xxxName = '…'  /  name: '…'  are replaced with '<name>'.
 *   5. Personal input values are blanked (value='' so the screenshot shows the placeholder).
 *   6. opts.selectors: extra CSS selectors whose text is masked entirely (e.g. cards listing students).
 *   Also: <select> person pickers (teacher/student/parent … by name/id/x-model) → option text '<person> (<email>)';
 *   detail-page label/value pairs (USERNAME, NO. KP, Nama …) → value masked; Alpine x-text bound to *.name / *.email /
 *   *.ic_number / id_delima … → masked; Alpine data keys *Name/*Email/*Phone → '<name>'; a detail-page title
 *   "Section - <Person>" → suffix masked; person-record ids (/admin/users/123, toggleRow(123), row checkbox values,
 *   allIds) → {id}/N, and location is rewritten with history.replaceState; its own injected <script> is removed.
 * Returns only counts; the collected strings are kept in non-enumerable window.__sanitizeStrings (for run-state's
 * piiLeakCheck) and never returned.
 *
 * Usage: inject with page.addScriptTag({path}) then page.evaluate(o => window.__sanitize(o), opts),
 * or set job.sanitize = true | {opts} in a tools/jobs/<Mxx>.js job (run-state.js calls it after the actions).
 * opts: { cols: 'regex source' (extra personal header pattern), keepCols: 'regex source' (never mask these headers),
 *         noDefaultKeep: bool (also allow masking Sekolah/Kelas/Subjek columns), selectors: [css] (mask + scrub globally),
 *         localSelectors: [css] (mask in place only), labels: 'regex alt' (extra detail labels whose value is masked), keepSelects: 'regex', scriptKeys: ['state', …] (extra JSON keys
 *         masked inside inline scripts), titleName: false, blankInputs: false, blankAlpine: false, idScrub: false }
 */
(function () {
  'use strict';
  function sanitize(opts) {
    opts = opts || {};
    // first: remove this script's own injected <script> so the inventory does not harvest its strings
    document.querySelectorAll('script:not([src])').forEach(function (sc) { if ((sc.textContent || '').indexOf('window.__sanitize = sanitize') >= 0) sc.remove(); });
    var PERSONAL_COL = /^(nama|name|emel|e-mel|email|telefon|tel|no\.? ?tel|phone|ic|no\.? ?(ic|k\/?p|kp|mykad)|mykad|kad pengenalan|ibu ?bapa|penjaga|anak|pengguna|user|pemohon|penghantar|pelajar\b(?! aktif)|guru\b(?! aktif)|penaja\b|cikgu|guru kelas|waris|dicipta oleh|oleh|diimport oleh|admin|pic|pegawai|hubungi|kontak|contact)/i;
    var extraCol = opts.cols ? new RegExp(opts.cols, 'i') : null;
    var keepCol = opts.keepCols ? new RegExp(opts.keepCols, 'i') : null;
    var FIELD = /(^|_)(name|nama|email|emel|phone|telefon|ic|ic_number|mykad|parent_name|parent_email|parent_phone|student_name|guardian)(_|$)/i;
    var strings = new Set(), cells = 0, attrs = 0, texts = 0, inputs = 0;
    function add(s) { s = (s || '').replace(/\s+/g, ' ').trim(); if (s.length >= 3 && !/^<.*>$/.test(s) && !/^[\d\s\-\/:.,]+$/.test(s)) strings.add(s); }
    function ph(h) { h = h.toLowerCase(); return /mel|mail/.test(h) ? '<email>' : /tel|phone/.test(h) ? '<phone>' : /ic|k\/?p|mykad|pengenalan/.test(h) ? '<ic>' : /ibu|penjaga|anak|pengguna|user|pemohon|oleh|admin|pelajar|guru|cikgu|waris|penaja|pic|pegawai|hubungi|kontak|contact/.test(h) ? '<person>' : '<name>'; }
    function maskNode(root, p) {
      var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), n, list = [];
      while ((n = w.nextNode())) list.push(n);
      list.forEach(function (t) {
        var v = t.nodeValue.trim();
        if (!v || /^<.*>$/.test(v)) return;
        if (/^[\d\s,.%+\-\/:]+$/.test(v) && p !== '<phone>' && p !== '<ic>') return; // counts / dates kept
        if (/^(Pelajar|Guru|Ibu Bapa|Penaja|Admin|Admin Sekolah|Pegawai PPD|Aktif|Tidak Aktif|Tiada|-|—|N\/A)$/i.test(v)) return; // enumerations kept
        add(v); v.split(/\s*[·•|,\n]\s*/).forEach(add);
        t.nodeValue = t.nodeValue.replace(t.nodeValue.trim(), p); cells++;
      });
      root.querySelectorAll('img').forEach(function (im) { if (im.alt) add(im.alt); im.removeAttribute('src'); im.setAttribute('alt', p); });
    }
    // 1. personal table columns
    document.querySelectorAll('table').forEach(function (tb) {
      var heads = Array.from(tb.querySelectorAll('thead th'));
      if (!heads.length) { var fr = tb.querySelector('tr'); if (fr) heads = Array.from(fr.querySelectorAll('th')); }
      heads.forEach(function (th, idx) {
        var h = th.textContent.replace(/\s+/g, ' ').trim();
        if (!h || (keepCol && keepCol.test(h)) || (!opts.noDefaultKeep && /sekolah|school|kelas|class|subjek|pakej|plan|langganan/i.test(h))) return;
        if (!(PERSONAL_COL.test(h) || (extraCol && extraCol.test(h)))) return;
        var p = ph(h);
        tb.querySelectorAll('tbody tr').forEach(function (tr) { var td = tr.children[idx]; if (td) maskNode(td, p); });
      });
    });
    (opts.localSelectors || []).forEach(function (sel) { document.querySelectorAll(sel).forEach(function (el) { var w2 = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), n2; while ((n2 = w2.nextNode())) { if (n2.nodeValue.trim() && !/^[s·•]+$/.test(n2.nodeValue)) { n2.nodeValue = '<masked>'; cells++; } } }); });
    (opts.selectors || []).forEach(function (sel) { document.querySelectorAll(sel).forEach(function (el) { maskNode(el, '<masked>'); }); });
    // 1b. <select>s that list people (teacher/student/parent/sponsor/officer pickers): option text masked, count kept
    var PERSON_SELECT = /(teacher|guru|cikgu|user|student|pelajar|parent|ibu|sponsor|penaja|officer|pegawai|child|anak)/i;
    var opts_ = 0;
    document.querySelectorAll('select').forEach(function (s) {
      var id = [s.name, s.id, s.getAttribute('x-model')].join(' ');
      if (!PERSON_SELECT.test(id) || /class|kelas|level|school|sekolah/i.test(id) || (opts.keepSelects && new RegExp(opts.keepSelects, 'i').test(id))) return;
      Array.from(s.options).forEach(function (o) {
        if (!o.value) return;
        var tx = o.text.trim(); add(tx); var mm = tx.match(/^(.*?)\s*\((.*)\)$/); if (mm) { add(mm[1]); add(mm[2]); }
        o.text = mm ? '<person> (<email>)' : '<person>'; opts_++;
      });
    });
    // 1c. label → value pairs on detail pages (e.g. "USERNAME" / "NO. KP" / "Nama" followed by the value)
    var PERSONAL_LABEL = /^(nama( penuh)?|name|username|nama pengguna|e-?mel|email|telefon|no\.? ?tel(efon)?|phone|ic|no\.? ?(ic|k\/?p|kp|mykad)|mykad|kad pengenalan|ibu ?bapa|penjaga|waris|anak|cikgu|guru|guru kelas|pic|pegawai)\s*:?$/i;
    document.querySelectorAll('body *').forEach(function (el) {
      if (el.children.length || !el.textContent || el.textContent.length > 40) return;
      var lt = el.textContent.replace(/\s+/g, ' ').trim();
      if (!PERSONAL_LABEL.test(lt) && !(opts.labels && new RegExp('^(' + opts.labels + ')\\s*:?$', 'i').test(lt))) return;
      if (el.closest('table,select,label,button,a,nav,aside,header')) return;
      var v = el.nextElementSibling;
      if (!v && el.parentElement) v = el.parentElement.nextElementSibling;
      if (v && !v.querySelector('input,select,textarea,form,button')) maskNode(v, ph(el.textContent));
    });
    // 1e. Alpine-rendered personal values (x-text="s.name", x-text="student.email", x-text="selectedName" …)
    document.querySelectorAll('[x-text]').forEach(function (el) {
      var xt = el.getAttribute('x-text');
      // only plain bindings (s.name, student.email, selectedName) — expressions with literals keep their static copy
      if (!/^[\w$.?]+$/.test(xt.trim()) || /school|sekolah|kelas|class|subject|subjek|package|pakej|file/i.test(xt) || /^(j|p)\.name$/.test(xt)) return;
      if (/(\.|^|\b)(name|email|phone|ic_number|ic|username|full_name|nama|id_delima)\b|[a-z](Name|Email|Phone)\b/.test(xt)) maskNode(el, /mail/i.test(xt) ? '<email>' : /phone/i.test(xt) ? '<phone>' : /\bic/i.test(xt) ? '<ic>' : '<name>');
    });
    // 1d. detail-page titles "Section - <Person name>"
    var tm = document.title.match(/^(.+?) - (.+)$/);
    if (tm && opts.titleName !== false && !/(admin panel|prestasiplus|admin prestasiplus)$/i.test(tm[2].trim())) add(tm[2]);
    // 2. personal field values
    document.querySelectorAll('input,textarea').forEach(function (i) {
      var nm = i.name || i.getAttribute('x-model') || '';
      if (!nm || !FIELD.test(nm.replace(/([a-z])([A-Z])/g, '$1_$2')) || /^(hidden|checkbox|radio|file|submit|button)$/.test(i.type)) return;
      if (i.value) { add(i.value); if (opts.blankInputs !== false) { i.value = ''; inputs++; } }
    });
    document.querySelectorAll('[x-data]').forEach(function (el) {
      try {
        var d = el._x_dataStack && el._x_dataStack[0]; if (!d) return;
        Object.keys(d).forEach(function (k) {
          var desc = Object.getOwnPropertyDescriptor(d, k); if (desc && desc.get) return;
          if (typeof d[k] !== 'string' || !d[k]) return;
          if ((FIELD.test(k.replace(/([a-z])([A-Z])/g, '$1_$2')) || /Name$|Email$|Phone$/.test(k)) && !/school|sekolah|package|pakej|class|kelas|state|district|jpn|ppd|file/i.test(k)) {
            add(d[k]); if (opts.blankAlpine !== false) d[k] = '<name>';
          }
        });
      } catch (e) {}
    });
    // 3 + 4. global replacement
    var list = Array.from(strings).sort(function (a, b) { return b.length - a.length; });
    var variants = [];
    list.forEach(function (s) {
      variants.push(s);
      var e1 = encodeURIComponent(s); if (e1 !== s) variants.push(e1);
      var e2 = e1.replace(/%20/g, '+'); if (e2 !== e1) variants.push(e2);
      var e3 = s.replace(/'/g, "\\'"); if (e3 !== s) variants.push(e3);
    });
    function scrub(v, isScript) {
      var o = v;
      for (var i = 0; i < variants.length; i++) if (o.indexOf(variants[i]) >= 0) o = o.split(variants[i]).join('<name>');
      if (isScript) o = o.replace(/("(name|full_name|student_name|parent_name|child_name|username|email|phone|ic_number)"\s*:\s*)"(?:\\.|[^"\\])*"/g, '$1"<name>"');
      else o = o.replace(/(\b(?![Ff]ile|[Cc]lass|[Ss]chool|[Pp]ackage)\w*[Nn]ame\w*\s*[=:]\s*)(['"`])(?:\\.|(?!\2)[^\\])*\2/g, '$1$2<name>$2');
      if (!isScript) o = o.replace(/([?&]name=)[^&"']*/g, '$1<name>');
      if (isScript && opts.scriptKeys) o = o.replace(new RegExp('("(' + opts.scriptKeys.join('|') + ')"\\s*:\\s*)"(?:\\\\.|[^"\\\\])*"', 'g'), '$1"<masked>"');
      // person-record ids (so a masked row cannot be linked back to a record): /admin/users/123 → /admin/users/{id}
      if (opts.idScrub !== false) {
        o = o.replace(/(\/admin\/(users|comp-students))\/\d+/g, '$1/{id}')
             .replace(/(deleteUserId = |toggleRow\(|selectedIds\.includes\(|selected\.includes\(')\d+/g, '$1N')
             .replace(/(allIds\s*[:=]\s*\[)[^\]]*\]/g, '$1N]');
      }
      return o;
    }
    // default passwords shown as a placeholder of a password-ish field (single token, no spaces) → '<default-password>'
    document.querySelectorAll('input[placeholder]').forEach(function (i) {
      var nm = (i.name || i.getAttribute('x-model') || '') + ' ' + (i.id || '');
      if (/pass|kata_?laluan/i.test(nm) && !/\s/.test(i.placeholder) && /\d/.test(i.placeholder)) { i.setAttribute('placeholder', '<default-password>'); attrs++; }
    });
    if (opts.idScrub !== false) {
      document.querySelectorAll('tbody input[type=checkbox][value], input[type=hidden][name="linked_students[]"]').forEach(function (c) { if (/^\d+$/.test(c.value)) { c.setAttribute('value', 'N'); attrs++; } });
      if (/\/admin\/(users|comp-students)\/\d+/.test(location.pathname)) { try { history.replaceState(history.state, '', location.pathname.replace(/(\/admin\/(users|comp-students))\/\d+/, '$1/{id}') + location.search); } catch (e) {} }
    }
    var all = document.body.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      for (var j = 0; j < el.attributes.length; j++) {
        var a = el.attributes[j];
        if (a.name === 'class' || a.name === 'style' || a.name === 'value' && el.type === 'hidden') continue;
        var nv = scrub(a.value);
        if (nv !== a.value) { try { el.setAttribute(a.name, nv); attrs++; } catch (e) {} }
      }
    }
    if (true) {
      var w = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT), t;
      while ((t = w.nextNode())) { var s = t.nodeValue, ns = scrub(s, t.parentNode && t.parentNode.tagName === 'SCRIPT'); if (ns !== s) { t.nodeValue = ns; texts++; } }
      document.title = scrub(document.title);
    }
    // template contents (x-for / x-if) are not live nodes: scrub their attributes too
    document.querySelectorAll('template').forEach(function (tp) {
      tp.content.querySelectorAll('*').forEach(function (el) {
        for (var j = 0; j < el.attributes.length; j++) { var a = el.attributes[j]; var nv = scrub(a.value); if (nv !== a.value) el.setAttribute(a.name, nv); }
      });
    });
    window.__sanitized = true;
    try { Object.defineProperty(window, '__sanitizeStrings', { value: list, configurable: true, enumerable: false }); } catch (e) {}
    return 'sanitized: cells=' + cells + ' strings=' + list.length + ' attrs=' + attrs + ' texts=' + texts + ' inputs=' + inputs + ' options=' + opts_;
  }
  if (typeof window !== 'undefined') window.__sanitize = sanitize;
  return sanitize;
})();
