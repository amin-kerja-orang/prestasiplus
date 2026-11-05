/**
 * Renders question text with `$latex$` spans to safe HTML. Plain text is escaped; maths goes
 * through KaTeX (bundled locally, no CDN, `trust: false`, never throws).
 */
import katex from 'katex'

const ESC: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}
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

/** The fixed phrase that cites every stimulus of the group (D-S8-T02-1). */
export const CITE_ALL = 'semua bahan'

export type CiteSegment = { kind: 'text'; text: string } | { kind: 'cite'; text: string; target: string }

const reEscape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Splits a prompt into plain text and citations (FR-PA-37, AC-PA-39): a stimulus label ("Bahan 2") or "semua bahan",
 * case-insensitive, whole word ("Bahan 21" never matches "Bahan 2"). `$...$` maths is never matched and stays inside
 * text segments, so KaTeX still renders. No match (or an odd `$`) gives one text segment.
 */
export function citeSegments(
  text: string,
  stimuli: readonly { id: string; label?: string }[],
): CiteSegment[] {
  const terms = new Map<string, string>([[CITE_ALL, 'all']])
  for (const s of stimuli) {
    const l = (s.label ?? '').trim().toLowerCase()
    if (l && !terms.has(l)) terms.set(l, s.id)
  }
  const pieces = text.split('$')
  if (pieces.length % 2 === 0) return [{ kind: 'text', text }]
  const alt = [...terms.keys()].sort((a, b) => b.length - a.length).map(reEscape).join('|')
  const re = new RegExp(`(?<![\\p{L}\\p{N}_])(?:${alt})(?![\\p{L}\\p{N}_])`, 'giu')
  const out: CiteSegment[] = []
  const pushText = (t: string): void => {
    if (!t) return
    const last = out[out.length - 1]
    if (last?.kind === 'text') last.text += t
    else out.push({ kind: 'text', text: t })
  }
  pieces.forEach((p, i) => {
    if (i % 2 === 1) return pushText(`$${p}$`)
    let at = 0
    for (const m of p.matchAll(re)) {
      pushText(p.slice(at, m.index))
      out.push({ kind: 'cite', text: m[0], target: terms.get(m[0].toLowerCase())! })
      at = m.index + m[0].length
    }
    pushText(p.slice(at))
  })
  return out
}

/** Plain text of a rich string (for aria-labels): maths spans keep their LaTeX source. */
export function richToText(text: string): string {
  return text.replace(/\$/g, '')
}
