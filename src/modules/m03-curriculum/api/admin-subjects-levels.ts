/**
 * M03 admin subject and education-level endpoints (SRS v1.10 §7 #1-#12; build-plan M03-T2).
 * Types and client functions for S6-S8 (subjects) and S9-S11 (levels). Every call needs an admin
 * session (`AD`).
 *
 * Mutations resolve to `{data, status}` (`status` = the flash text, UNVERIFIED COPY §8), so the
 * screen can show the green alert; the two active switches resolve to `{id, isActive}`.
 */

import { api, type ListResult } from '@/api'

import type { EducationStage } from './lookups'

/** DATA-M03-02 Subject. */
export interface AdminSubject {
  id: number
  code: string
  name: string
  nameEn: string
  /** Free text (BR-05): Lucide name, Font Awesome class or emoji; `null` when empty. */
  icon: string | null
  /** `#rrggbb`, case kept as stored. */
  color: string
  isCore: boolean
  order: number
  isActive: boolean
  educationLevelIds: number[]
  createdAt: string
  updatedAt: string
}

/** #1 item: the subject plus the derived question count and the linked levels (level order). */
export interface AdminSubjectListItem extends AdminSubject {
  questionCount: number
  levels: { id: number; name: string }[]
}

/** DATA-M03-01 EducationLevel. */
export interface AdminEducationLevel {
  id: number
  code: string
  name: string
  nameEn: string
  stage: EducationStage
  curriculum: string
  order: number
  isActive: boolean
  grade: number | null
  createdAt: string
  updatedAt: string
}

/** #7 item: the level plus the derived counts. */
export interface AdminEducationLevelListItem extends AdminEducationLevel {
  questionCount: number
  subjectCount: number
}

/** #3 / #4 body. */
export interface SubjectInputBody {
  name: string
  nameEn: string
  code: string
  icon?: string | null
  color: string
  isCore: boolean
  order: number
  educationLevelIds: number[]
}

/** #9 / #10 body. */
export interface LevelInputBody {
  name: string
  nameEn: string
  code: string
  stage: EducationStage
  curriculum: string
  order: number
}

/** A mutation result: the data plus the flash text. */
export interface CurriculumMutation<T> {
  data: T
  status: string
}

/** #5 / #11 result. */
export interface ActiveResult {
  id: number
  isActive: boolean
}

type Signal = { signal?: AbortSignal }

function opts(options: Signal): Signal {
  return options.signal ? { signal: options.signal } : {}
}

/** #1 `GET /api/admin/subjects`: every subject, no paging, BR-08 order. */
export function fetchAdminSubjects(
  options: Signal = {},
): Promise<ListResult<AdminSubjectListItem>> {
  return api.list<AdminSubjectListItem>('/api/admin/subjects', opts(options))
}

/** #2 `GET /api/admin/subjects/:id` (404 for an unknown subject). */
export function fetchAdminSubject(id: number, options: Signal = {}): Promise<AdminSubject> {
  return api.get<AdminSubject>(`/api/admin/subjects/${String(id)}`, opts(options))
}

/** #3 `POST /api/admin/subjects` (201; 422 with `fields`, e.g. a duplicate code). */
export function createSubject(input: SubjectInputBody): Promise<CurriculumMutation<AdminSubject>> {
  return api.post<CurriculumMutation<AdminSubject>>('/api/admin/subjects', {
    body: input,
    raw: true,
  })
}

/** #4 `PUT /api/admin/subjects/:id`: the ticked levels replace the links. */
export function updateSubject(
  id: number,
  input: SubjectInputBody,
): Promise<CurriculumMutation<AdminSubject>> {
  return api.put<CurriculumMutation<AdminSubject>>(`/api/admin/subjects/${String(id)}`, {
    body: input,
    raw: true,
  })
}

/** #5 `PATCH /api/admin/subjects/:id/active` (the S6 switch). */
export function setSubjectActive(id: number, isActive: boolean): Promise<ActiveResult> {
  return api.patch<ActiveResult>(`/api/admin/subjects/${String(id)}/active`, {
    body: { isActive },
  })
}

/** #6 `DELETE /api/admin/subjects/:id` (cascades to links and chapters, BR-10). */
export function deleteSubject(id: number): Promise<CurriculumMutation<{ deleted: number }>> {
  return api.delete<CurriculumMutation<{ deleted: number }>>(`/api/admin/subjects/${String(id)}`, {
    raw: true,
  })
}

/** #7 `GET /api/admin/education-levels`: every level, no paging, `order` then id. */
export function fetchAdminLevels(
  options: Signal = {},
): Promise<ListResult<AdminEducationLevelListItem>> {
  return api.list<AdminEducationLevelListItem>('/api/admin/education-levels', opts(options))
}

/** #8 `GET /api/admin/education-levels/:id` (404 for an unknown level). */
export function fetchAdminLevel(id: number, options: Signal = {}): Promise<AdminEducationLevel> {
  return api.get<AdminEducationLevel>(`/api/admin/education-levels/${String(id)}`, opts(options))
}

/** #9 `POST /api/admin/education-levels` (201; 422). */
export function createLevel(
  input: LevelInputBody,
): Promise<CurriculumMutation<AdminEducationLevel>> {
  return api.post<CurriculumMutation<AdminEducationLevel>>('/api/admin/education-levels', {
    body: input,
    raw: true,
  })
}

/** #10 `PUT /api/admin/education-levels/:id` (404; 422). */
export function updateLevel(
  id: number,
  input: LevelInputBody,
): Promise<CurriculumMutation<AdminEducationLevel>> {
  return api.put<CurriculumMutation<AdminEducationLevel>>(
    `/api/admin/education-levels/${String(id)}`,
    { body: input, raw: true },
  )
}

/** #11 `PATCH /api/admin/education-levels/:id/active` (the S9 switch). */
export function setLevelActive(id: number, isActive: boolean): Promise<ActiveResult> {
  return api.patch<ActiveResult>(`/api/admin/education-levels/${String(id)}/active`, {
    body: { isActive },
  })
}

/** #12 `DELETE /api/admin/education-levels/:id` (cascades to links and chapters, BR-10). */
export function deleteLevel(id: number): Promise<CurriculumMutation<{ deleted: number }>> {
  return api.delete<CurriculumMutation<{ deleted: number }>>(
    `/api/admin/education-levels/${String(id)}`,
    { raw: true },
  )
}
