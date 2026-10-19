import { STUDENT_IMPORT_IC_MAX, STUDENT_IMPORT_MESSAGES, STUDENT_IMPORT_NAME_MAX } from '@pp/contract'

import {
  csvRecords,
  isEmail,
  pasteBlocks,
  plan,
  toTitleCase,
  withoutHeader,
  type ImportPlan,
  type ImportRecord,
} from '../users/import'

export type StudentImportMode = 'csv' | 'paste'

export interface PlannedStudent {
  line: number
  /** Title Case (mock BR-15). */
  name: string
  /** The DELIMa e-mail: it is both the login e-mail and the DELIMa id. */
  email: string
  /** The DELIMa password as typed in the file; hashed on arrival, never stored or echoed. */
  password: string
  /** As typed (at most 14 characters); only its hash and mask are stored, and only when it is a 12-digit IC. */
  ic: string | null
}

/** The data records of a DELIMa text: CSV lines (header dropped) or blank-line separated paste blocks. */
export function studentRecords(text: string, mode: StudentImportMode): ImportRecord[] {
  return mode === 'csv' ? withoutHeader(csvRecords(text)) : pasteBlocks(text)
}

/**
 * Mock `planStudentImport` (BR-15): CSV `name, email, password, ic?` or paste blocks of 3 to 4 lines
 * (name, DELIMa e-mail, password, optional IC). Failed lines carry the BM message of the contract;
 * an e-mail that exists, or repeats an earlier record, is skipped.
 */
export function planStudentImport(records: ImportRecord[], emailExists: (email: string) => boolean): ImportPlan<PlannedStudent> {
  return plan<PlannedStudent>(
    records,
    ({ line, cells }) => {
      const name = cells[0] ?? ''
      const email = cells[1] ?? ''
      const password = cells[2] ?? ''
      const ic = cells[3] ?? ''
      if (name === '') return STUDENT_IMPORT_MESSAGES.noName
      if ([...name].length > STUDENT_IMPORT_NAME_MAX) return STUDENT_IMPORT_MESSAGES.nameLong
      if (!isEmail(email)) return STUDENT_IMPORT_MESSAGES.badDelimaEmail
      if (password === '') return STUDENT_IMPORT_MESSAGES.noDelimaPassword
      if ([...ic].length > STUDENT_IMPORT_IC_MAX) return STUDENT_IMPORT_MESSAGES.icLong
      return { line, name: toTitleCase(name), email, password, ic: ic === '' ? null : ic }
    },
    emailExists,
  )
}
