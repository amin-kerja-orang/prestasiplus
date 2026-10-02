/**
 * Helpers shared by the M04-T2 workflow handlers (SRS §7 #9–#13, #18–#27): the admin guard, body and
 * query readers, M03 / M01 / M02 name lookups and the simulated file upload (metadata only, checked
 * against the SRS type and size rules).
 */

import { users } from '@/modules/m01-authentication/mock'
import { schools } from '@/modules/m02-users-schools/mock'
import { curriculum } from '@/modules/m03-curriculum/mock'
import { requireRole, type MockQuery, type MockRequest } from '@/mock/define'

/** Every M04 workflow endpoint is admin-only (SRS §7, SEC-M04-01, SEC-M04-09). */
export const adminOnly = requireRole('admin')

export type Body = Record<string, unknown>

/** The request body as a plain object (JSON or the fields of a multipart form). */
export function bodyOf(req: MockRequest): Body {
  const b = req.body
  return typeof b === 'object' && b !== null && !Array.isArray(b) && !(b instanceof Blob)
    ? (b as Body)
    : {}
}

/** A text field, trimmed; `''` when absent or not text. */
export function textField(b: Body, key: string): string {
  const v = b[key]
  return typeof v === 'string' ? v.trim() : ''
}

/** A positive integer in JSON (number) or multipart (digits); `undefined` when absent, `null` when malformed. */
export function optionalId(b: Body, key: string): number | undefined | null {
  const v = b[key]
  if (v === undefined || v === null || v === '') return undefined
  if (typeof v === 'number') return Number.isSafeInteger(v) && v > 0 ? v : null
  if (typeof v === 'string' && /^\d+$/.test(v.trim())) {
    const n = Number(v.trim())
    return Number.isSafeInteger(n) && n > 0 ? n : null
  }
  return null
}

/**
 * A list filter from the query: `undefined` = not given (no condition), a number = the value, and
 * `NO_MATCH` = given but not a valid id (as live, an unknown filter value matches nothing).
 */
export const NO_MATCH = -1

export function queryFilterId(query: MockQuery, key: string): number | undefined {
  const raw = query[key]
  const v = typeof raw === 'string' ? raw : raw?.[0]
  if (v === undefined || v.trim() === '') return undefined
  return /^\d+$/.test(v.trim()) && Number(v.trim()) > 0 ? Number(v.trim()) : NO_MATCH
}

/** `{id, name}` of an M03 subject / level, or `null` when the id is null or unknown. */
export interface IdName {
  id: number
  name: string
}

export interface NameLookup {
  subject(id: number | null): IdName | null
  level(id: number | null): IdName | null
}

export function nameLookup(): NameLookup {
  const subjects = new Map(curriculum.subjects().map((s) => [s.id, s.name]))
  const levels = new Map(curriculum.levels().map((l) => [l.id, l.name]))
  const ref = (map: Map<number, string>, id: number | null): IdName | null => {
    if (id === null) return null
    const name = map.get(id)
    return name === undefined ? null : { id, name }
  }
  return { subject: (id) => ref(subjects, id), level: (id) => ref(levels, id) }
}

/** `{id, name}` of a creator or teacher; `name` is `null` when the user is not in the store (INFERRED). */
export function userRef(id: number): { id: number; name: string | null } {
  return { id, name: users.get(id)?.name ?? null }
}

/** The name of a user's school (M02), `null` when none. */
export function schoolNameOf(userId: number): string | null {
  const schoolId = users.get(userId)?.schoolId
  if (schoolId === undefined || schoolId === null) return null
  return schools.get(schoolId)?.name ?? null
}

/** Text cut at `max` characters plus "..." (Str::limit style). */
export function excerpt(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}...` : text
}

// ---------------------------------------------------------------------------------------------
// Simulated uploads (SEC-M04-02): only metadata is checked and kept
// ---------------------------------------------------------------------------------------------

const MB = 1024 * 1024

export const CSV_MAX_BYTES = 5 * MB
export const IMAGE_MAX_BYTES = 2 * MB

const EXT_MIME: Readonly<Record<string, string>> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
}

export interface UploadedFile {
  name: string
  size: number
  /** The declared MIME type; from the extension when the browser sent none. */
  mime: string
  blob: Blob
}

/** A `File` / `Blob` field of a multipart body; `null` when it is not a file. */
export function uploadedFile(value: unknown): UploadedFile | null {
  if (typeof Blob === 'undefined' || !(value instanceof Blob)) return null
  const name = (value as { name?: unknown }).name
  const fileName = typeof name === 'string' && name !== '' ? name : 'upload'
  const ext = /\.([A-Za-z0-9]+)$/.exec(fileName)?.[1]?.toLowerCase() ?? ''
  return {
    name: fileName,
    size: value.size,
    mime: value.type !== '' ? value.type.toLowerCase() : (EXT_MIME[ext] ?? ''),
    blob: value,
  }
}

/** JPG / PNG / WebP / GIF; SVG and every other type are refused (SEC-M04-02). */
export const DIAGRAM_MIMES: readonly string[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]

/**
 * The kept reference of an upload: a deterministic placeholder `blob:mock/{scope}/{file name}`.
 * No live object URL is kept (it would die on reload); the UI renders a placeholder image for a
 * `blob:mock/` reference. Shared by the S2/S4 question images and the S11 diagram images.
 * S2/S4 accept JPG/PNG/WebP (SRS §5); S11 accepts `image/*` = JPG/PNG/WebP/GIF (DIAGRAM_MIMES).
 */
export function storeUpload(scope: string, file: Pick<UploadedFile, 'name'>): string {
  return `blob:mock/${scope}/${encodeURIComponent(file.name)}`
}
