// M11 helper (read-only): window.__m11compact(keep) returns a compact, masked outerHTML of <main>:
// repeated sibling runs (same tag+class, > keep+1 items) are cut to `keep` items plus a "<!-- +N more -->" marker;
// <svg> bodies dropped; school names, person names (text before an e-mail, bin/binti/A/P/A/L), e-mails, avatar URLs
// and person-record ids are masked. Used only to read page structure during discovery; nothing is submitted.
(function () {
  var SCH = /\b(SEKOLAH (MENENGAH |KEBANGSAAN |JENIS |AGAMA |RENDAH |SENI |SUKAN |BERASRAMA )[A-Z0-9 ()'.@&\/-]*[A-Z0-9)]|SMK [A-Za-z][A-Za-z0-9 ()'.@-]*[A-Za-z0-9)]|SJKC? ?\(?[CT]?\)? [A-Z][A-Z0-9 ()'.-]*[A-Z0-9)]|SK [A-Z][A-Z0-9 ()'.-]*[A-Z0-9)]|SAM [A-Z][A-Z0-9 ()'.-]*[A-Z0-9)]|KOLEJ [A-Z][A-Z0-9 ()'.-]*[A-Z0-9)]|MAKTAB [A-Z][A-Z0-9 ()'.-]*[A-Z0-9)]|SBP [A-Z][A-Z0-9 ()'.-]*[A-Z0-9)]|MRSM [A-Z][A-Z0-9 ()'.-]*[A-Z0-9)])/g;
  window.__m11compact = function (keep, rootSel, minRun) {
    keep = keep || 2; minRun = minRun || 6;
    var src = document.querySelector(rootSel || 'main') || document.body;
    var root = src.cloneNode(true);
    root.querySelectorAll('svg').forEach(function (s) { s.innerHTML = ''; });
    var tb = root.querySelector('[x-data="tournamentBanner()"]'); if (tb) { var nx = tb.nextElementSibling; tb.remove(); if (nx && nx.tagName === 'SCRIPT') nx.remove(); }
    // collapse repeated runs
    (function walk(el, depth) {
      var kids = Array.from(el.children), i = 0;
      while (i < kids.length) {
        var k = kids[i], j = i + 1;
        while (j < kids.length && kids[j].tagName === k.tagName) j++;
        var n = j - i;
        if (n >= minRun && depth > 1 && k.tagName !== 'OPTION' && k.tagName !== 'TH') {
          var seen = {}, kept = 0, removed = 0;
          for (var x = i; x < j; x++) {
            var cls = (kids[x].getAttribute('class') || '') + '|' + (kids[x].getAttribute('style') || '').replace(/[0-9.]+/g, '');
            if (kept < keep || (!seen[cls] && Object.keys(seen).length < 6)) { seen[cls] = 1; kept++; }
            else { kids[x].remove(); removed++; }
          }
          if (removed) el.insertBefore(document.createComment(' +' + removed + ' more ' + k.tagName.toLowerCase() + ' (of ' + n + ') '), kids[j] || null);
        }
        i = j;
      }
      Array.from(el.children).forEach(function (c) { walk(c, depth + 1); });
    })(root, 0);
    // mask
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), t, list = [];
    while ((t = w.nextNode())) list.push(t);
    list = list.filter(function (x) { return x.nodeValue.trim() && !(x.parentNode && /SCRIPT|STYLE/.test(x.parentNode.tagName)); });
    list.forEach(function (x, k) {
      var v = x.nodeValue;
      if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(v)) { x.nodeValue = v.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig, '<email>'); if (k > 0 && !/<email>/.test(list[k - 1].nodeValue)) list[k - 1].nodeValue = '<name>'; }
    });
    list.forEach(function (x) {
      var v = x.nodeValue;
      if (/\b(BIN|BINTI|bin|binti|A\/P|A\/L|a\/p|a\/l)\b/.test(v)) v = '<name>';
      v = v.replace(SCH, '<school>').replace(/\bPPD [A-Z][A-Za-z ]+[A-Za-z]/g, 'PPD <ppd>');
      x.nodeValue = v;
    });
    root.querySelectorAll('a[href*="/sekolah/"]').forEach(function (a) { if (a.children.length === 0 && a.textContent.trim()) a.textContent = '<school>'; });
    root.querySelectorAll('img').forEach(function (im) { var s = im.getAttribute('src') || ''; if (/ui-avatars|storage|avatar/.test(s)) im.setAttribute('src', '<avatar>'); if (im.alt) im.setAttribute('alt', '<alt>'); });
    root.querySelectorAll('*').forEach(function (e) { Array.from(e.attributes).forEach(function (a) { if (/^(title|alt|onclick|@click|x-data|data-name|aria-label)$/.test(a.name)) { var nv = a.value.replace(SCH, '<school>'); if (nv !== a.value) e.setAttribute(a.name, nv); } }); });
    var h = root.outerHTML.replace(/\n\s*\n/g, '\n').replace(/[ \t]{2,}/g, ' ');
    return h;
  };
})();
