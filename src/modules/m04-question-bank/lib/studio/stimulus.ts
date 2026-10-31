/**
 * The stimulus form of the Studio (V2 Langkah 2 "Rangsangan"): kinds and their BM labels, the form state, the same rules the
 * stimulus API (T32, `POST /api/stimuli`) enforces, and the mapping to its bodies. The kind of a saved stimulus never changes.
 */
import type { StimulusCreateRequest, StimulusUpdateRequest } from '@pp/contract'

export const STIMULUS_KINDS = [
  { value: 'passage', label: 'Petikan' },
  { value: 'image', label: 'Gambar' },
  { value: 'diagram', label: 'Rajah' },
  { value: 'table', label: 'Jadual' },
  { value: 'map', label: 'Peta' },
  { value: 'infographic', label: 'Infografik' },
  { value: 'graph', label: 'Graf' },
] as const

export type StimulusKind = (typeof STIMULUS_KINDS)[number]['value']
const IMAGE_KINDS: readonly StimulusKind[] = ['image', 'diagram', 'map', 'infographic', 'graph']

export interface StimulusForm {
  kind: StimulusKind
  label: string
  caption: string
  alt: string
  body: string
  /** `table`: one row per line, cells separated by `|`; the first line is the header. */
  tableText: string
  sourceCitation: string
  imageToken: string | null
}

/** Shape of a stimulus as the API returns it (group detail `stimuli[]`). */
export interface WireStimulus {
  id: string
  kind: StimulusKind
  label: string
  body: { ms: string } | null
  imageId: string | null
  alt: string | null
  caption?: string | null | undefined
  sourceCitation?: string | null | undefined
  tableData?: { head: string[]; rows: string[][] } | null | undefined
}

export const STIMULUS_MESSAGES_BM = {
  passage: 'Petikan mesti mempunyai teks.',
  image: 'Sila muat naik imej untuk rangsangan ini.',
  table: 'Jadual mesti mempunyai kepala dan sekurang-kurangnya satu baris, atau imej.',
} as const

/** V2 Langkah 2: `Jenis rangsangan` defaults to passage. */
export function blankStimulus(kind: StimulusKind = 'passage'): StimulusForm {
  return { kind, label: '', caption: '', alt: '', body: '', tableText: '', sourceCitation: '', imageToken: null }
}

export const tableToText = (t: { head: string[]; rows: string[][] } | null | undefined): string =>
  t ? [t.head, ...t.rows].map((r) => r.join(' | ')).join('\n') : ''

/** Header and rows of the table text, or null when it has no header line plus one row. */
export function parseTable(text: string): { head: string[]; rows: string[][] } | null {
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l !== '')
  if (lines.length < 2) return null
  const cells = (l: string): string[] => l.split('|').map((c) => c.trim())
  return { head: cells(lines[0] as string), rows: lines.slice(1).map(cells) }
}

export function stimulusFormOf(s: WireStimulus): StimulusForm {
  return {
    kind: s.kind,
    label: s.label,
    caption: s.caption ?? '',
    alt: s.alt ?? '',
    body: s.body?.ms ?? '',
    tableText: tableToText(s.tableData),
    sourceCitation: s.sourceCitation ?? '',
    imageToken: s.imageId,
  }
}

/** The BM message of what stops the stimulus being saved (the API's kind rules), or null. */
export function stimulusIssue(f: StimulusForm): string | null {
  if (f.kind === 'passage' && f.body.trim() === '') return STIMULUS_MESSAGES_BM.passage
  if (f.kind === 'table' && parseTable(f.tableText) === null && f.imageToken === null) return STIMULUS_MESSAGES_BM.table
  if (IMAGE_KINDS.includes(f.kind) && f.imageToken === null) return STIMULUS_MESSAGES_BM.image
  return null
}

const orNull = (v: string): string | null => (v.trim() === '' ? null : v.trim())

export function toCreateBody(f: StimulusForm): StimulusCreateRequest {
  const table = parseTable(f.tableText)
  return {
    kind: f.kind,
    label: orNull(f.label),
    caption: orNull(f.caption),
    alt: orNull(f.alt),
    sourceCitation: orNull(f.sourceCitation),
    ...(f.body.trim() === '' ? {} : { body: { ms: f.body } }),
    ...(table === null ? {} : { tableData: table }),
    ...(f.imageToken === null ? {} : { imageFileId: f.imageToken }),
  }
}

/** Only the keys that differ from the saved form (`PUT /stimuli/:id` changes just those); null when nothing changed. */
export function toUpdateBody(now: StimulusForm, saved: StimulusForm): StimulusUpdateRequest | null {
  const out: StimulusUpdateRequest = {}
  if (now.label !== saved.label) out.label = orNull(now.label)
  if (now.caption !== saved.caption) out.caption = orNull(now.caption)
  if (now.alt !== saved.alt) out.alt = orNull(now.alt)
  if (now.sourceCitation !== saved.sourceCitation) out.sourceCitation = orNull(now.sourceCitation)
  if (now.body !== saved.body) out.body = now.body.trim() === '' ? null : { ms: now.body }
  if (now.tableText !== saved.tableText) out.tableData = parseTable(now.tableText)
  if (now.imageToken !== saved.imageToken) out.imageFileId = now.imageToken
  return Object.keys(out).length === 0 ? null : out
}
