/**
 * Shared HTML sanitiser (BE-24 AC 2). Consumers inject `HTML_SANITIZER` and depend only on the
 * `HtmlSanitizer` interface, so the stand-in below can be swapped for a `sanitize-html` adapter
 * (LEAD approved the library) without touching a consumer. The XSS tests run against the interface.
 */
export interface HtmlSanitizer {
  /** Returns markup that is safe to store and to render. Idempotent: `sanitize(sanitize(x)) === sanitize(x)`. */
  sanitize(html: string): string
}

/** Injection token of the `HtmlSanitizer`. */
export const HTML_SANITIZER = Symbol('HTML_SANITIZER')

const VOID_TAGS = new Set(['br', 'hr', 'img', 'col'])
const ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup', 'code', 'pre', 'hr', 'span', 'div',
  'ul', 'ol', 'li', 'a', 'h2', 'h3', 'h4', 'blockquote', 'img',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
])
/** Dangerous elements: the tag AND everything inside it is dropped. */
const DROP_WITH_CONTENT = new Set([
  'script', 'style', 'iframe', 'frameset', 'object', 'applet', 'noscript', 'noembed',
  'noframes', 'template', 'textarea', 'title', 'xmp', 'plaintext', 'svg', 'math', 'head',
])
/** Void or empty dangerous tags: only the tag is dropped. */
const DROP_TAG_ONLY = new Set(['embed', 'frame', 'link', 'meta', 'base', 'param'])
const ALLOWED_ATTRS:Readonly<Record<string, readonly string[]>> = {
  a: ['href', 'title'],
  img: ['src', 'alt', 'title', 'width', 'height'],
  td: ['colspan', 'rowspan'],
  th: ['colspan', 'rowspan'],
  ol: ['start'],
}
const DIGITS = /^\d{1,4}$/
const NUMERIC_ATTRS = new Set(['width', 'height', 'colspan', 'rowspan', 'start'])
const MAX_TAG = 4096
const MAX_DEPTH = 64
const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', colon: ':', tab: '\t', newline: '\n',
  sol: '/', lpar: '(', rpar: ')', excl: '!', num: '#', semi: ';', comma: ',', period: '.', equals: '=',
  quest: '?', percnt: '%', plus: '+', commat: '@', lowbar: '_', bsol: '\\',
}
const AMP_NOT_ENTITY = /&(?!(?:[A-Za-z][A-Za-z0-9]{1,31}|#[0-9]{1,7}|#[xX][0-9A-Fa-f]{1,6});)/g
const ALLOWED_SCHEMES: Readonly<Record<string, readonly string[]>> = { a: ['http', 'https', 'mailto'], img: ['http', 'https'] }

const isAlpha = (c: string | undefined): boolean => c !== undefined && /^[A-Za-z]$/.test(c)
const isAlnum = (code: number): boolean => (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122)
const isWs = (c: string): boolean => c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\f'

const escText = (s: string): string => s.replace(AMP_NOT_ENTITY, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const escAttr = (s: string): string => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function decodeEntities(s: string): string {
  // As a browser does in an attribute: a named entity needs its `;`; only amp, lt, gt and quot also work without
  // one, and then not before `=` or a letter or digit (so `?a=1&num=3` and `&tab=2` stay as they are).
  return s.replace(/&(?:#[xX]([0-9A-Fa-f]{1,6});?|#([0-9]{1,7});?|([A-Za-z][A-Za-z0-9]{1,31});|(amp|lt|gt|quot)(?![=A-Za-z0-9]))/g, (m, hex?: string, dec?: string, name?: string, legacy?: string) => {
    if (legacy !== undefined) return NAMED_ENTITIES[legacy] ?? m
    if (name !== undefined) return NAMED_ENTITIES[name.toLowerCase()] ?? m
    const cp = hex !== undefined ? Number.parseInt(hex, 16) : Number.parseInt(dec ?? '0', 10)
    if (cp === 0 || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) return '�'
    return String.fromCodePoint(cp)
  })
}

/** A URL that may be kept for `tag`, or null. Entities are decoded first so `&#106;avascript:` is seen as it is. */
function safeUrl(raw: string, tag: 'a' | 'img'): string | null {
  const cleaned = decodeEntities(raw).replace(/[\u0000-\u001f\u007f-\u009f]/g, '').trim()
  if (cleaned === '' || cleaned.length > 2048) return null
  const probe = cleaned.replace(/\s+/g, '')
  const scheme = /^([A-Za-z][A-Za-z0-9+.-]*):/.exec(probe)
  if (scheme) return (ALLOWED_SCHEMES[tag] ?? []).includes((scheme[1] as string).toLowerCase()) ? cleaned.replace(/ /g, '%20') : null
  if (probe.startsWith('//') || probe.startsWith('/\\') || probe.includes(':')) return null
  // Root-relative paths (for example an uploaded `/api/files/<token>`) and, for links, in-page anchors.
  if (probe.startsWith('/') || (tag === 'a' && probe.startsWith('#'))) return cleaned.replace(/ /g, '%20')
  return null
}

interface ParsedTag {
  name: string
  closing: boolean
  attrs: Map<string, string>
  end: number
}

/**
 * Reads a tag at `start` (a `<`), quote-aware, at most MAX_TAG characters; null when it is not a complete tag.
 * A failed scan costs up to MAX_TAG steps and is charged to `budget`; once the budget is spent no further tag is
 * read (the rest is text), so a run of unterminated tags cannot make the cost quadratic.
 */
function readTag(src: string, start: number, budget: { left: number }): ParsedTag | null {
  if (budget.left <= 0) return null
  const tag = scanTag(src, start)
  if (tag === null) budget.left -= MAX_TAG
  return tag
}

function scanTag(src: string, start: number): ParsedTag | null {
  const n = src.length
  const max = Math.min(n, start + MAX_TAG)
  let p = start + 1
  const closing = src[p] === '/'
  if (closing) p++
  const nameStart = p
  if (!isAlpha(src[p])) return null
  while (p < n && isAlnum(src.charCodeAt(p))) p++
  const name = src.slice(nameStart, p).toLowerCase()
  const attrs = new Map<string, string>()
  while (p < max) {
    while (p < max && (isWs(src[p] as string) || src[p] === '/')) p++
    if (p >= max) return null
    if (src[p] === '>') return { name, closing, attrs, end: p + 1 }
    const as = p
    while (p < max && !isWs(src[p] as string) && src[p] !== '=' && src[p] !== '>' && src[p] !== '/') p++
    if (p === as) p++ // a stray `=`
    const attr = src.slice(as, p).toLowerCase()
    while (p < max && isWs(src[p] as string)) p++
    let value = ''
    if (src[p] === '=') {
      p++
      while (p < max && isWs(src[p] as string)) p++
      const q = src[p]
      if (q === '"' || q === "'") {
        let e = p + 1
        while (e < max && src[e] !== q) e++
        if (e >= max) return null
        value = src.slice(p + 1, e)
        p = e + 1
      } else {
        const vs = p
        while (p < max && !isWs(src[p] as string) && src[p] !== '>') p++
        value = src.slice(vs, p)
      }
    }
    if (attr !== '' && !attrs.has(attr)) attrs.set(attr, value)
  }
  return null
}

/** Index after the closing tag of a raw element (case-insensitive, ASCII); `n` when it never closes. */
function skipRawElement(src: string, from: number, name: string): number {
  const n = src.length
  let p = src.indexOf('<', from)
  while (p !== -1) {
    if (src[p + 1] === '/' && src.slice(p + 2, p + 2 + name.length).toLowerCase() === name) {
      const after = src[p + 2 + name.length]
      if (after === undefined || isWs(after) || after === '/' || after === '>') {
        const gt = src.indexOf('>', p)
        return gt === -1 ? n : gt + 1
      }
    }
    p = src.indexOf('<', p + 1)
  }
  return n
}

function attrsOf(tag: string, parsed: Map<string, string>): string | null {
  const allowed = ALLOWED_ATTRS[tag] ?? []
  let out = ''
  let hasUrl = false
  for (const key of allowed) {
    const raw = parsed.get(key)
    if (raw === undefined) continue
    if (key === 'href' || key === 'src') {
      const url = safeUrl(raw, tag === 'img' ? 'img' : 'a')
      if (url === null) continue
      hasUrl = true
      out += ` ${key}="${escAttr(url)}"`
    } else if (NUMERIC_ATTRS.has(key)) {
      const v = decodeEntities(raw).trim()
      if (DIGITS.test(v)) out += ` ${key}="${v}"`
    } else {
      out += ` ${key}="${escAttr(decodeEntities(raw).replace(/[\u0000-\u001f\u007f-\u009f]/g, ''))}"`
    }
  }
  if (tag === 'img' && !hasUrl) return null
  if (tag === 'a' && hasUrl) out += ' rel="noopener noreferrer"'
  return out
}

/**
 * Temporary strict allow-list sanitiser. It rebuilds the output from the allow-list, so nothing it
 * does not name survives: unknown tags are escaped to text, dangerous elements are dropped with their
 * content, every `on*` attribute and `style` is dropped, URLs are limited to http, https, mailto and
 * root-relative paths, and the result is always well formed (tags are balanced, depth is capped).
 */
export class AllowListHtmlSanitizer implements HtmlSanitizer {
  sanitize(html: string): string {
    const src = html.replace(/\u0000/g, '')
    const n = src.length
    const lastGt = src.lastIndexOf('>')
    // Failed tag scans allowed in one document: 64 plus one per 256 characters.
    const budget = { left: MAX_TAG * (64 + Math.ceil(n / 256)) }
    const out: string[] = []
    const stack: string[] = []
    let i = 0
    while (i < n) {
      const lt = src.indexOf('<', i)
      if (lt === -1) {
        out.push(escText(src.slice(i)))
        break
      }
      if (lt > i) out.push(escText(src.slice(i, lt)))
      i = lt
      const c1 = src[i + 1]
      if (c1 === '!' || c1 === '?') {
        if (src.startsWith('<!--', i)) {
          const e = src.indexOf('-->', i + 2)
          i = e === -1 ? n : e + 3
        } else {
          const e = src.indexOf('>', i)
          i = e === -1 ? n : e + 1
        }
        continue
      }
      const tag = i < lastGt && (isAlpha(c1) || (c1 === '/' && isAlpha(src[i + 2]))) ? readTag(src, i, budget) : null
      if (!tag) {
        out.push('&lt;')
        i++
        continue
      }
      if (DROP_WITH_CONTENT.has(tag.name)) {
        i = tag.closing ? tag.end : tag.name === 'plaintext' ? n : skipRawElement(src, tag.end, tag.name)
        continue
      }
      if (DROP_TAG_ONLY.has(tag.name)) {
        i = tag.end
        continue
      }
      if (!ALLOWED_TAGS.has(tag.name)) {
        out.push(escText(src.slice(i, tag.end)))
        i = tag.end
        continue
      }
      i = tag.end
      if (tag.closing) {
        const at = stack.lastIndexOf(tag.name)
        if (at === -1 || VOID_TAGS.has(tag.name)) continue
        while (stack.length > at) out.push(`</${stack.pop() as string}>`)
        continue
      }
      const attrs = attrsOf(tag.name, tag.attrs)
      if (attrs === null) continue
      if (VOID_TAGS.has(tag.name)) {
        out.push(`<${tag.name}${attrs}>`)
        continue
      }
      if (stack.length >= MAX_DEPTH) continue
      stack.push(tag.name)
      out.push(`<${tag.name}${attrs}>`)
    }
    while (stack.length > 0) out.push(`</${stack.pop() as string}>`)
    return out.join('')
  }
}
