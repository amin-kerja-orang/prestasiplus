/**
 * View-model helpers of the Tag DSKP block (v2-dskp-integration UX spec 3.x, DSKP-T07): option lists,
 * SP rows and flags, the derived SK, the TP descriptor lines and the AI state of one field. Pure
 * functions over a loaded `DskpSubjectView`; they never change a tag (see `domain/tag-edit.ts`) and
 * never decide validity (see `domain/tag-rule.ts`). All BM copy of the block is here so the copy
 * table of the spec has one home.
 */
import type { TagSuggestion } from '../../../domain/admin-types'
import type { CurriculumTag, FormOrigin, KbatLevel, TpLevel } from '../../../domain/types'
import { DSKP_FLAG_LABELS, DSKP_REVIEW_BADGE_FLAGS } from '../../../lib/dskp-source'
import type {
  DskpFlag,
  DskpSkNode,
  DskpSpNode,
  DskpSubjectInfo,
  DskpSubjectView,
  DskpUnitNode,
} from '../../../lib/dskp-source'
import type { IntakeQuestion } from '../types'
import type { TagField } from './suggestion'
import { tagFieldPath } from './suggestion'

const FLAG_REVIEW = 'perlu semakan'

/** BM copy of the block (design 9, exact wording; "." between figures is the middle dot). */
export const TAG_COPY = {
  legend: 'Tag DSKP',
  subject: (name: string): string => `Subjek: ${name}`,
  form: 'Asal tingkatan',
  formPlaceholder: 'Pilih tingkatan',
  unit: 'Unit',
  unitPlaceholder: 'Pilih unit',
  unitHint: (noun: string): string => `Mengikut ${noun} dalam DSKP`,
  unitReview: ` (${FLAG_REVIEW})`,
  unitMissing: (id: string): string => `${id} (tidak dijumpai dalam katalog)`,
  unitNone: 'Tiada unit dalam DSKP untuk subjek dan tingkatan ini.',
  sp: 'SP (Standard Pembelajaran)',
  spSearchAria: 'Cari SP',
  spSearchPlaceholder: 'Cari kod atau teks SP...',
  spNeedUnit: 'Pilih unit dahulu untuk melihat SP.',
  spCount: (n: number, m: number): string => `${n} SP dipilih · ${m} SP dalam unit ini`,
  spCountSearch: (k: number, n: number): string => `${k} SP sepadan · ${n} SP dipilih`,
  spNoMatch: (q: string): string => `Tiada SP sepadan dengan "${q}".`,
  spClearSearch: 'Kosongkan Carian',
  spNone: 'Tiada SP yang boleh dipilih dalam unit ini.',
  spRemove: (code: string): string => `Buang SP ${code}`,
  sk: 'SK (Standard Kandungan)',
  skEmpty: 'Dipaparkan selepas SP dipilih.',
  skHint: 'Dikira daripada SP dan tidak boleh diubah.',
  tp: 'TP (1-6)',
  tpPlaceholder: 'Pilih TP',
  kbat: 'Aras KBAT (pilihan)',
  kbatNone: 'Bukan KBAT',
  kbatHint: 'Tidak ditentukan oleh TP.',
  tpHeading: (tp: number, level?: string): string => (level ? `TP ${tp} - ${level}` : `TP ${tp}`),
  tpUnitSource: (noun: string, code: string): string => `Mengikut ${noun} ${code}`,
  tpSkSource: (code: string): string => `Mengikut SK ${code}`,
  tpGeneralSource: 'Mengikut jadual TP am subjek ini',
  tpRange: (a: number, b: number): string => `Berlaku untuk TP ${a}-${b}`,
  tpNone: 'Tiada penerangan TP dalam DSKP untuk unit ini.',
  tpNeedTp: 'Pilih TP untuk melihat penerangannya mengikut DSKP.',
  tpNeedTarget: 'Pilih unit dan SP untuk melihat penerangan TP.',
  tpOutside: 'Tiada penerangan TP DSKP untuk Tingkatan 1-3.',
  aiSuggested: 'Cadangan AI',
  aiConfidence: (level: string): string => `Cadangan AI · Keyakinan ${level}`,
  aiConfirmed: 'Disahkan',
  aiChanged: (value: string): string => `Diubah daripada cadangan AI: ${value}`,
  aiNoMatch: (what: 'unit' | 'SP'): string =>
    `AI tidak menjumpai ${what} yang sepadan. Pilih secara manual.`,
  confirmUnit: 'Saya sahkan unit DSKP (keyakinan rendah)',
  confirmSp: 'Saya sahkan SP (keyakinan rendah)',
  confirmTp: 'Saya sahkan TP (cadangan AI)',
  confirmKbat: 'Saya sahkan Aras KBAT (cadangan AI)',
  flagReview: FLAG_REVIEW,
  flagSpelling: 'perlu semakan ejaan',
  legendReview:
    'Tanda "perlu semakan" bermaksud teks DSKP ini belum disahkan sepenuhnya. SP masih boleh dipilih.',
  legendSpelling: 'Ejaan Jawi bagi SP ini belum disahkan. SP masih boleh dipilih.',
  noticeForm: 'Unit dan SP dikosongkan kerana tingkatan berubah.',
  noticeUnit: 'SP dikosongkan kerana unit berubah.',
  outside: 'Tingkatan 1-3 berada di luar DSKP. Unit dan SP tidak diperlukan; TP masih wajib.',
  reviewTitle: 'Perlu semakan tag',
  reviewText:
    'Tag soalan ini belum disahkan. Pilih tingkatan, unit dan SP daripada DSKP, kemudian hantar versi baharu.',
  loadError: 'Tidak dapat memuatkan senarai DSKP bagi subjek ini. Sila cuba semula.',
} as const

export const TINGKATAN_OPTIONS: readonly { value: FormOrigin; label: string }[] = [
  { value: 'T4', label: 'Tingkatan 4' },
  { value: 'T5', label: 'Tingkatan 5' },
  { value: 'T1-T3', label: 'Tingkatan 1-3 (di luar DSKP)' },
]

export const KBAT_LABEL: Record<KbatLevel, string> = {
  mengaplikasi: 'Mengaplikasi',
  menganalisis: 'Menganalisis',
  menilai: 'Menilai',
  mencipta: 'Mencipta',
}

export const TP_LEVELS: readonly TpLevel[] = [1, 2, 3, 4, 5, 6]

export const CONFIDENCE_WORD = { tinggi: 'tinggi', sederhana: 'sederhana', rendah: 'rendah' } as const

/* ------------------------------------------------------------------------------ flags */

export interface ReviewFlag {
  /** The badge word. */
  text: string
  /** Specific reason(s), the tooltip text. */
  reason: string
  /** Pendidikan Islam style spelling flag. */
  spelling: boolean
}

/** The "perlu semakan" badge of a node, or null (AC-03.3: a flag never blocks use). */
export function reviewFlag(flags: readonly DskpFlag[]): ReviewFlag | null {
  const hits = flags.filter((f) => DSKP_REVIEW_BADGE_FLAGS.includes(f))
  if (hits.length === 0) return null
  const spelling = hits.includes('perluSemakanEjaan')
  return {
    text: spelling ? TAG_COPY.flagSpelling : TAG_COPY.flagReview,
    reason: hits.map((f) => DSKP_FLAG_LABELS[f]).join(', '),
    spelling,
  }
}

/** The legend line for the flagged rows that are visible, or null when none is flagged. */
export function flagLegend(rows: readonly { flag: ReviewFlag | null }[]): string | null {
  const flagged = rows.filter((r) => r.flag !== null)
  if (flagged.length === 0) return null
  return flagged.every((r) => r.flag?.spelling) ? TAG_COPY.legendSpelling : TAG_COPY.legendReview
}

/* ------------------------------------------------------------------------------ unit */

export interface UnitOptionView {
  id: string
  label: string
}
export interface UnitGroupView {
  key: string
  /** null = a flat list (the subject prints no grouping). */
  label: string | null
  units: UnitOptionView[]
}

/**
 * "{kod} - {tajuk}" as printed, with the review suffix for a node flag. The subject-wide Pendidikan Islam
 * spelling flag is not repeated on every unit (it shows on the SK and SP rows).
 */
export function unitOptionLabel(u: DskpUnitNode): string {
  const flagged = u.flags.some((f) => f !== 'perluSemakanEjaan' && DSKP_REVIEW_BADGE_FLAGS.includes(f))
  return `${u.code} - ${u.title}${flagged ? TAG_COPY.unitReview : ''}`
}

/** The units of a tingkatan in print order, grouped by Bidang/Tema where the subject prints one. */
export function unitOptionGroups(
  view: DskpSubjectView,
  tingkatan: 'T4' | 'T5',
): UnitGroupView[] {
  const units = view.units(tingkatan)
  const out = new Map<string, UnitGroupView>()
  for (const u of units) {
    const key = u.groupId ?? ''
    let g = out.get(key)
    if (!g) {
      const node = u.groupId ? view.group(u.groupId) : undefined
      g = {
        key,
        label: node ? (node.code ? `${node.code} ${node.title}` : node.title) : null,
        units: [],
      }
      out.set(key, g)
    }
    g.units.push({ id: u.id, label: unitOptionLabel(u) })
  }
  return [...out.values()]
}

/** A stored unit id the catalogue no longer lists for the chosen tingkatan (AC-07.7). */
export function missingUnitId(
  view: DskpSubjectView | undefined,
  tag: CurriculumTag,
): string | null {
  if (!view || !tag.unitId) return null
  if (tag.formOrigin !== 'T4' && tag.formOrigin !== 'T5') return null
  return view.units(tag.formOrigin).some((u) => u.id === tag.unitId) ? null : tag.unitId
}

/* ------------------------------------------------------------------------------ SP / SK */

export interface SpRowView {
  id: string
  code: string
  text: string
  flag: ReviewFlag | null
}

export const spRow = (sp: DskpSpNode): SpRowView => ({
  id: sp.id,
  code: sp.code,
  text: sp.text,
  flag: reviewFlag(sp.flags),
})

/**
 * The SP of a unit that match a search box (token AND over code and text, case, diacritic and
 * tashkil insensitive: the catalogue search), in print order. An empty query returns every SP.
 */
export function filterSps(
  view: DskpSubjectView,
  unitId: string,
  all: readonly DskpSpNode[],
  query: string,
): readonly DskpSpNode[] {
  if (query.trim() === '') return all
  const hits = view.search(query, {
    unitId: unitId as DskpSpNode['unitId'],
    kinds: ['sp'],
    limit: Math.max(all.length, 1),
  })
  const ids = new Set(hits.map((h) => h.node.id))
  return all.filter((sp) => ids.has(sp.id))
}

/** `ids` sorted into catalogue print order (chips and data never follow click order). */
export function inPrintOrder<T extends string>(
  view: DskpSubjectView,
  unitId: string | null,
  ids: readonly T[],
): T[] {
  if (!unitId) return [...ids]
  const order = view.sps(unitId as DskpSpNode['unitId']).map((s) => s.id as string)
  const rank = (id: string): number => {
    const i = order.indexOf(id)
    return i === -1 ? order.length : i
  }
  return [...ids].sort((a, b) => rank(a) - rank(b))
}

export interface SkRowView {
  id: string
  code: string
  title: string
  flag: ReviewFlag | null
}

/** The distinct SK of the chosen SP, in print order (derived, never stored). */
export function skRows(view: DskpSubjectView, spIds: readonly string[]): SkRowView[] {
  return view
    .skIdsOf(spIds as DskpSpNode['id'][])
    .map((id) => view.sk(id))
    .filter((s): s is DskpSkNode => s !== undefined)
    .map((s) => ({ id: s.id, code: s.code, title: s.title, flag: reviewFlag(s.flags) }))
}

/* ------------------------------------------------------------------------------ TP descriptor */

export interface TpDescriptorItem {
  heading: string
  text: string
  source: string
  /** "Berlaku untuk TP a-b" for a descriptor printed for a range. */
  range: string | null
}

export type TpDescription =
  | { kind: 'outside' }
  | { kind: 'need-target' }
  | { kind: 'need-tp' }
  | { kind: 'none' }
  | { kind: 'found'; items: TpDescriptorItem[]; rtl: boolean }

/** What to show under the TP select (design 3.5); help text only, it never changes the TP. */
export function describeTp(
  view: DskpSubjectView | undefined,
  info: DskpSubjectInfo | undefined,
  tag: CurriculumTag,
): TpDescription {
  if (tag.formOrigin === 'T1-T3') return { kind: 'outside' }
  const needsSp = info?.tpLevel === 'sk'
  if (!view || !info || !tag.unitId || (needsSp && tag.spIds.length === 0))
    return { kind: 'need-target' }
  if (tag.tp === null) return { kind: 'need-tp' }
  const resolved = view.tpFor({ unitId: tag.unitId, spIds: tag.spIds }, tag.tp)
  if (resolved.length === 0) return { kind: 'none' }
  const items = resolved.map((r): TpDescriptorItem => {
    let source: string = TAG_COPY.tpGeneralSource
    if (r.source === 'unit') {
      const u = r.nodeId ? view.unit(r.nodeId as DskpUnitNode['id']) : undefined
      source = TAG_COPY.tpUnitSource(info.unitNoun, u?.code ?? '')
    } else if (r.source === 'sk') {
      const s = r.nodeId ? view.sk(r.nodeId as DskpSkNode['id']) : undefined
      source = TAG_COPY.tpSkSource(s?.code ?? '')
    }
    const range = r.descriptor.range
    return {
      heading: TAG_COPY.tpHeading(tag.tp as number, r.descriptor.label),
      text: r.descriptor.text,
      source,
      range: range ? TAG_COPY.tpRange(range[0], range[1]) : null,
    }
  })
  return { kind: 'found', items, rtl: info.rtlFields.includes('tp') }
}

/* ------------------------------------------------------------------------------ AI state */

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)

const COPY_CONFIRM: Record<TagField, string> = {
  unit: TAG_COPY.confirmUnit,
  sp: TAG_COPY.confirmSp,
  tp: TAG_COPY.confirmTp,
  kbat: TAG_COPY.confirmKbat,
}
export const confirmText = (f: TagField): string => COPY_CONFIRM[f]

function currentOf(tag: CurriculumTag, f: TagField): unknown {
  return f === 'unit' ? tag.unitId : f === 'sp' ? tag.spIds : f === 'tp' ? tag.tp : tag.kbat
}
function suggestedOf(s: TagSuggestion | undefined, f: TagField): unknown {
  if (!s) return undefined
  return f === 'unit' ? s.unitId : f === 'sp' ? s.spIds : f === 'tp' ? s.tp : s.kbat
}
const filled = (v: unknown): boolean =>
  Array.isArray(v) ? v.length > 0 : v !== null && v !== undefined && v !== ''

export interface AiFieldState {
  /** AI badge on the label: suggestion not yet confirmed, or confirmed. */
  badge: { kind: 'suggested'; confidence: string | null; warning: boolean } | { kind: 'confirmed' } | null
  /** The "Saya sahkan ..." box (shown while the value is the suggestion and needs confirming). */
  confirm: boolean
  confirmed: boolean
  /** The person changed the value away from the AI suggestion: the suggested value. */
  changedFrom: unknown
  /** AI found no catalogue node for this field (unit and SP only). */
  noMatch: boolean
}

/**
 * The AI state of one field (design 3.6). `needsConfirm` is whether the field is in `lowFields`
 * (and asked for at this tingkatan). The suggestion is never styled as final; a value the person
 * changed has no badge, and a stale tick is not counted (the gate reads `tagFieldResolved`).
 */
export function aiFieldState(q: IntakeQuestion, f: TagField, needsConfirm: boolean): AiFieldState {
  const none: AiFieldState = { badge: null, confirm: false, confirmed: false, changedFrom: undefined, noMatch: false }
  const s = q.tagSuggestion
  if (!s) return none
  const suggested = suggestedOf(s, f)
  const value = currentOf(q.tag, f)
  if (!filled(suggested)) {
    if (f === 'unit')
      return { ...none, noMatch: !filled(value) && q.lowFields.includes(tagFieldPath('unit')) }
    if (f === 'sp')
      return {
        ...none,
        noMatch:
          filled(s.unitId) && q.tag.unitId === s.unitId && !filled(value),
      }
    return none
  }
  if (!same(value, suggested)) return { ...none, changedFrom: suggested }
  const confirmed = needsConfirm && q.confirmed.includes(tagFieldPath(f))
  const level = s.confidence[f]
  return {
    badge: confirmed
      ? { kind: 'confirmed' }
      : { kind: 'suggested', confidence: level ?? null, warning: level === 'rendah' },
    confirm: needsConfirm && filled(value),
    confirmed,
    changedFrom: undefined,
    noMatch: false,
  }
}

/** The suggested value as a short label for "Diubah daripada cadangan AI: {nilai}". */
export function suggestionLabel(view: DskpSubjectView | undefined, f: TagField, v: unknown): string {
  if (f === 'unit') {
    const u = view?.unit(String(v) as DskpUnitNode['id'])
    return u ? `${u.code} - ${u.title}` : String(v)
  }
  if (f === 'sp') {
    return (v as string[])
      .map((id) => view?.sp(id as DskpSpNode['id'])?.code ?? id)
      .join(', ')
  }
  if (f === 'kbat') return KBAT_LABEL[v as KbatLevel] ?? String(v)
  return String(v)
}
