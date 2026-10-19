/**
 * Shared constants and helpers of the M03 subject and level screens (S6-S11, M03-T2): route names
 * and paths, exact BM copy (SRS §8), stage metadata (BR-01, FR-58), error lines and class strings.
 */

import { isApiError } from '@/api'

import type { EducationStage } from '../api/lookups'

export const SUBJECTS_LIST_PATH = '/admin/subjects'
export const LEVELS_LIST_PATH = '/admin/education-levels'

export const SUBJECT_ROUTES = {
  list: 'm03.subjects.list',
  create: 'm03.subjects.create',
  edit: 'm03.subjects.edit',
} as const

export const LEVEL_ROUTES = {
  list: 'm03.levels.list',
  create: 'm03.levels.create',
  edit: 'm03.levels.edit',
} as const

/** Exact observed copy (SRS §8) and the placeholder load error. */
export const COPY = {
  subjectNotFound: 'Subjek tidak dijumpai.',
  levelNotFound: 'Tahap Pendidikan tidak dijumpai.',
  confirmDeleteSubject: 'Adakah anda pasti mahu padam subjek ini?',
  confirmDeleteLevel: 'Adakah anda pasti mahu padam tahap pendidikan ini?',
  switchFailed: 'Gagal kemaskini status',
  networkError: 'Ralat rangkaian',
  /** Placeholder (no live equivalent), SRS §8 "Page data failed to load". */
  loadFailed: 'Ralat memuatkan data. Sila cuba semula.',
  /** Shown only when a save produced no usable message (INFERRED). */
  genericError: 'Ralat berlaku. Sila cuba lagi.',
} as const

/** FR-58 / FR-64 stage labels and the S10/S11 select options (BR-01). */
export const STAGE_LABELS: Record<EducationStage, string> = {
  primary: 'Rendah',
  lower_secondary: 'Menengah Rendah',
  upper_secondary: 'Menengah Atas',
}

export const STAGE_OPTIONS: readonly { value: EducationStage; label: string }[] = [
  { value: 'primary', label: 'Rendah (Primary)' },
  { value: 'lower_secondary', label: 'Menengah Rendah (Lower Secondary)' },
  { value: 'upper_secondary', label: 'Menengah Atas (Upper Secondary)' },
]

/** Red-alert lines of a failed call (FR-27: `error.fields` messages, else the message). */
export function errorLines(err: unknown): string[] {
  if (!isApiError(err)) return [COPY.genericError]
  if (err.status === 0 || err.code === 'NETWORK_ERROR') return [COPY.genericError]
  const fieldTexts = err.fields ? Object.values(err.fields) : []
  if (fieldTexts.length > 0) return [...new Set(fieldTexts)]
  if (err.message === '' || /^HTTP \d+$/.test(err.message)) return [COPY.genericError]
  return [err.message]
}

/** Server field messages by field name (empty when the error carries none). */
export function fieldErrors(err: unknown): Record<string, string> {
  return isApiError(err) && err.fields ? { ...err.fields } : {}
}

export function isNotFoundError(err: unknown): boolean {
  return isApiError(err) && err.status === 404
}

/** `true` for a response-less failure (no connection), which the switches report as "Ralat rangkaian". */
export function isNetworkFailure(err: unknown): boolean {
  return !isApiError(err) || err.status === 0 || err.code === 'NETWORK_ERROR'
}

const HEX6 = /^#[0-9a-fA-F]{6}$/

/** FR-41: the icon tile background is the colour plus `20` (12.5 % alpha); none for a non-hex value. */
export function tileBackground(color: string): string | undefined {
  return HEX6.test(color) ? `${color}20` : undefined
}
