/**
 * M13 API types (SRS M13 v1.1 §6, §7). Endpoint #1 keeps the live snake_case body (SQ-M13-01); the
 * others use camelCase and the shared envelope.
 */

import type { ChatTier, LevelCode, RubricKey } from './settings'

/** #1 request. */
export interface ChatSendRequest {
  message: string
  thread_id: string | null
}

/** #1 2xx body (no envelope). */
export interface ChatSendResponse {
  thread_id: string
  reply: string
  tier: ChatTier
  turns_remaining: number
  tool_hops: number
  tokens: { in: number; out: number }
}

/** #1 non-2xx body: 422 `{}`, 429 `{quota_exhausted: true}`, other errors `{error}`. */
export interface ChatErrorBody {
  error?: string
  quota_exhausted?: boolean
}

export type RphStatus = 'generated'
export type RphSource = 'form' | 'chat'

/** DATA-M13-03 Rph (#3, #4). */
export interface Rph {
  id: number
  userId: number
  subjectName: string
  level: LevelCode
  tajuk: string
  className: string | null
  /** `YYYY-MM-DD`. */
  lessonDate: string
  durationMinutes: number
  timeSlot: string | null
  tema: string | null
  pengajaranKeperluan: string | null
  status: RphStatus
  source: RphSource
  content: string
  threadId: string | null
  createdAt: string
}

/** #2 row. */
export interface RphListItem {
  id: number
  lessonDate: string
  subjectName: string
  level: LevelCode
  tajuk: string
  status: RphStatus
}

/** #3 request. */
export interface RphCreateRequest {
  subjectName: string
  level: string
  tajuk: string
  className?: string | null
  lessonDate?: string | null
  durationMinutes?: number | null
  timeSlot?: string | null
  tema?: string | null
  pengajaranKeperluan?: string | null
}

/** DATA-M13-04 EssayMarking (#6). */
export interface EssayMarking {
  id: number
  userId: number
  rubricKey: RubricKey
  subjectName: string | null
  level: string | null
  studentName: string | null
  essayTitle: string | null
  essayText: string
  marks: number
  maxMarks: number
  comment: string
  threadId: string
  createdAt: string
}

/** #5 row. */
export interface EssayListItem {
  id: number
  studentName: string | null
  subjectName: string | null
  rubricKey: RubricKey
  essayTitle: string | null
  marks: number
  maxMarks: number
  createdAt: string
}

/** #7 row (pending, own). */
export interface PbdQueueItem {
  id: number
  studentId: number
  studentName: string
  classroomId: number
  sp: string
  skor: number
  tp: number
}

/** #8 result. */
export interface RollupResult {
  created: number
  updated: number
  skipped: number
}

/** #9 result. */
export interface BulkApproveResult {
  approved: number
}

/** #11 option source (M10 #12), the fields S3 / S6 use. */
export interface CikguClassOption {
  id: number
  name: string
  subjectName: string | null
  educationLevel: string
  levelLabel: string
}

/** #12 (M03 #28): the fields the S3 datalist uses. */
export interface CikguSubjectOption {
  id: number
  name: string
}
