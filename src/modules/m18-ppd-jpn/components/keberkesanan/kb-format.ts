import type { DsStatus } from '@/ds'
import { formatCount } from '@/lib/number'
import { formatDateShortMs } from '@/lib/time'

/** Page title and copy of S21 (design `m18-amaran-summary` section 5 and copy table rows 23-44). */
export const KB_TITLE = 'Keberkesanan Intervensi'

export type KbEffectiveness = 'belum_dinilai' | 'berkesan' | 'sederhana' | 'tidak_berkesan'

export const KB_BADGE: Record<KbEffectiveness, { status: DsStatus; label: string }> = {
  belum_dinilai: { status: 'inactive', label: 'Belum Dinilai' },
  berkesan: { status: 'done', label: 'Berkesan' },
  sederhana: { status: 'pending-approval', label: 'Sederhana' },
  tidak_berkesan: { status: 'rejected', label: 'Tidak Berkesan' },
}

/** Doughnut order of the contract: [Berkesan, Sederhana, Tidak Berkesan, Belum Dinilai]. */
export const KB_DOUGHNUT_LABELS = ['Berkesan', 'Sederhana', 'Tidak Berkesan', 'Belum Dinilai']

export const count = formatCount

/** "Keberkesanan Intervensi - {SEKOLAH}" (copy row 24). */
export function tabTitle(schoolName: string): string {
  return `${KB_TITLE} - ${schoolName.toLocaleUpperCase('ms-MY')}`
}

/** "{label} · {d MMM yyyy}" (copy row 38). */
export function followUpLine(label: string, date: string): string {
  return `${label} · ${formatDateShortMs(date)}`
}

export const rateText = (rate: number | null): string => (rate === null ? '—' : `${String(rate)}%`)
