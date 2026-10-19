/**
 * Minimal allow-list sanitiser for the question HTML of S4 (M04 `questionText`; SEC-M11-05 spirit).
 * Parsed into an inert document, rebuilt from a small tag list with every attribute dropped; `script`,
 * `style`, `iframe`, `object`, `embed` and `svg` are removed with their content (so are `noscript`,
 * `template`, `link` and `meta`); unknown tags are unwrapped (their text stays).
 *
 * Known limitation (G4 check, 2026-10-03): no M04 question text in the seed (anchors or the generated
 * datasets) contains `<img>` or `<table>`, so neither is allowed here; they are unwrapped to their text.
 * If a later seed adds them, allow `img` with an https or relative `src` only, and `table` tags, with tests.
 */

const ALLOWED = new Set([
  'b',
  'br',
  'div',
  'em',
  'i',
  'li',
  'ol',
  'p',
  'span',
  'strong',
  'sub',
  'sup',
  'u',
  'ul',
])
const DROPPED = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'svg',
  'link',
  'meta',
  'noscript',
  'template',
])

function clean(node: Node, out: Document): Node[] {
  const result: Node[] = []
  node.childNodes.forEach((child) => {
    if (child.nodeType === 3) {
      result.push(out.createTextNode(child.textContent ?? ''))
    } else if (child.nodeType === 1) {
      const tag = (child as Element).tagName.toLowerCase()
      if (DROPPED.has(tag)) return
      const inner = clean(child, out)
      if (ALLOWED.has(tag)) {
        const el = out.createElement(tag)
        inner.forEach((n) => el.append(n))
        result.push(el)
      } else {
        result.push(...inner)
      }
    }
  })
  return result
}

export function safeHtml(html: string): string {
  if (typeof DOMParser === 'undefined') return ''
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const holder = doc.createElement('div')
  clean(doc.body, doc).forEach((n) => holder.append(n))
  return holder.innerHTML
}
