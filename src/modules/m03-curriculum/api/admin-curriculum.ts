/**
 * M03 admin curriculum endpoints (SRS v1.10 §7 #13-#24; build-plan M03-T3): the S1 tree, the chapter
 * forms S2/S3, the topic forms S4/S5 and the inline subtopic add/edit/delete on S1. Every call needs an
 * admin session (`AD`). Also the two option lists the S1/S2/S3 selects use (#1 and #7: every record,
 * inactive ones included, FR-M03-02).
 *
 * Mutations resolve to `{data, status}` (`status` = the flash text, UNVERIFIED COPY §8). A 404 is an
 * `ApiError` with `status === 404` (BR-18: the pages turn it into a redirect with a flash).
 */

import { api, type ListResult } from '@/api'

/** DATA-M03-03 (the fields the screens use). */
export interface CurriculumChapter {
  id: number
  subjectId: number
  educationLevelId: number | null
  name: string | null
  nameEn: string | null
  chapterNumber: number | null
  description: string | null
  isActive: boolean
  createdSeq: number
}

/** DATA-M03-04. */
export interface CurriculumTopic {
  id: number
  chapterId: number
  name: string
  nameEn: string | null
  topicNumber: string | null
  description: string | null
  learningStandard: string | null
  isActive: boolean
  createdSeq: number
}

/** DATA-M03-05. */
export interface CurriculumSubtopic {
  id: number
  topicId: number
  name: string
  nameEn: string | null
  learningObjective: string | null
  createdSeq: number
}

export interface TopicNode extends CurriculumTopic {
  subtopics: CurriculumSubtopic[]
}

export interface ChapterNode extends CurriculumChapter {
  topics: TopicNode[]
}

export interface NamedRef {
  id: number
  name: string
}

/** #13 `data`. */
export interface CurriculumTree {
  subject: NamedRef
  level: NamedRef
  stats: { chapters: number; topics: number; subtopics: number }
  chapters: ChapterNode[]
}

/** #14 `data`: the chapter with its pair (S3, S4 context). */
export interface ChapterDetail extends CurriculumChapter {
  subject: NamedRef
  level: NamedRef
}

/** #18 `data`: the topic with its chapter context (S5). */
export interface TopicDetail extends CurriculumTopic {
  chapter: ChapterDetail
}

/** #1 / #7 option rows (only what the selects show). */
export interface SubjectOption {
  id: number
  name: string
}

export interface LevelOption {
  id: number
  name: string
}

export interface CurriculumMutation<T> {
  data: T
  status: string
}

/** #15 body. */
export interface ChapterInput {
  subjectId: number | null
  educationLevelId: number | null
  name: string
  nameEn?: string | null
  chapterNumber?: number | null
  description?: string | null
}

/** #16 body. */
export interface ChapterUpdateInput extends ChapterInput {
  isActive: boolean
}

/** #19 body. */
export interface TopicInput {
  chapterId: number
  name: string
  nameEn?: string | null
  topicNumber?: string | null
  description?: string | null
  learningStandard?: string | null
}

/** #20 body (the chapter cannot change). */
export interface TopicUpdateInput {
  name: string
  nameEn?: string | null
  topicNumber?: string | null
  description?: string | null
  learningStandard?: string | null
  isActive: boolean
}

/** #22 body. */
export interface SubtopicInput {
  topicId: number
  name: string
  nameEn?: string | null
  learningObjective?: string | null
}

/** #23 body. */
export interface SubtopicUpdateInput {
  name: string
  nameEn?: string | null
  learningObjective?: string | null
}

type Opts = { signal?: AbortSignal }
const sig = (options: Opts): Opts => (options.signal ? { signal: options.signal } : {})
const seg = (id: number | string): string => encodeURIComponent(String(id))

const base = '/api/admin/curriculum'

/** #1 `GET /api/admin/subjects`: every subject (the filter and form "Subjek" selects). */
export function fetchSubjectOptions(options: Opts = {}): Promise<ListResult<SubjectOption>> {
  return api.list<SubjectOption>('/api/admin/subjects', sig(options))
}

/** #7 `GET /api/admin/education-levels`: every level by `order` (the "Tahap" selects). */
export function fetchLevelOptions(options: Opts = {}): Promise<ListResult<LevelOption>> {
  return api.list<LevelOption>('/api/admin/education-levels', sig(options))
}

/** #13 `GET /api/admin/curriculum` (422 when a parameter is missing; 404 for an unknown subject or level). */
export function fetchCurriculumTree(
  subjectId: string | number,
  educationLevelId: string | number,
  options: Opts = {},
): Promise<CurriculumTree> {
  return api.get<CurriculumTree>(base, {
    query: { subjectId: String(subjectId), educationLevelId: String(educationLevelId) },
    ...sig(options),
  })
}

/** #14 `GET …/chapters/:id` (404 -> "Bab tidak dijumpai."). */
export function fetchChapter(id: number | string, options: Opts = {}): Promise<ChapterDetail> {
  return api.get<ChapterDetail>(`${base}/chapters/${seg(id)}`, sig(options))
}

/** #15 `POST …/chapters` (201; 422 with `fields`). */
export function createChapter(input: ChapterInput): Promise<CurriculumMutation<CurriculumChapter>> {
  return api.post<CurriculumMutation<CurriculumChapter>>(`${base}/chapters`, {
    body: input,
    raw: true,
  })
}

/** #16 `PUT …/chapters/:id`. */
export function updateChapter(
  id: number | string,
  input: ChapterUpdateInput,
): Promise<CurriculumMutation<CurriculumChapter>> {
  return api.put<CurriculumMutation<CurriculumChapter>>(`${base}/chapters/${seg(id)}`, {
    body: input,
    raw: true,
  })
}

/** #17 `DELETE …/chapters/:id` (its topics and subtopics go with it). */
export function deleteChapter(id: number): Promise<CurriculumMutation<unknown>> {
  return api.delete<CurriculumMutation<unknown>>(`${base}/chapters/${seg(id)}`, { raw: true })
}

/** #18 `GET …/topics/:id` (404 -> "Topik tidak dijumpai."). */
export function fetchTopic(id: number | string, options: Opts = {}): Promise<TopicDetail> {
  return api.get<TopicDetail>(`${base}/topics/${seg(id)}`, sig(options))
}

/** #19 `POST …/topics` (422 incl. an unknown chapter). */
export function createTopic(input: TopicInput): Promise<CurriculumMutation<CurriculumTopic>> {
  return api.post<CurriculumMutation<CurriculumTopic>>(`${base}/topics`, {
    body: input,
    raw: true,
  })
}

/** #20 `PUT …/topics/:id`. */
export function updateTopic(
  id: number | string,
  input: TopicUpdateInput,
): Promise<CurriculumMutation<CurriculumTopic>> {
  return api.put<CurriculumMutation<CurriculumTopic>>(`${base}/topics/${seg(id)}`, {
    body: input,
    raw: true,
  })
}

/** #21 `DELETE …/topics/:id` (its subtopics go with it). */
export function deleteTopic(id: number): Promise<CurriculumMutation<unknown>> {
  return api.delete<CurriculumMutation<unknown>>(`${base}/topics/${seg(id)}`, { raw: true })
}

/** #22 `POST …/subtopics` (appended last). */
export function createSubtopic(
  input: SubtopicInput,
): Promise<CurriculumMutation<CurriculumSubtopic>> {
  return api.post<CurriculumMutation<CurriculumSubtopic>>(`${base}/subtopics`, {
    body: input,
    raw: true,
  })
}

/** #23 `PUT …/subtopics/:id`. */
export function updateSubtopic(
  id: number,
  input: SubtopicUpdateInput,
): Promise<CurriculumMutation<CurriculumSubtopic>> {
  return api.put<CurriculumMutation<CurriculumSubtopic>>(`${base}/subtopics/${seg(id)}`, {
    body: input,
    raw: true,
  })
}

/** #24 `DELETE …/subtopics/:id`. */
export function deleteSubtopic(id: number): Promise<CurriculumMutation<unknown>> {
  return api.delete<CurriculumMutation<unknown>>(`${base}/subtopics/${seg(id)}`, { raw: true })
}
