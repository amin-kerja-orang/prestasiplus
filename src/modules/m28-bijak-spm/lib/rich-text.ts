/**
 * Renders question text with `$latex$` spans to safe HTML. Plain text is escaped; maths goes
 * through KaTeX (bundled locally, no CDN, `trust: false`, never throws).
 */
import katex from 'katex'

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
export const escapeHtml = (s: string): string => s.replace(/[&<>"']/g, (c) => ESC[c]!)

const cache = new Map<string, string>()

export function renderMath(latex: string, display = false): string {
  const key = `${display ? 'd' : 'i'}:${latex}`
  const hit = cache.get(key)
  if (hit) return hit
  let html: string
  try {
    html = katex.renderToString(latex, {
      throwOnError: false,
      displayMode: display,
      trust: false,
      strict: 'ignore',
      output: 'htmlAndMathml',
    })
  } catch {
    html = escapeHtml(latex)
  }
  if (cache.size > 800) cache.clear()
  cache.set(key, html)
  return html
}

/** Text with `$...$` spans -> HTML. An odd `$` is shown literally. */
export function renderRich(text: string): string {
  const parts = text.split('$')
  if (parts.length % 2 === 0) return escapeHtml(text)
  return parts.map((p, i) => (i % 2 === 1 ? renderMath(p) : escapeHtml(p))).join('')
}

/** Plain text of a rich string (for aria-labels): maths spans keep their LaTeX source. */
export function richToText(text: string): string {
  return text.replace(/\$/g, '')
}
