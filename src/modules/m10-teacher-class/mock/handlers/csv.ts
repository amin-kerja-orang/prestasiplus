/**
 * The teacher CSV import of S21 (SRS M10 v1.18 §7 #57, #58, BR-M10-24, DV-M10-08). One store, one
 * format (D12): the template file, the parser and the row rules are M04's public exports
 * (`IMPORT_TEMPLATE_CSV`, `planImport`; M04 BR-M04-10). This file only adds what is M10's own:
 *
 * - **No defaults.** The S21 form has no subject, level or difficulty to fall back on, so M04's
 *   plan is run with no defaults: a row without `subject_id`, `education_level_id` or
 *   `difficulty_level` fails with M04's message.
 * - **S22 length caps** (SRS M10 §5; M04 does not apply them to its import): question text ≤ 2000
 *   and each option ≤ 500 characters. A longer row is reported by its file line and not created,
 *   like any other bad row. The failures stay ordered by line.
 */

import { IMPORT_TEMPLATE_CSV, planImport as planM04Import } from '@/modules/m04-question-bank/mock'
import type { QuestionInput } from '@/modules/m04-question-bank/mock'

export const TEMPLATE_NAME = 'template-import-soalan.csv'

/** The template file text: M04 #11's. */
export const TEMPLATE_CSV = IMPORT_TEMPLATE_CSV

export const TEXT_MAX = 2000
export const OPTION_MAX = 500
export const MSG_TEXT_LONG = 'Soalan tidak boleh melebihi 2000 aksara.'
export const MSG_OPTION_LONG = 'Pilihan jawapan tidak boleh melebihi 500 aksara.'

export interface ImportPlan {
  /** Required header columns the file lacks (a non-empty list refuses the file). */
  missingColumns: string[]
  rows: QuestionInput[]
  failures: { row: number; message: string }[]
  /** Data records seen (planned + failed). */
  dataRows: number
}

/** M04's plan without defaults, plus the M10 length caps. */
export function planImport(text: string): ImportPlan {
  const plan = planM04Import(text)
  const rows: QuestionInput[] = []
  const failures = [...plan.failures]
  for (const r of plan.rows) {
    if ([...r.input.questionText].length > TEXT_MAX) {
      failures.push({ row: r.line, message: MSG_TEXT_LONG })
    } else if ((r.input.options ?? []).some((o) => [...o].length > OPTION_MAX)) {
      failures.push({ row: r.line, message: MSG_OPTION_LONG })
    } else rows.push(r.input)
  }
  failures.sort((a, b) => a.row - b.row)
  return { missingColumns: plan.missingColumns, rows, failures, dataRows: plan.dataRows }
}
