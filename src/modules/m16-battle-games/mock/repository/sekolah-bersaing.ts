/**
 * The `sekolahBersaing` repository (owner M16; R1-AS-45, FR-AS-45-1, FR-AS-45-4, API-AS-14, DM-31): the
 * live school board, computed on request from the session totals of the M05 owner and the M02 register.
 * Nothing is stored: the table stays empty, as the real one stays unused (DM-31). A school with no
 * scored session, outside the register or of a primary type (D72) is absent.
 */

import type { GamesSekolahBersaingBoard } from '@pp/contract'

import { roundHalfUp } from '@/lib/number'
import { defineRepository } from '@/mock/repository'
import { schools } from '@/modules/m02-users-schools/mock'
import { kirkpatrick, type KaSchoolAgg } from '@/modules/m05-practice/mock'

import { sekolahBersaingTable } from '../tables/tables'

/** `sekolah_bersaing_min_pupils` (GAME-16). */
const MIN_PUPILS = 1
/** `sekolah_bersaing_top_n` (GAME-16, FR-AS-45-1). */
const TOP_N = 30

export type SekolahBersaingView = GamesSekolahBersaingBoard

/** The two M02 reads of the board (a parameter, so the rules can be tested without a boot). */
export interface BoardRegister {
  get(id: number): { name: string; state: string } | undefined
  isHidden(id: number): boolean
}

/** API-AS-14: unrounded accuracy desc, pupils desc, sessions desc, name asc (Malay collation), top 30. */
export function rankBoard(
  totals: readonly KaSchoolAgg[],
  register: BoardRegister,
): SekolahBersaingView {
  return totals
    .flatMap((s) => {
      const school = register.get(s.schoolId)
      if (
        !school ||
        register.isHidden(s.schoolId) ||
        s.scoredSessions === 0 ||
        s.sessionStudents < MIN_PUPILS
      ) {
        return []
      }
      return [
        {
          school: school.name,
          state: school.state,
          accuracy: s.scoreSum / s.scoredSessions,
          pupils: s.sessionStudents,
          sessions: s.sessions,
        },
      ]
    })
    .sort(
      (a, b) =>
        b.accuracy - a.accuracy ||
        b.pupils - a.pupils ||
        b.sessions - a.sessions ||
        a.school.localeCompare(b.school, 'ms'),
    )
    .slice(0, TOP_N)
    .map(({ school, state, accuracy, pupils }, i) => ({
      rank: i + 1,
      school,
      state,
      accuracy: roundHalfUp(accuracy, 1),
      pupils,
    }))
}

export const sekolahBersaingRepo = defineRepository({
  owner: 'M16',
  name: 'sekolahBersaing',
  store: sekolahBersaingTable,
  methods: () => ({
    view: (): SekolahBersaingView => rankBoard(kirkpatrick.schools(), schools),
  }),
})
