/**
 * M04 question-import endpoints (SRS §7 #9–#11; build-plan M04-T2): S5 import, S5h history and the
 * template download. Every call needs an admin session. UI tasks read this file and do not change it
 * (build-plan §S.3 rule 5).
 *
 * `csvFile` may be a `File` (multipart, as live) or the file's text (JSON). The server checks the
 * extension (`.csv` / `.txt`), the MIME type and the size (5 MB) and answers `422` with
 * `fields.csvFile` (SRS §5). A file that is accepted always answers `201`: rows that cannot be
 * imported are counted in `failedCount` and listed in `failures` (BR-M04-10).
 */

import { api, type BlobResult, type ListResult } from '@/api'

/** DATA-M04-07 (D11 dataset, §6.13.5). */
export interface QuestionImportRun {
  id: number
  fileName: string
  importedCount: number
  failedCount: number
  /** `row` is the 1-based line of the file (the header is line 1). */
  failures: { row: number; message: string }[]
  defaults: {
    subjectId: number | null
    educationLevelId: number | null
    difficultyLevel: number | null
  }
  createdBy: number
  createdAt: string
  /** `YYYY-MM` of `createdAt`. */
  createdMonth: string
}

/** #9 result: the run plus the flash text "Import selesai: {x} soalan diimport, {y} gagal." */
export interface QuestionImportResponse {
  data: QuestionImportRun
  status: string
}

export interface QuestionImportInput {
  csvFile: File | string | null
  defaultSubjectId?: number | null
  defaultEducationLevelId?: number | null
  /** 1–5; the S5 form preselects 2. */
  defaultDifficultyLevel?: number | null
}

/** JSON, or multipart when a `File` is attached. */
function importBody(input: QuestionImportInput) {
  const { csvFile, ...fields } = input
  if (typeof File !== 'undefined' && csvFile instanceof File) {
    const form = new FormData()
    for (const [key, value] of Object.entries(fields)) {
      if (value !== null && value !== undefined) form.append(key, String(value))
    }
    form.append('csvFile', csvFile)
    return form
  }
  return { ...fields, ...(csvFile ? { csvFile } : {}) }
}

/** #9 `POST /api/question-imports` (201; 422 with `fields.csvFile` / `defaultSubjectId` …). */
export function importQuestions(input: QuestionImportInput): Promise<QuestionImportResponse> {
  return api.post<QuestionImportResponse>('/api/question-imports', {
    body: importBody(input),
    raw: true,
  })
}

/** #10 `GET /api/question-imports`: S5h history, newest first, 20 per page. */
export function fetchQuestionImports(
  query: { page?: number; signal?: AbortSignal } = {},
): Promise<ListResult<QuestionImportRun>> {
  return api.list<QuestionImportRun>('/api/question-imports', {
    query: { page: query.page ?? null },
    ...(query.signal ? { signal: query.signal } : {}),
  })
}

/** #11 `GET /api/question-imports/template`: the CSV file `template-import-soalan.csv`. */
export function downloadImportTemplate(): Promise<BlobResult> {
  return api.blob('/api/question-imports/template')
}
