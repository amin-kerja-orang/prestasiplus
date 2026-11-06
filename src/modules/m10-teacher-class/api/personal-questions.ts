/**
 * API-GUR-24 client (S6-T16): `GET/POST /api/guru/personal-questions`, `GET/PUT/DELETE /:id`. Own questions only,
 * newest first, 20 per page; another teacher's id is 404; a delete while an active Misi draws the question is
 * 409 "Soalan sedang digunakan dalam misi.".
 */
import { api, wireId, wireIdOpt, type ListResult } from '@/api'

import type { PersonalQuestion, PersonalQuestionRequest } from './personal-questions-types'

interface Signal {
  signal?: AbortSignal
}

const withSignal = (options: Signal) => (options.signal ? { signal: options.signal } : {})
const url = (id: number): string => `/api/guru/personal-questions/${String(id)}`

/**
 * The wire body: the contract ids are opaque strings, so http mode sends `subjectId`, `educationLevelId`, `chapterId`
 * and `spIds` as strings (a number is a 422). Absent optional fields stay absent.
 */
function wireBody(body: PersonalQuestionRequest) {
  return {
    ...body,
    subjectId: wireId(body.subjectId),
    educationLevelId: wireId(body.educationLevelId),
    ...(body.chapterId !== undefined ? { chapterId: wireIdOpt(body.chapterId) } : {}),
    ...(body.spIds !== undefined ? { spIds: body.spIds.map((id) => wireId(id)) } : {}),
  }
}

/** The list: the "Tahap" filter is the query `educationLevelId` (absent = every tahap). */
export function fetchPersonalQuestions(
  params: { educationLevelId?: number; page?: number } = {},
  options: Signal = {},
): Promise<ListResult<PersonalQuestion>> {
  return api.list<PersonalQuestion>('/api/guru/personal-questions', {
    query: {
      educationLevelId:
        params.educationLevelId === undefined ? undefined : String(params.educationLevelId),
      page: params.page,
    },
    ...withSignal(options),
  })
}

export function fetchPersonalQuestion(id: number, options: Signal = {}): Promise<PersonalQuestion> {
  return api.get<PersonalQuestion>(url(id), withSignal(options))
}

export function createPersonalQuestion(body: PersonalQuestionRequest): Promise<PersonalQuestion> {
  return api.post<PersonalQuestion>('/api/guru/personal-questions', { body: wireBody(body) })
}

export function updatePersonalQuestion(
  id: number,
  body: PersonalQuestionRequest,
): Promise<PersonalQuestion> {
  return api.put<PersonalQuestion>(url(id), { body: wireBody(body) })
}

export function deletePersonalQuestion(id: number): Promise<{ deleted: number }> {
  return api.delete<{ deleted: number }>(url(id))
}
