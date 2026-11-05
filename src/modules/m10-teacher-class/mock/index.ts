/**
 * M10 mock plugin (F-30: the shared store of classes, enrolments, DSKP and the M10 records that the
 * student side reads; SRS M10 v1.15 §6, overview §6.7, D11/D12). Owner of the `classrooms` (with the
 * enrolments), `dskp`, `missions`, `remedialTests` and `questionSets` repositories.
 *
 * PUBLIC exports (the only M10 mock code other modules may import, `@/modules/m10-teacher-class/mock`):
 * - `classrooms` — classes keyed by (`kind`, `id`) and their enrolments: `get`, `list`,
 *   `forStudent`, `forTeacher`, `forSchool`, `members`, `memberIds`, `enrolmentsOf`,
 *   `teacherStudentIds`, `findByJoinCode`, `levelSummary`, `owners`, `designation`, and the writes
 *   `create`, `enrol`, `unenrol`;
 * - `dskp` — Bidang / SK / SP (`bidang`, `sk`, `sp`, `getSp`, `spPath`, `genericSpId`);
 * - `missions` — `forStudent(userId, date)`, `questionIdsFor(missionId, userId)` (M05 seams);
 * - `remedialTests` — `forStudent(userId)`, `complete(id, {afterAccuracy, completedAt})` (M05
 *   seams), `get(id, viewer)` (Q4 preview: own teacher or admin);
 * - `questionSets` — `visibleFor(userId)` (M05 seam);
 * - `teacherProfiles` — `forUser`, `schoolOf`, `save` (DATA-M10-03);
 * - the row types.
 *
 * Routes (M10-T1, `handlers/`): §7 #1, #11–#17, #35–#38, #42–#44, #51–#58 and #73–#75 (#39–#41 are
 * served by M04 over the `dskp` store). Test hook `enrol` (§6.12). `teacherProfiles` (DATA-M10-03) is
 * the T1 store of the profile school that drives S6 (BR-M10-30). The other handlers, hooks and the
 * screens belong to M10-T2…T8. The class and enrolment rows are built in `finalise` from the M01
 * users repository (nothing is hard-coded per user count).
 *
 * Bump `version` whenever the seed, the build or a table changes (overview §6.9, §14 rule 4b).
 */

import { defineMockModule } from '@/mock/define'

import { classroomsRepo } from './repository/classrooms'
import { dskpRepo } from './repository/dskp'
import { m10Routes } from './handlers'
import { m10Hooks } from './hooks'
import { missionsRepo } from './repository/missions'
import { questionSetsRepo } from './repository/question-sets'
import { remedialTestsRepo } from './repository/remedial'
import { teacherProfilesRepo, teacherProfilesTable } from './repository/teacher-profiles'
import { finaliseM10, seedM10 } from './seeds/seed'
import { M10_TABLES } from './tables/tables'

const plugin = defineMockModule({
  id: 'M10',
  dependsOn: ['core', 'M01', 'M02', 'M03', 'M04'],
  version: 5,
  tables: { ...M10_TABLES, teacherProfiles: teacherProfilesTable },
  repositories: {
    classrooms: classroomsRepo,
    dskp: dskpRepo,
    missions: missionsRepo,
    remedialTests: remedialTestsRepo,
    questionSets: questionSetsRepo,
    teacherProfiles: teacherProfilesRepo,
  },
  seed: seedM10,
  finalise: finaliseM10,
  routes: m10Routes,
  hooks: m10Hooks,
})

export default plugin

export const { classrooms, dskp, missions, remedialTests, questionSets, teacherProfiles } =
  plugin.repositories

export type { ClassFilter, ClassInput, EnrolInput, LevelSummary } from './repository/classrooms'
export type { SpPath } from './repository/dskp'
export type { MissionInput } from './repository/missions'
export type { RemedialInput, RemedialPreview } from './repository/remedial'
export type { QuestionSetInput, SetRole } from './repository/question-sets'
export type * from './repository/types'
export type { TeacherProfilePatch, TeacherProfileRow } from './repository/teacher-profiles'
export type { Designation } from './build/classes'
