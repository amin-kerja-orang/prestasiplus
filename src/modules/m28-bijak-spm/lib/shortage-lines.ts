/**
 * BM lines for the student's Jana Kertas shortage alert (design 7.2, architecture 6.4). The contract
 * carries data, not prose; the text is built here from `kind`. Numbers are the real eligible counts.
 */
import type { BijakGenerateShortage } from '@pp/contract'

/** Lines shown before the rest collapse behind "Tunjuk {n} lagi" (design D-11). */
export const SHORTAGE_LINE_CAP = 5

const BLOCKING_LABEL: Record<NonNullable<BijakGenerateShortage['blocking']>, string> = {
  kbat: 'KBAT',
  tp: 'TP',
  marks: 'markah',
  quota: 'kuota topik',
}

/** DSKP label of a short unit, e.g. "T5 5.0 Transformasi"; the T1-T3 bucket prints "T1-T3". */
export function unitLabel(unit: BijakGenerateShortage['unit']): string {
  if (!unit) return ''
  if (unit.kind === 't1_t3') return 'T1-T3'
  return [unit.level, unit.code, unit.title].filter(Boolean).join(' ')
}

export function shortageLine(s: BijakGenerateShortage): string {
  const count = `${s.section}: perlu ${s.need} soalan, hanya ${s.have} tersedia`
  switch (s.kind) {
    case undefined:
    case 'count':
      return count
    case 'marks': {
      if (s.slot && s.marksMin !== undefined && s.marksMax !== undefined) {
        const range = s.marksMin === s.marksMax ? `${s.marksMin}` : `${s.marksMin}-${s.marksMax}`
        return `${s.section} soalan ${s.slot.from}-${s.slot.to}: perlu soalan ${range} markah, hanya ${s.have} tersedia`
      }
      return `${s.section}: tidak dapat menyusun ${s.need} markah daripada soalan yang tersedia`
    }
    case 'tp': {
      const slot = s.slot ? ` soalan ${s.slot.from}-${s.slot.to}` : ''
      const band = s.tp ? `TP ${s.tp.min}-${s.tp.max}` : 'TP yang ditetapkan'
      return s.have > 0
        ? `${s.section}${slot}: perlu ${s.need} soalan pada ${band}, hanya ${s.have} tersedia`
        : `${s.section}${slot}: tiada soalan layak pada ${band}`
    }
    case 'unit': {
      const what = s.basis === 'marks' ? 'markah' : 'soalan'
      const unit = unitLabel(s.unit)
      return `${s.section}: perlu ${s.need} ${what}${unit ? ` ${unit}` : ''}, hanya ${s.have} tersedia`
    }
    case 'level_share':
      return `${s.section}: nisbah Tingkatan 4 : 5 tidak dapat dipenuhi daripada soalan yang tersedia`
    case 'kbat':
      return `${s.section}: perlu ${s.need} markah KBAT, hanya ${s.have} tersedia`
    case 'combination':
      return s.blocking
        ? `${s.section}: syarat ${BLOCKING_LABEL[s.blocking]} tidak dapat dipenuhi bersama syarat lain`
        : `${s.section}: syarat tidak dapat dipenuhi bersama syarat lain`
    case 'overlap':
      return s.otherSection
        ? `${s.section}: soalan yang diperlukan telah digunakan oleh ${s.otherSection}`
        : count
    default:
      return count
  }
}
