/**
 * Finalise-time seed of the M18 anchors that need to read users (SRS M05 v1.17 FR-M05-148, XR-M18-03):
 * the 38 SubjectMastery rows of the 12 KLUANG pupils and the PupilSubjectAccuracy rows (see
 * `../datasets/m18-anchors.ts`). Runs after the datasets have compiled and the log is primed, because
 * pupil X and Y of 8765 are two of the pupils that answer there.
 */

import { users } from '@/modules/m01-authentication/mock'

import { answersDataset } from '../datasets/answers'
import { kluangAnchors, type LitePupil } from '../datasets/m18-anchors'
import { pupilAccuracyRepo } from './pupil-accuracy'
import { practiceRepo } from './practice'
import { nextCacheKey } from './reads'

const SCHOOLS: ReadonlySet<number> = new Set([8765, 2710, 3160, 2700, 8767])

export function seedM18Anchors(): string[] {
  const pupils: LitePupil[] = users
    .query('U-ROLE', { sort: 'id' }, 'student')
    .rows.filter((u) => u.schoolId !== null && SCHOOLS.has(u.schoolId))
  const answering = new Set<number>()
  answersDataset.count(
    { seg: 'mon', schoolId: 8765 },
    (r) => {
      answering.add(r.userId)
      return false
    },
    { matchFields: ['userId'], cacheKey: nextCacheKey('m05-m18-8765') },
  )
  const built = kluangAnchors(
    pupils,
    [...answering].sort((a, b) => a - b),
  )
  if (built.issues.length === 0) {
    practiceRepo.storeMastery(built.mastery)
    pupilAccuracyRepo.seed(built.accuracy)
  }
  return built.issues.map((i) => `M18 anchors: ${i}`)
}
