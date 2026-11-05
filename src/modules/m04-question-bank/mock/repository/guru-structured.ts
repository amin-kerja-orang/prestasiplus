/**
 * Own structured submissions of a teacher (API-GUR-26 own-review union, API-GUR-17 structured variant,
 * S6-T17). A small deterministic in-memory store: ids are `g{n}` (never a question id), an owner sees
 * only their own, and a submission the admin has accepted is not editable. The seed is two rows of the
 * canonical Guru (one waiting, one returned with a reason); it is rebuilt on every boot.
 */

import { toIsoMyt } from '@/lib/time'

import type { GuruCognitiveLevel } from '../../api/structured-guru'

/** Prefix of a submission id (`g{itemId}`), as the API builds it. */
export const GURU_SUBMISSION_PREFIX = 'g'

export interface GuruSubmissionPart {
  text: string
  marks: number
  scheme: string
  cognitiveLevel: GuruCognitiveLevel | null
}

export interface GuruSubmission {
  id: string
  ownerId: number
  subjectId: number
  educationLevelId: number
  chapterId: number | null
  spIds: number[]
  tp: number | null
  cognitiveLevel: GuruCognitiveLevel | null
  difficultyLevel: number
  stimulus: string
  stimulusImageId: string | null
  parts: GuruSubmissionPart[]
  /** Epoch ms; later is newer. */
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
  /** The viewer's own, newest first, optionally filtered by subject and level. */
  listOwn(
    ownerId: number,
    filter: { subjectId?: number; educationLevelId?: number } = {},
  ): GuruSubmission[] {
    return rows
      .filter(
        (r) =>
          r.ownerId === ownerId &&
          (filter.subjectId === undefined || r.subjectId === filter.subjectId) &&
          (filter.educationLevelId === undefined || r.educationLevelId === filter.educationLevelId),
      )
      .sort((a, b) => b.createdAtMs - a.createdAtMs)
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
  /** Seed-only: inserts a row with its final state. */
  seed(row: Omit<GuruSubmission, 'id'>): GuruSubmission {
    seq += 1
    const made = { ...row, id: `${GURU_SUBMISSION_PREFIX}${String(seq)}` }
    rows.push(made)
    return made
  },
  update(row: GuruSubmission, input: GuruSubmissionInput): GuruSubmission {
    Object.assign(row, input, { rejectionReason: null })
    return row
  },
  remove(row: GuruSubmission): void {
    rows = rows.filter((r) => r !== row)
  },
}

/** Display time of a row (+08:00). */
export const submissionCreatedAt = (row: GuruSubmission): string =>
  toIsoMyt(new Date(row.createdAtMs))
