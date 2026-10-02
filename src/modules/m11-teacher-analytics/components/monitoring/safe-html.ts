/**
 * Minimal allow-list sanitiser for the question HTML of S4 (M04 `questionText`; SEC-M11-05 spirit).
 * Parsed into an inert document, rebuilt from a small tag list with every attribute dropped; `script`,
 * `style`, `iframe`, `object`, `embed` and `svg` are removed with their content.
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
const DROPPED = new Set(['script', 'style', 'iframe', 'object', 'embed', 'svg', 'link', 'meta'])

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
