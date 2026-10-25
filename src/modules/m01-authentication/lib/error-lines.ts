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
 * BM labels for the English attribute words in Laravel's default validation texts (BUG-04). Where a
 * form shows the field, its on-screen label is reused. A word not listed here is never echoed in
 * English: the generic "this field" line is used instead. All BM here is INFERRED: Perlu pengesahan.
 */
const FIELD_LABELS: Record<string, string> = {
  name: 'Nama Penuh',
  email: 'Alamat Email',
  phone: 'No. Telefon',
  password: 'Kata Laluan',
  'current password': 'Kata Laluan Semasa',
  grade: 'Darjah',
  'ic number': 'No. Kad Pengenalan',
  school: 'Sekolah',
  'school id': 'Sekolah',
  role: 'Peranan',
  bio: 'Bio / Motto',
  token: 'Token',
  'profile picture': 'Gambar Profil',
  'subuh push time': 'Push waktu Subuh',
  'sahur push time': 'Mod Ramadan',
  faith: 'Agama',
}

function label(attr = ''): string | null {
  return FIELD_LABELS[attr.toLowerCase()] ?? null
}

type Rule = [RegExp, (m: RegExpExecArray) => string]

/** The attribute-bearing Laravel templates the M01 endpoints emit (contract `account/schema.ts`). */
const RULES: Rule[] = [
  [
    /^The (.+?) field is required\.$/,
    (m) => (label(m[1]) ? `Ruang ${label(m[1])} wajib diisi.` : 'Ruang ini wajib diisi.'),
  ],
  [
    /^The (.+?) field must be a valid email address\.$/,
    (m) =>
      label(m[1])
        ? `Ruang ${label(m[1])} mestilah alamat email yang sah.`
        : 'Alamat email tidak sah.',
  ],
  [
    /^The (.+?) has already been taken\.$/,
    (m) => (label(m[1]) ? `${label(m[1])} ini telah digunakan.` : 'Nilai ini telah digunakan.'),
  ],
  [
    /^The (.+?) field confirmation does not match\.$/,
    (m) => (label(m[1]) ? `Pengesahan ${label(m[1])} tidak sepadan.` : 'Pengesahan tidak sepadan.'),
  ],
  [
    /^The (.+?) confirmation does not match\.$/,
    (m) => (label(m[1]) ? `Pengesahan ${label(m[1])} tidak sepadan.` : 'Pengesahan tidak sepadan.'),
  ],
  [
    /^The (.+?) (?:field )?must be at least (\d+) characters\.$/,
    (m) => `Ruang ${label(m[1]) ?? 'ini'} mestilah sekurang-kurangnya ${m[2]} aksara.`,
  ],
  [
    /^The (.+?) field must not be greater than (\d+) characters\.$/,
    (m) => `Ruang ${label(m[1]) ?? 'ini'} tidak boleh melebihi ${m[2]} aksara.`,
  ],
  [
    /^The (.+?) field must not be greater than (\d+) kilobytes\.$/,
    (m) => `Ruang ${label(m[1]) ?? 'ini'} tidak boleh melebihi ${m[2]} KB.`,
  ],
  [
    /^The (.+?) field must be a file of type: (.+)\.$/,
    (m) => `Ruang ${label(m[1]) ?? 'ini'} mestilah fail jenis: ${m[2]}.`,
  ],
  [
    /^The selected (.+?) is invalid\.$/,
    (m) => (label(m[1]) ? `Pilihan ${label(m[1])} tidak sah.` : 'Pilihan ini tidak sah.'),
  ],
  [
    /^The (.+?) field must match the format H:i\.$/,
    (m) => `Ruang ${label(m[1]) ?? 'ini'} mestilah dalam format JJ:MM.`,
  ],
]

/** Fixed English texts of the M01 flows (Laravel `passwords.*` and the current-password check). */
const FIXED: Record<string, string> = {
  'This password reset token is invalid.': 'Token tetapan semula kata laluan ini tidak sah.',
  'The password is incorrect.': 'Kata laluan tidak betul.',
  'Please wait before retrying.': 'Sila tunggu sebentar sebelum mencuba lagi.',
  "We can't find a user with that email address.":
    'Kami tidak menjumpai pengguna dengan alamat email itu.',
}

/**
 * Laravel English default -> BM, matched on the exact default text. Anything else (including
 * texts that are already BM, as the mock sends) passes through unchanged.
 */
export function translateServerText(text: string): string {
  const t = text.trim()
  const fixed = FIXED[t]
  if (fixed) return fixed
  for (const [re, fn] of RULES) {
    const m = re.exec(t)
    if (m) return fn(m)
  }
  return text
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
