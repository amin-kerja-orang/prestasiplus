/**
 * Allow-list HTML sanitiser for the pupil question display (S8-T03, FR-QA-18 / AC-QA-18).
 *
 * This is a COPY of the m09 article pattern (`m09-content/lib/artikel/sanitize-html.ts`), not an import:
 * ESLint forbids cross-module imports and this shared component must not depend on a module.
 * The input is parsed into an inert document (`DOMParser`: no script runs, nothing loads) and rebuilt from
 * an allow-list. Dangerous elements are dropped with their content, unknown elements (`a`, `img`, ...) are
 * unwrapped (text and allowed children kept), and event attributes, `style` and URLs never survive.
 */

/**
 * Allowed tags. `div` is included although the card's Decided allow-list omits it: the S2-T10 contract writes
 * `div` carriers (`poem`, `two-col`, `box`). Interim lead decision (posted on #503 for team-dd to confirm);
 * change it here only.
 */
export const QUESTION_HTML_TAGS: ReadonlySet<string> = new Set([
  'b', 'i', 'u', 's', 'ul', 'ol', 'li', 'code', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'br', 'p', 'div',
])

/** Removed together with their content. */
const DROPPED_TAGS = new Set([
  'script', 'style', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet', 'svg', 'math', 'template',
  'noscript', 'form', 'input', 'button', 'textarea', 'select', 'link', 'meta', 'base', 'title', 'head',
  'audio', 'video', 'source', 'canvas',
])

/** The only `class` tokens that survive (S2-T10 carriers). */
export const QUESTION_HTML_CLASSES: ReadonlySet<string> = new Set(['poem', 'two-col', 'box'])

const SPAN_TAGS = new Set(['th', 'td'])

function cleanElement(source: Element, target: Document): Node {
  const tag = source.tagName.toLowerCase()
  const out = target.createElement(tag)
  for (const attr of Array.from(source.attributes)) {
    const name = attr.name.toLowerCase()
    if (name === 'class') {
      const kept = attr.value.split(/\s+/).filter((c) => QUESTION_HTML_CLASSES.has(c))
      if (kept.length) out.setAttribute('class', kept.join(' '))
    } else if ((name === 'colspan' || name === 'rowspan') && SPAN_TAGS.has(tag)) {
      const v = attr.value.trim()
      if (/^\d{1,2}$/.test(v) && Number(v) >= 1 && Number(v) <= 12) out.setAttribute(name, String(Number(v)))
    }
  }
  copyChildren(source, out, target)
  return out
}

function copyChildren(from: Node, to: Node, target: Document): void {
  for (const child of Array.from(from.childNodes)) {
    if (child.nodeType === 3) {
      to.appendChild(target.createTextNode(child.nodeValue ?? ''))
    } else if (child.nodeType === 1) {
      const el = child as Element
      const tag = el.tagName.toLowerCase()
      if (DROPPED_TAGS.has(tag)) continue
      if (QUESTION_HTML_TAGS.has(tag)) to.appendChild(cleanElement(el, target))
      else copyChildren(el, to, target)
    }
  }
}

/** Returns safe HTML. Needs a DOM (`DOMParser`); without one the text is escaped. */
export function sanitizeQuestionHtml(html: string): string {
  if (typeof DOMParser === 'undefined') {
    return html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }
  // The `<body>` prefix keeps leading whitespace, which a bare parse would drop.
  const doc = new DOMParser().parseFromString(`<body>${html}`, 'text/html')
  const out = doc.implementation.createHTMLDocument('')
  const root = out.createElement('div')
  copyChildren(doc.body, root, out)
  return root.innerHTML
}
