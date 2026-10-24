/**
 * M06 client functions (SRS M06 v1.4 §7 #1-#7, #12-#17, plus the provisional M24 Duta read). UI tasks
 * import these and do not change this file. SPM quiz sessions and S10 history use the M05 client
 * (`startSession`, `checkAnswer`, `submitSession`, `fetchSessions`), not M06 functions.
 *
 * Failures reject with `ApiError`: 401 without a session, 404 unknown subject / foreign mock,
 * 409 `NOT_SUBMITTED` / already submitted, 422 `fields.subject`.
 */

import { api } from '@/api'

import type {
  DatabankSubject,
  DutaCard,
  LatihTubiConfig,
  LatihTubiList,
  MockAnswerInput,
  MockExamView,
  MockListItem,
  MockResult,
  SpmOverview,
  SubjektifOverview,
  TrackingAHub,
  TrackingASubjectResult,
  WalkthroughResponse,
} from './types'

interface Signal {
  signal?: AbortSignal
}
const withSignal = (o: Signal) => (o.signal ? { signal: o.signal } : {})

/** #1 S1. */
export const fetchSpmOverview = (o: Signal = {}) =>
  api.get<SpmOverview>('/api/spm/overview', withSignal(o))

/** #2 S2. */
export const fetchDatabank = (o: Signal = {}) =>
  api.get<DatabankSubject[]>('/api/spm/databank', withSignal(o))

/** #3 S3. */
export const fetchLatihTubiList = (o: Signal = {}) =>
  api.get<LatihTubiList>('/api/spm/latih-tubi', withSignal(o))

/** #4 S4; 404 for an unknown code. */
export const fetchLatihTubiConfig = (code: string, o: Signal = {}) =>
  api.get<LatihTubiConfig>(`/api/spm/latih-tubi/${encodeURIComponent(code)}`, withSignal(o))

/** #5 S5. */
export const fetchTrackingAHub = (o: Signal = {}) =>
  api.get<TrackingAHub>('/api/spm/tracking-a', withSignal(o))

/** #6 S6; BM/BI answer `{redirect}`. */
export const fetchTrackingASubject = (code: string, o: Signal = {}) =>
  api.get<TrackingASubjectResult>(
    `/api/spm/tracking-a/${encodeURIComponent(code)}`,
    withSignal(o),
  )

/** #7 S8. */
export const fetchSubjektif = (o: Signal = {}) =>
  api.get<SubjektifOverview>('/api/spm/subjektif', withSignal(o))

/** #12 S11 list, newest first. */
export const fetchMocks = (o: Signal = {}) =>
  api.get<MockListItem[]>('/api/spm-mocks', withSignal(o))

/** #13 S11 "Jana Percubaan SPM". */
export const createMock = (body: { subject: string; paperNumber: 1 | 2 }) =>
  api.post<{ id: number }>('/api/spm-mocks', { body })

/** #14 Q4 (provisional). */
export const fetchMock = (id: number, o: Signal = {}) =>
  api.get<MockExamView>(`/api/spm-mocks/${String(id)}`, withSignal(o))

/** #15 Q4 submit. */
export const submitMock = (id: number, answers: MockAnswerInput[]) =>
  api.post<MockResult>(`/api/spm-mocks/${String(id)}/submit`, { body: { answers } })

/** #16 S12. */
export const fetchMockResult = (id: number, o: Signal = {}) =>
  api.get<MockResult>(`/api/spm-mocks/${String(id)}/result`, withSignal(o))

/** #17 S13; the live-shaped body is returned untouched. */
export const solveWalkthrough = (form: FormData) =>
  api.multipart<WalkthroughResponse>('/api/spm-walkthrough/solve', form, { raw: true })

/** Provisional M24 read (`GET /api/duta/recommendations`): one card or null. */
export const fetchDutaRecommendation = (
  query: { subject?: string; seed?: number } = {},
  o: Signal = {},
) => {
  const q: Record<string, string | number> = {}
  if (query.subject !== undefined) q.subject = query.subject
  if (query.seed !== undefined) q.seed = query.seed
  return api.get<DutaCard | null>('/api/duta/recommendations', { ...withSignal(o), query: q })
}
