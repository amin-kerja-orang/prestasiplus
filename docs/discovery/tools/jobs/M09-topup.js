// M09 top-up capture plan — S28 /perutusan/awam/{id} (public perutusan page, guest).
// SAFETY: the page was requested ONCE from live in a fresh cookie-less context; the response is served to every job and
// screenshot below by a context.route cache installed on that guest context (run-state's guest worker = the only non-admin
// context). Nothing is clicked except "Salin Pautan" (clipboard only). The YouTube iframe is loaded, never played.
// Personal data: AWAMMASK replaces the poster display name (text next to the .author-avatar initials) with '<person>' and
// school names (SMK/SK/SMKA/SJK…/MRSM/SBP + capitalised words, also '+' / %20 encoded inside share URLs) with '<school>',
// in text, attributes and the document title; then tools/sanitize.js {titleName:false}. No real name is written here.
(function () {
  var B = 'https://prestasiplus.my';
  var AWAMMASK = "(() => { var n = 0; var names = [];" +
    " document.querySelectorAll('.author-avatar').forEach(function (a) { var s = a.nextElementSibling; var p = s && s.querySelector('.author-name, p'); if (p && p.textContent.trim()) names.push(p.textContent.trim()); });" +
    " var SCH = /\\b(SMKA|SMK|SK|SJKC|SJKT|SJK|SMA|MRSM|SBP)(\\s|\\+|%20)+[A-Z][A-Za-z']*((\\s|\\+|%20)+[A-Z][A-Za-z']*)*/g;" +
    " function scrub(v) { var o = v; names.forEach(function (x) { [x, encodeURIComponent(x), encodeURIComponent(x).replace(/%20/g, '+')].forEach(function (y) { if (o.indexOf(y) >= 0) o = o.split(y).join('<person>'); }); }); return o.replace(SCH, '<school>'); }" +
    " var w = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT), t; while ((t = w.nextNode())) { var s2 = scrub(t.nodeValue); if (s2 !== t.nodeValue) { t.nodeValue = s2; n++; } }" +
    " document.querySelectorAll('*').forEach(function (el) { for (var j = 0; j < el.attributes.length; j++) { var a = el.attributes[j]; if (a.name === 'class' || a.name === 'style') continue; var nv = scrub(a.value); if (nv !== a.value) { el.setAttribute(a.name, nv); n++; } } });" +
    " document.title = scrub(document.title);" +
    " var html = document.documentElement.outerHTML; var leaks = names.filter(function (x) { return html.indexOf(x) >= 0; }).length + (html.match(SCH) || []).length;" +
    " return 'awammask: names=' + names.length + ' replaced=' + n + ' leaks=' + leaks; })()";
  var LAYOUT = { eval: "(() => { var cs = function (e) { if (!e) return 'none'; var c = getComputedStyle(e); return e.tagName + '.' + (e.className || '').toString().split(' ')[0] + '{bg:' + c.backgroundColor + (c.backgroundImage !== 'none' ? ' ' + c.backgroundImage.slice(0, 60) : '') + ' fg:' + c.color + ' pos:' + c.position + '}'; }; var ifr = document.querySelector('iframe'); var r = ifr ? ifr.getBoundingClientRect() : null; return ['nav ' + cs(document.querySelector('nav')), 'body ' + cs(document.body), 'h1 ' + cs(document.querySelector('h1')), 'role ' + cs(document.querySelector('.role-badge')), 'cta ' + cs([...document.querySelectorAll('a')].find(a => /Daftar Percuma Sekarang/.test(a.textContent))), 'footer ' + cs(document.querySelector('footer')), 'iframe ' + (r ? Math.round(r.width) + 'x' + Math.round(r.height) : 'none'), 'docW=' + document.documentElement.scrollWidth].join(' ; '); })()" };
  var BTNS = { eval: "(() => [...document.querySelectorAll('a, button')].filter(b => b.offsetParent).map(b => { var r = b.getBoundingClientRect(); return (b.textContent.trim().replace(/\\s+/g, ' ') || b.getAttribute('aria-label') || b.tagName).slice(0, 24) + '@' + Math.round(r.x) + ',' + Math.round(r.y) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height); }).join(' ; '))()" };
  var jobs = [];
  function J(file, state, actions, extra) {
    var j = { group: 'T', guest: true, file: file, url: B + '/perutusan/awam/4', actions: [{ eval: AWAMMASK }].concat(actions || [], [{ eval: AWAMMASK }]), sanitize: { titleName: false },
              opts: { state: state + ' (guest)', prefix: 'EL-M09-S28', contentRoot: 'main' } };
    Object.assign(j, extra || {});
    if (j.width === 375) j.opts.state += ' @375'; if (j.width === 768) j.opts.state += ' @768';
    jobs.push(j);
  }
  J('S28-perutusan-awam__default__1280', '#4 public page (cached single response)', [LAYOUT, BTNS]);
  J('S28-perutusan-awam__link-copied__1280', '"Salin Pautan" clicked (clipboard; button feedback)', [{ click: 'button:has-text("Salin Pautan")' }, { wait: 400 }, { eval: "[...document.querySelectorAll('button')].map(b => b.outerHTML.slice(0, 160)).join(' | ')" }]);
  J('S28-perutusan-awam__default__768', '#4', [LAYOUT, BTNS], { width: 768 });
  J('S28-perutusan-awam__default__375', '#4', [LAYOUT, BTNS], { width: 375 });
  window.__M09T_JOBS = jobs;
  window.__M09T_MASK = AWAMMASK;
  var D = 'docs/discovery/img/M09/';
  var MK = { eval: AWAMMASK };
  window.__M09T_SHOTS = [
    { file: D + 'perutusan-awam-desktop.png', url: B + '/perutusan/awam/4', width: 1280, actions: [MK, { wait: 800 }, MK], sanitize: { titleName: false } },
    { file: D + 'perutusan-awam-tablet.png', url: B + '/perutusan/awam/4', width: 768, actions: [MK, { wait: 800 }, MK], sanitize: { titleName: false }, fullPage: false },
    { file: D + 'perutusan-awam-mobile.png', url: B + '/perutusan/awam/4', width: 375, actions: [MK, { wait: 800 }, MK], sanitize: { titleName: false } }
  ];
})();
