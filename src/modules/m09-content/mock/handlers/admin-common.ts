/**
 * Shared pieces of the M09 admin handlers (SRS M09 v1.6 §7 #1–#5, #10–#19, #21–#23, #41–#42): the
 * admin guard, the not-found and success flash copy (§8.1, §8.2, PROPOSED COPY), body reading that
 * works for JSON and multipart posts, and uploaded-file helpers.
 *
 * A 404's `error.message` is the exact one-time flash text the screens show on their redirect
 * (FR-M09-10 "Artikel tidak dijumpai.", FR-M09-53 "Banner tidak dijumpai."); the notes screens
 * redirect without a flash (FR-M09-44).
 */

import { requireRole } from '@/mock/define'

import { sanitiseFileName } from '../repository/audio-support'

export const adminOnly = requireRole('admin')

export const NOT_FOUND = {
  article: 'Artikel tidak dijumpai.',
  note: 'Nota tidak dijumpai.',
  banner: 'Banner tidak dijumpai.',
} as const

/** Success flash texts returned in `status` (PROPOSED COPY, §8.2). */
export const ADMIN_FLASH = {
  article: {
    created: 'Artikel berjaya ditambah.',
    updated: 'Artikel berjaya dikemaskini.',
    deleted: 'Artikel berjaya dipadam.',
  },
  note: {
    created: 'Nota berjaya ditambah.',
    updated: 'Nota berjaya dikemaskini.',
    deleted: 'Nota berjaya dipadam.',
  },
  banner: {
    created: 'Banner berjaya ditambah.',
    updated: 'Banner berjaya dikemaskini.',
    deleted: 'Banner berjaya dipadam.',
  },
  audioCreated: 'Set Audio KBAT berjaya disimpan.',
  screenshots: (n: number): string => `${String(n)} fail berjaya dimuat naik.`,
} as const

/** Per-file refusal (§8.2): "{file}: format atau saiz tidak dibenarkan." */
export const fileRefused = (name: string): string => `${name}: format atau saiz tidak dibenarkan.`

/** The request body as a plain record (JSON object or multipart fields); anything else is `{}`. */
export function bodyOf(body: unknown): Record<string, unknown> {
  return typeof body === 'object' && body !== null && !Array.isArray(body) && !isBlob(body)
    ? (body as Record<string, unknown>)
    : {}
}

function isBlob(value: unknown): boolean {
  return typeof Blob !== 'undefined' && value instanceof Blob
}

/** Laravel `TrimStrings` + `ConvertEmptyStringsToNull`: a trimmed string, or `null` when blank. */
export function clean(value: unknown): unknown {
  if (typeof value !== 'string') return value
  const t = value.trim()
  return t === '' ? null : t
}

/** True when the key was sent at all (so a PUT can leave an absent field unchanged). */
export const has = (body: Record<string, unknown>, ...keys: string[]): boolean =>
  keys.some((k) => k in body)

/** The first present value among the camelCase and snake_case spellings of a field. */
export function pick(body: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) if (key in body) return body[key]
  return undefined
}

/** A whole number from a JSON number or a numeric string; `undefined` otherwise. */
export function asInt(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isInteger(value) ? value : undefined
  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) return Number(value.trim())
  return undefined
}

/** Laravel `boolean`: true/false, 1/0, "1"/"0", plus the checkbox values "on"/"true"/"false". */
export function asBool(value: unknown): boolean | undefined {
  if (value === true || value === 1 || value === '1' || value === 'on' || value === 'true') {
    return true
  }
  if (value === false || value === 0 || value === '0' || value === 'false' || value === 'off') {
    return false
  }
  return undefined
}

/** An absolute http(s) URL (the form fields are `type=url`). */
export function isUrl(value: string): boolean {
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

/** `YYYY-MM-DD` that is a real calendar date. */
export function isDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

// --- uploaded files -----------------------------------------------------------------------------

export interface UploadedFile {
  name: string
  size: number
  type: string
  /** The uploaded `File`/`Blob` itself (multipart only; absent for a JSON stand-in). */
  blob?: Blob
}

/**
 * A file from a multipart field (`File`/`Blob`) or from a JSON stand-in `{name, size, type}`.
 * An empty file input (no name, size 0, which is what a browser sends for "no file chosen") is
 * not a file.
 */
export function fileOf(value: unknown): UploadedFile | null {
  if (isBlob(value)) {
    const blob = value as Blob & { name?: string }
    const name = blob.name ?? ''
    if (name === '' && blob.size === 0) return null
    return { name: name === '' ? 'fail' : name, size: blob.size, type: blob.type, blob }
  }
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const v = value as { name?: unknown; fileName?: unknown; size?: unknown; type?: unknown }
    const name =
      typeof v.name === 'string' ? v.name : typeof v.fileName === 'string' ? v.fileName : null
    if (name !== null && typeof v.size === 'number') {
      return { name, size: v.size, type: typeof v.type === 'string' ? v.type : '' }
    }
  }
  return null
}

/** Every file of a field that may be single, repeated (array) or absent. */
export function filesOf(...values: unknown[]): UploadedFile[] {
  const out: UploadedFile[] = []
  for (const value of values) {
    const items = Array.isArray(value) ? (value as unknown[]) : value === undefined ? [] : [value]
    for (const item of items) {
      const f = fileOf(item)
      if (f) out.push(f)
    }
  }
  return out
}

/** BR-M09-30 file-name sanitising (leading dots stripped, capped at 120; may be empty). */
export const sanitiseName = (name: string): string => sanitiseFileName(name)

/**
 * Maximum lengths of the long text fields (INFERRED hardening, not observed on live): article and
 * note content 200,000 characters; audio question text and explanation 2,000, options 500,
 * instructions 5,000; banner description 5,000.
 */
export const MAX_LEN = {
  content: 200_000,
  questionText: 2_000,
  option: 500,
  explanation: 2_000,
  instructions: 5_000,
  description: 5_000,
} as const
