/**
 * M07 student client functions (SRS M07 v1.7 §7 #1-#6 and #21-#23; build-plan M07-T1a). UI tasks
 * import these and do not change this file (build-plan §S.3 rule 5). Errors: 401, 403 (no access to
 * the level, FR-M07-19: the page redirects to `/pksk`), 404 (unknown level or domain code), 422.
 */

import { api } from '@/api'

import type {
  PkskAccess,
  PkskAnswer,
  PkskDashboard,
  PkskDomain,
  PkskDomainSection,
  PkskExam,
  PkskExamAttempt,
  PkskLevel,
  PkskPractice,
  PkskPracticeResult,
} from './types'

interface Signal {
  signal?: AbortSignal
}

const withSignal = (o: Signal) => (o.signal ? { signal: o.signal } : {})

const level = (l: PkskLevel) => `/api/pksk/levels/${encodeURIComponent(l)}`

/** #1 `GET /api/pksk/me/access`. */
export function fetchPkskAccess(options: Signal = {}): Promise<PkskAccess> {
  return api.get<PkskAccess>('/api/pksk/me/access', withSignal(options))
}

/** #2 `GET /api/pksk-domains` (15, by `order`). */
export function fetchPkskDomains(options: Signal = {}): Promise<PkskDomain[]> {
  return api.get<PkskDomain[]>('/api/pksk-domains', withSignal(options))
}

/** #3 `GET /api/pksk/levels/:level/dashboard`. */
export function fetchPkskDashboard(l: PkskLevel, options: Signal = {}): Promise<PkskDashboard> {
  return api.get<PkskDashboard>(`${level(l)}/dashboard`, withSignal(options))
}

/** #4 `GET /api/pksk/levels/:level/domains`. */
export function fetchPkskDomainSections(
  l: PkskLevel,
  options: Signal = {},
): Promise<PkskDomainSection[]> {
  return api.get<PkskDomainSection[]>(`${level(l)}/domains`, withSignal(options))
}

/** #5 `GET /api/pksk/levels/:level/domains/:code` (provisional practice page, L-2). */
export function fetchPkskPractice(
  l: PkskLevel,
  code: string,
  options: Signal = {},
): Promise<PkskPractice> {
  return api.get<PkskPractice>(
    `${level(l)}/domains/${encodeURIComponent(code)}`,
    withSignal(options),
  )
}

/** #6 `GET /api/pksk/levels/:level/exam-attempts` (own, newest first). */
export function fetchPkskExamAttempts(
  l: PkskLevel,
  options: Signal = {},
): Promise<PkskExamAttempt[]> {
  return api.get<PkskExamAttempt[]>(`${level(l)}/exam-attempts`, withSignal(options))
}

/** #21 `POST /api/pksk/levels/:level/domains/:code/practice-sessions` (provisional, L-2). */
export function submitPkskPractice(
  l: PkskLevel,
  code: string,
  answers: PkskAnswer[],
): Promise<PkskPracticeResult> {
  return api.post<PkskPracticeResult>(
    `${level(l)}/domains/${encodeURIComponent(code)}/practice-sessions`,
    { body: { answers } },
  )
}

/** #22 `GET /api/pksk/levels/:level/exam` (provisional, L-3). */
export function fetchPkskExam(l: PkskLevel, options: Signal = {}): Promise<PkskExam> {
  return api.get<PkskExam>(`${level(l)}/exam`, withSignal(options))
}

/** #23 `POST /api/pksk/levels/:level/exam-attempts` (provisional, L-3). */
export function submitPkskExam(l: PkskLevel, answers: PkskAnswer[]): Promise<PkskExamAttempt> {
  return api.post<PkskExamAttempt>(`${level(l)}/exam-attempts`, { body: { answers } })
}
