/**
 * Typed shortage lines and their BM formatter (architecture 6.4; AC-03.2, 34.4, 34.9, 35.8, 36.7,
 * 36.8, 37.4). The contract carries data, not prose; the BM line is built here from `kind`.
 * `shortageLine` accepts the old `{ section, need, have }` shape too (kind absent = count).
 */
import type { UnitRef } from './standard-model'

export const SHORTAGE_KINDS = [
  'count',
  'marks',
  'tp',
  'unit',
  'kbat',
  'level_share',
  'combination',
  'overlap',
] as const
export type ShortageKind = (typeof SHORTAGE_KINDS)[number]

/** A unit reference with the display fields a response adds. */
export type UnitLabelRef = UnitRef & { code?: string; level?: 'T4' | 'T5'; title?: string }

export interface StandardShortage {
  /** Section label (Bahagian A). */
  section: string
  need: number
  have: number
  kind?: ShortageKind
  basis?: 'questions' | 'marks'
  unit?: UnitLabelRef
  slot?: { from: number; to: number }
  tp?: { min: number; max: number }
  blocking?: 'kbat' | 'tp' | 'marks' | 'quota'
  otherSection?: string
  /** Not on the wire (the contract has no field for it): marks band of a `marks` shortage on a slot group (AC-34.9). */
  marksBand?: { min?: number; max?: number }
}

export function unitLabel(u: UnitLabelRef | undefined): string {
  if (!u) return ''
  if (u.kind === 't1_t3') return 'T1-T3, luar DSKP'
  const head = [u.level, u.code].filter(Boolean).join(' ')
  const label = [head, u.title].filter(Boolean).join(' ')
  return label || `unit ${u.nodeId}`
}

const slotText = (s: { from: number; to: number } | undefined) =>
  !s ? '' : s.from === s.to ? ` soalan ${s.from}` : ` soalan ${s.from}-${s.to}`
const range = (a: number, b: number) => (a === b ? `${a}` : `${a}-${b}`)

const BLOCKING_TEXT: Record<NonNullable<StandardShortage['blocking']>, string> = {
  kbat: 'KBAT',
  tp: 'TP',
  marks: 'markah',
  quota: 'topik',
}

/** BM line for one shortage. Wording for the first six kinds is the AC wording; all are [PROPOSED]. */
export function shortageLine(s: StandardShortage): string {
  switch (s.kind) {
    case 'marks':
      if (s.slot) {
        const mb = s.marksBand
        const b =
          mb?.min !== undefined && mb.max !== undefined
            ? ` dengan ${range(mb.min, mb.max)} markah`
            : mb?.min !== undefined
              ? ` dengan sekurang-kurangnya ${mb.min} markah`
              : mb?.max !== undefined
                ? ` dengan tidak lebih ${mb.max} markah`
                : ' dengan markah yang ditetapkan'
        return `${s.section}${slotText(s.slot)}: tiada soalan layak${b}`
      }
      return `${s.section}: tidak dapat menyusun ${s.need} markah daripada soalan yang tersedia`
    case 'tp': {
      const band = s.tp ? ` pada TP ${range(s.tp.min, s.tp.max)}` : ''
      if (s.have === 0) return `${s.section}${slotText(s.slot)}: tiada soalan layak${band}`
      return `${s.section}${slotText(s.slot)}: perlu ${s.need} soalan${band}, hanya ${s.have} tersedia`
    }
    case 'unit': {
      const what = s.basis === 'marks' ? 'markah' : 'soalan'
      return `${s.section}: perlu ${s.need} ${what} ${unitLabel(s.unit)}, hanya ${s.have} tersedia`
    }
    case 'kbat':
      return `${s.section}: perlu ${s.need} markah KBAT, hanya ${s.have} tersedia`
    case 'level_share':
      return `${s.section}: nisbah Tingkatan 4 : 5 tidak dapat dipenuhi daripada soalan yang tersedia`
    case 'combination':
      return `${s.section}: syarat ${s.blocking ? BLOCKING_TEXT[s.blocking] : 'bahagian'} tidak dapat dipenuhi bersama syarat lain`
    case 'overlap':
      return `${s.section}: soalan yang diperlukan telah digunakan oleh ${s.otherSection ?? 'bahagian lain'}`
    case 'count':
    default:
      return `${s.section}: perlu ${s.need} soalan, hanya ${s.have} tersedia`
  }
}
