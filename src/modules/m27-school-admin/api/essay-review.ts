/**
 * Tanda Karangan client (V2 Panel `/spm/tanda-karangan`; contract `packages/contract/src/school-admin/essay-review.ts`).
 * One page, two doors: the school admin reads `/admin-sekolah/tanda-karangan` (the school comes from the session), Admin
 * Pusat reads `/admin/spm/tanda-karangan` (every school). `meta.totalItems` is the count waiting. Errors: 401, 403,
 * 404 on confirm (unknown or outside the scope), 422 (bad mark), 429.
 */

import { api, type ListResult } from '@/api'

export interface EssayReviewPoint {
  id?: number
  covered?: boolean
  awarded?: number
}

export interface EssayReviewRow {
  id: string
  student: string
  questionNo: string | null
  stem: string
  /** The maximum mark of the part. */
  marks: number
  /** The AI proposal; null when it gave none. */
  proposed: number | null
  rationale: string
  points: EssayReviewPoint[]
  scheme: string[]
  essay: string
}

export interface EssayReviewConfirmResult {
  data: { id: string; finalMarks: number }
  /** "Markah karangan disahkan." */
  status: string
}

export type EssayReviewList = ListResult<EssayReviewRow>

/** Base path of the caller: Admin Pusat reaches the national queue, the school admin the own school's. */
export const essayReviewBase = (central: boolean): string =>
  central ? '/api/admin/spm/tanda-karangan' : '/api/admin-sekolah/tanda-karangan'

/** `GET` the pending proposals (newest first, 20 per page). */
export const fetchEssayReview = (central: boolean, signal?: AbortSignal) =>
  api.list<EssayReviewRow>(essayReviewBase(central), { ...(signal ? { signal } : {}) })

/** `POST /{id}/sahkan`: confirm or adjust the final mark. */
export const confirmEssayMark = (central: boolean, id: string, marks: number) =>
  api.post<EssayReviewConfirmResult>(`${essayReviewBase(central)}/${encodeURIComponent(id)}/sahkan`, {
    body: { marks },
    raw: true,
  })
