/**
 * M08 headcount client functions (SRS M08 v1.12 §7 #12–#17, #24–#29; build-plan M08-T1b). UI tasks
 * import these and do not change this file (build-plan §S.3 rule 5). Errors are `ApiError`s: 403 for a
 * role or config the viewer may not use (every headcount page is 403 for pelajar), 404 for an unknown
 * id, 409 `CONFLICT` for a duplicate Auto / Manual config (message = the flash text), 422
 * `VALIDATION_ERROR` with `fields`.
 */

import { api, type BlobResult } from '@/api'

import type {
  AutoSetupInput,
  CreateHeadcountInput,
  DropStudentsInput,
  HeadcountDashboard,
  HeadcountDetail,
  HeadcountFormOptions,
  HeadcountListItem,
  HeadcountSort,
  HeadcountStudent,
  HeadcountSummary,
} from './headcount-types'

interface Signal {
  signal?: AbortSignal
}
const withSignal = (o: Signal) => (o.signal ? { signal: o.signal } : {})

/** #12 `GET /api/headcounts` (S12, the viewer's own configs, newest first). */
export const fetchHeadcounts = (o: Signal = {}) =>
  api.get<HeadcountListItem[]>('/api/headcounts', withSignal(o))

/** #13 `GET /api/headcounts/dashboard` (S13). */
export const fetchHeadcountDashboard = (o: Signal = {}) =>
  api.get<HeadcountDashboard>('/api/headcounts/dashboard', withSignal(o))

/** #14 `GET /api/headcounts/form-options` (S14 selects). */
export const fetchHeadcountFormOptions = (o: Signal = {}) =>
  api.get<HeadcountFormOptions>('/api/headcounts/form-options', withSignal(o))

/** #15 `POST /api/headcounts` (S14): resolves to the new config id; 409 duplicate mode, 422 fields. */
export const createHeadcount = (input: CreateHeadcountInput, o: Signal = {}) =>
  api.post<{ id: number }>('/api/headcounts', { body: input, ...withSignal(o) })

/** #16 `POST /api/headcounts/auto-setup` (S12 modal): resolves to the number of configs created. */
export const autoSetupHeadcounts = (input: AutoSetupInput, o: Signal = {}) =>
  api.post<{ created: number }>('/api/headcounts/auto-setup', { body: input, ...withSignal(o) })

/** #17 `GET /api/headcounts/students/:userId` (S15); 404 unknown pupil, 403 not permitted. */
export const fetchHeadcountStudent = (userId: number | string, o: Signal = {}) =>
  api.get<HeadcountStudent>(`/api/headcounts/students/${String(userId)}`, withSignal(o))

/** #24 `GET /api/headcounts/:id/summary` (S22); 404 unknown, 403 not permitted. */
export const fetchHeadcountSummary = (id: number | string, o: Signal = {}) =>
  api.get<HeadcountSummary>(`/api/headcounts/${String(id)}/summary`, withSignal(o))

/** #25 `GET /api/headcounts/:id` (S23); `sort` ranking (default) or name. */
export const fetchHeadcountDetail = (id: number | string, options: { sort?: HeadcountSort } & Signal = {}) =>
  api.get<HeadcountDetail>(`/api/headcounts/${String(id)}`, {
    ...withSignal(options),
    ...(options.sort ? { query: { sort: options.sort } } : {}),
  })

/** #26 `POST /api/headcounts/:id/reset` ("Ya, Reset"). */
export const resetHeadcount = (id: number | string, o: Signal = {}) =>
  api.post<{ reset: true }>(`/api/headcounts/${String(id)}/reset`, withSignal(o))

/** #27 `DELETE /api/headcounts/:id` ("Ya, Padam"). */
export const deleteHeadcount = (id: number | string, o: Signal = {}) =>
  api.delete<{ deleted: true }>(`/api/headcounts/${String(id)}`, withSignal(o))

/** #28 `POST /api/headcounts/:id/drop-students` ("Gugurkan" / "Kembalikan"). */
export const dropHeadcountStudents = (id: number | string, input: DropStudentsInput, o: Signal = {}) =>
  api.post<{ updated: number }>(`/api/headcounts/${String(id)}/drop-students`, {
    body: input,
    ...withSignal(o),
  })

/** #29 `GET /api/headcounts/:id/export` (CSV download of the S23 table). */
export const downloadHeadcountCsv = (
  id: number | string,
  options: { sort?: HeadcountSort } & Signal = {},
): Promise<BlobResult> =>
  api.blob(`/api/headcounts/${String(id)}/export`, {
    ...withSignal(options),
    ...(options.sort ? { query: { sort: options.sort } } : {}),
  })
