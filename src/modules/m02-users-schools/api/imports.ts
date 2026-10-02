/**
 * M02 import and quota endpoints (SRS v1.28 §7 #12–#15; build-plan M02-T2): S4 bulk user import,
 * S5 DELIMa student import, the S5 quota panel and the S5 existing-students list. Every call needs
 * an admin session. UI tasks read this file and do not change it (build-plan §S.3 rule 5).
 *
 * `csvFile` may be a `File` (sent as multipart, as live) or the file's text (JSON). `importMode`
 * `csv` reads `csvFile`, `paste` reads `pasteContent`.
 */

import { api } from '@/api'

/** DATA-M02-11 (INFERRED, URS OQ-2). `errors` lists the failed lines only. */
export interface ImportResult {
  created: number
  skipped: number
  failed: number
  errors: ImportError[]
}

export interface ImportError {
  /** 1-based line of the file or paste (the first line of a DELIMa paste block). */
  line: number
  message: string
}

/** The import responses: the result plus the flash text (UNVERIFIED COPY §8). */
export interface ImportResponse {
  data: ImportResult
  status: string
}

export type ImportMode = 'csv' | 'paste'

/** Roles the S4 bulk import can create (BR-14, S4 short labels Guru / Ibu Bapa / Admin / PPD). */
export type BulkImportRole = 'teacher' | 'parent' | 'school_admin' | 'ppd_officer'

/** S5 class levels: D1–D6 (grade 1–6), T1–T5 (grade 7–11). */
export type ImportClassLevel =
  'D1' | 'D2' | 'D3' | 'D4' | 'D5' | 'D6' | 'T1' | 'T2' | 'T3' | 'T4' | 'T5'

interface ImportSource {
  importMode: ImportMode
  csvFile?: File | string | null
  pasteContent?: string | null
}

export interface BulkImportInput extends ImportSource {
  role: BulkImportRole | ''
  /** Required for `teacher` and `school_admin`. */
  schoolId?: number | null
  /** Empty or absent → the configured bulk default (SEC-M02-03). */
  defaultPassword?: string | null
}

export interface StudentImportInput extends ImportSource {
  schoolId: number | null
  classLevel: ImportClassLevel | ''
}

/** #14: `hasSubscription` false → no other field. `used` counts active and inactive students. */
export interface SchoolQuota {
  hasSubscription: boolean
  quota?: number
  used?: number
  remaining?: number
}

/** #15 item. */
export interface ExistingStudent {
  id: number
  name: string
  email: string
  idDelima: string | null
  classLevel: string | null
  isActive: boolean
}

export interface ExistingStudentsQuery {
  search?: string | null
  classLevel?: string | null
  signal?: AbortSignal
}

/** JSON, or multipart when a `File` is attached. */
function importBody(
  fields: Record<string, string | number | boolean | null | undefined>,
  file: File | string | null | undefined,
) {
  if (typeof File !== 'undefined' && file instanceof File) {
    const form = new FormData()
    for (const [key, value] of Object.entries(fields)) {
      if (value !== null && value !== undefined) form.append(key, String(value))
    }
    form.append('csvFile', file)
    return form
  }
  return { ...fields, ...(file ? { csvFile: file } : {}) }
}

/** #12 `POST /api/admin/users/bulk-import` (422 without role, school or data). */
export function importUsers(input: BulkImportInput): Promise<ImportResponse> {
  const { csvFile, ...fields } = input
  return api.post<ImportResponse>('/api/admin/users/bulk-import', {
    body: importBody(fields, csvFile),
    raw: true,
  })
}

/** #13 `POST /api/admin/students/import` (422, incl. no active subscription or not enough quota). */
export function importStudents(input: StudentImportInput): Promise<ImportResponse> {
  const { csvFile, ...fields } = input
  return api.post<ImportResponse>('/api/admin/students/import', {
    body: importBody(fields, csvFile),
    raw: true,
  })
}

/** #14 `GET /api/admin/schools/:id/quota` (404 for an unknown school). */
export function fetchSchoolQuota(
  schoolId: number,
  options: { signal?: AbortSignal } = {},
): Promise<SchoolQuota> {
  return api.get<SchoolQuota>(
    `/api/admin/schools/${String(schoolId)}/quota`,
    options.signal ? { signal: options.signal } : {},
  )
}

/** #15 `GET /api/admin/schools/:id/students`: at most 200, name A→Z, not paginated. */
export function fetchSchoolStudents(
  schoolId: number,
  query: ExistingStudentsQuery = {},
): Promise<ExistingStudent[]> {
  return api.get<ExistingStudent[]>(`/api/admin/schools/${String(schoolId)}/students`, {
    query: { search: query.search ?? null, classLevel: query.classLevel ?? null },
    ...(query.signal ? { signal: query.signal } : {}),
  })
}
