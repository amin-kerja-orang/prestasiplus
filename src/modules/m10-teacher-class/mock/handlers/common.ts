/**
 * Helpers shared by the M10-T1 handlers (SRS M10 v1.18 §7, §9): the guards, body readers that work
 * for JSON and multipart posts, uploaded-file helpers and the message texts.
 *
 * Guards (SRS §7): **T** = session with role `teacher` or `admin` (guest 401, other roles 403
 * `FORBIDDEN`); **S** = any logged-in user. Messages that the SRS marks UNVERIFIED COPY (§5, §8.3,
 * OQ-M10-16) are placeholders in the Laravel `ms` style and are listed once, in `MSG`.
 */

import { raw, requireAuth, requireRole, type MockRequest, type MockResponse } from '@/mock/define'

import { levelIdOf } from '../data/spec'
import type { EducationLevelSlug } from '../repository/types'

/** SRS §7 `T`: teacher or admin. */
export const teacherOnly = requireRole('teacher', 'admin')

/** SRS §7 `S`: any logged-in user. */
export const anySession = requireAuth()

/** The signed-in user of a guarded route. */
export function viewerId(req: MockRequest): number {
  if (!req.session) throw new Error('a guard must run before this handler')
  return req.session.userId
}

export const viewerRole = (req: MockRequest): string => req.session?.role ?? ''

/** UNVERIFIED COPY (OQ-M10-16): server validation and refusal texts. */
export const MSG = {
  required: 'Medan ini diperlukan.',
  invalid: 'Medan ini tidak sah.',
  className: 'Sila isi nama kumpulan.',
  subject: 'Sila pilih subjek.',
  level: 'Sila pilih tahap pendidikan.',
  school: 'Sekolah tidak sah.',
  classroom: 'Kelas tidak sah.',
  classCode: 'Sila masukkan kod kelas.',
  joinNotFound: 'Kod kelas tidak sah.',
  joinAlready: 'Anda sudah menyertai kelas ini.',
  joined: (name: string): string => `Berjaya menyertai kelas ${name}.`,
  notFound: 'Rekod tidak dijumpai.',
  studentNotFound: 'Pelajar tidak dijumpai.',
  studentOtherSchool: 'Pelajar bukan daripada sekolah anda.',
  classNotOwn: 'Kelas ini bukan milik anda.',
  alreadyInClass: 'Pelajar sudah berada dalam kelas ini.',
  notInClass: 'Pelajar tiada dalam kelas ini.',
  // inline creates (`200 {error}`, #36, #38, #42–#44)
  chapterName: 'Nama bab diperlukan.',
  chapterNumber: 'Nombor bab mesti antara 1 dan 99.',
  chapterParent: 'Subjek atau tahap tidak sah.',
  topicName: 'Nama topik diperlukan.',
  topicParent: 'Bab tidak sah.',
  bidangName: 'Nama bidang diperlukan.',
  bidangParent: 'Subjek atau tahap tidak sah.',
  skFields: 'Kod dan keterangan SK diperlukan.',
  skParent: 'Bidang tidak sah.',
  spFields: 'Kod dan keterangan SP diperlukan.',
  spParent: 'SK tidak sah.',
  // questions (S22, S24, S21 import)
  questionText: 'Sila isi soalan.',
  questionTextLong: 'Soalan tidak boleh melebihi 2000 aksara.',
  questionType: 'Jenis soalan tidak sah.',
  difficulty: 'Sila pilih tahap kesukaran.',
  options: 'Sila isi semua pilihan jawapan.',
  optionLong: 'Pilihan jawapan tidak boleh melebihi 500 aksara.',
  correctAnswer: 'Sila pilih jawapan betul.',
  correctAnswerText: 'Sila masukkan jawapan betul.',
  correctAnswerLong: 'Jawapan betul tidak boleh melebihi 500 aksara.',
  tfAnswer: 'Sila pilih betul atau salah.',
  scriptType: 'Jenis tulisan tidak sah.',
  sp: 'SP DSKP tidak sah.',
  chapter: 'Bab tidak sah.',
  topic: 'Topik tidak sah.',
  image: 'Gambar mesti jenis JPG, PNG atau WebP dan tidak melebihi 2MB.',
  csvRequired: 'Sila pilih fail CSV.',
  csvFile: 'Fail mesti jenis CSV atau TXT dan tidak melebihi 5MB.',
  csvColumns: (cols: string): string => `Fail CSV mesti mempunyai kolum ${cols}.`,
  csvNoData: 'Fail CSV tiada baris data.',
} as const

/** `200 {error}` of the inline creates, as live (#36, #38, #42–#44). */
export const errorLive = (message: string): MockResponse => raw(200, { error: message })

// --- body readers ------------------------------------------------------------------------------

export type Body = Readonly<Record<string, unknown>>

const isBlob = (value: unknown): value is Blob =>
  typeof Blob !== 'undefined' && value instanceof Blob

/** The request body as a plain record (JSON object or multipart fields); anything else is `{}`. */
export function bodyOf(req: MockRequest): Body {
  const b = req.body
  return typeof b === 'object' && b !== null && !Array.isArray(b) && !isBlob(b) ? (b as Body) : {}
}

/** A whole number from a JSON number or a numeric string; `undefined` otherwise. */
export function intOf(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isSafeInteger(value) ? value : undefined
  if (typeof value === 'string' && /^\s*-?\d+\s*$/.test(value)) {
    const n = Number(value)
    return Number.isSafeInteger(n) ? n : undefined
  }
  return undefined
}

/** A trimmed string; `undefined` for anything that is not a string. */
export const textOf = (value: unknown): string | undefined =>
  typeof value === 'string' ? value.trim() : undefined

/** A boolean from true/false, 1/0, "1"/"0", "true"/"false"; `undefined` otherwise. */
export function boolOf(value: unknown): boolean | undefined {
  if (value === true || value === 1 || value === '1' || value === 'true') return true
  if (value === false || value === 0 || value === '0' || value === 'false') return false
  return undefined
}

/**
 * `name`, `name[]` and the indexed keys `name[0]`…: a JSON array, a repeated multipart key (an
 * array) or a single value (a string) all give a list; a missing key gives `undefined`.
 */
export function listOf(body: Body, name: string, size?: number): unknown[] | undefined {
  const direct = body[name] ?? body[`${name}[]`]
  const out: unknown[] = Array.isArray(direct)
    ? [...(direct as unknown[])]
    : direct === undefined
      ? []
      : [direct]
  let indexed = false
  for (const key of Object.keys(body)) {
    const m = new RegExp(`^${name}\\[(\\d+)\\]$`).exec(key)
    if (m) {
      out[Number(m[1])] = body[key]
      indexed = true
    }
  }
  if (direct === undefined && !indexed) return undefined
  return size === undefined ? out : Array.from({ length: size }, (_, i) => out[i])
}

// --- uploaded files ----------------------------------------------------------------------------

export interface UploadedFile {
  name: string
  size: number
  type: string
  blob: Blob | null
}

/**
 * A file from a multipart field (`File`/`Blob`) or a JSON stand-in `{name, size, type}`. An empty
 * file input (no name, size 0) is not a file.
 */
export function fileOf(value: unknown): UploadedFile | null {
  if (isBlob(value)) {
    const named = value as Blob & { name?: string }
    const name = named.name ?? ''
    if (name === '' && value.size === 0) return null
    return { name: name === '' ? 'fail' : name, size: value.size, type: value.type, blob: value }
  }
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const v = value as { name?: unknown; size?: unknown; type?: unknown }
    if (typeof v.name === 'string' && typeof v.size === 'number') {
      return {
        name: v.name,
        size: v.size,
        type: typeof v.type === 'string' ? v.type : '',
        blob: null,
      }
    }
  }
  return null
}

/** The mock reference of an uploaded file (the M04 convention; nothing is stored, D22). */
export const uploadRef = (scope: string, name: string): string =>
  `blob:mock/${scope}/${encodeURIComponent(name)}`

// --- labels ------------------------------------------------------------------------------------

/** "Tahun n" / "Ting. n" (FR-M10-29). */
export function levelLabel(slug: EducationLevelSlug): string {
  const n = levelIdOf(slug)
  return n <= 6 ? `Tahun ${String(n)}` : `Ting. ${String(n - 6)}`
}

/** BR-M10-02: the pre-fill URL of the QR code (PROPOSED, OQ-M10-04). */
export const joinUrlOf = (code: string): string =>
  `https://prestasiplus.my/kelas-saya?kod=${encodeURIComponent(code)}`
