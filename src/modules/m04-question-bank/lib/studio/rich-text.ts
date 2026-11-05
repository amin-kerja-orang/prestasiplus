/**
 * Authoring toolbar of the Studio (PRD45 3.1.5, FR-QA-18): pure text transforms. Each button turns the current
 * `{ value, start, end }` of a textarea into the next one; nothing here touches the DOM.
 *
 * The markup is what the S8-T03 renderer allows (`question-display/lib/sanitize.ts`): `b i u s ul ol li code table ...`
 * and the classes `poem | two-col | box`. Per the D115 final ruling the class sits on `p` / `ul`, never on `div`:
 * `Baris puisi` = one `<p class="poem">` per stanza (lines joined by `<br>`), `Dua lajur` = `<ul class="two-col">` with
 * two `<li>`, `Kotak teks` = `<p class="box">`. Markers: `$latex$`, `$$latex$$`, `{{img:<token>}}`, `{{gap:N}}`.
 */
import { renderMath } from '../../../../components/question-display/lib/rich-text'

export interface TextState {
  value: string
  start: number
  end: number
}

export type ToolbarAction =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strike'
  | 'ul'
  | 'ol'
  | 'code'
  | 'table'
  | 'row'
  | 'col'
  | 'removeTable'
  | 'poem'
  | 'twoCol'
  | 'box'
  | 'gap'

export const MATH_MAX_LENGTH = 500
export const MATH_INVALID = 'Formula matematik tidak sah.'
export const IMAGE_INVALID = 'Gambar mesti JPG, PNG atau WebP, maksimum 2MB.'
export const IMAGE_MAX_BYTES = 2 * 1024 * 1024
export const IMAGE_TYPES: readonly string[] = ['image/jpeg', 'image/png', 'image/webp']
/** Same cap as the renderer's `MAX_GAP`: a larger N would stay literal for the pupil. */
export const MAX_GAP = 99

/** Toolbar buttons in PRD45 3.1.5 order. `kind` says how the component runs it. */
export const TOOLBAR: readonly { id: string; label: string; title: string; kind: 'action' | 'math' | 'mathBlock' | 'image' | 'undo' | 'redo'; action?: ToolbarAction }[] = [
  { id: 'bold', label: 'B', title: 'Tebal', kind: 'action', action: 'bold' },
  { id: 'italic', label: 'I', title: 'Condong', kind: 'action', action: 'italic' },
  { id: 'underline', label: 'U', title: 'Garis bawah', kind: 'action', action: 'underline' },
  { id: 'strike', label: 'S', title: 'Garis tengah', kind: 'action', action: 'strike' },
  { id: 'ul', label: '• Senarai', title: 'Senarai berpeluru', kind: 'action', action: 'ul' },
  { id: 'ol', label: '1. Senarai', title: 'Senarai bernombor', kind: 'action', action: 'ol' },
  { id: 'code', label: '</>', title: 'Kod', kind: 'action', action: 'code' },
  { id: 'table', label: 'Jadual', title: 'Sisip jadual', kind: 'action', action: 'table' },
  { id: 'row', label: '+Baris', title: 'Tambah baris jadual', kind: 'action', action: 'row' },
  { id: 'col', label: '+Lajur', title: 'Tambah lajur jadual', kind: 'action', action: 'col' },
  { id: 'removeTable', label: '×Jadual', title: 'Buang jadual', kind: 'action', action: 'removeTable' },
  { id: 'math', label: '√x', title: 'Matematik dalam baris', kind: 'math' },
  { id: 'mathBlock', label: '√x blok', title: 'Matematik blok', kind: 'mathBlock' },
  { id: 'image', label: 'Imej', title: 'Sisip imej', kind: 'image' },
  { id: 'poem', label: 'Baris puisi', title: 'Baris puisi', kind: 'action', action: 'poem' },
  { id: 'twoCol', label: 'Dua lajur', title: 'Dua lajur', kind: 'action', action: 'twoCol' },
  { id: 'box', label: 'Kotak teks', title: 'Kotak teks', kind: 'action', action: 'box' },
  { id: 'gap', label: 'Penanda ruang kosong', title: 'Penanda ruang kosong', kind: 'action', action: 'gap' },
  { id: 'undo', label: 'Buat asal', title: 'Buat asal', kind: 'undo' },
  { id: 'redo', label: 'Buat semula', title: 'Buat semula', kind: 'redo' },
]

const clamp = (s: TextState): TextState => {
  const len = s.value.length
  const a = Math.min(Math.max(s.start, 0), len)
  const b = Math.min(Math.max(s.end, 0), len)
  return { value: s.value, start: Math.min(a, b), end: Math.max(a, b) }
}

/** Replaces the selection with `text`; the caret goes after it (or selects `select` inside it). */
function replaceSelection(s: TextState, text: string, caretFromEnd = 0): TextState {
  const c = clamp(s)
  const value = c.value.slice(0, c.start) + text + c.value.slice(c.end)
  const pos = c.start + text.length - caretFromEnd
  return { value, start: pos, end: pos }
}

function wrap(s: TextState, open: string, close: string): TextState {
  const c = clamp(s)
  const inner = c.value.slice(c.start, c.end)
  const value = c.value.slice(0, c.start) + open + inner + close + c.value.slice(c.end)
  if (inner === '') {
    const pos = c.start + open.length
    return { value, start: pos, end: pos }
  }
  return { value, start: c.start + open.length, end: c.start + open.length + inner.length }
}

/** Puts a block on its own lines: a newline before when the text before does not end one, and after likewise. */
function insertBlock(s: TextState, block: string): TextState {
  const c = clamp(s)
  const before = c.value.slice(0, c.start)
  const after = c.value.slice(c.end)
  const lead = before === '' || before.endsWith('\n') ? '' : '\n'
  const trail = after === '' || after.startsWith('\n') ? '' : '\n'
  const text = lead + block + trail
  const value = before + text + after
  const pos = before.length + lead.length + block.length
  return { value, start: pos, end: pos }
}

/** `<li>` items from the selection's non-empty lines (one empty item when nothing is selected). */
function listBlock(tag: 'ul' | 'ol', selected: string): string {
  const lines = selected.split('\n').map((l) => l.trim()).filter((l) => l !== '')
  const items = (lines.length ? lines : ['']).map((l) => `<li>${l}</li>`).join('')
  return `<${tag}>${items}</${tag}>`
}

/** Stanzas are separated by a blank line; lines inside a stanza are joined by `<br>`. */
function poemBlock(selected: string): string {
  const stanzas = selected.trim() === '' ? [''] : selected.trim().split(/\n\s*\n/)
  return stanzas
    .map((st) => `<p class="poem">${st.split('\n').map((l) => l.trim()).filter((l) => l !== '').join('<br>')}</p>`)
    .join('\n')
}

/** Two columns: the selection's first blank-line-separated half and the rest (empty when nothing is selected). */
function twoColBlock(selected: string): string {
  const parts = selected.trim() === '' ? [] : selected.trim().split(/\n\s*\n/)
  const left = parts[0] ?? ''
  const right = parts.slice(1).join('<br>')
  return `<ul class="two-col"><li>${left.replace(/\n/g, '<br>')}</li><li>${right.replace(/\n/g, '<br>')}</li></ul>`
}

/** Smallest unused `{{gap:N}}` number in the field (from 1). `null` when all 1..MAX_GAP are taken. */
export function nextGapNumber(value: string): number | null {
  const used = new Set<number>()
  for (const m of value.matchAll(/\{\{gap:(\d+)\}\}/g)) used.add(Number(m[1]))
  for (let n = 1; n <= MAX_GAP; n += 1) if (!used.has(n)) return n
  return null
}

/* ---- tables ------------------------------------------------------------------------------------------- */

const TABLE_RE = /<table\b[\s\S]*?<\/table>/gi

function tableAt(value: string, pos: number): { from: number; to: number; html: string } | null {
  for (const m of value.matchAll(TABLE_RE)) {
    const from = m.index
    const to = from + m[0].length
    if (pos >= from && pos <= to) return { from, to, html: m[0] }
  }
  return null
}

const newTable = (): string =>
  '<table><thead><tr><th></th><th></th></tr></thead><tbody><tr><td></td><td></td></tr><tr><td></td><td></td></tr></tbody></table>'

function addRow(s: TextState): TextState {
  const c = clamp(s)
  const t = tableAt(c.value, c.start)
  if (!t) return c
  const rows = [...t.html.matchAll(/<tr\b[\s\S]*?<\/tr>/gi)]
  if (rows.length === 0) return c
  const rel = c.start - t.from
  const at = rows.find((r) => rel >= r.index && rel <= r.index + r[0].length) ?? rows[rows.length - 1]!
  const cells = (at[0].match(/<t[hd]\b/gi) ?? []).length || 1
  const fresh = `<tr>${'<td></td>'.repeat(cells)}</tr>`
  const insertAt = t.from + at.index + at[0].length
  const value = c.value.slice(0, insertAt) + fresh + c.value.slice(insertAt)
  return { value, start: insertAt + fresh.length, end: insertAt + fresh.length }
}

function addColumn(s: TextState): TextState {
  const c = clamp(s)
  const t = tableAt(c.value, c.start)
  if (!t) return c
  const html = t.html.replace(/<tr\b[\s\S]*?<\/tr>/gi, (row) => {
    const tag = /<th\b/i.test(row) && !/<td\b/i.test(row) ? 'th' : 'td'
    return row.replace(/<\/tr>$/i, `<${tag}></${tag}></tr>`)
  })
  const value = c.value.slice(0, t.from) + html + c.value.slice(t.to)
  const pos = t.from + html.length
  return { value, start: pos, end: pos }
}

function removeTable(s: TextState): TextState {
  const c = clamp(s)
  const t = tableAt(c.value, c.start)
  if (!t) return c
  const value = c.value.slice(0, t.from) + c.value.slice(t.to)
  return { value, start: t.from, end: t.from }
}

/* ---- public ------------------------------------------------------------------------------------------- */

export function applyAction(action: ToolbarAction, s: TextState): TextState {
  const c = clamp(s)
  const selected = c.value.slice(c.start, c.end)
  switch (action) {
    case 'bold':
      return wrap(c, '<b>', '</b>')
    case 'italic':
      return wrap(c, '<i>', '</i>')
    case 'underline':
      return wrap(c, '<u>', '</u>')
    case 'strike':
      return wrap(c, '<s>', '</s>')
    case 'code':
      return wrap(c, '<code>', '</code>')
    case 'ul':
      return insertBlock(c, listBlock('ul', selected))
    case 'ol':
      return insertBlock(c, listBlock('ol', selected))
    case 'table':
      return insertBlock(c, newTable())
    case 'row':
      return addRow(c)
    case 'col':
      return addColumn(c)
    case 'removeTable':
      return removeTable(c)
    case 'poem':
      return insertBlock(c, poemBlock(selected))
    case 'twoCol':
      return insertBlock(c, twoColBlock(selected))
    case 'box':
      return insertBlock(c, `<p class="box">${selected.trim().replace(/\n/g, '<br>')}</p>`)
    case 'gap': {
      const n = nextGapNumber(c.value)
      return n === null ? c : replaceSelection(c, `{{gap:${String(n)}}}`)
    }
  }
}

/** `null` when the formula is fine, else the error shown under the dialog field. */
export function validateLatex(latex: string): string | null {
  const t = latex.trim()
  if (t === '' || t.length > MATH_MAX_LENGTH) return MATH_INVALID
  return renderMath(t).includes('katex-error') ? MATH_INVALID : null
}

/** `$latex$` in the line, or `$$latex$$` on its own line. Throws nothing: an invalid formula returns `error`. */
export function insertMath(s: TextState, latex: string, block: boolean): { state: TextState; error: string | null } {
  const error = validateLatex(latex)
  if (error !== null) return { state: s, error }
  const t = latex.trim()
  return { state: block ? insertBlock(s, `$$${t}$$`) : replaceSelection(s, `$${t}$`), error: null }
}

export const insertImage = (s: TextState, token: string): TextState => replaceSelection(s, `{{img:${token}}}`)

/** Client check before the upload (the server checks again). `null` = acceptable. */
export function imageProblem(file: { type: string; size: number }): string | null {
  return IMAGE_TYPES.includes(file.type) && file.size <= IMAGE_MAX_BYTES ? null : IMAGE_INVALID
}

/* ---- undo / redo -------------------------------------------------------------------------------------- */

export interface History {
  past: TextState[]
  future: TextState[]
}
export const emptyHistory = (): History => ({ past: [], future: [] })
const HISTORY_LIMIT = 100

/** Records `before` as an undo step (unless it equals the last one) and clears redo. */
export function pushHistory(h: History, before: TextState): History {
  const last = h.past[h.past.length - 1]
  if (last && last.value === before.value) return { past: h.past, future: [] }
  return { past: [...h.past, before].slice(-HISTORY_LIMIT), future: [] }
}
export function undo(h: History, now: TextState): { history: History; state: TextState } | null {
  const prev = h.past[h.past.length - 1]
  if (!prev) return null
  return { history: { past: h.past.slice(0, -1), future: [...h.future, now] }, state: prev }
}
export function redo(h: History, now: TextState): { history: History; state: TextState } | null {
  const next = h.future[h.future.length - 1]
  if (!next) return null
  return { history: { past: [...h.past, now], future: h.future.slice(0, -1) }, state: next }
}
