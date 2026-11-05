/**
 * Own structured submissions of a teacher (API-GUR-17 structured variant, S6-T17): a small deterministic
 * in-memory store with `g{n}` ids (never a question id). An owner sees and changes only their own; once the
 * admin has accepted an item it is no longer editable (409). Rebuilt empty on every boot.
 *
 * Same method names and row shape as the M04 mock store `guruSubmissions` that serves the API-GUR-26 reads
 * (`m04-question-bank/mock/repository/guru-structured.ts`, S6-T17 submit-list). Until both branches are merged
 * they are two stores; after the merge replace this file by a re-export of the M04 one (one owner, D12).
 */

export const GURU_SUBMISSION_PREFIX = 'g'

export interface GuruSubmissionPart {
  text: string
  marks: number
  scheme: string
  cognitiveLevel: string | null
}

export interface GuruSubmission {
  id: string
  ownerId: number
  subjectId: number
  educationLevelId: number
  chapterId: number | null
  spIds: number[]
  tp: number | null
  cognitiveLevel: string | null
  difficultyLevel: number
  stimulus: string
  stimulusImageId: string | null
  parts: GuruSubmissionPart[]
  createdAtMs: number
  rejectionReason: string | null
  /** False once the admin accepted the item (a 409 on edit and delete). */
  editable: boolean
}

export type GuruSubmissionInput = Omit<
  GuruSubmission,
  'id' | 'ownerId' | 'createdAtMs' | 'rejectionReason' | 'editable'
>

let rows: GuruSubmission[] = []
let seq = 0

export const guruSubmissions = {
  reset(): void {
    rows = []
    seq = 0
  },
  listOwn(ownerId: number): GuruSubmission[] {
    return rows.filter((r) => r.ownerId === ownerId).sort((a, b) => b.createdAtMs - a.createdAtMs)
  },
  /** The owner's submission, or null for an unknown or foreign id (a 404). */
  getOwn(ownerId: number, id: string): GuruSubmission | null {
    return rows.find((r) => r.id === id && r.ownerId === ownerId) ?? null
  },
  add(ownerId: number, input: GuruSubmissionInput, nowMs: number): GuruSubmission {
    seq += 1
    const row: GuruSubmission = {
      ...input,
      id: `${GURU_SUBMISSION_PREFIX}${String(seq)}`,
      ownerId,
      createdAtMs: nowMs,
      rejectionReason: null,
      editable: true,
    }
    rows.push(row)
    return row
  },
  update(row: GuruSubmission, input: GuruSubmissionInput): GuruSubmission {
    Object.assign(row, input, { rejectionReason: null })
    return row
  },
  remove(row: GuruSubmission): void {
    rows = rows.filter((r) => r !== row)
  },
  /** Test hook: the admin accepted the item (no longer editable). */
  accept(row: GuruSubmission): void {
    row.editable = false
  },
}
