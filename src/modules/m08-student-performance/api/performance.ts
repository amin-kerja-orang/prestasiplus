/**
 * M08 client functions (SRS M08 v1.11 §7 #1–#4, #6, #7, #9–#11, #18–#23; build-plan M08-T1). UI tasks
 * import these and do not change this file (build-plan §S.3 rule 5). Headcount functions (#12–#17,
 * #24–#29) are M08-T1b's (`api/headcount*`); #5 (class dashboard) and #8 (class analytics) have no
 * handler in T1 (reported).
 */

import { api } from '@/api'

import type {
  Analytics,
  ClassCard,
  ClassItemAnalysis,
  LeaderboardPeriod,
  Leaderboard,
  LevelCard,
  LevelDetail,
  PublicProfile,
  Ranking,
  SchoolItemAnalysis,
  SchoolPerformance,
  StudentPerformance,
  Timeline,
  TimelineInput,
  TimelinePost,
} from './types'

interface Signal {
  signal?: AbortSignal
}
const withSignal = (o: Signal) => (o.signal ? { signal: o.signal } : {})

/** #1 `GET /api/performance/school` (S1). */
export const fetchSchoolPerformance = (o: Signal = {}) =>
  api.get<SchoolPerformance>('/api/performance/school', withSignal(o))

/** #2 `GET /api/performance/levels` (S2). */
export const fetchLevels = (o: Signal = {}) =>
  api.get<LevelCard[]>('/api/performance/levels', withSignal(o))

/** #3 `GET /api/performance/levels/:code` (S3); 404 for a code other than t4 / t5. */
export const fetchLevelDetail = (code: string, o: Signal = {}) =>
  api.get<LevelDetail>(`/api/performance/levels/${encodeURIComponent(code)}`, withSignal(o))

/** #4 `GET /api/performance/classes` (S4, the viewer's own classes). */
export const fetchOwnClasses = (o: Signal = {}) =>
  api.get<ClassCard[]>('/api/performance/classes', withSignal(o))

/** #6 `GET /api/performance/students/:userId` (S6); 404 unknown, 403 not permitted. */
export const fetchStudentPerformance = (userId: number | string, o: Signal = {}) =>
  api.get<StudentPerformance>(`/api/performance/students/${String(userId)}`, withSignal(o))

/** #7 `GET /api/analytics/me` (S7). */
export const fetchAnalytics = (o: Signal = {}) =>
  api.get<Analytics>('/api/analytics/me', withSignal(o))

/** #9 `GET /api/item-analysis/school[/:schoolId]` (S9); `tingkatan` T4 / T5 or absent. */
export const fetchSchoolItemAnalysis = (
  options: { schoolId?: number; tingkatan?: 'T4' | 'T5' | null } & Signal = {},
) =>
  api.get<SchoolItemAnalysis>(
    options.schoolId === undefined
      ? '/api/item-analysis/school'
      : `/api/item-analysis/school/${String(options.schoolId)}`,
    {
      ...withSignal(options),
      ...(options.tingkatan ? { query: { tingkatan: options.tingkatan } } : {}),
    },
  )

/** #10 `GET /api/item-analysis/classes` (S10). */
export const fetchItemAnalysisClasses = (o: Signal = {}) =>
  api.get<ClassCard[]>('/api/item-analysis/classes', withSignal(o))

/** #11 `GET /api/item-analysis/classes/:id` (S11); 403 for an unknown or unpermitted class (FR-M08-08). */
export const fetchClassItemAnalysis = (id: number, o: Signal = {}) =>
  api.get<ClassItemAnalysis>(`/api/item-analysis/classes/${String(id)}`, withSignal(o))

/** #18 `GET /api/timeline` (S16). */
export const fetchTimeline = (o: Signal = {}) => api.get<Timeline>('/api/timeline', withSignal(o))

/** #19 `POST /api/timeline` (S17, multipart); 422 with `fields`. */
export function createTimelinePost(input: TimelineInput, o: Signal = {}): Promise<TimelinePost> {
  const form = new FormData()
  form.append('title', input.title)
  form.append('category', input.category)
  if (input.eventDate) form.append('eventDate', input.eventDate)
  if (input.story) form.append('story', input.story)
  input.photos.forEach((f) => form.append('photos[]', f))
  ;(input.captions ?? []).forEach((c, i) => form.append(`captions[${String(i)}]`, c))
  return api.multipart<TimelinePost>('/api/timeline', form, withSignal(o))
}

/** #20 `GET /api/public/students/:id` (S18; no session needed); 404 unknown. */
export const fetchPublicProfile = (id: number | string, o: Signal = {}) =>
  api.get<PublicProfile>(`/api/public/students/${String(id)}`, withSignal(o))

/** #21 `GET /api/rankings` (S19). */
export const fetchRankings = (
  query: { scope?: string; subjectId?: number | string; tingkatan?: string; negeri?: string } = {},
  o: Signal = {},
) => api.get<Ranking>('/api/rankings', { ...withSignal(o), query })

/** #22 `GET /api/leaderboard` (S20). */
export const fetchLeaderboard = (period: LeaderboardPeriod = 'week', o: Signal = {}) =>
  api.get<Leaderboard>('/api/leaderboard', { ...withSignal(o), query: { period } })

/** #23 `GET /api/weekly-report` (S21): answers 403 for every role (admin as observed, others blocked). */
export const fetchWeeklyReport = (o: Signal = {}) =>
  api.get<never>('/api/weekly-report', withSignal(o))
