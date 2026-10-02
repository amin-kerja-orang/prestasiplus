/**
 * M12 client functions (SRS M12 v1.6 §7 #1-#14; build-plan M12-T1). The UI tasks import these and do not change
 * this file (build-plan §S.3 rule 5). The page query `school_id` / `state` is passed as `schoolId` / `state`.
 *
 * Failures reject with `ApiError`: 401 without a session (the client's 401 policy sends the user to `/login`),
 * 403 `FORBIDDEN` for a role without access (and for S8 with an id that is not an accessible student), 404
 * `NOT_FOUND`, 409 `CONFLICT` (a second feedback in the month), 422 `VALIDATION_ERROR` with `fields`.
 *
 * Access: admin and teacher (provisional, SRS M12 §9) reach all of #1-#11 and #14; the school administrator
 * (INFERRED, build-plan v1.12 R.1.3, `/admin-sekolah/kirkpatrick`) reaches #1 and #14 only (G4 decision
 * F6), always forced to the account's own school; #11-#13 are open to any logged-in user.
 */

import { api, type BlobResult } from '@/api'

import type {
  Behavior,
  Chain,
  FeedbackInput,
  FeedbackResponse,
  FeedbackStatus,
  FilterOptions,
  InterventionInput,
  InterventionList,
  KirkpatrickIntervention,
  Learning,
  MyKirkpatrick,
  Overview,
  Reaction,
  Results,
  ScopeQuery,
  StudentKirkpatrick,
} from './types'

interface Signal {
  signal?: AbortSignal
}

const withSignal = (o: Signal) => (o.signal ? { signal: o.signal } : {})

const scopeQuery = (q: ScopeQuery) => ({
  ...(q.schoolId === null || q.schoolId === undefined ? {} : { schoolId: q.schoolId }),
  ...(q.state === null || q.state === undefined || q.state === '' ? {} : { state: q.state }),
})

/** #1 `GET /api/kirkpatrick/overview?schoolId&state` (S1). */
export function fetchKirkpatrickOverview(
  query: ScopeQuery = {},
  options: Signal = {},
): Promise<Overview> {
  return api.get<Overview>('/api/kirkpatrick/overview', {
    query: scopeQuery(query),
    ...withSignal(options),
  })
}

/** #2 `GET /api/kirkpatrick/reaction` (S2; ignores the scope). */
export function fetchKirkpatrickReaction(options: Signal = {}): Promise<Reaction> {
  return api.get<Reaction>('/api/kirkpatrick/reaction', withSignal(options))
}

/** #3 `GET /api/kirkpatrick/learning?schoolId` (S3). */
export function fetchKirkpatrickLearning(
  query: Pick<ScopeQuery, 'schoolId'> = {},
  options: Signal = {},
): Promise<Learning> {
  return api.get<Learning>('/api/kirkpatrick/learning', {
    query: scopeQuery(query),
    ...withSignal(options),
  })
}

/** #4 `GET /api/kirkpatrick/behavior?schoolId` (S4). */
export function fetchKirkpatrickBehavior(
  query: Pick<ScopeQuery, 'schoolId'> = {},
  options: Signal = {},
): Promise<Behavior> {
  return api.get<Behavior>('/api/kirkpatrick/behavior', {
    query: scopeQuery(query),
    ...withSignal(options),
  })
}

/** #5 `GET /api/kirkpatrick/results?schoolId` (S5; one response holds the 946 prediction rows). */
export function fetchKirkpatrickResults(
  query: Pick<ScopeQuery, 'schoolId'> = {},
  options: Signal = {},
): Promise<Results> {
  return api.get<Results>('/api/kirkpatrick/results', {
    query: scopeQuery(query),
    ...withSignal(options),
  })
}

/** #6 `GET /api/kirkpatrick/chain` (S6). */
export function fetchKirkpatrickChain(options: Signal = {}): Promise<Chain> {
  return api.get<Chain>('/api/kirkpatrick/chain', withSignal(options))
}

/** #7 `GET /api/kirkpatrick/export-pdf` (S6 "Muat Turun Laporan"; PROPOSED content, provisional). */
export function fetchKirkpatrickChainPdf(): Promise<BlobResult> {
  return api.blob('/api/kirkpatrick/export-pdf')
}

/** #8 `GET /api/kirkpatrick/interventions` (S7). */
export function fetchKirkpatrickInterventions(options: Signal = {}): Promise<InterventionList> {
  return api.get<InterventionList>('/api/kirkpatrick/interventions', withSignal(options))
}

/** #9 `POST /api/kirkpatrick/interventions` (201; 422 `fields.studentId` "Pelajar tidak dijumpai."). */
export function createKirkpatrickIntervention(
  input: InterventionInput,
): Promise<KirkpatrickIntervention> {
  return api.post<KirkpatrickIntervention>('/api/kirkpatrick/interventions', { body: input })
}

/** #10 `GET /api/kirkpatrick/students/:id` (S8; 403 when the id is not an accessible student). */
export function fetchKirkpatrickStudent(
  id: number,
  options: Signal = {},
): Promise<StudentKirkpatrick> {
  return api.get<StudentKirkpatrick>(`/api/kirkpatrick/students/${String(id)}`, withSignal(options))
}

/** #11 `GET /api/kirkpatrick/me` (S9, the current user). */
export function fetchMyKirkpatrick(options: Signal = {}): Promise<MyKirkpatrick> {
  return api.get<MyKirkpatrick>('/api/kirkpatrick/me', withSignal(options))
}

/** #12 `GET /api/feedback/status` (S10). */
export function fetchFeedbackStatus(options: Signal = {}): Promise<FeedbackStatus> {
  return api.get<FeedbackStatus>('/api/feedback/status', withSignal(options))
}

/** #13 `POST /api/feedback` (201; 409 when already answered this month; 422 out of range). */
export function submitFeedback(input: FeedbackInput): Promise<FeedbackResponse> {
  return api.post<FeedbackResponse>('/api/feedback', { body: input })
}

/** #14 `GET /api/kirkpatrick/filter-options` (the S1 / S4 selects). */
export function fetchKirkpatrickFilterOptions(options: Signal = {}): Promise<FilterOptions> {
  return api.get<FilterOptions>('/api/kirkpatrick/filter-options', withSignal(options))
}
