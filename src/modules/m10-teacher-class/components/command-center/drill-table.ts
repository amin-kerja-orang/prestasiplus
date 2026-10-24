/**
 * The drill table of each type (FN-M10-2.2.7): header texts and cell texts of the rows. Columns named in
 * the discovery script are exact; the columns of `students` and `engagement` after "Pelajar" are
 * PROPOSED (the live script shows "…", never observed with rows).
 */
import { formatMyt } from '@/lib/time'

import type { CcDrillRowMap, CcDrillType } from '../../api/command-center-types'
import { accuracyTone, gpsTone, plain } from './copy'

export type DrillCell = {
  text: string
  /** Token text colour class (`text-success`, ...). */
  tone?: string
  mono?: boolean
}
export type DrillRow = {
  /** A row with a student id opens the student page in a new tab. */
  studentId?: number
  cells: DrillCell[]
}
export interface DrillTable {
  headers: string[]
  rows: DrillRow[]
}

const pct = (value: number): DrillCell => ({
  text: `${plain(value)}%`,
  tone: accuracyTone(value),
  mono: true,
})
const num = (value: number): DrillCell => ({ text: String(value), mono: true })
const txt = (text: string): DrillCell => ({ text })
const when = (iso: string | null): DrillCell => ({
  text: iso ? formatMyt(iso, 'dd/MM/yyyy HH:mm') : '-',
})

export const BAND_LABEL: Record<string, string> = {
  champion: 'Juara',
  consistent: 'Konsisten',
  developing: 'Berkembang',
  minimum: 'Minimum',
  disengaged: 'Tidak Terlibat',
}

export function drillTable<T extends CcDrillType>(type: T, rows: CcDrillRowMap[T][]): DrillTable {
  switch (type) {
    case 'students':
      return {
        headers: ['Pelajar', 'Kelas', 'Jawapan', 'Ketepatan', 'Terakhir Aktif', 'Status'],
        rows: (rows as CcDrillRowMap['students'][]).map((r) => ({
          studentId: r.studentId,
          cells: [
            txt(r.name),
            txt(r.className),
            num(r.answered),
            pct(r.accuracy),
            when(r.lastActiveAt),
            { text: r.status, tone: r.status === 'Aktif' ? 'text-success' : 'text-muted' },
          ],
        })),
      }
    case 'today':
      return {
        headers: ['Masa', 'Pelajar', 'Subjek', 'Soalan', 'Betul', 'Ketepatan'],
        rows: (rows as CcDrillRowMap['today'][]).map((r) => ({
          studentId: r.studentId,
          cells: [
            { text: r.time, mono: true },
            txt(r.student),
            txt(r.subject),
            num(r.answered),
            num(r.correct),
            pct(r.accuracy),
          ],
        })),
      }
    case 'subjects':
      return {
        headers: ['Subjek', 'Jawapan', 'Betul', 'Ketepatan', 'Pelajar'],
        rows: (rows as CcDrillRowMap['subjects'][]).map((r) => ({
          cells: [
            txt(r.subject),
            num(r.answered),
            num(r.correct),
            pct(r.accuracy),
            num(r.students),
          ],
        })),
      }
    case 'gps':
      return {
        headers: ['Subjek', 'GPS', 'Gred', 'Pelajar', 'Sumber'],
        rows: (rows as CcDrillRowMap['gps'][]).map((r) => ({
          cells: [
            txt(r.subject),
            { text: r.gps.toFixed(2), tone: gpsTone(r.gps), mono: true },
            { text: r.grade, tone: gpsTone(r.gps) },
            num(r.students),
            txt(r.source),
          ],
        })),
      }
    case 'kirk':
      return {
        headers: ['Pelajar', 'Purata', 'Kepuasan', 'Relevan', 'Kegunaan', 'Tarikh'],
        rows: (rows as CcDrillRowMap['kirk'][]).map((r) => ({
          studentId: r.studentId,
          cells: [
            txt(r.name),
            { text: plain(r.average), mono: true },
            num(r.satisfaction),
            txt(r.relevance === null ? '-' : String(r.relevance)),
            txt(r.usefulness === null ? '-' : String(r.usefulness)),
            txt(r.date),
          ],
        })),
      }
    case 'mood':
      return {
        headers: ['Pelajar', 'Tarikh', 'Sebab'],
        rows: (rows as CcDrillRowMap['mood'][]).map((r) => ({
          studentId: r.studentId,
          cells: [txt(r.name), txt(r.date), txt(r.reason ?? '-')],
        })),
      }
    case 'engagement':
      return {
        headers: [
          'Pelajar',
          'Tahap',
          'Hari Aktif',
          'Jawapan Minggu Ini',
          'Ketepatan',
          'Terakhir Aktif',
        ],
        rows: (rows as CcDrillRowMap['engagement'][]).map((r) => ({
          studentId: r.studentId,
          cells: [
            txt(r.name),
            txt(BAND_LABEL[r.band] ?? r.band),
            num(r.days),
            num(r.answeredWeek),
            pct(r.accuracy),
            when(r.lastActiveAt),
          ],
        })),
      }
  }
  return { headers: [], rows: [] }
}
