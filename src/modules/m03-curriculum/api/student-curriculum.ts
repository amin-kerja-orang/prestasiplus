/**
 * M03 student catalogue endpoints (SRS v1.10 §7 #25–#27; build-plan M03-T1a, used by M03-T4):
 * S12 Topik (`fetchTopics`), S13 detail (`fetchTopic`) and S14 Peta Belajar (`fetchLearningMap`).
 * Any session; a guest gets 401. An unknown topic id is an `ApiError` with `status === 404` (S13
 * renders the global 404 page, FR-79).
 */

import { api, type ListResult } from '@/api'

export type LegacyGradeLevel =
  | 'DARJAH_1'
  | 'DARJAH_2'
  | 'DARJAH_3'
  | 'DARJAH_4'
  | 'DARJAH_5'
  | 'DARJAH_6'
  | 'TINGKATAN_1'
  | 'TINGKATAN_2'
  | 'TINGKATAN_3'
  | 'TINGKATAN_4'
  | 'TINGKATAN_5'

export type LegacySubject =
  | 'MATEMATIK'
  | 'BAHASA_MELAYU'
  | 'BAHASA_INGGERIS'
  | 'SAINS'
  | 'PENDIDIKAN_ISLAM'
  | 'PENDIDIKAN_MORAL'
  | 'SEJARAH'
  | 'GEOGRAFI'

/** #25 item (S12 card). */
export interface TopicCard {
  id: number
  gradeLevel: LegacyGradeLevel
  subject: LegacySubject
  /** Code with "_" → " ". */
  subjectLabel: string
  name: string
  description: string | null
  subtopicCount: number
  /** The first 3 subtopic names (the card adds "+{n−3} lagi..." itself). */
  subtopicsPreview: string[]
}

export interface TopicSubtopic {
  id: number
  name: string
  description: string | null
  /** BR-19: the topic progress % (no subtopic tagging exists). */
  progress: number
}

/** #26 `data` (S13). `progress` is for the current user. */
export interface TopicDetail {
  id: number
  gradeLevel: LegacyGradeLevel
  subject: LegacySubject
  subjectLabel: string
  /** BR-16: the admin subject code for `/practice/{practiceCode}`. */
  practiceCode: string
  name: string
  description: string | null
  icon: string | null
  sequence: number
  subtopics: TopicSubtopic[]
  progress: { questionsAnswered: number; progress: number }
}

export type TopicState = 'mastered' | 'started' | 'unlocked' | 'locked'

/** One S14 subject pill: shown as "{emoji} {label}". */
export interface LearningMapSubject {
  code: string
  label: string
  emoji: string
  /** Active pill background and border. */
  color: string
}

/** One S14 island. `practiceUrl` is `null` for a locked topic. */
export interface LearningMapTopic {
  id: number
  name: string
  icon: string | null
  state: TopicState
  progress: number
  sessions: number
  questionsAnswered: number
  practiceUrl: string | null
}

/** #27 `data` (S14). */
export interface LearningMap {
  /** The subject as served (an unknown code is kept). */
  subject: string
  /** Hero label (the pill label without its emoji). */
  subjectLabel: string
  /** The served grade: `DARJAH_1`…`DARJAH_4`. */
  grade: string
  gradeOptions: string[]
  subjects: LearningMapSubject[]
  stats: { done: number; total: number; progress: number }
  topics: LearningMapTopic[]
}

export interface TopicsQuery {
  gradeLevel?: string | null
  subject?: string | null
  signal?: AbortSignal
}

/** #25: every matching topic on one page (BR-13). */
export function fetchTopics(query: TopicsQuery = {}): Promise<ListResult<TopicCard>> {
  return api.list<TopicCard>('/api/topics', {
    query: { gradeLevel: query.gradeLevel ?? null, subject: query.subject ?? null },
    ...(query.signal ? { signal: query.signal } : {}),
  })
}

/** #26: one topic with the current user's progress. */
export function fetchTopic(
  id: number | string,
  options: { signal?: AbortSignal } = {},
): Promise<TopicDetail> {
  return api.get<TopicDetail>(
    `/api/topics/${encodeURIComponent(String(id))}`,
    options.signal ? { signal: options.signal } : {},
  )
}

export interface LearningMapQuery {
  subject?: string | null
  grade?: string | null
  signal?: AbortSignal
}

/** #27: the Peta Belajar of a subject and grade for the current user (BR-14/15). */
export function fetchLearningMap(query: LearningMapQuery = {}): Promise<LearningMap> {
  return api.get<LearningMap>('/api/learning-map', {
    query: { subject: query.subject ?? null, grade: query.grade ?? null },
    ...(query.signal ? { signal: query.signal } : {}),
  })
}
