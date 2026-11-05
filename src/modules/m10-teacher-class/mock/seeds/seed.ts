/**
 * M10 store seed (F-30; SRS M10 v1.15 §6.9, §6.11), written through the M10 repositories (overview
 * §3 rule 3a):
 *
 * - `seedM10(ctx)` (seed phase): forgets the compiled class state, sets the visibility clock and
 *   seeds the DSKP records (static data; nothing reads the users dataset here).
 * - `finaliseM10()` (after every dataset has compiled): builds the 750 classes and their
 *   enrolments from the users repository, seeds the designed missions, remedial tests and
 *   question sets, and runs the build checks (a failure stops the boot).
 */

import { checkNamedQueries } from '@/mock/dataset'
import type { SeedContext } from '@/mock/define'
import { questions } from '@/modules/m04-question-bank/mock'

import {
  DESIGNED_MISSIONS_4402,
  DESIGNED_MISSIONS_GURU,
  DESIGNED_QUESTION_SETS,
  DESIGNED_REMEDIAL,
  KIMIA_ANCHORS,
} from '../data/designed'
import { NAMED_SP_IDS } from '../data/dskp'
import { DEMO_PUPILS } from '../data/spec'
import { classQueries, classroomsRepo } from '../repository/classrooms'
import { dskpRepo } from '../repository/dskp'
import { missionsRepo } from '../repository/missions'
import { questionSetsRepo } from '../repository/question-sets'
import { remedialTestsRepo } from '../repository/remedial'
import { seedTeacherProfiles } from './m10-t1'

export function seedM10(ctx: SeedContext): void {
  classroomsRepo.resetCompiled()
  questionSetsRepo.beginSeed(() => ctx.clock.now())
  dskpRepo.seed()
  seedTeacherProfiles()
}

/** Five eligible Kimia T5 ids: the M08 anchors when M04 holds them, else a deterministic draw. */
function kimiaQuestionIds(stream: string): number[] {
  if (KIMIA_ANCHORS.every((id) => questions.getEligible(id) !== null)) return [...KIMIA_ANCHORS]
  return questions
    .practiceQuery({ subjectId: 10, educationLevelIds: [11], limit: 5, seed: stream })
    .map((q) => q.id)
}

export function finaliseM10(): void {
  classroomsRepo.compile()

  const issues: string[] = checkNamedQueries(classQueries).map((i) => i.message)
  for (const id of NAMED_SP_IDS)
    if (!dskpRepo.hasSp(id)) issues.push(`DSKP SP ${String(id)} is missing`)

  const demo = classroomsRepo.memberIds('classroom', 2001)
  if (demo.join() !== [...DEMO_PUPILS].join()) issues.push('class 2001 members are not 3001–3008')
  const c813 = classroomsRepo.memberIds('classroom', 813)
  missionsRepo.seed([
    ...DESIGNED_MISSIONS_GURU.map((m) => ({ ...m, recipientIds: demo })),
    ...DESIGNED_MISSIONS_4402.map((m) => ({ ...m, recipientIds: c813 })),
  ])
  remedialTestsRepo.seed(
    DESIGNED_REMEDIAL.map((t) => {
      const ids = kimiaQuestionIds(`m10:remedial:${String(t.id)}`)
      return { ...t, questionIds: ids, totalQuestions: ids.length }
    }),
  )
  questionSetsRepo.seed(DESIGNED_QUESTION_SETS)

  if (issues.length > 0) {
    throw new Error(`M10 store build check failed:\n${issues.map((m) => `- ${m}`).join('\n')}`)
  }
}
