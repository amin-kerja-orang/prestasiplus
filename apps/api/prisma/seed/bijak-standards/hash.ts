/**
 * `structure_hash` of a seeded blueprint (design 3.5): sha-256 (hex) of the exam-core canonical STRUCTURAL
 * content. Same approach as the service (BJS-08): `canonicalStructure` + sha-256. If BJS-08 also defines a
 * helper, keep one at the merge and delete the other.
 */
import { createHash } from 'node:crypto'

import { canonicalStructure, type StandardBlueprint } from '@pp/exam-core'

export function structureHashOf(bp: StandardBlueprint): string {
  return createHash('sha256').update(canonicalStructure(bp), 'utf8').digest('hex')
}
