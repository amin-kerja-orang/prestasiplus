/** Shared labels and route names of the admin question bank screens (papers / review / bank). */
import type { DsStatus } from '@/ds'

import type { Confidence, QuestionKind, QuestionStatus } from '../../domain/admin-types'

export const ADMIN_ROUTES = {
  review: 'm28.admin.review',
  reviewItem: 'm28.admin.review.item',
  bank: 'm28.admin.bank',
  bankEdit: 'm28.admin.bank.edit',
  papers: 'm28.admin.papers',
  paperNew: 'm28.admin.papers.new',
  paperEdit: 'm28.admin.papers.edit',
} as const

export const STATUS_BADGE: Record<QuestionStatus, DsStatus> = {
  semakan: 'awaiting-review',
  terbit: 'published',
  draf: 'draft',
  ditolak: 'rejected',
}

export const KIND_LABEL: Record<QuestionKind, string> = {
  objektif: 'Objektif',
  berstruktur: 'Berstruktur',
  esei: 'Esei',
}

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  tinggi: 'Keyakinan tinggi',
  sederhana: 'Keyakinan sederhana',
  rendah: 'Keyakinan rendah',
}

export const KERTAS_ITEMS = [
  { label: 'Semua kertas', value: '' },
  { label: 'Kertas 1', value: '1' },
  { label: 'Kertas 2', value: '2' },
]

export const KIND_ITEMS = [
  { label: 'Semua jenis', value: '' },
  { label: 'Objektif', value: 'objektif' },
  { label: 'Berstruktur', value: 'berstruktur' },
  { label: 'Esei', value: 'esei' },
]

export function ageText(days: number): string {
  if (days <= 0) return 'Hari ini'
  return days === 1 ? '1 hari lalu' : `${days} hari lalu`
}

export function detailMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Sesuatu tidak kena. Sila cuba lagi.'
}
