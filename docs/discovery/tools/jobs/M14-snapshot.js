// M14 dated seed snapshot (read-only). Defines window.__m14snap(key) → NON-PERSONAL values of the current page:
// config forms (name=value), counts, amounts, tiers, levels, dates, colour tokens, live record ids (transaction #ids, tier /
// challenge / badge / reward / request ids from form actions). Person names, e-mails, avatars, bank account numbers and
// account-holder names are never read into the result: a person is replaced by a positional token "<student:{rank}>" /
// "<teacher:{rank}>"; school names by "<school:{n}>" (n = order of first appearance on the page).
// Nothing is clicked or submitted. Usage (Playwright): addScriptTag(this file) then page.evaluate(k => window.__m14snap(k), key).
(function () {
  function T(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
  function N(s) { var v = T(s).replace(/[^\d.\-]/g, ''); return v === '' ? null : +v; }
  function main() { return document.querySelector('main'); }
  function forms() {
    return Array.from(main().querySelectorAll('form')).map(function (f) {
      var o = { action: (f.getAttribute('action') || '').replace(/^https?:\/\/[^/]+/, ''), method: T((f.querySelector('[name=_method]') || {}).value || f.method).toUpperCase(), fields: {} };
      Array.from(f.elements).forEach(function (e) {
        if (!e.name || e.name === '_token' || e.name === '_method') return;
        if (/^(user_id|bank_account|account_holder|admin_note|search)$/.test(e.name)) { o.fields[e.name] = e.value ? '<value>' : ''; return; }
        o.fields[e.name] = e.type === 'checkbox' ? e.checked : e.value;
      });
      return o;
    });
  }
  function pager() { var p = main().querySelector('nav[role=navigation] p'); return p ? T(p.textContent) : null; }
  var schools = {};
  function school(s) { s = T(s); if (!s) return s; if (!(s in schools)) schools[s] = Object.keys(schools).length + 1; return '<school:' + schools[s] + '>'; }
  var C = {};
  C.overview = function () {
    var m = main(), cards = {};
    m.querySelectorAll('.gami-stat-card').forEach(function (c) { cards[T(c.querySelector('.text-xs').textContent)] = T(c.querySelector('.text-2xl').textContent); });
    var tiers = Array.from(m.querySelectorAll('.tier-dist-bar')).map(function (b) { var row = b.closest('.mb-3'); return { tier: T(row.querySelector('.w-20').textContent), count: N(b.textContent), width: b.style.width, bg: b.style.background, pct: T(row.querySelector('.w-12').textContent) }; });
    var top = Array.from(m.querySelectorAll('.section-card .space-y-2 > div')).filter(function (d) { return d.querySelector('.text-amber-600'); }).map(function (d, i) { var sub = d.querySelector('.text-xs.capitalize') || d.querySelector('.text-xs'); return { rank: T(d.children[0].textContent), student: '<student:' + (i + 1) + '>', sub: T(sub ? sub.textContent : ''), syiling: T(d.querySelector('.text-amber-600').textContent) }; });
    var tx = Array.from(m.querySelectorAll('tbody tr')).map(function (tr) { var td = tr.children; return { student: '<student>', type: T(td[1].textContent), amount: T(td[2].textContent), amountClass: td[2].className, source: T(td[3].textContent), time: T(td[4].textContent) }; });
    return { cards: cards, tierDistribution: tiers, top10: top, recentTransactions: tx };
  };
  C.forms = function () { return { forms: forms() }; };
  C.students = function () {
    var rows = Array.from(main().querySelectorAll('tbody tr')).map(function (tr) { var td = tr.children; if (td.length < 7) return { empty: T(tr.textContent) };
      var b = td[1].querySelector('.tier-badge'); return { idLine: T(td[0].querySelector('.text-xs').textContent).replace(/^.*·/, '·'), tier: T(b.textContent), tierStyle: b.getAttribute('style'), level: N(td[2].textContent), syiling: N(td[3].textContent), token: N(td[4].textContent), jumlahSyiling: N(td[5].textContent), xp: N(td[6].textContent) }; });
    return { url: location.pathname + location.search, pager: pager(), rows: rows, empty: T((main().querySelector('tbody td[colspan]') || {}).textContent || '') };
  };
  C.transactions = function () {
    var rows = Array.from(main().querySelectorAll('tbody tr')).map(function (tr) { var td = tr.children; if (td.length < 8) return { empty: T(tr.textContent) };
      return { id: T(td[0].textContent), idLine: T(td[1].querySelector('.text-xs').textContent), type: T(td[2].textContent), typeClass: td[2].querySelector('span').className, amount: T(td[3].textContent), amountClass: td[3].className, balanceAfter: T(td[4].textContent), source: T(td[5].textContent), description: T(td[6].textContent), date: T(td[7].textContent) }; });
    return { url: location.pathname + location.search, pager: pager(), rows: rows };
  };
  C.guruAdmin = function () {
    var m = main(), cards = {};
    m.querySelectorAll('.grid > .card').forEach(function (c) { cards[T(c.children[1].textContent)] = T(c.children[0].textContent); });
    var badges = Array.from(m.querySelectorAll('tbody[x-data]')).map(function (tb) { var td = tb.querySelector('tr').children, f = tb.querySelector('form');
      return { id: N((f.getAttribute('action').match(/lencana\/(\d+)/) || [])[1]), name: T(td[0].textContent), icon: td[1].querySelector('i').className, threshold: T(td[2].textContent), bonus: T(td[3].textContent), status: T(td[4].textContent), statusClass: td[4].querySelector('span').className }; });
    return { cards: cards, tunaiBadge: T((m.querySelector('a[href$="/guru/tunai"] span') || {}).textContent || ''), badges: badges, katalogHeading: T(m.querySelectorAll('.card h2')[1].textContent), empty: T((m.querySelector('.text-center.py-8 p') || {}).textContent || '') };
  };
  C.tebusan = function () { var m = main(); return { url: location.pathname + location.search, tabs: Array.from(m.querySelectorAll('a[href*="status="]')).map(function (a) { return T(a.textContent) + ' [' + (/bg-indigo-600/.test(a.className) ? 'active' : 'inactive') + ']'; }), rows: m.querySelectorAll('tbody tr').length, empty: T((m.querySelector('.card p') || {}).textContent || '') }; };
  C.tunai = function () {
    var m = main(), cards = {};
    m.querySelectorAll('.grid > .card').forEach(function (c) { cards[T(c.children[1].textContent)] = T(c.children[0].textContent); });
    var rows = Array.from(m.querySelectorAll('tbody tr')).map(function (tr, i) { var td = tr.children; if (td.length < 7) return { empty: T(tr.textContent) };
      var f = td[6].querySelector('form');
      return { teacher: '<teacher:' + (i + 1) + '>', requestId: f ? N((f.getAttribute('action').match(/tunai\/(\d+)/) || [])[1]) : null, syiling: T(td[1].textContent), tunai: T(td[2].textContent), bank: T((td[3].querySelector('div') || {}).textContent || ''), accountNo: '<masked>', holder: '<masked>', status: T(td[4].textContent), statusClass: (td[4].querySelector('span') || {}).className, date: T(td[5].textContent), statusOptions: f ? Array.from(f.querySelectorAll('select option')).map(function (o) { return o.value; }) : [] }; });
    return { url: location.pathname + location.search, cards: cards, tabs: Array.from(m.querySelectorAll('a[href^="?status"]')).map(function (a) { return T(a.textContent) + ' [' + (/bg-blue-600/.test(a.className) ? 'active' : 'inactive') + ']'; }), rows: rows, empty: T((m.querySelector('tbody td[colspan], .card .text-center p') || {}).textContent || '') };
  };
  C.rewardControl = function () {
    var m = main(), cards = {};
    m.querySelectorAll('.space-y-8 > .grid:first-child > div').forEach(function (c) { cards[T(c.children[0].textContent)] = T(c.children[1].textContent) + (c.children[2] ? ' | ' + T(c.children[2].textContent) : ''); });
    var rewards = Array.from(m.querySelectorAll('section:nth-of-type(2) tbody tr')).map(function (tr) { var td = tr.children, f = td[3].querySelector('form');
      return { id: N((f.getAttribute('action').match(/reward\/(\d+)/) || [])[1]), hadiah: T(td[0].textContent), jenis: T(td[1].textContent), hargaSyiling: T(td[2].textContent), kosSen: f.querySelector('input[name=cost_value_sen]').value, rm: T(f.querySelector('span').textContent) }; });
    return { cards: cards, forms: forms(), rewards: rewards, draws: Array.from(m.querySelectorAll('section:nth-of-type(3) tbody tr')).map(function (tr) { return T(tr.textContent); }) };
  };
  C.text = function (sel) { return { text: T((document.querySelector(sel || 'main') || {}).innerText || '') }; };
  C.leaderboard = function () {
    var m = main();
    var top = Array.from(m.querySelectorAll('.lb-top-card')).map(function (c, i) { var d = c.querySelectorAll('.text-xs'); return { card: c.className, medal: T(c.querySelector('.lb-medal').textContent), student: '<student:' + (i + 1) + '>', syiling: T(d[0].textContent), tier: T(d[1].textContent) }; });
    var rows = Array.from(m.querySelectorAll('.lb-row')).map(function (r) { return { rowClass: r.className, rank: T(r.querySelector('.lb-rank').textContent), student: '<student:' + T(r.querySelector('.lb-rank').textContent).replace('#', '') + '>', titleLevel: T(r.querySelector('.text-xs').textContent), syiling: T(r.querySelector('.text-right .font-bold').textContent), tierEmoji: T(r.querySelector('.text-lg').textContent) }; });
    return { top3: top, rows: rows };
  };
  C.achievements = function () {
    var m = main();
    var b = Array.from(m.querySelectorAll('.badge-card')).map(function (c) { var p = c.querySelector('.progress-mini-fill');
      return { cls: c.className, rarityColor: c.style.getPropertyValue('--rarity-color'), icon: T(c.querySelector('.badge-icon').textContent), name: T(c.querySelector('.badge-name').textContent), desc: T(c.querySelector('.badge-desc').textContent), rarity: T(c.querySelector('.rarity-tag').textContent), rarityClass: c.querySelector('.rarity-tag').className, reward: T(c.querySelector('.badge-reward').textContent), progress: p ? { width: p.style.width, label: T(p.parentElement.nextElementSibling.textContent) } : null, onclick: c.getAttribute('onclick') ? 'openShareCard(…)' : null }; });
    return { url: location.pathname + location.search, hero: T(m.querySelector('.achieve-hero').textContent), streak: T(m.querySelector('.streak-card').textContent), pills: Array.from(m.querySelectorAll('a[href*="achievements"]')).map(function (a) { return T(a.textContent) + ' [' + (/bg-purple-600/.test(a.className) ? 'active' : 'inactive') + ']'; }), badges: b };
  };
  C.guruLeaderboard = function () {
    var m = main(), th = Array.from(m.querySelectorAll('thead th')).map(function (x) { return T(x.textContent); });
    var si = th.indexOf('Sekolah');
    var rows = Array.from(m.querySelectorAll('tbody tr')).map(function (tr, i) { var td = tr.children; var o = { rank: T(td[0].textContent), teacher: '<teacher:' + (i + 1) + '>', rowClass: tr.className.trim() };
      if (si >= 0) o.school = school(td[si].textContent); o.soalan = T(td[th.indexOf('Soalan')].textContent); o.syiling = T(td[th.indexOf('Syiling')].textContent); return o; });
    return { url: location.pathname + location.search, tabs: Array.from(m.querySelectorAll('a[href*="tab="]')).map(function (a) { return T(a.textContent) + ' [' + (/bg-indigo-600/.test(a.className) ? 'active' : 'inactive') + ']'; }), columns: th, rows: rows, empty: T((m.querySelector('tbody td[colspan]') || {}).textContent || '') };
  };
  C.header = function () { return { chips: Array.from(document.querySelectorAll('[id^=jb-]')).map(function (e) { return e.id + '=' + T(e.textContent); }) }; };
  window.__m14snap = function (k, a) { schools = {}; return C[k](a); };
})();
