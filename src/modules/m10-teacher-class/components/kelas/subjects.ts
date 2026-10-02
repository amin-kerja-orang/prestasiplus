/**
 * The S5 "Subjek" options: typed M10 wrapper of M03 `GET /api/subjects` (a module's UI code cannot
 * import another module's `api/`, ADR-0009). Every subject in id order (FN-M10-3.2.4).
 */
import { api } from '@/api'

export interface SubjectOption {
  id: number
  name: string
}

export async function fetchSubjectOptions(signal?: AbortSignal): Promise<SubjectOption[]> {
  const result = await api.list<SubjectOption>('/api/subjects', signal ? { signal } : {})
  return result.data.map((s) => ({ id: s.id, name: s.name })).sort((a, b) => a.id - b.id)
}
