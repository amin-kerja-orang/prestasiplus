/**
 * HTTP implementation of the Bijak SPM student server (`BijakApi`), talking to the real
 * `/api/bijak/*` routes (contract: packages/contract/src/bijak/{papers,attempts}). The pages see the
 * same interface and the same domain shapes as with the in-browser mock, so this file only
 * - maps the wire to the domain (ISO 8601 instants become epoch ms, the numeric `userId` of the
 *   mock attempt is not on the wire and is filled with 0, `serverNow` is folded into `serverNow()`),
 * - maps `ApiError` to the `BijakError` codes the pages read (`not_found`, `offline`, ...),
 * - sends `X-CSRF-Token` (Session.csrf, from `GET /api/session`) on every mutating request.
 *
 * It must never import `store.ts` / `data/registry` (the mock + seeds): the http bundle stays free
 * of them. Only type imports from the domain and the contract.
 */
import type {
  BijakAttemptHistoryRow,
  BijakAttemptInProgress,
  BijakAttemptMeta,
  BijakAttemptPaperView,
  BijakAttemptResultView,
  BijakAttemptSaveResult,
  BijakAttemptStartResult,
  BijakAttemptSubmitResult,
  BijakBlueprintContract,
  BijakGenerateResult,
  BijakGenerateShortage,
  BijakPaperCover,
  BijakPaperSummary,
  BijakAttemptQuestionResult,
} from '@pp/contract'
import { reactive } from 'vue'

import { api, ApiError, API_ERROR_CODES, type ApiClient, type HttpMethod } from '@/api'

import type {
  AttemptMode,
  AttemptPaperView,
  GenerateOutcome,
  HistoryRow,
  InProgressInfo,
  PaperCover,
  PaperSummary,
  QuestionResult,
  ResultView,
  SaveChange,
  SavePayload,
  StoredAnswer,
  Subject,
  SubjectCode,
  SubmitPayload,
} from '../domain/types'
import { BijakError } from './errors'
import type { BijakApi, ContractRow, SaveResult, SubmitResult } from './types'

export interface HttpBijakOptions {
  /** The API client to send through. Default: the app-wide `api` (transport installed by bootstrap). */
  client?: Pick<ApiClient, 'request'>
  /**
   * Returns the CSRF token (`Session.csrf`). `refresh: true` must bypass any cache (called once
   * after a 403 `CSRF_INVALID`). Default: lazily `GET /api/session`, cached.
   */
  getCsrf?: (refresh: boolean) => Promise<string>
  /** Local clock, injectable for tests. */
  now?: () => number
}

type Body = Record<string, unknown>

/* ------------------------------------------------------------------------------ wire mapping */

const toMs = (iso: string): number => Date.parse(iso)
const toIso = (ms: number): string => new Date(ms).toISOString()

function changeToWire(c: SaveChange): Body {
  return { partId: c.partId, answer: c.answer, rev: c.rev, savedAt: toIso(c.savedAt) }
}

function payloadToWire(p: SavePayload): Body {
  const out: Body = { changes: p.changes.map(changeToWire) }
  if (p.flags) out.flags = p.flags
  if (p.picks) out.picks = p.picks
  if (typeof p.position === 'number') out.position = p.position
  return out
}

function submitToWire(p: SubmitPayload): Body {
  const out = payloadToWire(p)
  out.idempotencyKey = p.idempotencyKey
  if (p.answers) {
    out.answers = Object.fromEntries(
      Object.entries(p.answers).map(([partId, v]) => [
        partId,
        { answer: v.answer, rev: v.rev, savedAt: toIso(v.savedAt) },
      ]),
    )
  }
  if (p.auto !== undefined) out.auto = p.auto
  return out
}

function metaFromWire(m: BijakAttemptMeta): AttemptPaperView['attempt'] {
  const answers: Record<string, StoredAnswer> = {}
  for (const [partId, a] of Object.entries(m.answers)) {
    answers[partId] = { answer: a.answer, rev: a.rev, savedAt: toMs(a.savedAt) }
  }
  const { startedAt, deadline, submittedAt, ...rest } = m
  return {
    ...rest,
    // The numeric user id of the mock attempt is not on the wire (every attempt is the caller's).
    userId: 0,
    answers,
    startedAt: toMs(startedAt),
    deadline: deadline === null ? null : toMs(deadline),
    ...(submittedAt !== undefined ? { submittedAt: toMs(submittedAt) } : {}),
  }
}

function viewFromWire(v: BijakAttemptPaperView): AttemptPaperView {
  return {
    attempt: metaFromWire(v.attempt),
    sections: v.sections,
    questions: v.questions,
    groups: v.groups,
    checks: v.checks,
  }
}

/* --------------------------------------------------------------------------------- errors */

const DEFAULT_MESSAGES = {
  not_found: 'Tidak ditemui',
  forbidden: 'Akses ditolak',
  not_submitted: 'Skema hanya didedahkan selepas Hantar',
  bad_request: 'Permintaan tidak sah',
} as const

/** The body message (BM, verbatim from the contract) unless the body had none (`HTTP 404`). */
function bodyMessage(e: ApiError, fallback: string): string {
  return e.message && !/^HTTP \d+$/.test(e.message) ? e.message : fallback
}

/**
 * Maps an `ApiError` to the `BijakError` the pages and the autosave read. 401 (handled by the global
 * policy of the api client), 429 and 5xx are rethrown unchanged; aborts too.
 */
export function toBijakError(e: unknown): unknown {
  if (!(e instanceof ApiError)) return e
  if (e.code === API_ERROR_CODES.NETWORK_ERROR) return new BijakError('offline', 'Luar talian')
  if (e.status === 404) {
    return new BijakError('not_found', bodyMessage(e, DEFAULT_MESSAGES.not_found))
  }
  if (e.status === 403) {
    return new BijakError('forbidden', bodyMessage(e, DEFAULT_MESSAGES.forbidden))
  }
  if (e.status === 409) {
    return e.code === 'NOT_SUBMITTED'
      ? new BijakError('not_submitted', bodyMessage(e, DEFAULT_MESSAGES.not_submitted))
      : // CONFLICT "Percubaan sudah tamat" (check on a closed attempt): the mock's bad_request.
        new BijakError('bad_request', bodyMessage(e, 'Percubaan sudah tamat'))
  }
  if (e.status === 400 || e.status === 422) {
    return new BijakError('bad_request', bodyMessage(e, DEFAULT_MESSAGES.bad_request))
  }
  return e
}

function shortagesOf(e: ApiError): BijakGenerateShortage[] {
  const body = e.body as { error?: { details?: { shortages?: BijakGenerateShortage[] } } } | null
  return body?.error?.details?.shortages ?? []
}

/* ------------------------------------------------------------------------------- the client */

export class HttpBijakServer implements BijakApi {
  private readonly client: Pick<ApiClient, 'request'>
  private readonly now: () => number
  private readonly csrfSource: (refresh: boolean) => Promise<string>
  private csrfCache: Promise<string> | null = null
  private clockOffsetMs = 0
  private readonly subjectList = reactive<Subject[]>([])
  private subjectsRequested = false

  constructor(options: HttpBijakOptions = {}) {
    this.client = options.client ?? api
    this.now = options.now ?? (() => Date.now())
    this.csrfSource = options.getCsrf ?? ((refresh) => this.sessionCsrf(refresh))
  }

  /* ------------------------------------------------------------------------------ plumbing */

  /** Default CSRF source: `GET /api/session` once, `data.csrf` cached until a refresh. */
  private sessionCsrf(refresh: boolean): Promise<string> {
    if (refresh || !this.csrfCache) {
      const pending = this.client
        .request<{ data: { csrf: string } }>('GET', '/api/session', { raw: true })
        .then((body) => body.data.csrf)
      this.csrfCache = pending
      // A failed fetch must not stay cached.
      pending.catch(() => {
        if (this.csrfCache === pending) this.csrfCache = null
      })
    }
    return this.csrfCache
  }

  /** One request, the `ApiError` untouched: CSRF header on mutations, one refresh + retry on `CSRF_INVALID`. */
  private async exec<T>(method: HttpMethod, url: string, body?: Body): Promise<T> {
    const run = (csrf?: string) =>
      this.client.request<{ data: T } | null>(method, url, {
        raw: true,
        ...(body !== undefined ? { body } : {}),
        ...(csrf ? { headers: { 'x-csrf-token': csrf } } : {}),
      })
    let res: { data: T } | null
    if (method === 'GET') {
      res = await run()
    } else {
      try {
        res = await run(await this.csrfSource(false))
      } catch (e) {
        // The session was renewed behind our back: fetch the token again, retry exactly once.
        if (!(e instanceof ApiError && e.status === 403 && e.code === 'CSRF_INVALID')) throw e
        res = await run(await this.csrfSource(true))
      }
    }
    return (res?.data ?? null) as T
  }

  /** `exec` with errors mapped to `BijakError` (what the pages read). */
  private async send<T>(method: HttpMethod, url: string, body?: Body): Promise<T> {
    try {
      return await this.exec<T>(method, url, body)
    } catch (e) {
      throw toBijakError(e)
    }
  }

  private learnClock(serverNow: string): void {
    this.clockOffsetMs = toMs(serverNow) - this.now()
  }

  serverNow(): number {
    return this.now() + this.clockOffsetMs
  }

  /* --------------------------------------------------------------------------------- papers */

  /**
   * Sync, like the mock: returns a reactive list that fills from `GET /api/bijak/subjects` after the
   * first call (a failed fetch is retried by the next call). Pages derive their lists with `computed`.
   */
  subjects(): readonly Subject[] {
    if (!this.subjectsRequested) {
      this.subjectsRequested = true
      this.send<Subject[]>('GET', '/api/bijak/subjects').then(
        (rows) => this.subjectList.splice(0, this.subjectList.length, ...rows),
        () => {
          this.subjectsRequested = false
        },
      )
    }
    return this.subjectList
  }

  listPapers(): Promise<PaperSummary[]> {
    return this.send<BijakPaperSummary[]>('GET', '/api/bijak/papers')
  }

  getCover(_userId: number, paperId: string): Promise<PaperCover> {
    return this.send<BijakPaperCover>('GET', `/api/bijak/papers/${encodeURIComponent(paperId)}`)
  }

  listContracts(): Promise<ContractRow[]> {
    return this.send<BijakBlueprintContract[]>('GET', '/api/bijak/contracts')
  }

  async generatePaper(
    _userId: number,
    subject: SubjectCode,
    kertas: number,
  ): Promise<GenerateOutcome> {
    try {
      const out = await this.exec<BijakGenerateResult>('POST', '/api/bijak/papers/generate', {
        subject,
        kertas,
      })
      return { ok: true, paperId: out.paperId }
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        if (e.code === 'NO_BLUEPRINT') return { ok: false, reason: 'no_blueprint' }
        if (e.code === 'SHORTAGE')
          return { ok: false, reason: 'shortage', shortages: shortagesOf(e) }
      }
      throw toBijakError(e)
    }
  }

  /* ------------------------------------------------------------------------------- attempts */

  async findInProgress(_userId: number, paperId: string): Promise<InProgressInfo | null> {
    const info = await this.send<BijakAttemptInProgress | null>(
      'GET',
      `/api/bijak/papers/${encodeURIComponent(paperId)}/in-progress`,
    )
    return info ?? null
  }

  async startAttempt(
    _userId: number,
    paperId: string,
    mode: AttemptMode,
    opts: { restart?: boolean } = {},
  ): Promise<{ attemptId: string }> {
    const body: Body = { paperId, mode }
    if (opts.restart !== undefined) body.restart = opts.restart
    const out = await this.send<BijakAttemptStartResult>('POST', '/api/bijak/attempts', body)
    return { attemptId: out.attemptId }
  }

  async getAttemptView(_userId: number, attemptId: string): Promise<AttemptPaperView> {
    const wire = await this.send<BijakAttemptPaperView>(
      'GET',
      `/api/bijak/attempts/${encodeURIComponent(attemptId)}`,
    )
    this.learnClock(wire.serverNow)
    return viewFromWire(wire)
  }

  async saveAnswers(_userId: number, attemptId: string, payload: SavePayload): Promise<SaveResult> {
    const out = await this.send<BijakAttemptSaveResult>(
      'PUT',
      `/api/bijak/attempts/${encodeURIComponent(attemptId)}/answers`,
      payloadToWire(payload),
    )
    return { ...out, savedAt: toMs(out.savedAt) }
  }

  submit(_userId: number, attemptId: string, payload: SubmitPayload): Promise<SubmitResult> {
    return this.send<BijakAttemptSubmitResult>(
      'POST',
      `/api/bijak/attempts/${encodeURIComponent(attemptId)}/submit`,
      submitToWire(payload),
    )
  }

  async abandon(_userId: number, attemptId: string): Promise<void> {
    await this.send<null>('POST', `/api/bijak/attempts/${encodeURIComponent(attemptId)}/abandon`)
  }

  checkQuestion(
    _userId: number,
    attemptId: string,
    questionId: string,
    payload?: SavePayload,
  ): Promise<QuestionResult> {
    return this.send<BijakAttemptQuestionResult>(
      'POST',
      `/api/bijak/attempts/${encodeURIComponent(attemptId)}/questions/${encodeURIComponent(questionId)}/check`,
      payload ? payloadToWire(payload) : undefined,
    )
  }

  async getResult(_userId: number, attemptId: string): Promise<ResultView> {
    const wire = await this.send<BijakAttemptResultView>(
      'GET',
      `/api/bijak/attempts/${encodeURIComponent(attemptId)}/result`,
    )
    return {
      attempt: metaFromWire(wire.attempt),
      result: wire.result,
      paper: viewFromWire(wire.paper),
    }
  }

  async history(): Promise<HistoryRow[]> {
    const rows = await this.send<BijakAttemptHistoryRow[]>('GET', '/api/bijak/history')
    return rows.map((r) => ({ ...r, startedAt: toMs(r.startedAt) }))
  }
}

/** Builds the HTTP server; `client` lets a Node smoke test send through its own `ApiClient`. */
export function createHttpBijakServer(options: HttpBijakOptions = {}): HttpBijakServer {
  return new HttpBijakServer(options)
}
