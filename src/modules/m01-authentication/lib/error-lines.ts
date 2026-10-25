/**
 * Turns a failed M01 auth call into the lines of the red alert box (FR-M01-09/10/26/68).
 * The mock sends the message text (credentials, throttle, inactive account) in `ApiError.message`
 * and per-field texts in `fields` (Laravel-style); one line per distinct text.
 */

import { isApiError } from '@/api'

/** Shown only when the request produced no usable message (network failure, HTTP 500). INFERRED copy. */
export const GENERIC_ERROR = 'Ralat berlaku. Sila cuba lagi.'

/** The API's generic English defaults (api-error.ts): never shown in the BM UI (SWE). */
const GENERIC_SERVER_TEXTS: readonly string[] = [
  'server error',
  'not found',
  'this action is unauthorized',
  'unauthenticated',
  'conflict',
  'the given data was invalid',
  'payload too large',
]

function isGenericServerText(message: string): boolean {
  return GENERIC_SERVER_TEXTS.includes(message.trim().replace(/\.$/, '').toLowerCase())
}

/**
 * BM labels for the English field names inside Laravel's default validation texts (BUG-04).
 * Unknown names fall back to the English name. Every BM string here is INFERRED: Perlu pengesahan.
 */
const FIELD_LABELS: Record<string, string> = {
  name: 'nama',
  email: 'alamat email',
  password: 'kata laluan',
  'password confirmation': 'pengesahan kata laluan',
  grade: 'darjah',
  phone: 'no. telefon',
  school: 'sekolah',
  role: 'peranan',
  bio: 'bio',
}

function label(attr: string): string {
  return FIELD_LABELS[attr.toLowerCase()] ?? attr
}

/** Exact English token-reset text (Laravel `passwords.token`). */
const TOKEN_INVALID_EN = 'This password reset token is invalid.'

/**
 * Laravel English default -> BM, matched on the exact default text. Anything else (including
 * texts that are already BM, as the mock sends) passes through unchanged.
 */
export function translateServerText(text: string): string {
  const t = text.trim()
  if (t === TOKEN_INVALID_EN) return 'Token tetapan semula kata laluan ini tidak sah.'
  let m = /^The (.+?) field is required\.$/.exec(t)
  if (m) return `Ruang ${label(m[1])} wajib diisi.`
  m = /^The (.+?) has already been taken\.$/.exec(t)
  if (m) return `${capitalise(label(m[1]))} ini telah digunakan.`
  m = /^The (.+?) (?:field )?confirmation does not match\.$/.exec(t)
  if (m) return `Pengesahan ${label(m[1])} tidak sepadan.`
  m = /^The (.+?) (?:field )?must be at least (\d+) characters\.$/.exec(t)
  if (m) return `Ruang ${label(m[1])} mestilah sekurang-kurangnya ${m[2]} aksara.`
  m = /^The (.+?) (?:field )?must not be greater than (\d+) characters\.$/.exec(t)
  if (m) return `Ruang ${label(m[1])} tidak boleh melebihi ${m[2]} aksara.`
  m = /^The (.+?) must be a valid email address\.$/.exec(t)
  if (m) return `Ruang ${label(m[1])} mestilah alamat email yang sah.`
  return text
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function errorLines(err: unknown): string[] {
  if (!isApiError(err)) return [GENERIC_ERROR]
  // No response at all ("Failed to fetch" is English developer text): the generic line.
  if (err.status === 0 || err.code === 'NETWORK_ERROR') return [GENERIC_ERROR]
  const fieldTexts = err.fields ? Object.values(err.fields) : []
  if (fieldTexts.length > 0) return [...new Set(fieldTexts.map(translateServerText))]
  if (
    err.message === '' ||
    /^HTTP \d+$/.test(err.message) ||
    err.status >= 500 ||
    isGenericServerText(err.message)
  ) {
    return [GENERIC_ERROR]
  }
  return [translateServerText(err.message)]
}
