/**
 * Lookups of the S8 and S11 filters (FR-M04-96, FR-M04-112): subjects alphabetical, levels in id order
 * (M03 #32, #33), every school of the M02 register A to Z (M02 #43 = M04 #31).
 */

import { api } from '@/api'

import { fetchEducationLevels, fetchSubjects } from '../api/lookups'

export interface NameOption {
  id: number
  name: string
}

export async function fetchSubjectOptions(signal?: AbortSignal): Promise<NameOption[]> {
  const result = await fetchSubjects(signal ? { signal } : {})
  return result.data
    .map((s) => ({ id: s.id, name: s.name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ms'))
}

export async function fetchLevelOptions(signal?: AbortSignal): Promise<NameOption[]> {
  const result = await fetchEducationLevels(signal ? { signal } : {})
  return result.data.map((l) => ({ id: l.id, name: l.name })).sort((a, b) => a.id - b.id)
}

/** M04 #31: `GET /api/schools?all=1`, already sorted by name. */
export function fetchSchoolNameOptions(signal?: AbortSignal): Promise<NameOption[]> {
  return api.get<NameOption[]>('/api/schools', {
    query: { all: 1 },
    ...(signal ? { signal } : {}),
  })
}
