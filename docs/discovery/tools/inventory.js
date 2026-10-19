/*
 * PrestasiPlus discovery — page element inventory (reusable for all modules).
 *
 * Runs INSIDE the page. Defines window.__inventory(opts) which returns a JSON-serialisable
 * object describing every element of interest on the current page — visible AND hidden
 * (display:none, x-show, x-cloak, [hidden], closed <details>, <template> content).
 *
 * Recommended workflow (Playwright MCP; the MCP code runner has no fs access, so files are
 * injected by Playwright itself via addScriptTag({path})):
 *   1. Write the capture plan: tools/jobs/<Mxx>.js sets window.__<Mxx>_JOBS = [job, ...] where
 *        job = { group, file: '<S#>-<screen>__<state>__<width>', guest: bool (cookie-less context),
 *                url, width (default 1280), actions: [...], opts: {prefix:'EL-<Mxx>-<S#>', state, repeat, mask} }
 *        actions (client-side reveals only): {click|hover|check: sel} {fill|type: [sel, text]}
 *                {select: [sel, value]} {press: key} {eval: 'js expr'} {wait: ms}
 *   2. browser_run_code_unsafe: async (page) => page.addScriptTag({ path: '<abs>/tools/jobs/<Mxx>.js' })
 *      browser_evaluate: () => { window.__jobs = window.__<Mxx>_JOBS.filter(j => j.group === 'A') }
 *   3. browser_run_code_unsafe { filename: tools/run-state.js } — runs each job in a worker tab
 *      (guest context or the logged-in context), injects THIS file, stores results in window.__invs.
 *   4. browser_evaluate { function: () => window.__invs, filename: inventory/_raw/<Mxx>/_batch.json }
 *      node tools/split-batch.js inventory/_raw/<Mxx>/_batch.json   (one raw file per state)
 *   5. node tools/merge-inventory.js <Mxx> tools/jobs/<Mxx>.screens.json
 *      → inventory/<Mxx>/<S#-key>.json (final EL-<Mxx>-<S#>-nnn IDs, per-state presence,
 *        conditional / hidden-only / mobile-only flags), shell files, and _crawl.json (module-classified URLs).
 *   6. node tools/diff-narrative.js inventory/<Mxx> <narrative.md>  → strings the narrative doc lacks.
 *   Helpers: tools/view.js (raw file), tools/view-merged.js (merged file).
 *
 * Ad-hoc use: paste the whole file into browser_evaluate as
 *   () => { <file contents>; return window.__inventory({...}); }
 *
 * opts:
 *   prefix     string   ID prefix, e.g. 'EL-M01-S1' (IDs = prefix-001, -002 … in DOM order)
 *   state      string   free label of the UI state captured (e.g. 'role=teacher')
 *   repeat     {selector: keepN}  repeated list items (rows, cards): only the first keepN are
 *                        inventoried; total count reported in meta.repeats
 *   mask       [selector]  descendant text of these nodes is replaced with '<masked>'
 *   redact     [string]    literal strings replaced with '<redacted>' everywhere
 *   contentRoot string  selector of the page's content region (default 'main'); elements
 *                        outside it are tagged region:'shell' (layout chrome) when it exists
 *   includeText bool   include plain static text nodes as kind 'text' (default true)
 *   maxText    number   truncate text to this many chars (default 300)
 *
 * Privacy: input VALUES are never returned (only valueType: empty / filled / number / token).
 *          Emails and long digit runs in text are replaced by <email> / <digits>.
 */
(function () {
  'use strict';

  function inventory(opts) {
    opts = opts || {};
    var prefix = opts.prefix || 'EL';
    var maxText = opts.maxText || 300;
    var includeText = opts.includeText !== false;
    var redact = opts.redact || [];
    var contentRoot = document.querySelector(opts.contentRoot || 'main');

    // ---------- helpers ----------
    function clean(s) {
      if (s == null) return '';
      s = String(s).replace(/\s+/g, ' ').trim();
      s = s.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '<email>');
      s = s.replace(/\b\d{7,}\b/g, function (m) { return '<digits:' + m.length + '>'; });
      for (var i = 0; i < redact.length; i++) if (redact[i]) s = s.split(redact[i]).join('<redacted>');
      if (s.length > maxText) s = s.slice(0, maxText) + '…';
      return s;
    }
    function attr(el, n) { var v = el.getAttribute && el.getAttribute(n); return v == null ? undefined : v; }
    function trunc(s, n) { s = String(s); return s.length > n ? s.slice(0, n) + '…' : s; }

    var maskSel = (opts.mask || []).join(',');
    function isMasked(el) { return maskSel && el.closest && el.closest(maskSel); }
    function textOf(el) {
      if (isMasked(el)) return '<masked>';
      var t = el.textContent || '';
      return clean(t);
    }
    function ownText(el) {
      var s = '';
      for (var c = el.firstChild; c; c = c.nextSibling) if (c.nodeType === 3) s += c.nodeValue;
      s = s.replace(/\s+/g, ' ').trim();
      if (!s) return '';
      return isMasked(el) ? '<masked>' : clean(s);
    }
    function iconOf(el) {
      var i = el.matches && el.matches('i,svg,span[class*="fa-"]') ? el : el.querySelector && el.querySelector('i[class*="fa-"], svg, span[class*="fa-"]');
      if (!i) return undefined;
      if (i.tagName.toLowerCase() === 'svg') return 'svg' + (attr(i, 'data-lucide') ? ':' + attr(i, 'data-lucide') : '');
      var cls = (i.getAttribute('class') || '').split(/\s+/).filter(function (c) {
        return /^fa-/.test(c) && !/^fa-(solid|regular|brands|light|thin|duotone|fw|lg|xs|sm|xl|2x|3x|4x|5x|spin|pulse)$/.test(c);
      });
      return cls.join(' ') || undefined;
    }
    function alpineAttrs(el) {
      var o = null;
      for (var i = 0; i < el.attributes.length; i++) {
        var a = el.attributes[i], n = a.name;
        if (/^(x-|@|:|on[a-z]+$)/.test(n) && n !== 'x-cloak' && !/^:(class|style)$/.test(n) && n !== 'x-bind:class') {
          (o = o || {})[n] = trunc(a.value, 240);
        }
      }
      return o;
    }
    function visInfo(el, inTemplate) {
      if (inTemplate) return { visible: false, hiddenBy: ['template:' + inTemplate] };
      var reasons = [], showWhen = null;
      for (var a = el; a && a.nodeType === 1 && a !== document.documentElement; a = a.parentElement) {
        var cs = getComputedStyle(a);
        if (a.hasAttribute('x-cloak')) reasons.push('x-cloak');
        if (cs.display === 'none') {
          reasons.push(a.hasAttribute('x-show') ? 'x-show' : (a.hidden ? 'hidden-attr' : 'display:none'));
        }
        if (a === el && cs.visibility === 'hidden') reasons.push('visibility:hidden');
        if (a === el && parseFloat(cs.opacity) === 0) reasons.push('opacity:0');
        if (a !== el && a.tagName === 'DETAILS' && !a.open) {
          var sum = el.closest('summary');
          if (!(sum && sum.parentElement === a)) reasons.push('closed-details');
        }
        if (!showWhen && a.hasAttribute('x-show')) showWhen = a.getAttribute('x-show');
      }
      var r = el.getBoundingClientRect();
      if (!reasons.length && r.width <= 1 && r.height <= 1 && getComputedStyle(el).display !== 'contents') {
        var cs2 = getComputedStyle(el);
        if (cs2.position === 'absolute' && (cs2.clip !== 'auto' || cs2.overflow === 'hidden')) reasons.push('sr-only');
        else if (el.tagName !== 'INPUT' || el.type !== 'hidden') reasons.push('zero-size');
      }
      // off-canvas (e.g. drawer translated -100%): entirely outside the viewport horizontally
      if (!reasons.length && (r.width > 0 || r.height > 0) && (r.right <= 0 || r.left >= Math.max(innerWidth, document.documentElement.scrollWidth))) {
        var inScroller = false;
        for (var sa = el.parentElement; sa && sa !== document.body; sa = sa.parentElement) {
          var ox = getComputedStyle(sa).overflowX;
          if ((ox === 'auto' || ox === 'scroll') && sa.scrollWidth > sa.clientWidth) { inScroller = true; break; }
        }
        if (!inScroller) reasons.push('offscreen');
      }
      var o = { visible: reasons.length === 0 };
      if (reasons.length) o.hiddenBy = Array.from(new Set(reasons));
      if (showWhen) o.showWhen = trunc(showWhen, 200);
      return o;
    }
    function region(el) {
      if (!contentRoot) return 'page';
      if (el.isConnected && contentRoot.contains(el)) return 'content';
      return el.isConnected ? 'shell' : 'template';
    }
    var LANDMARK = 'header,nav,aside,main,footer,form,dialog,[role=dialog],[role=navigation],section,[role=tablist],table';
    function landmark(el) {
      var l = el.parentElement && el.parentElement.closest(LANDMARK);
      if (!l) return undefined;
      var s = l.tagName.toLowerCase();
      if (l.id) s += '#' + l.id;
      var cls = (l.getAttribute('class') || '').split(/\s+/).filter(function (c) { return /^(sidebar|topbar|bottom|drawer|modal|card)/.test(c); });
      if (cls.length) s += '.' + cls[0];
      if (l.getAttribute('aria-label')) s += '[' + l.getAttribute('aria-label') + ']';
      return s;
    }
    function labelFor(el) {
      if (el.getAttribute('aria-label')) return clean(el.getAttribute('aria-label'));
      if (el.getAttribute('aria-labelledby')) {
        var lb = document.getElementById(el.getAttribute('aria-labelledby'));
        if (lb) return textOf(lb);
      }
      if (el.labels && el.labels.length) return textOf(el.labels[0]);
      var p = el.parentElement;
      for (var d = 0; p && d < 3; d++, p = p.parentElement) {
        var ctrls = p.querySelectorAll('input:not([type=hidden]),select,textarea');
        if (ctrls.length > 1) break;
        var l = p.querySelector('label');
        if (l) return textOf(l);
      }
      return undefined;
    }
    function valueType(el) {
      var v = el.value;
      if (el.type === 'hidden' && el.name === '_token') return 'csrf-token';
      if (el.type === 'hidden' && el.name === '_method') return 'literal:' + v;
      if (v == null || v === '') return 'empty';
      if (/^\d+$/.test(v)) return 'filled:number';
      return 'filled';
    }

    // ---------- classification ----------
    var claimed = new WeakSet();
    function underClaimed(el) {
      for (var a = el.parentElement; a; a = a.parentElement) if (claimed.has(a)) return true;
      return false;
    }
    var BTNCLS = /\b(btn|button)\b/i;
    function isRepeatHidden(el) { return repeatSkip.has(el) || (function () { for (var a = el.parentElement; a; a = a.parentElement) if (repeatSkip.has(a)) return true; return false; })(); }

    // repeated items
    var repeatSkip = new WeakSet(), repeats = {};
    Object.keys(opts.repeat || {}).forEach(function (sel) {
      var keep = opts.repeat[sel], list = document.querySelectorAll(sel);
      repeats[sel] = list.length;
      for (var i = keep; i < list.length; i++) repeatSkip.add(list[i]);
    });

    var elements = [], alpine = [], seq = 0, lastHeading = null;
    function push(el, o, inTemplate) {
      o.id = prefix + '-' + String(++seq).padStart(3, '0');
      var v = visInfo(el, inTemplate);
      if (o.kind === 'hidden-field') v = { visible: false, hiddenBy: ['type=hidden'] };
      o.visible = v.visible;
      if (v.hiddenBy) o.hiddenBy = v.hiddenBy;
      if (v.showWhen) o.showWhen = v.showWhen;
      o.region = inTemplate ? (templateRegion || 'template') : region(el);
      var lm = landmark(el); if (lm) o.landmark = lm;
      if (lastHeading && o.kind !== 'heading') o.section = lastHeading;
      var ax = alpineAttrs(el); if (ax) o.alpine = ax;
      if (el.getAttribute('title')) o.title = clean(el.getAttribute('title'));
      if (el.getAttribute('role')) o.role = el.getAttribute('role');
      if (el.getAttribute('aria-label')) o.ariaLabel = clean(el.getAttribute('aria-label'));
      if (el.id) o.domId = el.id;
      // key for cross-state merging (no DOM path so it is stable when x-if re-renders)
      // identity text: prefer Alpine expressions (stable) over rendered, data-dependent text
      var idText = (ax && ax['x-text']) ? 'x-text:' + ax['x-text'] : (ax && ax['x-show'] && /^(card|modal|text|empty-state)$/.test(o.kind)) ? 'x-show:' + ax['x-show'] : (o.text || o.label || o.placeholder || '');
      o.key = [o.kind, o.tag, o.name || '', o.href || '', o.action || '', idText.slice(0, 80), o.landmark || ''].join('|');
      elements.push(o);
    }

    function classify(el, inTemplate) {
      var tag = el.tagName.toLowerCase();
      if (/^(script|style|noscript|link|meta|head|title|br|hr|path|g|circle|rect|line|polyline|polygon|defs|use|symbol|clippath|lineargradient|stop)$/.test(tag)) return;
      if (isRepeatHidden(el)) return;
      var role = el.getAttribute('role') || '';
      var cls = el.getAttribute('class') || '';
      var o = null;

      if (/^h[1-6]$/.test(tag)) {
        o = { kind: 'heading', tag: tag, level: +tag[1], text: textOf(el) };
        lastHeading = o.text.slice(0, 120);
        claimed.add(el);
      } else if (tag === 'form') {
        var m = el.querySelector('input[name=_method]');
        o = { kind: 'form', tag: tag, action: attr(el, 'action'), method: (attr(el, 'method') || 'GET').toUpperCase(),
              spoofedMethod: m ? m.value : undefined, enctype: attr(el, 'enctype'),
              fields: Array.from(el.elements || []).map(function (f) { return f.name; }).filter(Boolean) };
      } else if (tag === 'a' && el.hasAttribute('href')) {
        var href = el.getAttribute('href');
        var kind = 'link';
        if (role === 'tab' || el.closest('[role=tablist]')) kind = 'tab';
        else if (role === 'menuitem') kind = 'menuitem';
        else if (el.closest('.pagination,nav[aria-label*="agination" i],nav[role=navigation]') || /[?&]page=\d+/.test(href) || el.rel === 'next' || el.rel === 'prev') kind = 'pagination';
        else if (/[?&](filter|type|status|tab|sort|q|search|category|kategori)=/.test(href) || /^\?/.test(href)) kind = 'filter';
        o = { kind: kind, tag: tag, text: textOf(el), href: href, absHref: el.href, target: attr(el, 'target'), icon: iconOf(el) };
        if (!o.text) o.iconOnly = true;
        claimed.add(el);
      } else if (tag === 'button' || role === 'button' || (tag === 'input' && /^(submit|button|reset|image)$/.test(el.type)) || (tag === 'summary')) {
        var kind2 = tag === 'summary' ? 'accordion-trigger' : 'button';
        var ax = alpineAttrs(el) || {};
        var click = ax['@click'] || ax['x-on:click'] || ax['onclick'] || '';
        if (el.hasAttribute('aria-expanded') || el.hasAttribute('aria-haspopup') || /\b(open|dropdown|menu)\w*\s*=\s*!/i.test(click)) kind2 = 'dropdown-trigger';
        else if (/(\w+)\s*=\s*!\s*\1\b/.test(click) || /toggle/i.test(click)) kind2 = 'toggle';
        if (role === 'tab' || el.closest('[role=tablist]') || /\btab\w*\s*=\s*['"]/.test(click)) kind2 = 'tab';
        if (role === 'menuitem') kind2 = 'menuitem';
        o = { kind: kind2, tag: tag, type: el.type || attr(el, 'type'), text: tag === 'input' ? clean(el.value) : textOf(el),
              icon: iconOf(el), disabled: el.disabled || undefined, form: el.form ? (el.form.getAttribute('action') || '(no action)') : undefined };
        if (!o.text) o.iconOnly = true;
        claimed.add(el);
      } else if ((el.hasAttribute('@click') || el.hasAttribute('x-on:click') || el.hasAttribute('onclick') || el.hasAttribute('@click.prevent') || el.hasAttribute('@click.stop')) && !/^(input|select|textarea|label|form)$/.test(tag)) {
        // non-semantic clickable (div/span/li with an Alpine or inline click handler) — button-like
        o = { kind: 'clickable', tag: tag, text: textOf(el), icon: iconOf(el) };
        if (!o.text) o.iconOnly = true;
        claimed.add(el);
      } else if (tag === 'input') {
        var t = (el.type || 'text').toLowerCase();
        o = { kind: t === 'checkbox' ? 'checkbox' : t === 'radio' ? 'radio' : t === 'hidden' ? 'hidden-field' : 'input', tag: tag, type: t, name: attr(el, 'name'),
              label: labelFor(el), placeholder: attr(el, 'placeholder'), required: el.required || undefined,
              readonly: el.readOnly || undefined, disabled: el.disabled || undefined,
              min: attr(el, 'min'), max: attr(el, 'max'), step: attr(el, 'step'), minlength: attr(el, 'minlength'),
              maxlength: attr(el, 'maxlength'), pattern: attr(el, 'pattern'), accept: attr(el, 'accept'),
              autocomplete: attr(el, 'autocomplete'), inputmode: attr(el, 'inputmode'), autofocus: el.autofocus || undefined,
              multiple: el.multiple || undefined, valueType: valueType(el) };
        if (t === 'checkbox' || t === 'radio') { o.optionValue = attr(el, 'value'); o.checked = el.checked; o.valueType = undefined; }
        claimed.add(el);
      } else if (tag === 'select') {
        o = { kind: 'select', tag: tag, name: attr(el, 'name'), label: labelFor(el), required: el.required || undefined,
              disabled: el.disabled || undefined, multiple: el.multiple || undefined,
              options: Array.from(el.options).map(function (op) { return { value: op.value, text: clean(op.text), disabled: op.disabled || undefined, group: op.parentElement.tagName === 'OPTGROUP' ? op.parentElement.label : undefined }; }),
              selectedIsFirst: el.selectedIndex <= 0 };
        claimed.add(el);
      } else if (tag === 'textarea') {
        o = { kind: 'textarea', tag: tag, name: attr(el, 'name'), label: labelFor(el), placeholder: attr(el, 'placeholder'),
              required: el.required || undefined, maxlength: attr(el, 'maxlength'), minlength: attr(el, 'minlength'), rows: attr(el, 'rows'), valueType: valueType(el) };
        claimed.add(el);
      } else if (tag === 'label') {
        o = { kind: 'label', tag: tag, text: textOf(el), for: attr(el, 'for') };
        claimed.add(el);
      } else if (tag === 'table') {
        var heads = Array.from(el.querySelectorAll('thead th, tr:first-child th')).map(textOf);
        var bodyRows = el.querySelectorAll('tbody tr');
        var first = bodyRows[0];
        o = { kind: 'table', tag: tag, columns: heads, rowCount: bodyRows.length,
              firstRowActions: first ? Array.from(first.querySelectorAll('a,button')).map(function (b) { return { tag: b.tagName.toLowerCase(), text: textOf(b), href: attr(b, 'href'), icon: iconOf(b), title: attr(b, 'title') }; }) : [] };
        claimed.add(el);
      } else if (tag === 'dialog' || role === 'dialog' || role === 'alertdialog' || el.hasAttribute('aria-modal') ||
                 (/\b(modal|drawer|offcanvas|overlay|popup|lightbox)\b/i.test(cls)) ||
                 (el.hasAttribute('x-show') && !inTemplate && /fixed/.test(cls) && /inset-0|z-\[?\d/.test(cls))) {
        var hd = el.querySelector('h1,h2,h3,h4,h5,[class*="font-bold"]');
        o = { kind: 'modal', tag: tag, text: hd ? textOf(hd) : textOf(el).slice(0, 80), open: tag === 'dialog' ? el.open : undefined };
      } else if (role === 'tablist') {
        o = { kind: 'tablist', tag: tag, text: textOf(el).slice(0, 120) };
      } else if (role === 'menu' || role === 'listbox') {
        o = { kind: 'menu', tag: tag, text: textOf(el).slice(0, 120) };
      } else if (tag === 'img') {
        o = { kind: 'image', tag: tag, alt: attr(el, 'alt'), src: (attr(el, 'src') || '').replace(/^https?:\/\/[^/]+/, '').slice(0, 160) };
      } else if (role === 'alert' || role === 'status' || /\b(alert|toast|flash|invalid-feedback|error-message|notice)\b/i.test(cls) ||
                 (/\bbg-(red|green|emerald|yellow|amber|orange|blue|rose)-50\b/.test(cls) && /\bborder/.test(cls) && ownText(el) !== '' )) {
        o = { kind: 'alert', tag: tag, text: textOf(el), icon: iconOf(el) };
        claimed.add(el);
      } else if (/\b(rounded-full|badge|pill|chip)\b/.test(cls) && /\b(bg-|badge|pill)/.test(cls) && !el.querySelector('a,button,input,div') && (el.textContent || '').trim().length > 0 && (el.textContent || '').trim().length <= 40) {
        o = { kind: 'badge', tag: tag, text: textOf(el), icon: iconOf(el) };
        claimed.add(el);
      } else if (/^(div|section|article)$/.test(tag) && /\b(card|widget|panel)\b/.test(cls) ||
                 (/^(div|section|article)$/.test(tag) && /\brounded-(xl|2xl|3xl)\b/.test(cls) && /\bshadow/.test(cls) && /\bbg-white\b/.test(cls))) {
        var tt = el.querySelector('h1,h2,h3,h4,h5,h6,[class*="font-bold"],[class*="font-semibold"],strong');
        if (tt) o = { kind: 'card', tag: tag, text: textOf(tt).slice(0, 120) };
      } else if (el.hasAttribute('title') && !underClaimed(el)) {
        o = { kind: 'tooltip', tag: tag, text: clean(el.getAttribute('title')), icon: iconOf(el) };
      }

      if (!o && includeText && !underClaimed(el)) {
        var ot = ownText(el);
        if (ot && ot.length > 0) {
          var kindT = /^(tiada|no |empty|kosong)|tidak dijumpai|belum ada (data|rekod|notifikasi|sebarang)/i.test(ot) ? 'empty-state' : 'text';
          o = { kind: kindT, tag: tag, text: ot, icon: iconOf(el) };
        }
      }
      if (o) {
        for (var k in o) if (o[k] === undefined || o[k] === '') delete o[k];
        push(el, o, inTemplate);
      }
      // Alpine component registry (independent of classification)
      if (el.hasAttribute('x-data')) {
        var xd = el.getAttribute('x-data');
        var keys = [];
        var mk = xd.match(/([A-Za-z_$][\w$]*)\s*:/g);
        if (mk) keys = mk.map(function (s) { return s.replace(/\s*:$/, ''); });
        var fn = xd.match(/^\s*([A-Za-z_$][\w$]*)\s*\(/);
        var state;
        try { var d = inTemplate ? null : (el._x_dataStack && el._x_dataStack[0]) || (window.Alpine && Alpine.$data && Alpine.$data(el)); if (d) { state = {}; Object.keys(d).forEach(function (k2) { var v = d[k2]; if (typeof v !== 'function') state[k2] = (typeof v === 'object' && v !== null) ? (Array.isArray(v) ? 'array(' + v.length + ')' : 'object') : typeof v === 'string' ? (/^[a-z_]{0,20}$/.test(v) ? v : 'string(' + v.length + ')') : v; }); } } catch (e) {}
        alpine.push({ tag: tag, component: fn ? fn[1] : undefined, xData: trunc(xd, 400), keys: Array.from(new Set(keys)), liveState: state,
                      visible: visInfo(el, inTemplate).visible, region: inTemplate ? 'template' : region(el), section: lastHeading || undefined });
      }
    }

    var templateRegion = null;
    function walk(root, inTemplate) {
      var all = root.querySelectorAll('*');
      for (var i = 0; i < all.length; i++) {
        var el = all[i];
        classify(el, inTemplate);
        if (el.tagName === 'TEMPLATE' && el.content) {
          var cond = el.getAttribute('x-if') ? 'x-if=' + el.getAttribute('x-if') : el.getAttribute('x-for') ? 'x-for=' + el.getAttribute('x-for') : 'template';
          var prevTR = templateRegion;
          if (!inTemplate) templateRegion = region(el);
          walk(el.content, trunc(cond, 160));
          templateRegion = prevTR;
        }
      }
    }
    walk(document.body, null);

    // ---------- inline JS / Alpine string messages ----------
    var messages = [], seen = {}, urls = [], seenUrl = {};
    function harvest(src, code) {
      var re = /(['"`])((?:\\.|(?!\1)[^\\\n])*)\1/g, m;
      while ((m = re.exec(code))) {
        var s = m[2].replace(/\\(['"`])/g, '$1').trim();
        // URL / endpoint literals (incl. template-literal fragments like `/notifikasi/${id}`)
        var um = s.match(/^(?:https?:\/\/(?:www\.)?prestasiplus\.my)?(\/[A-Za-z0-9_\-\/{}$.?=&%]*)$/);
        if (um && um[1].length > 1 && !/\.(js|css|png|jpe?g|svg|webp|gif|ico|woff2?|json)(\?|$)/.test(um[1])) {
          if (!seenUrl[um[1]]) { seenUrl[um[1]] = { url: um[1], sources: [] }; urls.push(seenUrl[um[1]]); }
          if (seenUrl[um[1]].sources.length < 5 && seenUrl[um[1]].sources.indexOf(src) < 0) seenUrl[um[1]].sources.push(src);
          continue;
        }
        if (s.length < 3 || !/[A-Za-z]/.test(s)) continue;
        if (!/\s/.test(s) && !/^[A-Z][a-z]+[.!?]*$/.test(s)) continue;            // single code-ish token
        if (/^[\w\-:\/\[\]\.\s!#%&()]+$/.test(s) && /\b(px|py|mt|mb|text-|bg-|flex|grid|rounded|border|hidden|w-|h-|fa-)/.test(s)) continue; // class lists
        if (/^(https?:|\/)[^\s]*$/.test(s) || /[{};]|=>|\bfunction\b|document\.|window\./.test(s)) continue;
        if (/^(GET|POST|PUT|DELETE|PATCH|Content-Type|application\/json|X-CSRF-TOKEN)/.test(s)) continue;
        var key = s;
        if (seen[key]) { if (seen[key].sources.length < 5 && seen[key].sources.indexOf(src) < 0) seen[key].sources.push(src); continue; }
        seen[key] = { text: clean(s), sources: [src] };
        messages.push(seen[key]);
      }
    }
    Array.from(document.querySelectorAll('script:not([src])')).forEach(function (s, i) {
      if (/application\/(ld\+)?json/.test(s.type || '')) return;
      if ((s.textContent || '').indexOf('window.__inventory') >= 0) return; // this script itself (injected)
      harvest('script#' + i, s.textContent || '');
    });
    function harvestAttrs(root) {
      root.querySelectorAll('*').forEach(function (el) {
        for (var i = 0; i < el.attributes.length; i++) {
          var a = el.attributes[i];
          if (/^(x-|@|:|on[a-z]+$)/.test(a.name) && !/^(:class|x-bind:class|:style|x-transition)/.test(a.name)) harvest('attr:' + a.name + '@' + el.tagName.toLowerCase(), a.value);
        }
        if (el.tagName === 'TEMPLATE' && el.content) harvestAttrs(el.content);
      });
    }
    harvestAttrs(document.body);

    // ---------- summary ----------
    var counts = {};
    elements.forEach(function (e) { var k = e.kind + (e.visible ? '' : ':hidden'); counts[k] = (counts[k] || 0) + 1; });
    return {
      meta: {
        url: location.pathname + location.search, title: document.title, state: opts.state || 'default',
        viewport: { width: innerWidth, height: innerHeight }, scrollWidth: document.documentElement.scrollWidth,
        hasHorizontalOverflow: document.documentElement.scrollWidth > innerWidth,
        contentRoot: contentRoot ? (opts.contentRoot || 'main') : null, repeats: repeats,
        capturedAt: new Date().toISOString(), total: elements.length, counts: counts,
        visibleCount: elements.filter(function (e) { return e.visible; }).length
      },
      alpine: alpine,
      messages: messages,
      urls: urls,
      elements: elements
    };
  }

  if (typeof window !== 'undefined') window.__inventory = inventory;
  return inventory;
})();
