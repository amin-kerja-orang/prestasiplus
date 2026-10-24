/**
 * M04 master-note endpoints (SRS §7 #26–#27; build-plan M04-T2): S12 "Nota Induk — Semakan Admin"
 * (rendered in the user shell, admin role). Every call needs an admin session. UI tasks read this
 * file and do not change it (build-plan §S.3 rule 5).
 */

import { api, type ListResult } from '@/api'

export type MasterNoteTab = 'flagged' | 'approved' | 'all'
export type MasterNoteAction = 'approve' | 'regen' | 'unflag'

/** DATA-M04-06 with the question it belongs to. */
export interface MasterNoteRow {
  id: number
  questionId: number
  /** `"—"` when the question or its subject is unknown. */
  subjectName: string
  /** `null` is shown as "—". */
  chapter: string | null
  model: string
  tokens: number
  /** Badge "conf {n}". */
  confidence: number
  /** The question text (S12 cuts it at about 200 characters). */
  questionText: string
  noteText: string
  trapText: string
  flagged: boolean
  teacherApproved: boolean
  createdAt: string
}

export interface MasterNoteListMeta {
  /** The tab that was applied (an unknown `tab` falls back to `flagged`). */
  activeTab: MasterNoteTab
  /** "{flagged} ditanda · {teacherApproved} diluluskan guru · {total} jumlah". */
  summary: { flagged: number; teacherApproved: number; total: number }
}

/** #26 `GET /api/master-notes`: `id` descending, 15 per page. */
export function fetchMasterNotes(
  query: { tab?: string | null; page?: number; signal?: AbortSignal } = {},
): Promise<ListResult<MasterNoteRow, MasterNoteListMeta>> {
  return api.list<MasterNoteRow, MasterNoteListMeta>('/api/master-notes', {
    query: { tab: query.tab ?? null, page: query.page ?? null },
    ...(query.signal ? { signal: query.signal } : {}),
  })
}

/**
 * #27 `POST /api/master-notes/:id/:action`. Success is HTTP 200 `{ ok: true }`; a failure is a
 * non-2xx status (the page judges by the status only, FR-M04-104) and rejects with an `ApiError`.
 */
export function actOnMasterNote(id: number, action: MasterNoteAction): Promise<{ ok: true }> {
  return api.post<{ ok: true }>(`/api/master-notes/${String(id)}/${action}`, { raw: true })
}
