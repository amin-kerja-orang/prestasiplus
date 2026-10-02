/**
 * M03 seed (SRS v1.8 §6.9): the transformed discovery fixture, loaded through the owner repository
 * (overview §3 rule 3a). The fixture is read as text (`?raw`) so the type-checker does not infer an
 * 800 KB JSON literal; the text is also what the seed version hashes (plugin `fixtures`).
 *
 * Override `curriculumInactiveDemo: true` adds the SRS §6.9 test-only inactive chapter and topic
 * (E2E-M03-06). It is off by default so the default seed mirrors the observed 1,251 chapters.
 */

import type { SeedContext } from '@/mock/define'

import fixtureText from '../data/curriculum.json?raw'
import { curriculumRepo } from '../repository/curriculum'
import type { CurriculumFixture } from '../repository/types'

export const CURRICULUM_FIXTURE_TEXT: string = fixtureText

/** Override key for the SRS §6.9 test-only records. */
export const INACTIVE_DEMO_OVERRIDE = 'curriculumInactiveDemo'

let parsed: CurriculumFixture | null = null

/** The parsed fixture (parsed once per page; rows are copied on insert). */
export function curriculumFixture(): CurriculumFixture {
  parsed ??= JSON.parse(fixtureText) as CurriculumFixture
  return parsed
}

export function seedCurriculum(ctx: SeedContext): void {
  const inactiveDemo = ctx.overrides[INACTIVE_DEMO_OVERRIDE] === true
  curriculumRepo.seedFixture(ctx, curriculumFixture(), { inactiveDemo })
}
