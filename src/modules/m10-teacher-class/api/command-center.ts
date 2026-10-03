/**
 * M10 Command Center client functions (SRS M10 v1.18 §7 #2–#10; build-plan M10-T3). The S2 page task
 * (M10-T4) imports these and does not change this file (build-plan §S.3 rule 5).
 *
 * The bodies are bare objects (no `{data}` envelope), so every call is `raw`. Errors are `ApiError`:
 * 401/403 from the guard, 422 `VALIDATION_ERROR` (unknown drill type or filter; `generate` refusals,
 * whose `message` is the text to show), 403 (`generate` for a student that is not the viewer's), 404
 * (`cancel` of an unknown test, `badge-holders` of an unknown badge), 409 (`cancel` of a test that is
 * not active). The page shows "Ralat: {message}" for a failed scan and keeps its previous values
 * when a poll fails (FR-M10-15).
 */

import { api } from '@/api'

import type {
  CcAchievements,
  CcBadgeHolders,
  CcDrill,
  CcDrillType,
  CcEvaluation,
  CcLiveData,
  CcPredictive,
  CcRemedialGenerateResponse,
  CcRemedialScan,
} from './command-center-types'

interface Signal {
  signal?: AbortSignal
}

const withSignal = (o: Signal) => (o.signal ? { signal: o.signal } : {})

/** The poll period of S2 (FR-M10-15). */
export const COMMAND_CENTER_POLL_MS = 10_000

/** #2 `GET /api/guru/command-center/live-data` (polled every 10 s). */
export function fetchCommandCenterLiveData(options: Signal = {}): Promise<CcLiveData> {
  return api.get<CcLiveData>('/api/guru/command-center/live-data', {
    raw: true,
    ...withSignal(options),
  })
}

/**
 * #3 `GET /api/guru/command-center/drill?type=&filter=`. `filter`: `kirk` needs `t1`…`t4`; `mood` a
 * mood name; `engagement` a band; `today` `aktiviti` for the panel; `students` `active`.
 */
export function fetchCommandCenterDrill<T extends CcDrillType>(
  type: T,
  filter?: string,
  options: Signal = {},
): Promise<CcDrill<T>> {
  return api.get<CcDrill<T>>('/api/guru/command-center/drill', {
    query: { type, filter: filter === '' ? undefined : filter },
    raw: true,
    ...withSignal(options),
  })
}

/** #4 `GET /api/guru/command-center/remedial/scan`. */
export function fetchRemedialScan(options: Signal = {}): Promise<CcRemedialScan> {
  return api.get<CcRemedialScan>('/api/guru/command-center/remedial/scan', {
    raw: true,
    ...withSignal(options),
  })
}

/** #5 `POST /api/guru/command-center/remedial/generate`; `subject` = `weakTopics[].subject`. */
export function generateRemedialTest(body: {
  studentId: number
  subject: string
}): Promise<CcRemedialGenerateResponse> {
  return api.post<CcRemedialGenerateResponse>('/api/guru/command-center/remedial/generate', {
    body,
    raw: true,
  })
}

/** #6 `POST /api/guru/command-center/remedial/cancel`. */
export function cancelRemedialTest(quizId: number): Promise<{ success: true }> {
  return api.post<{ success: true }>('/api/guru/command-center/remedial/cancel', {
    body: { quizId },
    raw: true,
  })
}

/** #7 `GET /api/guru/command-center/predictive`. */
export function fetchCommandCenterPredictive(options: Signal = {}): Promise<CcPredictive> {
  return api.get<CcPredictive>('/api/guru/command-center/predictive', {
    raw: true,
    ...withSignal(options),
  })
}

/** #8 `GET /api/guru/command-center/evaluate` (read-only). */
export function fetchCommandCenterEvaluation(options: Signal = {}): Promise<CcEvaluation> {
  return api.get<CcEvaluation>('/api/guru/command-center/evaluate', {
    raw: true,
    ...withSignal(options),
  })
}

/** #9 `GET /api/guru/command-center/achievements` (read-only). */
export function fetchCommandCenterAchievements(options: Signal = {}): Promise<CcAchievements> {
  return api.get<CcAchievements>('/api/guru/command-center/achievements', {
    raw: true,
    ...withSignal(options),
  })
}

/** #10 `GET /api/guru/command-center/badge-holders?badgeId=`. */
export function fetchBadgeHolders(badgeId: number, options: Signal = {}): Promise<CcBadgeHolders> {
  return api.get<CcBadgeHolders>('/api/guru/command-center/badge-holders', {
    query: { badgeId },
    raw: true,
    ...withSignal(options),
  })
}
