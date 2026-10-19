/**
 * M03 lookups of the S22 form (`GET /api/subjects`, `GET /api/education-levels`, any session): the shared
 * M10 client has no function for them. Question writes go through `api/guru.ts`.
 */
import { api } from '@/api'

export interface NamedLookup {
  id: number
  name: string
}

export async function fetchLevelOptions(signal?: AbortSignal): Promise<NamedLookup[]> {
  const res = await api.list<NamedLookup>('/api/education-levels', signal ? { signal } : {})
  return res.data.map((l) => ({ id: l.id, name: l.name }))
}

/** Subjects A→Z (FN-M10-7.2.2). */
export async function fetchSubjectOptions(signal?: AbortSignal): Promise<NamedLookup[]> {
  const res = await api.list<NamedLookup>('/api/subjects', signal ? { signal } : {})
  return res.data
    .map((s) => ({ id: s.id, name: s.name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ms'))
}
