/**
 * Renders question text with `$latex$` spans to safe HTML. Plain text is escaped; maths goes
 * through KaTeX (bundled locally, no CDN, `trust: false`, never throws).
 */
import katex from 'katex'

import { sanitizeQuestionHtml } from './sanitize'

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
      // Caps `\\rule`/sizing commands (in em) so one formula cannot blow up the layout.
      maxSize: 20,
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

/** Copy of the m04 `imageSrc` URL builder (cross-module imports are forbidden): a 22-char file token -> `/api/files/<token>`. */
const imageSrc = (token: string): string => `/api/files/${token}`

const IMG_TOKEN = /^[A-Za-z0-9_-]{22}$/
/** Highest `{{gap:N}}` that expands (ClozeGaps uses the same cap); a larger N stays literal. */
export const MAX_GAP = 99

const MARKER = /\{\{(?:img:([^{}\s]*)|gap:(\d+))\}\}/g

/** Escapes plain text and expands `{{img:token}}` / `{{gap:N}}`; bad markers stay literal. */
function plainWithMarkers(text: string): string {
  let out = ''
  let at = 0
  for (const m of text.matchAll(MARKER)) {
    out += escapeHtml(text.slice(at, m.index))
    at = m.index + m[0].length
    if (m[1] !== undefined && IMG_TOKEN.test(m[1])) {
      out += `<img src="${imageSrc(m[1])}" alt="">`
    } else if (m[2] !== undefined && m[2].length <= 2 && Number(m[2]) >= 1 && Number(m[2]) <= MAX_GAP) {
      out += `<span class="qd-gap" data-gap="${Number(m[2])}"></span>`
    } else out += escapeHtml(m[0])
  }
  return out + escapeHtml(text.slice(at))
}

/** One text node: `$$block$$`, then `$inline$` (an odd delimiter count stays literal), then markers. */
function markupText(text: string): string {
  if (!text.includes('$') && !text.includes('{{')) return escapeHtml(text)
  const blocks = text.split('$$')
  if (blocks.length % 2 === 0) return plainWithMarkers(text)
  return blocks
    .map((seg, i) => {
      if (i % 2 === 1) return renderMath(seg, true)
      const parts = seg.split('$')
      if (parts.length % 2 === 0) return plainWithMarkers(seg)
      return parts.map((p, j) => (j % 2 === 1 ? renderMath(p) : plainWithMarkers(p))).join('')
    })
    .join('')
}

const decodeText = (s: string): string =>
  s.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')

/**
 * Question markup -> safe HTML (FR-QA-18). Sanitises first, then expands markers in text nodes only
 * (tags and their attributes are never touched). Plain text gives the same HTML as `renderRich`.
 */
export function renderMarkup(text: string): string {
  return sanitizeQuestionHtml(text)
    .split(/(<[^>]*>)/)
    .map((piece) => (piece.startsWith('<') ? piece : markupText(decodeText(piece))))
    .join('')
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
