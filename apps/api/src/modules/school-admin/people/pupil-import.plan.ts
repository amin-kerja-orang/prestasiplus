import { SCHOOL_ADMIN_PUPIL_IMPORT_MESSAGES as M, SCHOOL_ADMIN_PUPIL_IMPORT_PREVIEW_ROWS, type SchoolAdminPupilImportResult } from '@pp/contract'

import { csvRecords, isEmail, textLines, toTitleCase } from '../../users/import'

/** Longest name the import accepts (the pupil form rule, 255 characters). */
const NAME_MAX = 255

export interface PupilFileRow {
  /** 1-based line of the file (the header is line 1). */
  line: number
  name: string
  email: string
  kelas: string
}

/** The data rows of an import file, or the name of the required column the header lacks. */
export type ParsedPupilFile = { rows: PupilFileRow[] } | { missing: string }

/**
 * `nama,email,kelas` (case-insensitive; comma or semicolon, detected from the header; a UTF-8 BOM is dropped). The first
 * non-blank line is the header and must contain `nama`; `email` and `kelas` may be absent or empty columns.
 */
export function parsePupilFile(text: string): ParsedPupilFile {
  const headerLine = textLines(text).find((l) => l.trim() !== '')
  if (headerLine === undefined) return { rows: [] }
  const delimiter = headerLine.split(';').length > headerLine.split(',').length ? ';' : ','
  const [header, ...data] = csvRecords(text, delimiter)
  const columns = (header?.cells ?? []).map((c) => c.trim().toLowerCase())
  const nama = columns.indexOf('nama')
  if (nama < 0) return { missing: 'nama' }
  const email = columns.indexOf('email')
  const kelas = columns.indexOf('kelas')
  const cell = (cells: string[], i: number): string => (i < 0 ? '' : (cells[i] ?? ''))
  return { rows: data.map((r) => ({ line: r.line, name: cell(r.cells, nama), email: cell(r.cells, email), kelas: cell(r.cells, kelas) })) }
}

export interface PlannedPupil {
  line: number
  /** Title Case. */
  name: string
  email: string
  /** A class of the school the row names; null = no enrolment. */
  classId: string | null
}

export interface PupilImportPlan {
  planned: PlannedPupil[]
  /** E-mails that already exist on the platform (each is also in `errors`). */
  skipped: number
  /** Every row that is not created, in file order. */
  errors: { line: number; message: string }[]
}

/**
 * Row rules of R1-AS-51: `nama` required; the e-mail valid; a later repeat of an e-mail inside the file fails; `kelas` must name
 * a class of THIS school (case-insensitive, `classByName` holds only that school's classes), else the level select is used, and
 * with neither "Kelas tidak dijumpai."; an e-mail that exists on the platform is skipped (decision of issue #485: counted in
 * `skipped` and listed as a failed row). A duplicate name + class is allowed.
 */
export function planPupilImport(
  rows: readonly PupilFileRow[],
  opts: { classByName: ReadonlyMap<string, string>; hasLevel: boolean; emailExists: (email: string) => boolean },
): PupilImportPlan {
  const out: PupilImportPlan = { planned: [], skipped: 0, errors: [] }
  const seen = new Set<string>()
  const fail = (line: number, message: string): void => {
    out.errors.push({ line, message })
  }
  for (const row of rows) {
    if (row.name === '') {
      fail(row.line, M.noName)
      continue
    }
    if ([...row.name].length > NAME_MAX) {
      fail(row.line, M.nameLong)
      continue
    }
    if (!isEmail(row.email)) {
      fail(row.line, M.badEmail)
      continue
    }
    const classId = row.kelas === '' ? undefined : opts.classByName.get(row.kelas.toLowerCase())
    if (classId === undefined && !opts.hasLevel) {
      fail(row.line, M.classNotFound)
      continue
    }
    const key = row.email.toLowerCase()
    if (seen.has(key)) {
      fail(row.line, M.emailRepeated)
      continue
    }
    seen.add(key)
    if (opts.emailExists(row.email)) {
      out.skipped++
      fail(row.line, M.emailExists)
      continue
    }
    out.planned.push({ line: row.line, name: toTitleCase(row.name), email: row.email, classId: classId ?? null })
  }
  return out
}

/** The `dryRun` / final answer. The preview lists the first rows of the file as typed (invalid rows included). */
export function importResultOf(
  rows: readonly PupilFileRow[],
  plan: PupilImportPlan,
  opts: { dryRun: boolean; created: number },
): SchoolAdminPupilImportResult {
  return {
    dryRun: opts.dryRun,
    rows: rows.length,
    created: opts.created,
    skipped: plan.skipped,
    errors: plan.errors.map((e) => ({ row: e.line, message: e.message })),
    ...(opts.dryRun
      ? {
          preview: rows.slice(0, SCHOOL_ADMIN_PUPIL_IMPORT_PREVIEW_ROWS).map((r) => ({
            row: r.line,
            name: r.name,
            email: r.email === '' ? null : r.email,
            className: r.kelas === '' ? null : r.kelas,
          })),
        }
      : {}),
  }
}
