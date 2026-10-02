// M11 audit top-up (read-only): in-page collectors for the dated seed snapshot. Returns NON-PERSONAL values only:
// school ids (from links), counts, percentages, colour classes, pill states. School names are replaced by "<school:{id}>";
// student / teacher names and e-mails are never read into the result. Nothing is clicked except Alpine pill state (client-side).
(function () {
  function T(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
  function colorTok(cls) { var m = (cls || '').match(/bg-(slate|blue|green|red)-50/); return (m ? m[1] : '?') + (/ring-amber-400/.test(cls) ? '+best' : ''); }
  // ---------- S2 overview ----------
  window.__m11snapS2 = function () {
    var main = document.querySelector('main'), nameToId = {}, codeToId = {};
    function rows(sec) {
      return Array.from(main.querySelectorAll(sec + ' tbody tr')).map(function (tr) {
        var a = tr.querySelector('a[href*="/monitoring/sekolah/"]'), id = +a.getAttribute('href').match(/sekolah\/(\d+)/)[1];
        var sub = T(a.parentElement.querySelector('div').textContent), kod = sub.split(' · ')[0], negeri = sub.split(' · ')[1];
        nameToId[T(a.textContent)] = id; codeToId[kod] = id;
        var td = tr.children, pill = td[5].querySelector('span'), bar = td[6];
        var fill = bar.querySelector('[style*="width"]');
        return { rank: +T(td[0].textContent), schoolId: id, negeri: negeri, daftar: +T(td[2].textContent).replace(/,/g, ''), aktifOrLogin: +T(td[3].textContent).replace(/,/g, ''),
          pct: T(td[4].textContent), tahap: T(pill.textContent), tahapColor: pill.style.backgroundColor,
          bar: fill ? { width: fill.style.width, labelInside: !!fill.querySelector('span') } : { width: null, labelInside: false } };
      });
    }
    var cards = {};
    main.querySelectorAll('#section-ringkasan .card').forEach(function (c) { var p = c.querySelectorAll('p'); cards[T(p[0].textContent)] = T(p[1].textContent); });
    var pel = rows('#section-pelajar'), guru = rows('#section-guru');
    var weeks = Array.from(main.querySelectorAll('#section-mingguan thead th[title]')).map(function (th) { return T(th.textContent) + '=' + th.getAttribute('title'); });
    var weekly = Array.from(main.querySelectorAll('#section-mingguan tbody tr')).map(function (tr) {
      var kod = T(tr.children[0].querySelector('div:last-child').textContent);
      var cells = Array.from(tr.querySelectorAll('td.font-mono')).map(function (td) { var v = T(td.textContent); return [v === '-' ? 0 : +v.replace(/,/g, ''), colorTok(td.className)]; });
      var ti = tr.children[tr.children.length - 2].querySelector('i'), best = tr.children[tr.children.length - 1];
      return { schoolId: codeToId[kod] || ('kod-unlinked'), cells: cells, trend: ti ? ti.getAttribute('title') : null, best: T(best.textContent) };
    });
    function tok(s) { s = T(s); Object.keys(nameToId).sort(function (a, b) { return b.length - a.length; }).forEach(function (n) { s = s.split(n).join('<school:' + nameToId[n] + '>'); }); return s; }
    var terbaik = [], perhatian = [], cadangan = [];
    main.querySelectorAll('#section-perhatian .card').forEach(function (c) {
      var h = T((c.querySelector('h3') || {}).textContent || '');
      var items = Array.from(c.querySelectorAll('li span, .grid > div span')).map(function (s) { return tok(s.textContent); });
      if (/Terbaik/.test(h)) terbaik = items; else if (/Perhatian/.test(h)) perhatian = items; else if (/Cadangan/.test(h)) cadangan = items;
    });
    var empty = main.querySelector('#section-perhatian p');
    return { url: location.pathname + location.search, cards: cards, sekolahCount: Array.from(main.querySelectorAll('#section-pelajar span.text-xs, #section-guru span.text-xs')).map(function (s) { return T(s.textContent); }).filter(function (x) { return / sekolah$/.test(x); }),
      pelajarTable: pel, guruTable: guru, weeks: weeks, weekly: weekly, sekolahTerbaik: terbaik, perhatianSegera: perhatian, cadanganTindakan: cadangan,
      perhatianEmpty: empty && /Tiada pemerhatian/.test(empty.textContent) ? T(empty.textContent) : null,
      unmappedNames: 0 };
  };
  // ---------- S3 school ----------
  window.__m11snapS3 = async function () {
    var main = document.querySelector('main');
    var hdr = main.querySelector('.card');
    var spans = Array.from(hdr.querySelectorAll('span.rounded-full'));
    var sub = spans.filter(function (s) { return /sehingga|langganan/i.test(s.textContent); })[0];
    var tahap = spans.filter(function (s) { return / — [\d.]+%$/.test(T(s.textContent)); })[0];
    var cards = {}; Array.from(main.querySelectorAll('.grid > .card')).forEach(function (c) { var p = c.querySelectorAll('p'); if (p.length >= 2) cards[T(p[0].textContent)] = T(p[1].textContent); });
    var warn = main.querySelector('.bg-amber-50.border-amber-200');
    var sCard = main.querySelector('[x-data*="studentFilter"]'), tCard = main.querySelector('[x-data*="teacherFilter"]');
    var pills = Array.from(sCard.querySelectorAll('button[\\@click^="studentFilter"]')).map(function (b) { return { filter: b.getAttribute('@click').match(/'(\w+)'/)[1], label: T(b.textContent) }; });
    var srows = Array.from(sCard.querySelectorAll('tbody tr'));
    var statusCount = {}, flagCount = { none: 0, perluSemak: 0, ditapis: 0 }, answeredNoLogin = 0, activeLinkMon = 0, linkKirk = 0, errorRows = 0, ting = {};
    var rowsOut = srows.map(function (tr, i) {
      var td = tr.children, st = T(td[4].textContent), badge = td[1].querySelector('span[title]');
      var flag = !badge ? 'none' : (/bg-rose-100/.test(badge.className) ? 'ditapis' : 'perluSemak');
      var login = T(td[5].textContent), act = T(td[6].textContent), soalan = +T(td[3].textContent);
      var xs = tr.getAttribute('x-show') || '';
      var m = xs.match(/'active' && (true|false)\)[\s\S]*'login' && !(true|false) && (true|false)\)[\s\S]*'never' && !(true|false)\)/);
      var broken = !/'\.includes\(studentSearch/.test(xs.replace(/'[^']*'\.includes\(studentSearch/, "''.includes(studentSearch")) || (xs.split("'").length % 2 === 0);
      statusCount[st] = (statusCount[st] || 0) + 1; flagCount[flag]++; ting[T(td[2].textContent)] = (ting[T(td[2].textContent)] || 0) + 1;
      if (st === 'Aktif' && login === '-') answeredNoLogin++;
      var a = td[1].querySelector('a'); if (a && /kirkpatrick/.test(a.getAttribute('href'))) linkKirk++; else activeLinkMon++;
      return { row: i + 1, tingkatan: T(td[2].textContent), soalan: soalan, status: st, flag: flag, hasLoginCell: login !== '-', hasActivityCell: act !== '-', link: a && /kirkpatrick/.test(a.getAttribute('href')) ? 'kirkpatrick' : 'monitoring',
        xshow: m ? { isActive: m[1] === 'true', loginNotActive: m[2] === 'true', loginHas: m[3] === 'true', neverHas: m[4] === 'true' } : 'unparsed', quoteImbalance: xs.split("'").length % 2 === 0 };
    });
    // pill results (Alpine state only)
    var d = Alpine.$data(sCard), shown = {};
    for (var k = 0; k < pills.length; k++) { d.studentFilter = pills[k].filter; await new Promise(function (r) { setTimeout(r, 120); });
      var vis = srows.filter(function (tr) { return getComputedStyle(tr).display !== 'none'; });
      var bd = {}; vis.forEach(function (tr) { var st = T(tr.children[4].textContent), b = tr.children[1].querySelector('span[title]'); var key = st + (b ? (/rose/.test(b.className) ? '+ditapis' : '+perluSemak') : '') + (st === 'Aktif' && T(tr.children[5].textContent) === '-' ? '+noLogin' : ''); bd[key] = (bd[key] || 0) + 1; });
      shown[pills[k].filter] = { rows: vis.length, breakdown: bd }; }
    d.studentFilter = 'all';
    var trows = tCard ? Array.from(tCard.querySelectorAll('tbody tr')) : [];
    var tStatus = {}; trows.forEach(function (tr) { var s = T(tr.children[2].textContent); tStatus[s] = (tStatus[s] || 0) + 1; });
    var tPills = tCard ? Array.from(tCard.querySelectorAll('button')).map(function (b) { return T(b.textContent); }) : [];
    return { schoolId: +location.pathname.match(/sekolah\/(\d+)/)[1],
      subscriptionPill: sub ? { text: T(sub.textContent), classes: (sub.className.match(/bg-\w+-\d+ text-\w+-\d+/) || [''])[0] } : null,
      tahapPill: tahap ? { text: T(tahap.textContent), color: tahap.style.backgroundColor } : null,
      negeri: T((hdr.querySelector('.fa-map-marker-alt') || { parentElement: { textContent: '' } }).parentElement.textContent),
      cards: cards, warningBox: warn ? T(warn.textContent) : null,
      studentPills: pills, studentRows: srows.length, statusCount: statusCount, flagCount: flagCount, answeredWithoutLogin: answeredNoLogin,
      tingkatanValues: ting, linkTargets: { monitoring: activeLinkMon, kirkpatrick: linkKirk }, pillShows: shown,
      rows: rowsOut,
      teacherHeading: tCard ? T(tCard.querySelector('h3').textContent) : null, teacherPills: tPills, teacherRows: trows.length, teacherStatusCount: tStatus,
      teacherEmpty: tCard && tCard.querySelector('p.text-center') ? T(tCard.querySelector('p.text-center').textContent) : null };
  };
  // ---------- S5 teacher ----------
  window.__m11snapS5 = function () {
    var main = document.querySelector('main'), cards = {};
    Array.from(main.querySelectorAll('.grid > .card')).forEach(function (c) { var p = c.querySelectorAll('p'); cards[T(p[0].textContent)] = T(p[1].textContent); });
    var rows = Array.from(main.querySelectorAll('tbody tr')), st = {}, acc = { lt50: 0, b50_70: 0, ge70: 0, none: 0 };
    rows.forEach(function (tr) { var s = T(tr.children[5].textContent); st[s] = (st[s] || 0) + 1; var a = T(tr.children[4].textContent); if (a === '-') acc.none++; else { var v = parseFloat(a); if (v < 50) acc.lt50++; else if (v < 70) acc.b50_70++; else acc.ge70++; } });
    return { url: location.pathname.replace(/\/guru\/\d+/, '/guru/{id}'), statusPill: T(main.querySelector('.card span.rounded-full').textContent), cards: cards, rows: rows.length, statusCount: st, accuracyBands: acc,
      cadangan: Array.from(main.querySelectorAll('.space-y-2 > div')).map(function (d) { return { text: T(d.textContent), box: (d.className.match(/bg-\w+-50/) || [''])[0], icon: (d.querySelector('i').className.match(/fa-[\w-]+(?= )/g) || []).filter(function (c) { return c !== 'fa-' ; })[0] }; }) };
  };
  // ---------- S4 student topics ----------
  window.__m11snapS4 = function () {
    var main = document.querySelector('main'), p = main.querySelector('[x-show="tab === \'topic\'"]'), out = [], subj = null;
    Array.from(p.children).forEach(function (el) {
      if (el.tagName === 'P') { subj = T(el.textContent); return; }
      if (!el.classList.contains('flex')) return;
      var s = el.querySelectorAll('span');
      out.push({ subject: subj, bab: T(s[0].textContent), topic: T(s[1].textContent), pct: T(s[2].textContent), betulJumlah: T(s[3].textContent), badge: T(s[4].textContent) });
    });
    var cards = {}; Array.from(main.querySelectorAll('.grid > .card')).forEach(function (c) { var q = c.querySelectorAll('p'); cards[T(q[0].textContent)] = T(q[1].textContent); });
    return { url: location.pathname.replace(/\/pelajar\/\d+/, '/pelajar/{Student A}'), cards: cards, topics: out };
  };
})();
