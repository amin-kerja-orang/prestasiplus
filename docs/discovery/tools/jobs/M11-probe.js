// M11 structural probe (read-only). Defines window.__m11probe() -> structure only: headings, forms (method/action,
// fields, option counts + option texts of non-person selects), links (ids normalised), buttons, table headers,
// row counts, x-data roots, inline-script summaries (Chart.js configs, fetch URLs). Table body cell text is NOT returned.
(function () {
  function c(s) { return String(s || '').replace(/\s+/g, ' ').trim().slice(0, 160); }
  function nid(h) { return String(h || '').replace(/^https?:\/\/[^/]+/, '').replace(/\/(\d+)(?=$|[/?#])/g, '/{n}').replace(/=(\d+)/g, '={n}'); }
  window.__m11probe = function (o) {
    o = o || {};
    var main = document.querySelector('main') || document.body;
    var r = { url: location.pathname + location.search, title: document.title, overflow: document.documentElement.scrollWidth - innerWidth };
    r.h = Array.from(main.querySelectorAll('h1,h2,h3,h4')).map(function (e) { return e.tagName + ':' + c(e.textContent); }).slice(0, 80);
    r.forms = Array.from(main.querySelectorAll('form')).map(function (f) {
      return { m: f.getAttribute('method'), a: nid(f.getAttribute('action')), fields: Array.from(f.elements).map(function (e) {
        var x = { t: e.tagName.toLowerCase() + ':' + (e.type || ''), n: e.name, id: e.id };
        if (e.tagName === 'SELECT') { x.opts = e.options.length; if (!/student|pelajar|user/i.test(e.name)) x.o = Array.from(e.options).slice(0, 40).map(function (op) { return op.value + '=' + c(op.text); }); x.sel = e.value; }
        if (e.placeholder) x.ph = e.placeholder; if (e.required) x.req = 1; if (e.getAttribute('onchange')) x.oc = e.getAttribute('onchange');
        return x; }) };
    });
    r.selectsOutsideForm = Array.from(main.querySelectorAll('select')).filter(function (s) { return !s.form; }).map(function (e) {
      return { n: e.name, xm: e.getAttribute('x-model'), ch: e.getAttribute('@change') || e.getAttribute('onchange'), opts: e.options.length, o: Array.from(e.options).slice(0, 40).map(function (op) { return op.value + '=' + c(op.text); }) };
    });
    var hrefs = {}; Array.from(main.querySelectorAll('a[href]')).forEach(function (a) { var k = nid(a.getAttribute('href')); var t = a.closest('tbody') ? '(row)' : c(a.textContent).slice(0, 50); hrefs[k] = hrefs[k] || { n: 0, t: t }; hrefs[k].n++; });
    r.links = hrefs;
    var btns = {}; Array.from(main.querySelectorAll('button,[role=button]')).forEach(function (b) { var k = c(b.textContent).slice(0, 60) + ' {' + (b.getAttribute('@click') || b.getAttribute('onclick') || b.type || '') .slice(0, 80) + '}'; btns[k] = (btns[k] || 0) + 1; });
    r.buttons = btns;
    r.tables = Array.from(main.querySelectorAll('table')).map(function (t) { return { th: Array.from(t.querySelectorAll('thead th')).map(function (x) { return c(x.textContent); }), rows: t.querySelectorAll('tbody tr').length }; });
    r.xdata = Array.from(main.querySelectorAll('[x-data]')).slice(0, 15).map(function (e) { return c(e.getAttribute('x-data')).slice(0, 160); });
    r.canvas = Array.from(document.querySelectorAll('canvas')).map(function (e) { return e.id || e.className; });
    r.scripts = Array.from(document.querySelectorAll('script:not([src])')).map(function (s) { return s.textContent; }).filter(function (t) { return /Chart|fetch\(|axios|function\s+\w+\(|Alpine\.data/.test(t) && !/chatbot|fcm|firebase|tournament/i.test(t.slice(0, 400)); }).map(function (t) { return t.length; });
    r.srcScripts = Array.from(document.querySelectorAll('script[src]')).map(function (s) { return s.src.replace(/^https?:\/\/[^/]+/, ''); }).filter(function (s) { return !/googletag|gtag|firebase/.test(s); });
    r.cards = o.cards ? Array.from(main.querySelectorAll(o.cards)).slice(0, 30).map(function (e) { return c(e.textContent); }) : undefined;
    r.empty = Array.from(main.querySelectorAll('p,div')).filter(function (e) { return !e.children.length && /tiada|belum|kosong|tidak/i.test(e.textContent); }).map(function (e) { return c(e.textContent); }).slice(0, 20);
    r.shell = { adminSidebar: !!document.querySelector('aside a[href="/admin"]'), header: c((document.querySelector('header h1, header h2') || {}).textContent) };
    return r;
  };
})();
