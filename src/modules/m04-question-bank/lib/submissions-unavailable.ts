/**
 * The teacher question papers (S10) have no admin API route in the real backend yet (only the teacher
 * side `GET /api/guru/contributions` exists). In http mode the adapter raises this error and the page
 * shows a friendly demo state instead of the generic load error. Copy mirrors `UNAVAILABLE_TITLE` in
 * `m28-bijak-spm/server/errors.ts` (not imported, to avoid a cross-module dependency).
 */
export const SUBMISSIONS_UNAVAILABLE_TITLE = 'Fungsi ini belum tersedia dalam demo'

export class SubmissionsUnavailableError extends Error {
  constructor() {
    super(SUBMISSIONS_UNAVAILABLE_TITLE)
    this.name = 'SubmissionsUnavailableError'
  }
}

export const isSubmissionsUnavailable = (err: unknown): boolean =>
  err instanceof SubmissionsUnavailableError
