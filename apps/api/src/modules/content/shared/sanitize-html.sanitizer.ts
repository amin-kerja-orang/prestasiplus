import { Logger } from '@nestjs/common'
import sanitizeHtml, { type IFrame, type Tag } from 'sanitize-html'

import { type HtmlSanitizer } from './html-sanitizer'

/**
 * The production `HtmlSanitizer` (BE-24 AC 2): the `sanitize-html` library with a STRICT config. The tag and
 * attribute allow-list is exactly that of the hand-written stand-in (`AllowListHtmlSanitizer`, kept as the
 * documented fallback), and the rules are the same:
 *
 * - tags outside the list are discarded (their text is kept); `script`, `style`, `iframe`, `object`, `svg`, `math`
 *   and similar are discarded WITH their content (`nonTextTags`);
 * - no `style` and no `on*` attribute: only the attributes named below survive;
 * - `<a href>`: http, https, mailto, a root-relative path or an in-page `#anchor`; the link always gets
 *   `rel="noopener noreferrer"`;
 * - `<img src>`: ONLY a stored file, `/api/files/<22-character token>`, relative or on one of the configured
 *   `PUBLIC_ORIGINS`; any other image (a third-party tracking pixel, another `/api` GET) is dropped;
 * - `data:`, `javascript:` and protocol-relative (`//host`) URLs never survive.
 */
const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup', 'code', 'pre', 'hr', 'span', 'div',
  'ul', 'ol', 'li', 'a', 'h2', 'h3', 'h4', 'blockquote', 'img',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
]

const ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  a: ['href', 'title', 'rel'],
  img: ['src', 'alt', 'title', 'width', 'height'],
  td: ['colspan', 'rowspan'],
  th: ['colspan', 'rowspan'],
  ol: ['start'],
}

/** Dropped together with everything inside them. */
const NON_TEXT_TAGS = [
  'script', 'style', 'textarea', 'option', 'noscript', 'iframe', 'object', 'svg', 'math', 'template', 'title',
  'xmp', 'noembed', 'noframes', 'applet', 'head', 'plaintext', 'frameset',
]

const FILE_PATH = /^\/api\/files\/[A-Za-z0-9_-]{22}$/
const DIGITS = /^\d{1,4}$/
const NUMERIC: Readonly<Record<string, readonly string[]>> = { img: ['width', 'height'], td: ['colspan', 'rowspan'], th: ['colspan', 'rowspan'], ol: ['start'] }
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/g

const logger = new Logger('PUBLIC_ORIGINS')

/** An entry for the log: no credentials (`user:pass@`), at most 60 characters. */
const forLog = (entry: string): string => entry.replace(/\/\/[^/@]*@/, '//').slice(0, 60)

/**
 * Origins (`scheme://host[:port]`) from the comma-separated `PUBLIC_ORIGINS` value. Only http and https entries with
 * a real origin are kept (a path is normalised away); every other entry is dropped with one warning naming it.
 */
export function originsOf(configured: string | undefined): string[] {
  const out: string[] = []
  for (const raw of (configured ?? '').split(',')) {
    const entry = raw.trim()
    if (entry === '') continue
    try {
      const url = new URL(entry)
      if ((url.protocol === 'http:' || url.protocol === 'https:') && url.origin !== 'null') {
        out.push(url.origin)
        continue
      }
    } catch {
      // falls through to the warning
    }
    logger.warn(`PUBLIC_ORIGINS entry ignored (not an http or https origin): ${forLog(entry)}`)
  }
  return out
}

export class SanitizeHtmlSanitizer implements HtmlSanitizer {
  private readonly options: sanitizeHtml.IOptions

  /** @param origins origins whose `/api/files/<token>` URL may be used as an image, besides the relative form. */
  constructor(private readonly origins: readonly string[] = []) {
    this.options = {
      allowedTags: ALLOWED_TAGS,
      allowedAttributes: ALLOWED_ATTRIBUTES,
      allowedSchemes: ['http', 'https'],
      allowedSchemesByTag: { a: ['http', 'https', 'mailto'] },
      allowedSchemesAppliedToAttributes: ['href', 'src'],
      allowProtocolRelative: false,
      disallowedTagsMode: 'discard',
      nonTextTags: NON_TEXT_TAGS,
      parseStyleAttributes: false,
      nestingLimit: 100,
      transformTags: { a: (n, a) => this.link(n, a), img: (n, a) => this.image(n, a), td: numeric, th: numeric, ol: numeric },
      exclusiveFilter: (frame: IFrame) => frame.tag === 'img' && !frame.attribs.src,
    }
  }

  sanitize(html: string): string {
    // A NUL is dropped first, so `<scr\0ipt>` cannot hide a tag name from the filters.
    return sanitizeHtml(html.replaceAll('\u0000', ''), this.options)
  }

  private link(tagName: string, attribs: sanitizeHtml.Attributes): Tag {
    const out: Record<string, string> = {}
    if (attribs.title !== undefined) out.title = attribs.title
    const href = attribs.href === undefined ? null : relativeOrAnchor(attribs.href)
    if (href !== null) {
      out.href = href
      out.rel = 'noopener noreferrer'
    }
    return { tagName, attribs: out }
  }

  private image(tagName: string, attribs: sanitizeHtml.Attributes): Tag {
    const out: Record<string, string> = {}
    const src = this.fileUrl(attribs.src)
    if (src !== null) out.src = src
    for (const k of ['alt', 'title'] as const) if (attribs[k] !== undefined) out[k] = attribs[k]
    for (const k of NUMERIC.img ?? []) if (attribs[k] !== undefined && DIGITS.test(attribs[k].trim())) out[k] = attribs[k].trim()
    return { tagName, attribs: out }
  }

  /** The src when it is `/api/files/<token>` (relative, or absolute on an allowed origin), else null. */
  private fileUrl(raw: string | undefined): string | null {
    const src = (raw ?? '').replace(CONTROL, '').trim()
    if (FILE_PATH.test(src)) return src
    try {
      const u = new URL(src)
      return (u.protocol === 'http:' || u.protocol === 'https:') && this.origins.includes(u.origin) && FILE_PATH.test(u.pathname) && u.search === '' && u.hash === '' ? `${u.origin}${u.pathname}` : null
    } catch {
      return null
    }
  }
}

/** td, th and ol: keep only numeric attribute values. */
function numeric(tagName: string, attribs: sanitizeHtml.Attributes): Tag {
  const out: Record<string, string> = {}
  for (const k of NUMERIC[tagName] ?? []) if (attribs[k] !== undefined && DIGITS.test(attribs[k].trim())) out[k] = attribs[k].trim()
  return { tagName, attribs: out }
}

/**
 * A link target that the library's scheme check will then judge: a root-relative path (not `//` or `/\`), an
 * in-page anchor, or an absolute URL (left to the scheme check). Anything else relative is dropped.
 */
function relativeOrAnchor(raw: string): string | null {
  const href = raw.replace(CONTROL, '').trim()
  if (href === '') return null
  const probe = href.replace(/\s+/g, '')
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(probe)) return /^(https?|mailto):/i.test(probe) ? href : null
  if (probe.startsWith('/')) return probe.startsWith('//') || probe.startsWith('/\\') ? null : href
  return probe.startsWith('#') ? href : null
}
