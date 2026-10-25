/**
 * Shared constants and helpers of the M09 admin screens S9–S14 (banners, Audio KBAT, screenshots):
 * route names and paths, exact BM copy (SRS M09 §8) and error lines.
 */

import { isApiError } from '@/api'

import { isGenericServerText } from '../generic-server-text'

export const BANNERS_PATH = '/admin/banners'
export const AUDIO_PATH = '/admin/audio-kbat'
export const SCREENSHOTS_PATH = '/admin/tools/screenshots'
export const AUDIO_TEMPLATE_PATH = '/admin/audio-kbat/template'
export const AUDIO_TEMPLATE_WORD_PATH = '/admin/audio-kbat/template-word'

export const MEDIA_ROUTES = {
  bannerList: 'm09.admin.banners.list',
  bannerCreate: 'm09.admin.banners.create',
  bannerEdit: 'm09.admin.banners.edit',
  audioList: 'm09.admin.audio.list',
  audioCreate: 'm09.admin.audio.create',
  audioTemplate: 'm09.admin.audio.template',
  audioTemplateWord: 'm09.admin.audio.template-word',
  screenshots: 'm09.admin.screenshots',
} as const

/** Exact observed copy (SRS §8.1) and the placeholders of §8.2. */
export const COPY = {
  bannerNotFound: 'Banner tidak dijumpai.',
  confirmDeleteBanner: 'Adakah anda pasti mahu padam banner ini?',
  /** Placeholder (no live equivalent): shown when a page's data cannot be loaded. */
  loadFailed: 'Ralat memuatkan data. Sila cuba semula.',
  /** Shown only when a save produced no usable message (INFERRED). */
  genericError: 'Ralat berlaku. Sila cuba lagi.',
} as const

/** Red-alert lines of a failed call: the `fields` messages, else the message. */
export function errorLines(err: unknown): string[] {
  if (!isApiError(err)) return [COPY.genericError]
  if (err.status === 0 || err.code === 'NETWORK_ERROR') return [COPY.genericError]
  const fieldTexts = err.fields ? Object.values(err.fields) : []
  if (fieldTexts.length > 0) return [...new Set(fieldTexts)]
  if (
    err.message === '' ||
    /^HTTP \d+$/.test(err.message) ||
    err.status >= 500 ||
    isGenericServerText(err.message)
  ) {
    return [COPY.genericError]
  }
  return [err.message]
}

/** Server field messages by field name (empty when the error carries none). */
export function fieldErrors(err: unknown): Record<string, string> {
  return isApiError(err) && err.fields ? { ...err.fields } : {}
}

export function isNotFoundError(err: unknown): boolean {
  return isApiError(err) && err.status === 404
}

/** First value of a route query parameter ("" when absent). */
export function queryText(value: unknown): string {
  const first: unknown = Array.isArray(value) ? (value as unknown[])[0] : value
  return typeof first === 'string' ? first : ''
}

/** Laravel `Str::limit(text, 50)`: the first 50 characters, trailing space trimmed, then "...". */
export function limit50(text: string): string {
  return text.length > 50 ? `${text.slice(0, 50).trimEnd()}...` : text
}

/** A `YYYY-MM-DD` date as `dd/mm/yyyy` (BR-M09-10); anything else is returned unchanged. */
export function dmy(date: string | null): string {
  if (!date) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date)
  return m ? `${m[3] ?? ''}/${m[2] ?? ''}/${m[1] ?? ''}` : date
}

/** Class strings of the admin form controls (live: `border-2 rounded-xl`, 44 px touch height). */
export const INPUT_CLASS =
  'w-full min-h-11 rounded-xl border-2 border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-transparent focus:ring-2 focus:ring-indigo-500'
export const LABEL_CLASS = 'mb-1.5 block text-sm font-semibold text-slate-700'
export const HINT_CLASS = 'mt-1.5 flex items-start gap-1.5 text-xs text-slate-500'
export const ERROR_TEXT_CLASS = 'mt-1 text-xs text-red-700'
export const ERROR_BORDER_CLASS = 'border-red-400'
