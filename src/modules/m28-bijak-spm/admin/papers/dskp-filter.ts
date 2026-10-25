/**
 * DSKP columns, filters and tag history for the bank and the review screens (v2-dskp-integration
 * UX spec section 6 and 7). Pure functions over the catalogue view and the `BankRow` / `HistoryEntry`
 * shapes, so the dependency rules, the chips and the history lines are testable without a page.
 */
import type { DskpSubjectView, DskpTingkatan } from '@/modules/m03-curriculum'

import type { Confidence, HistoryEntry, TagChange, TagFilter } from '../../domain/admin-types'
import type { FormOrigin, KbatLevel } from '../../domain/types'
import { KBAT_LEVELS } from '../../domain/types'
import { REVIEW_TOPIC, T1_T3_TOPIC } from '../../domain/topic'
import { dskpCodeOf } from '../../lib/dskp-source'

export { REVIEW_TOPIC, T1_T3_TOPIC }

/* ---------------------------------------------------------------------------------- labels */

export const KBAT_LABEL: Record<KbatLevel, string> = {
  mengaplikasi: 'Mengaplikasi',
  menganalisis: 'Menganalisis',
  menilai: 'Menilai',
  mencipta: 'Mencipta',
}

export const FORM_LABEL: Record<FormOrigin, string> = {
  T4: 'Tingkatan 4',
  T5: 'Tingkatan 5',
  'T1-T3': T1_T3_TOPIC,
}

export const FORM_FILTER_ITEMS = [
  { label: 'Semua tingkatan', value: '' },
  { label: FORM_LABEL.T4, value: 'T4' },
  { label: FORM_LABEL.T5, value: 'T5' },
  { label: FORM_LABEL['T1-T3'], value: 'T1-T3' },
]

export const TP_FILTER_ITEMS = [
  { label: 'Semua TP', value: '' },
  ...[1, 2, 3, 4, 5, 6].map((n) => ({ label: `TP ${n}`, value: String(n) })),
]

export const KBAT_FILTER_ITEMS = [
  { label: 'Semua', value: '' },
  { label: 'Ya', value: 'ya' },
  { label: 'Tidak', value: 'tidak' },
  ...KBAT_LEVELS.map((k) => ({ label: KBAT_LABEL[k], value: k })),
]

/* ------------------------------------------------------------------------- filter draft */

/** The curriculum part of a filter bar; every field is a string so it binds to a native select. */
export interface DskpFilterDraft {
  formOrigin: '' | FormOrigin
  unitId: string
  spId: string
  tp: string
  kbat: string
  tagReview: boolean
}

export const emptyDskpFilter = (): DskpFilterDraft => ({
  formOrigin: '',
  unitId: '',
  spId: '',
  tp: '',
  kbat: '',
  tagReview: false,
})

/** True when the catalogue unit `unitId` belongs to the tingkatan `form` (ids carry it: `MAT:T4:u:1.0`). */
export function unitBelongs(unitId: string, form: string): boolean {
  if (!unitId) return true
  if (form === '') return true
  return unitId.split(':')[1] === form
}

/**
 * The dependency rules of the bar (6.1), applied the moment a field changes: a new Subjek clears
 * Unit and SP; a new Tingkatan clears Unit and SP only when the chosen Unit is of another
 * tingkatan; a new Unit clears SP.
 */
export function clearOnSubject(d: DskpFilterDraft): void {
  d.unitId = ''
  d.spId = ''
}
export function clearOnForm(d: DskpFilterDraft): void {
  if (d.unitId && !unitBelongs(d.unitId, d.formOrigin)) {
    d.unitId = ''
    d.spId = ''
  }
  // Tingkatan 1-3 has no unit and no SP.
  if (d.formOrigin === 'T1-T3') {
    d.unitId = ''
    d.spId = ''
  }
}
export function clearOnUnit(d: DskpFilterDraft): void {
  d.spId = ''
}

/** The `listBank` filter for a curriculum draft (empty fields are left out). */
export function dskpServerFilter(d: DskpFilterDraft): TagFilter & { tagReview?: true } {
  return {
    ...(d.formOrigin ? { formOrigin: d.formOrigin } : {}),
    ...(d.unitId ? { unitId: d.unitId } : {}),
    ...(d.spId ? { spId: d.spId } : {}),
    ...(d.tp ? { tp: Number(d.tp) } : {}),
    ...(d.kbat ? { kbat: d.kbat as NonNullable<TagFilter['kbat']> } : {}),
    ...(d.tagReview ? { tagReview: true } : {}),
  }
}

/* ------------------------------------------------------------------------ select options */

export interface UnitOption {
  value: string
  label: string
}
/** A run of units shown under one `optgroup` (label set) or as plain options (label null). */
export interface UnitGroup {
  label: string | null
  units: UnitOption[]
}

const unitText = (code: string, title: string): string => `${code} - ${title}`

/**
 * Unit options of a subject (6.1). With one tingkatan: that tingkatan's units in print order, under
 * their Bidang / Tema where the subject prints one. Without: two groups "Tingkatan 4" and
 * "Tingkatan 5" (codes repeat across forms, the group tells them apart). Never sorted.
 */
export function unitGroups(view: DskpSubjectView | undefined, form: string): UnitGroup[] {
  if (!view || form === 'T1-T3') return []
  const forms: DskpTingkatan[] = form === 'T4' || form === 'T5' ? [form] : ['T4', 'T5']
  const out: UnitGroup[] = []
  for (const t of forms) {
    const units = view.units(t)
    if (forms.length > 1) {
      if (units.length)
        out.push({
          label: FORM_LABEL[t],
          units: units.map((u) => ({ value: u.id, label: unitText(u.code, u.title) })),
        })
      continue
    }
    let current: UnitGroup | null = null
    let currentGroup: string | undefined
    for (const u of units) {
      if (!current || u.groupId !== currentGroup) {
        const g = u.groupId ? view.group(u.groupId) : undefined
        current = { label: g ? (g.code ? `${g.code} ${g.title}` : g.title) : null, units: [] }
        currentGroup = u.groupId
        out.push(current)
      }
      current.units.push({ value: u.id, label: unitText(u.code, u.title) })
    }
  }
  return out
}

/** SP options of one unit: "{kod} - {teks}", selectable SP only, print order. */
export function spOptions(view: DskpSubjectView | undefined, unitId: string): UnitOption[] {
  if (!view || !unitId) return []
  return view
    .sps(unitId as Parameters<DskpSubjectView['sps']>[0])
    .map((sp) => ({ value: sp.id, label: unitText(sp.code, sp.text) }))
}

/* ------------------------------------------------------------------------------- chips */

export interface AppliedDskp extends DskpFilterDraft {
  /** "{kod} {tajuk}" of the unit and the printed code of the SP, taken when the filter was applied. */
  unitLabel: string
  spCode: string
}

/** The labels a chip needs, read from the catalogue view at the moment the filter is applied. */
export function appliedDskp(d: DskpFilterDraft, view: DskpSubjectView | undefined): AppliedDskp {
  const unit = d.unitId ? view?.unit(d.unitId as Parameters<DskpSubjectView['unit']>[0]) : undefined
  const sp = d.spId ? view?.sp(d.spId as Parameters<DskpSubjectView['sp']>[0]) : undefined
  return {
    ...d,
    unitLabel: unit ? `${unit.code} ${unit.title}` : d.unitId ? dskpCodeOf(d.unitId) : '',
    spCode: sp ? sp.code : d.spId ? dskpCodeOf(d.spId) : '',
  }
}

/** Active-filter chips, labels are the values (6.1). */
export function dskpChips(a: AppliedDskp): { key: string; label: string }[] {
  return [
    ...(a.formOrigin ? [{ key: 'formOrigin', label: FORM_LABEL[a.formOrigin] }] : []),
    ...(a.unitId ? [{ key: 'unitId', label: `Unit ${a.unitLabel}` }] : []),
    ...(a.spId ? [{ key: 'spId', label: `SP ${a.spCode}` }] : []),
    ...(a.tp ? [{ key: 'tp', label: `TP ${a.tp}` }] : []),
    ...(a.kbat
      ? [
          {
            key: 'kbat',
            label: `KBAT: ${
              a.kbat === 'ya'
                ? 'Ya'
                : a.kbat === 'tidak'
                  ? 'Tidak'
                  : KBAT_LABEL[a.kbat as KbatLevel]
            }`,
          },
        ]
      : []),
    ...(a.tagReview ? [{ key: 'tagReview', label: 'Perlu semakan tag' }] : []),
  ]
}

/** Removing a chip clears its field, and removing the Unit also removes the SP (6.1). */
export function removeDskpChip(d: DskpFilterDraft, key: string): void {
  switch (key) {
    case 'formOrigin':
      d.formOrigin = ''
      break
    case 'unitId':
      d.unitId = ''
      d.spId = ''
      break
    case 'spId':
      d.spId = ''
      break
    case 'tp':
      d.tp = ''
      break
    case 'kbat':
      d.kbat = ''
      break
    case 'tagReview':
      d.tagReview = false
      break
  }
}

/* --------------------------------------------------------------------------- row badges */

/** The tag fields of a bank row (or of a review item) that the badge row shows. */
export interface TagBadgeData {
  /** Display copy: unit title, the T1-T3 copy, or "Perlu semakan tag". */
  topic: string
  formOrigin: FormOrigin | null
  spCodes: readonly string[]
  tp: number | null
  kbat: KbatLevel | null
  tagReview: boolean
}

/** "SP 1.1.6", "SP 1.1.6, 1.1.7" (two at most), then "SP 1.1.6 +2" (the first and how many more). */
export function spBadgeText(codes: readonly string[]): string {
  if (codes.length <= 2) return `SP ${codes.join(', ')}`
  return `SP ${codes[0]} +${codes.length - 1}`
}

/** Card value of the TP field: "TP 3" and, when set, "TP 3 · KBAT Menilai". */
export function tpCardText(row: Pick<TagBadgeData, 'tp' | 'kbat'>): string {
  const tp = row.tp === null ? '' : `TP ${row.tp}`
  const kbat = row.kbat ? `KBAT ${KBAT_LABEL[row.kbat]}` : ''
  return [tp, kbat].filter(Boolean).join(' · ')
}

/* ----------------------------------------------------------------------------- history */

const FIELD_ORDER: TagChange['field'][] = ['formOrigin', 'unit', 'sp', 'tp', 'kbat']
const FIELD_LABEL: Record<TagChange['field'], string> = {
  formOrigin: 'Tingkatan',
  unit: 'Unit',
  sp: 'SP',
  tp: 'TP',
  kbat: 'Aras KBAT',
}
const CONFIDENCE_WORD: Record<Confidence, string> = {
  tinggi: 'tinggi',
  sederhana: 'sederhana',
  rendah: 'rendah',
}

const EMPTY = '(kosong)'
const NOT_FOUND = '(tidak dijumpai dalam katalog)'

/**
 * One value of a tag change as the history prints it (7.2): unit as "{kod} - {tajuk}", SP as
 * printed codes only (never Jawi text), "(kosong)" for a missing value and "(bukan KBAT)" for an
 * empty KBAT. An id the catalogue does not know is printed with "(tidak dijumpai dalam katalog)".
 */
export function formatTagValue(
  field: TagChange['field'],
  value: unknown,
  view: DskpSubjectView | undefined,
): string {
  switch (field) {
    case 'formOrigin':
      return typeof value === 'string' && value in FORM_LABEL
        ? FORM_LABEL[value as FormOrigin]
        : EMPTY
    case 'unit': {
      if (typeof value !== 'string' || !value) return EMPTY
      const u = view?.unit(value as Parameters<DskpSubjectView['unit']>[0])
      if (u) return unitText(u.code, u.title)
      return view ? `${value} ${NOT_FOUND}` : dskpCodeOf(value)
    }
    case 'sp': {
      const ids = Array.isArray(value)
        ? (value as string[])
        : typeof value === 'string'
          ? [value]
          : []
      if (!ids.length) return EMPTY
      return ids
        .map((id) => {
          const sp = view?.sp(id as Parameters<DskpSubjectView['sp']>[0])
          if (sp) return sp.code
          return view ? `${id} ${NOT_FOUND}` : dskpCodeOf(id)
        })
        .join(', ')
    }
    case 'tp':
      return typeof value === 'number' ? String(value) : EMPTY
    case 'kbat':
      return typeof value === 'string' && value in KBAT_LABEL
        ? KBAT_LABEL[value as KbatLevel]
        : '(bukan KBAT)'
  }
}

const sameValue = (a: unknown, b: unknown): boolean => {
  const key = (v: unknown): string =>
    JSON.stringify(Array.isArray(v) ? ([...v] as unknown[]).sort() : (v ?? null))
  return key(a) === key(b)
}

export interface TagLine {
  field: TagChange['field']
  /** "Tingkatan", "Unit", "SP", "TP" or "Aras KBAT". */
  label: string
  /** Absent on first tagging. */
  before?: string
  after: string
  /** " (cadangan AI: 3, keyakinan sederhana)" and its variants; '' when there was no suggestion. */
  suffix: string
}

/** The lines under a history entry, in the order Tingkatan, Unit, SP, TP, Aras KBAT. */
export function tagLines(entry: HistoryEntry, view: DskpSubjectView | undefined): TagLine[] {
  const changes = entry.tag ?? []
  return [...changes]
    .sort((a, b) => FIELD_ORDER.indexOf(a.field) - FIELD_ORDER.indexOf(b.field))
    .map((c) => {
      const conf = c.confidence ? `, keyakinan ${CONFIDENCE_WORD[c.confidence]}` : ''
      let suffix = ''
      if (c.ai !== undefined) {
        suffix = sameValue(c.ai, c.after)
          ? ` (cadangan AI diterima${conf})`
          : ` (cadangan AI: ${formatTagValue(c.field, c.ai, view)}${conf})`
      }
      return {
        field: c.field,
        label: FIELD_LABEL[c.field],
        ...('before' in c ? { before: formatTagValue(c.field, c.before, view) } : {}),
        after: formatTagValue(c.field, c.after, view),
        suffix,
      }
    })
}
