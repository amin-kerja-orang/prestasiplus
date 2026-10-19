/**
 * M03 mock plugin (F-24: curriculum store; overview §6.10, D12). Owner of the curriculum stores.
 *
 * PUBLIC exports (the only M03 mock code other modules may import, `@/modules/m03-curriculum/mock`):
 * the repositories `curriculum` (domain contract + `CH-*` named queries) and the named-query
 * repositories `curriculumLevels`, `curriculumSubjects`, `curriculumSubjectLevels`,
 * `curriculumTopics`, `curriculumSubtopics`, `legacyTopics`, `legacySubtopics`.
 *
 * Bump `version` whenever the seed or the seed logic changes (the fixture text is hashed too).
 * M03-T1a adds the student handlers (#25–#27) and the answer-log wiring (BR-19).
 */

import { defineMockModule } from '@/mock/define'

import { adminCurriculumRoutes } from './handlers/admin-curriculum'
import { adminLevelRoutes } from './handlers/admin-levels'
import { adminSubjectRoutes } from './handlers/admin-subjects'
import { lookupRoutes } from './handlers/lookups'
import { studentCurriculumRoutes } from './handlers/student-curriculum'
import {
  curriculumLevelsRepo,
  curriculumRepo,
  curriculumSubjectLevelsRepo,
  curriculumSubjectsRepo,
  curriculumSubtopicsRepo,
  curriculumTopicsRepo,
  legacySubtopicsRepo,
  legacyTopicsRepo,
} from './repository/curriculum'
import { curriculumTables } from './repository/stores'
import { CURRICULUM_FIXTURE_TEXT, INACTIVE_DEMO_OVERRIDE, seedCurriculum } from './seeds/curriculum'

const plugin = defineMockModule({
  id: 'M03',
  dependsOn: ['core'],
  version: 3,
  tables: curriculumTables,
  repositories: {
    curriculum: curriculumRepo,
    curriculumLevels: curriculumLevelsRepo,
    curriculumSubjects: curriculumSubjectsRepo,
    curriculumSubjectLevels: curriculumSubjectLevelsRepo,
    curriculumTopics: curriculumTopicsRepo,
    curriculumSubtopics: curriculumSubtopicsRepo,
    legacyTopics: legacyTopicsRepo,
    legacySubtopics: legacySubtopicsRepo,
  },
  fixtures: { curriculum: CURRICULUM_FIXTURE_TEXT },
  overrides: [INACTIVE_DEMO_OVERRIDE],
  seed: seedCurriculum,
  // M03-T1b: admin handlers #1–#24 (subjects, levels, curriculum tree).
  // M03-T1a: student handlers #25–#27 (topics, topic detail, Peta Belajar).
  routes: [
    ...lookupRoutes,
    ...adminSubjectRoutes,
    ...adminLevelRoutes,
    ...adminCurriculumRoutes,
    ...studentCurriculumRoutes,
  ],
})

export default plugin

export const {
  curriculum,
  curriculumLevels,
  curriculumSubjects,
  curriculumSubjectLevels,
  curriculumTopics,
  curriculumSubtopics,
  legacyTopics,
  legacySubtopics,
} = plugin.repositories
