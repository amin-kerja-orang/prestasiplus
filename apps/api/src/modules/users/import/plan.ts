import { IMPORT_ROW_MESSAGES } from '@pp/contract'

import { csvRecords, isEmail, withoutHeader, type ImportRecord } from './text'

/** `name` at most 255 and `phone` at most 14 characters (mock BR-08). */
export const IMPORT_NAME_MAX = 255
export const IMPORT_PHONE_MAX = 14

export interface ImportError {
  /** 1-based line of the file or paste. */
  line: number
  message: string
}

export interface ImportPlan<T> {
  planned: T[]
  skipped: number
  failed: number
  errors: ImportError[]
}

/**
 * Shared skeleton (mock `plan`): validates each record, then applies the skip rules.
 * - failed: the record breaks a field rule (one error entry per line);
 * - skipped: the e-mail already exists, or repeats an earlier record of the same import
 *   (case-insensitive). A failed record is not counted as the earlier one;
 * - planned: everything else.
 * The result is the same for every caller: it does not say in which school an existing account is.
 */
export function plan<T extends { line: number; email: string }>(
  records: ImportRecord[],
  build: (record: ImportRecord) => T | string,
  emailExists: (email: string) => boolean,
): ImportPlan<T> {
  const out: ImportPlan<T> = { planned: [], skipped: 0, failed: 0, errors: [] }
  const seen = new Set<string>()
  for (const record of records) {
    const built = build(record)
    if (typeof built === 'string') {
      out.failed++
      out.errors.push({ line: record.line, message: built })
      continue
    }
    const key = built.email.toLowerCase()
    if (seen.has(key) || emailExists(built.email)) {
      out.skipped++
      continue
    }
    seen.add(key)
    out.planned.push(built)
  }
  return out
}

export interface PlannedUser {
  line: number
  name: string
  email: string
  phone: string | null
}

/** The data records of a user import text (header dropped); 0 means "Tiada data untuk diimport.". */
export function userImportRecords(text: string): ImportRecord[] {
  return withoutHeader(csvRecords(text))
}

/**
 * Bulk user import (mock BR-14): lines `name, email, phone?`, CSV file or paste alike; the first
 * line is skipped when its second column is not an e-mail. Any column after the third is ignored:
 * there is no password column (D59b, the server generates a random password per account).
 */
export function planUserImport(
  records: ImportRecord[],
  emailExists: (email: string) => boolean,
): ImportPlan<PlannedUser> {
  return plan<PlannedUser>(
    records,
    ({ line, cells }) => {
      const name = cells[0] ?? ''
      const email = cells[1] ?? ''
      const phone = cells[2] ?? ''
      if (name === '') return IMPORT_ROW_MESSAGES.noName
      if ([...name].length > IMPORT_NAME_MAX) return IMPORT_ROW_MESSAGES.nameLong
      if (!isEmail(email)) return IMPORT_ROW_MESSAGES.badEmail
      if ([...phone].length > IMPORT_PHONE_MAX) return IMPORT_ROW_MESSAGES.phoneLong
      return { line, name, email, phone: phone === '' ? null : phone }
    },
    emailExists,
  )
}
