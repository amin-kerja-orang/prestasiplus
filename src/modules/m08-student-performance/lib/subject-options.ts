/**
 * The "Subjek" filter of S19 (FR-M08-110): every subject A to Z by name, value = the M03 id. A typed M08
 * wrapper of M03 `GET /api/subjects` (a module's UI code cannot import another module's `api/`, ADR-0009).
 */

import { api, type ListResult } from '@/api'

interface SubjectItem {
  id: number
  name: string
}

export interface SubjectOption {
  id: number
  name: string
}

export async function fetchSubjectOptions(signal?: AbortSignal): Promise<SubjectOption[]> {
  const result: ListResult<SubjectItem> = await api.list<SubjectItem>(
    '/api/subjects',
    signal ? { signal } : {},
  )
  return result.data
    .map((s) => ({ id: s.id, name: s.name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ms'))
}
