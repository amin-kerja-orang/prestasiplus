// M13 read-only layout probe (Cikgu Alesa). Inject with page.addScriptTag({path}) and call window.__m13probe().
// Returns: page overflow, sub-12px text in <main> (computed font-size), key control boxes, clipped grid items.
// Reads the DOM only: no click, no submit, no storage write. No person names are returned (text is truncated
// to 50 chars and only UI copy of <main> is read; the sidebar/shell is skipped).
(function () {
  function txt(el) { return (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 50); }
  window.__m13probe = function () {
    var main = document.querySelector('main') || document.body;
    var out = { url: location.pathname + location.search, w: innerWidth, scrollW: document.documentElement.scrollWidth,
      overflow: document.documentElement.scrollWidth > innerWidth, small: [], boxes: [], clipped: [] };
    // sub-12px text (own text nodes only, visible)
    var seen = {};
    main.querySelectorAll('*').forEach(function (el) {
      var own = '';
      for (var c = el.firstChild; c; c = c.nextSibling) if (c.nodeType === 3) own += c.nodeValue;
      own = own.replace(/\s+/g, ' ').trim();
      if (!own) return;
      var r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return;
      var fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs < 12) { var k = fs + '|' + own.slice(0, 40); if (!seen[k]) { seen[k] = 1; out.small.push(fs + 'px: ' + own.slice(0, 50)); } }
    });
    // key controls
    main.querySelectorAll('input:not([type=hidden]),select,textarea,button,a.px-4,a.px-3,a.px-5,a[href*="/cikgu"]').forEach(function (el) {
      var r = el.getBoundingClientRect(); if (r.width < 1) return;
      var cs = getComputedStyle(el);
      out.boxes.push([el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.name ? '[' + el.name + ']' : ''), txt(el) || el.getAttribute('placeholder') || '',
        Math.round(r.x) + ',' + Math.round(r.y) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height), cs.fontSize, cs.color, cs.backgroundColor, cs.backgroundImage !== 'none' ? 'gradient' : ''].join(' | '));
    });
    // clipped: element wider than its scroll parent or overflowing the viewport
    main.querySelectorAll('table, .grid, form, pre, section, header').forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (el.scrollWidth > el.clientWidth + 1 || r.right > innerWidth + 1) out.clipped.push(el.tagName.toLowerCase() + '.' + String(el.className).slice(0, 40) + ' scrollW=' + el.scrollWidth + ' clientW=' + el.clientWidth + ' right=' + Math.round(r.right));
    });
    return out;
  };
})();
