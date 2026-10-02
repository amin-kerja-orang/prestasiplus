/**
 * DATA-M11-01 reads (SRS M11 v1.10 §6.2, BR-M11-17): the anomaly flag of a pupil and the per-school
 * counts. The flag rows are the only stored M11 data.
 */

import type { Table } from '@/mock/define'
import { users } from '@/modules/m01-authentication/mock'

import type { FlagLevel } from '../../api/types'
import type { MonitoringFlagRow } from '../tables/tables'

export interface FlagCounts {
  review: number
  excluded: number
}

export interface FlagReader {
  /** The pupil's flag, or null. */
  level(userId: number): FlagLevel | null
  /** Flag counts per school of the flagged pupil (a school without a flag is absent). */
  bySchool(): Map<number, FlagCounts>
  all(): MonitoringFlagRow[]
}

export function makeFlagReader(store: Pick<Table<MonitoringFlagRow>, 'get' | 'query'>): FlagReader {
  return {
    level: (userId) => store.get(userId)?.level ?? null,
    all: () => store.query({ sort: 'id' }).rows,
    bySchool() {
      const out = new Map<number, FlagCounts>()
      for (const f of store.query({}).rows) {
        const schoolId = users.get(f.userId)?.schoolId ?? null
        if (schoolId === null) continue
        const c = out.get(schoolId) ?? { review: 0, excluded: 0 }
        c[f.level]++
        out.set(schoolId, c)
      }
      return out
    },
  }
}
