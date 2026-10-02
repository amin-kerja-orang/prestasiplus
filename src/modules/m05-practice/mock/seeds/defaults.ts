/**
 * M05 store seed (F-26; SRS M05 v1.16 §6.12, §6.14, §6.15), written through the M05 repositories
 * (overview §3 rule 3a):
 *
 * - `seedPractice(ctx)` (seed phase): the 65 practice question anchors 600001–600065 contributed to
 *   M04 (§6.15: approved, active, MCQ, verified textbook, `dskpSpId` null, difficulty
 *   ((k − 1) mod 4) + 1, explanation on odd ids per M04, `createdAt` 2025-12-01), the stored
 *   SubjectMastery counters and SPM targets of the canonical accounts, SubjectUsage 0.
 *   The canonical sessions and answers (A2–A5, P1–P4, M1–M4, the admin's 35 answers of 19/02) are
 *   dataset anchors added when the answer log compiles (`../repository/anchors.ts`).
 * - `finalisePractice()` (after every dataset has compiled): primes the generated rows, stores the
 *   anchor users' revision queues (admin 72, pelajar 24, pelajarmaju 4) and runs the build check
 *   (§6.14.2 named queries, Q-SESS-MEAN-ACC 79.8 %, the generation pins); a failure stops the boot.
 *
 * The trial counters live on the M01 users store (overview §6.7 "Trial counter"): the admin's 50 is
 * an M01 anchor value; pelajar's 32 used (§6.12) is not seeded there yet (reported, F-23).
 */

import type { SeedContext } from '@/mock/define'
import { questions, type Question } from '@/modules/m04-question-bank/mock'

import { M05_QUESTION_ANCHORS } from '../datasets/canonical'
import { mastery1156 } from '../datasets/m18-anchors'
import { resetKirkpatrickPrime } from '../datasets/kirkpatrick'
import { seedM18Anchors } from '../repository/m18-seed'
import { practiceRepo } from '../repository/practice'

const text = (id: number) => `Soalan latihan ${String(id)}: pilih jawapan yang betul.`

/** §6.15: the 65 practice anchors, completed by M04 (`questions.anchorRow`). */
export function practiceQuestionAnchors(): Question[] {
  const out: Question[] = []
  for (const g of M05_QUESTION_ANCHORS) {
    for (let id = g.ids[0]; id <= g.ids[1]; id++) {
      out.push(
        questions.anchorRow({
          id,
          subjectId: g.subjectId,
          educationLevelId: g.levelId,
          curriculumChapterId: g.chapterId,
          spmPool: false,
          complianceStatus: 'verified',
          sourceType: 'textbook',
          dskpSpId: null,
          questionText: text(id),
          sourceSet: 'm05_practice_anchor',
          createdAt: '2025-12-01T09:00:00+08:00',
        }),
      )
    }
  }
  return out
}

export function seedPractice(ctx: SeedContext): void {
  practiceRepo.beginSeed(() => ctx.clock.now())
  resetKirkpatrickPrime()
  // The class-1156 pupil's stored mastery counters (user 4627, mean level 3.95; F-26c).
  practiceRepo.contributeMastery(ctx, mastery1156())
  questions.contributeAnchors(ctx, practiceQuestionAnchors())
}

export function finalisePractice(): void {
  const issues = practiceRepo.finaliseSeed()
  // F-26c: the KirkpatrickSessionAggregate is primed on its first read, not here (boot cost).
  issues.push(...seedM18Anchors())
  if (issues.length > 0) {
    throw new Error(`M05 practice build check failed:\n${issues.map((i) => `- ${i}`).join('\n')}`)
  }
}
