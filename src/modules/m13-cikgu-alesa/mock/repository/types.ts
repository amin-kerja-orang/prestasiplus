/**
 * Row types of the M13 stores (SRS M13 v1.1 §6.2–§6.6). Datetimes are ISO 8601 with +08:00, dates
 * `YYYY-MM-DD`. `Rph` and `EssayMarking` are the API bodies (`../../api/types`).
 */

export type { EssayMarking, Rph, RphSource, RphStatus } from '../../api/types'

export type ChatTool = 'mark_essay' | 'rph' | 'practice'

/** DATA-M13-01. `id` is `thr-{n}`; runtime ids start at `thr-9000001`. */
export interface ChatThread {
  id: string
  userId: number
  createdAt: string
  updatedAt: string
}

/** DATA-M13-02. */
export interface ChatMessage {
  id: number
  threadId: string
  role: 'user' | 'bot'
  text: string
  tool: ChatTool | null
  toolHops: number
  tokensIn: number
  tokensOut: number
  createdAt: string
}

export type PbdStatus = 'pending' | 'approved'

/** DATA-M13-05. */
export interface PbdTag {
  id: number
  userId: number
  classroomId: number
  studentId: number
  sp: string
  skor: number
  tp: number
  status: PbdStatus
  createdAt: string
  approvedAt: string | null
}

/**
 * Test-hook state (SRS §6.9): `nextReply` = the override of the next canned reply (`text`);
 * `turnsAdjust` = the offset that makes today's quota count of `userId` read as set by
 * `cikguSetTurnsUsed`.
 */
export interface TestStateRow {
  id: number
  kind: 'nextReply' | 'turnsAdjust'
  userId: number | null
  text: string | null
  adjust: number
}
