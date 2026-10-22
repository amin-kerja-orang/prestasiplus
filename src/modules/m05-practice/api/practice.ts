/**
 * M05 client functions (SRS M05 v1.17 §7 #1–#21 and the session calls #4–#6, #23; build-plan
 * M05-T1). UI tasks import these and do not change this file (build-plan §S.3 rule 5).
 */

import { api, isHttpMode, wireId, wireIdOpt, type ListResult } from '@/api'

import type {
  ChapterSubject,
  ChapterSubjectDetail,
  CheckAnswerResponse,
  Corrections,
  Dashboard,
  HistoryItem,
  HistoryPeriod,
  HistoryTotals,
  MissionItem,
  Mastery,
  PracticeMode,
  PracticeSubject,
  Progress,
  ProgressPeriod,
  RemedialPreview,
  RemedialTestItem,
  RevisionOverview,
  RevisionSubject,
  SessionListItem,
  SaveSpmTargetsResult,
  SessionListStats,
  StartSessionRequest,
  SpmGrade,
  SpmTargets,
  StartSessionResponse,
  StructuredAttemptRequest,
  StructuredAttemptResult,
  StructuredCard,
  StructuredDetail,
  StructuredListMeta,
  StructuredScope,
  StructuredTrack,
  SubjectConfig,
  SubmitSessionResponse,
} from './types'

interface Signal {
  signal?: AbortSignal
}

const withSignal = (o: Signal) => (o.signal ? { signal: o.signal } : {})

/** #1 `GET /api/dashboard`. */
export async function fetchDashboard(options: Signal = {}): Promise<Dashboard> {
  const body = await api.get<Dashboard>('/api/dashboard', withSignal(options))
  return isHttpMode() ? normaliseDashboard(body) : body
}

/**
 * http mode only: the `PracticeReadDashboard` wire body (`GET /api/dashboard`, packages/contract
 * practice/reads) already has the page's `Dashboard` shape. Ids stay as sent (opaque strings, the
 * `EntityId` of the dashboard types; the page uses them only as list keys and never posts them back).
 * List sections the server returns empty (or omits) become `[]` so the page shows its existing empty
 * state.
 */
export function normaliseDashboard(wire: Dashboard): Dashboard {
  const list = <T>(rows: readonly T[] | null | undefined): T[] => (Array.isArray(rows) ? [...rows] : [])
  return {
    ...wire,
    banners: list(wire.banners),
    quests: list(wire.quests),
    badges: list(wire.badges),
    articles: list(wire.articles),
    subjects: list(wire.subjects),
    levelPills: list(wire.levelPills),
    recentQuestions: list(wire.recentQuestions),
    difficultyChart: list(wire.difficultyChart),
    subjectStats: list(wire.subjectStats),
  }
}

/** #2 `GET /api/practice/subjects`. */
export function fetchPracticeSubjects(options: Signal = {}): Promise<ListResult<PracticeSubject>> {
  return api.list<PracticeSubject>('/api/practice/subjects', withSignal(options))
}

/** #3 `GET /api/practice/subjects/:code` (404 `NOT_FOUND` for an unknown code). */
export function fetchSubjectConfig(code: string, options: Signal = {}): Promise<SubjectConfig> {
  return api.get<SubjectConfig>(
    `/api/practice/subjects/${encodeURIComponent(code)}`,
    withSignal(options),
  )
}

/** #4 `POST /api/practice/sessions` (402 `TRIAL_EXHAUSTED`, 409 `CHAPTER_LOCKED`, 404, 422). */
export function startSession(body: StartSessionRequest): Promise<StartSessionResponse> {
  return api.post<StartSessionResponse>('/api/practice/sessions', { body: startWireBody(body) })
}

/** Id fields of the start body that the contract types as `IdSchema` (string). */
const START_ID_FIELDS = [
  'levelId',
  'chapterId',
  'targetQuestionId',
  'missionId',
  'remedialTestId',
  'questionSetId',
] as const satisfies readonly (keyof StartSessionRequest)[]

/**
 * The start body as the active transport expects it: in http mode every id field is a string
 * (`StartSessionRequestSchema`; a numeric `levelId` is 422 "Nilai tidak sah.", D-02). Absent fields
 * stay absent and `null` stays `null`.
 */
function startWireBody(body: StartSessionRequest): Record<string, unknown> {
  const out: Record<string, unknown> = { ...body }
  for (const key of START_ID_FIELDS) {
    if (key in out) out[key] = wireIdOpt(body[key])
  }
  return out
}

const wireAnswer = (a: { questionId: number; selectedOptionId: number }) => ({
  questionId: wireId(a.questionId),
  selectedOptionId: a.selectedOptionId,
})

/** #5 `POST /api/practice/sessions/:id/check-answer`. */
export function checkAnswer(
  sessionId: string,
  body: { questionId: number; selectedOptionId: number },
): Promise<CheckAnswerResponse> {
  return api.post<CheckAnswerResponse>(
    `/api/practice/sessions/${encodeURIComponent(sessionId)}/check-answer`,
    { body: wireAnswer(body) },
  )
}

/** #6 `POST /api/practice/sessions/:id/submit` (BR-31). */
export function submitSession(
  sessionId: string,
  body: {
    answers?: { questionId: number; selectedOptionId: number }[]
    timeSpent: number
  },
): Promise<SubmitSessionResponse> {
  return api.post<SubmitSessionResponse>(
    `/api/practice/sessions/${encodeURIComponent(sessionId)}/submit`,
    { body: body.answers ? { ...body, answers: body.answers.map(wireAnswer) } : body },
  )
}

/** #7 `GET /api/practice/chapter-subjects`. */
export function fetchChapterSubjects(options: Signal = {}): Promise<ListResult<ChapterSubject>> {
  return api.list<ChapterSubject>('/api/practice/chapter-subjects', withSignal(options))
}

/** #8 `GET /api/practice/chapter-subjects/:code?levelId=`. */
export function fetchChapterSubject(
  code: string,
  query: { levelId?: number | null } = {},
  options: Signal = {},
): Promise<ChapterSubjectDetail> {
  return api.get<ChapterSubjectDetail>(
    `/api/practice/chapter-subjects/${encodeURIComponent(code)}`,
    { query: { levelId: query.levelId ?? null }, ...withSignal(options) },
  )
}

/** #9 `GET /api/practice/revision`. */
export function fetchRevisionOverview(options: Signal = {}): Promise<RevisionOverview> {
  return api.get<RevisionOverview>('/api/practice/revision', withSignal(options))
}

/** #10 `GET /api/practice/revision/:code` (404 for an unknown code; `count` 0 is a 200). */
export function fetchRevisionSubject(code: string, options: Signal = {}): Promise<RevisionSubject> {
  return api.get<RevisionSubject>(
    `/api/practice/revision/${encodeURIComponent(code)}`,
    withSignal(options),
  )
}

/** #11 `GET /api/practice/progress?period=` (default 30; unknown → zero figures). */
export function fetchProgress(
  period: ProgressPeriod | (string & {}) | null = null,
  options: Signal = {},
): Promise<Progress> {
  return api.get<Progress>('/api/practice/progress', {
    query: { period },
    ...withSignal(options),
  })
}

/** #12 `GET /api/practice/history?period=&page=` (15 per page). */
export function fetchHistory(
  query: { period?: HistoryPeriod | (string & {}) | null; page?: number | null } = {},
  options: Signal = {},
): Promise<ListResult<HistoryItem, { totals: HistoryTotals }>> {
  return api.list<HistoryItem, { totals: HistoryTotals }>('/api/practice/history', {
    query: { period: query.period ?? null, page: query.page ?? null },
    ...withSignal(options),
  })
}

/** #13 `GET /api/practice/corrections?month=YYYY-MM` (malformed → current month). */
export function fetchCorrections(
  month: string | null = null,
  options: Signal = {},
): Promise<Corrections> {
  return api.get<Corrections>('/api/practice/corrections', {
    query: { month },
    ...withSignal(options),
  })
}

/** #14 `GET /api/practice/mastery`. */
export function fetchMastery(options: Signal = {}): Promise<Mastery> {
  return api.get<Mastery>('/api/practice/mastery', withSignal(options))
}

/** #23 `GET /api/practice/sessions?modes=&type=&page=&pageSize=` (M06 S10 history). */
export function fetchSessions(
  query: {
    modes: readonly PracticeMode[]
    type?: PracticeMode | null
    page?: number | null
    pageSize?: number | null
  },
  options: Signal = {},
): Promise<
  ListResult<SessionListItem, { activeType: PracticeMode | null; stats: SessionListStats }>
> {
  return api.list<SessionListItem, { activeType: PracticeMode | null; stats: SessionListStats }>(
    '/api/practice/sessions',
    {
      query: {
        modes: query.modes.join(','),
        type: query.type ?? null,
        page: query.page ?? null,
        pageSize: query.pageSize ?? null,
      },
      ...withSignal(options),
    },
  )
}

// ---------------------------------------------------------------------------------------------
// #15–#21 (M05-T2)
// ---------------------------------------------------------------------------------------------

/** #15 `GET /api/practice/structured?subjectId=&kbatLevel=&page=&scope=spm&track=bahasa` (20 per page). */
export function fetchStructured(
  query: {
    subjectId?: number | string | null
    kbatLevel?: number | string | null
    page?: number | null
    scope?: StructuredScope | null
    track?: StructuredTrack | null
  } = {},
  options: Signal = {},
): Promise<ListResult<StructuredCard, StructuredListMeta>> {
  return api.list<StructuredCard, StructuredListMeta>('/api/practice/structured', {
    query: {
      subjectId: query.subjectId ?? null,
      kbatLevel: query.kbatLevel ?? null,
      page: query.page ?? null,
      scope: query.scope ?? null,
      track: query.track ?? null,
    },
    ...withSignal(options),
  })
}

/** #16 `GET /api/practice/structured/:id?scope=&track=` (404 for an unknown or unlisted set). */
export function fetchStructuredDetail(
  id: number | string,
  query: { scope?: StructuredScope | null; track?: StructuredTrack | null } = {},
  options: Signal = {},
): Promise<StructuredDetail> {
  return api.get<StructuredDetail>(`/api/practice/structured/${String(id)}`, {
    query: { scope: query.scope ?? null, track: query.track ?? null },
    ...withSignal(options),
  })
}

/** #17 `POST /api/practice/structured/:id/attempts` (404, 422). */
export function submitStructuredAttempt(
  id: number | string,
  body: StructuredAttemptRequest,
): Promise<StructuredAttemptResult> {
  return api.post<StructuredAttemptResult>(`/api/practice/structured/${String(id)}/attempts`, {
    body,
  })
}

/** #18 `GET /api/spm-targets`. */
export function fetchSpmTargets(options: Signal = {}): Promise<SpmTargets> {
  return api.get<SpmTargets>('/api/spm-targets', withSignal(options))
}

/** #19 `PUT /api/spm-targets`: `{data:{saved}, status}` (422 "Gred target tidak sah."). */
export function saveSpmTargets(
  targets: Record<number | string, SpmGrade | ''>,
): Promise<SaveSpmTargetsResult> {
  return api.put<SaveSpmTargetsResult>('/api/spm-targets', { body: { targets }, raw: true })
}

/** #20 `GET /api/remedial-tests/mine` (the viewer's tests, newest first). */
export function fetchRemedialTests(options: Signal = {}): Promise<ListResult<RemedialTestItem>> {
  return api.list<RemedialTestItem>('/api/remedial-tests/mine', withSignal(options))
}

/** #21 `GET /api/missions/today` (today's missions of the viewer, oldest first). */
export function fetchTodayMissions(options: Signal = {}): Promise<ListResult<MissionItem>> {
  return api.list<MissionItem>('/api/missions/today', withSignal(options))
}

/** #20b `GET /api/remedial-tests/:id` — Q4 preview (own teacher or admin; 404 for anyone else). */
export function fetchRemedialPreview(id: number, options: Signal = {}): Promise<RemedialPreview> {
  return api.get<RemedialPreview>(`/api/remedial-tests/${String(id)}`, withSignal(options))
}
