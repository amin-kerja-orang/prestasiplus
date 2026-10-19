/**
 * Turns import text into records to create, skipped records and failed lines (SRS v1.28 BR-14,
 * BR-15). Pure: the caller passes `emailExists`, and creates the planned records itself.
 *
 * Row outcomes:
 * - **failed** (`ImportResult.errors`, one entry per line): a missing name, an invalid e-mail, a
 *   too-long phone or a too-short password (BR-08 rules, INFERRED for imports);
 * - **skipped**: the e-mail already exists in the store, or repeats an earlier record of the same
 *   import (case-insensitive);
 * - **planned**: everything else.
 *
 * The messages are INFERRED (URS OQ-2): the live import copy was not observed. They are Bahasa
 * Melayu, like the other placeholder copy of §8.
 */

import type { ImportError, ImportMode } from '../../api/imports'
import {
  csvRecords,
  isEmail,
  pasteBlocks,
  toTitleCase,
  withoutHeader,
  type ImportRecord,
} from './text'

/** BR-08: `name` ≤ 255, `phone` ≤ 14, password min 6. */
const NAME_MAX = 255
const PHONE_MAX = 14
const PASSWORD_MIN = 6

export const IMPORT_MESSAGES = {
  noName: 'Nama diperlukan.',
  nameLong: 'Nama tidak boleh melebihi 255 aksara.',
  badEmail: 'Emel tidak sah.',
  badDelimaEmail: 'Emel DELIMa tidak sah.',
  phoneLong: 'Nombor telefon tidak boleh melebihi 14 aksara.',
  passwordShort: 'Kata laluan mesti sekurang-kurangnya 6 aksara.',
  noDelimaPassword: 'Kata laluan DELIMa diperlukan.',
  icLong: 'Nombor IC tidak boleh melebihi 14 aksara.',
} as const

export interface PlannedUser {
  line: number
  name: string
  email: string
  phone: string | null
  /** `''` = use the default password (the caller substitutes it). */
  password: string
}

export interface PlannedStudent {
  line: number
  /** Title Case (BR-15). */
  name: string
  /** The DELIMa e-mail = `email` = `idDelima`. */
  email: string
  password: string
  icNumber: string | null
}

export interface ImportPlan<T> {
  planned: T[]
  skipped: number
  failed: number
  errors: ImportError[]
}

/** Shared skeleton: validates each record, then applies the skip rules. */
function plan<T extends { line: number; email: string }>(
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

/**
 * S4 (BR-14): lines `name, email, phone?, password?`, CSV file or paste alike; the first line is
 * skipped when its second column is not an e-mail (INFERRED header rule).
 */
export function planUserImport(
  text: string,
  emailExists: (email: string) => boolean,
): ImportPlan<PlannedUser> {
  const records = withoutHeader(csvRecords(text))
  return plan<PlannedUser>(
    records,
    ({ line, cells }) => {
      const name = cells[0] ?? ''
      const email = cells[1] ?? ''
      const phone = cells[2] ?? ''
      const password = cells[3] ?? ''
      if (name === '') return IMPORT_MESSAGES.noName
      if ([...name].length > NAME_MAX) return IMPORT_MESSAGES.nameLong
      if (!isEmail(email)) return IMPORT_MESSAGES.badEmail
      if ([...phone].length > PHONE_MAX) return IMPORT_MESSAGES.phoneLong
      if (password !== '' && [...password].length < PASSWORD_MIN)
        return IMPORT_MESSAGES.passwordShort
      return { line, name, email, phone: phone === '' ? null : phone, password }
    },
    emailExists,
  )
}

/** Number of data records in the text (0 → "Tiada data untuk diimport."). */
export function countUserRecords(text: string): number {
  return withoutHeader(csvRecords(text)).length
}

/** The records of a DELIMa import text: CSV lines, or blank-line separated paste blocks. */
function studentRecords(text: string, mode: ImportMode): ImportRecord[] {
  return mode === 'csv' ? withoutHeader(csvRecords(text)) : pasteBlocks(text)
}

export function countStudentRecords(text: string, mode: ImportMode): number {
  return studentRecords(text, mode).length
}

/**
 * S5 (BR-15): CSV `name, email, password, ic?` or paste blocks of 3–4 lines (name, DELIMa e-mail,
 * password, optional IC). Names become Title Case.
 */
export function planStudentImport(
  text: string,
  mode: ImportMode,
  emailExists: (email: string) => boolean,
): ImportPlan<PlannedStudent> {
  return plan<PlannedStudent>(
    studentRecords(text, mode),
    ({ line, cells }) => {
      const name = cells[0] ?? ''
      const email = cells[1] ?? ''
      const password = cells[2] ?? ''
      const ic = cells[3] ?? ''
      if (name === '') return IMPORT_MESSAGES.noName
      if ([...name].length > NAME_MAX) return IMPORT_MESSAGES.nameLong
      if (!isEmail(email)) return IMPORT_MESSAGES.badDelimaEmail
      if (password === '') return IMPORT_MESSAGES.noDelimaPassword
      if ([...ic].length > PHONE_MAX) return IMPORT_MESSAGES.icLong
      return {
        line,
        name: toTitleCase(name),
        email,
        password,
        icNumber: ic === '' ? null : ic,
      }
    },
    emailExists,
  )
}

/** BR-15: `classLevel` D1–D6 → grade 1–6, T1–T5 → grade 7–11; `undefined` for anything else. */
export function gradeOfClassLevel(level: string): number | undefined {
  const m = /^([DT])([1-6])$/.exec(level)
  if (!m) return undefined
  const n = Number(m[2])
  if (m[1] === 'D') return n
  return n <= 5 ? n + 6 : undefined
}
