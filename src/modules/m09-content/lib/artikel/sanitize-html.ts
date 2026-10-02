/**
 * Allow-list HTML sanitiser for the S16 article body (SRS NFR-M09-08 SEC-M09-01 / SEC-M09-02).
 *
 * The stored `content` is HTML typed by an admin (or a teacher through M10), rendered as HTML on
 * S16 (FR-M09-15, FR-M09-34). It is parsed into an inert document (`DOMParser`: no script runs, no
 * resource loads) and rebuilt from an allow-list of tags and attributes: `script`, `iframe`,
 * `object`, `embed`, `svg`, `style`, forms, event handlers and `javascript:` / `data:` URLs never
 * reach the output. Links get `rel="noopener noreferrer"`. Unknown elements are unwrapped (their
 * text and allowed children are kept); the dangerous ones are dropped with their content.
 */

const ALLOWED_TAGS = new Set([
  'a',
  'abbr',
  'b',
  'blockquote',
  'br',
  'caption',
  'code',
  'col',
  'colgroup',
  'dd',
  'del',
  'div',
  'dl',
  'dt',
  'em',
  'figcaption',
  'figure',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'i',
  'img',
  'ins',
  'li',
  'mark',
  'ol',
  'p',
  'pre',
  'q',
  's',
  'small',
  'span',
  'strong',
  'sub',
  'sup',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'u',
  'ul',
])

/** Removed together with their content. */
const DROPPED_TAGS = new Set([
  'script',
  'style',
  'iframe',
  'frame',
  'frameset',
  'object',
  'embed',
  'applet',
  'svg',
  'math',
  'template',
  'noscript',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'link',
  'meta',
  'base',
  'title',
  'head',
  'audio',
  'video',
  'source',
  'canvas',
])

const GLOBAL_ATTRS = new Set(['title', 'lang', 'dir'])
const TAG_ATTRS: Record<string, ReadonlySet<string>> = {
  a: new Set(['href', 'target']),
  img: new Set(['src', 'alt', 'width', 'height']),
  td: new Set(['colspan', 'rowspan']),
  th: new Set(['colspan', 'rowspan', 'scope']),
  ol: new Set(['start', 'type']),
  col: new Set(['span']),
  colgroup: new Set(['span']),
}

const SAFE_HREF = /^(https?:|mailto:|tel:)/i
const SAFE_SRC = /^https?:/i

/** Strips the control characters and spaces a URL parser ignores (`java\tscript:`). */
function normaliseUrl(value: string): string {
  return value.replace(/[\u0000- \u007f-\u009f]+/g, '')
}

function isSafeUrl(value: string, schemes: RegExp): boolean {
  const url = normaliseUrl(value)
  if (url === '') return false
  // A URL with a scheme must be on the allow-list; a scheme-less (relative) URL is harmless.
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return schemes.test(url)
  return true
}

function cleanElement(source: Element, target: Document): Node {
  const tag = source.tagName.toLowerCase()
  const out = target.createElement(tag)
  const allowed = TAG_ATTRS[tag]
  for (const attr of Array.from(source.attributes)) {
    const name = attr.name.toLowerCase()
    if (name.startsWith('on')) continue
    if (!GLOBAL_ATTRS.has(name) && !allowed?.has(name)) continue
    const value = attr.value
    if (name === 'href' && !isSafeUrl(value, SAFE_HREF)) continue
    if (name === 'src' && !isSafeUrl(value, SAFE_SRC)) continue
    if (name === 'target' && value !== '_blank') continue
    out.setAttribute(name, value)
  }
  if (tag === 'a') {
    if (out.hasAttribute('href')) out.setAttribute('rel', 'noopener noreferrer')
    else out.removeAttribute('target')
  }
  if (tag === 'img') out.setAttribute('loading', 'lazy')
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
      if (ALLOWED_TAGS.has(tag)) to.appendChild(cleanElement(el, target))
      else copyChildren(el, to, target) // unknown element: unwrap
    }
  }
}

/** Returns safe HTML for `v-html`. Needs a DOM (`DOMParser`); without one the text is escaped. */
export function sanitizeHtml(html: string): string {
  if (typeof DOMParser === 'undefined') {
    return html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const out = doc.implementation.createHTMLDocument('')
  const root = out.createElement('div')
  copyChildren(doc.body, root, out)
  return root.innerHTML
}
