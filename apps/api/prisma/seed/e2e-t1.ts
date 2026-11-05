/**
 * E2E FIXTURE (S5-T01, AC-X3-1): five Tingkatan 1 Matematik MCQs, so the CI Tingkatan 1 pupil (`murid.t1.e2e@example.test`, grade 7) has a
 * subject with servable questions. The `questions-pool` demo seed holds Tingkatan 4 and 5 only, so the Tingkatan 5 pupil needs no fixture but
 * the Tingkatan 1 pupil does.
 *
 * Called ONLY from the guarded `e2e` seed (`e2e.ts`: profile `e2e`, `E2E_SEED=1`, refuses when `countsAsProduction`), after the K2 fixture and
 * BEFORE `linkPracticeChapters`, which (its level list includes T1) links these questions to the first in-tree active Tingkatan 1 chapter of
 * the subject, when there is one. It is not a seed module of its own and never part of the UAT or production seed.
 *
 * Content: 5 approved, ungrouped, non-PKSK, single-part MCQs written for this fixture (no exam paper is copied, no real person is named).
 * `number_label` starts with `E2E-T1-`. Each question passes the real contract schema (`QuestionPartSchema`) and the real approve gate
 * (`GATES.approve`) BEFORE anything is written (the curriculum has no DSKP nodes below Tingkatan 4, so the gate runs with `hasDskpNodes: false`
 * and the rows carry no unit or SP, like the Darjah rows of the pool). A question that fails stops the seed.
 *
 * Idempotent: questions are keyed by `number_label`; a re-run inserts nothing.
 */
import { QuestionPartSchema, type QuestionPart } from '@pp/contract'

import type { TxClient } from '../../src/db/client'
import { GATES } from '../../src/modules/questions/workflow/lifecycle/gates'
import { writePart } from './questions/index'
import type { SeedContext } from './index'

export const E2E_T1_SUBJECT = 'MATH'
export const E2E_T1_LEVEL = 'T1'
export const E2E_T1_LABEL_PREFIX = 'E2E-T1-'

const LABELS = ['A', 'B', 'C', 'D'] as const

interface Item {
  text: string
  options: readonly [string, string, string, string]
  correct: 0 | 1 | 2 | 3
}

/** Five generic Tingkatan 1 Matematik items (integers, fractions, perimeter), answers worked by hand. */
export const E2E_T1_ITEMS: readonly Item[] = [
  { text: 'Hitung nilai bagi 15 + (−7).', options: ['8', '22', '−8', '−22'], correct: 0 },
  { text: 'Nilai bagi 3/4 + 1/4 ialah', options: ['1/2', '1', '4/8', '3/16'], correct: 1 },
  { text: 'Perimeter sebuah segi empat sama bersisi 6 cm ialah', options: ['12 cm', '36 cm', '24 cm', '18 cm'], correct: 2 },
  { text: 'Antara nombor berikut, yang manakah nombor perdana?', options: ['9', '15', '21', '13'], correct: 3 },
  { text: 'Selesaikan 2x + 3 = 11.', options: ['x = 4', 'x = 7', 'x = 5', 'x = 8'], correct: 0 },
]

export const labelOf = (index: number): string => `${E2E_T1_LABEL_PREFIX}${E2E_T1_SUBJECT}-${String(index + 1).padStart(2, '0')}`

function partOf(it: Item): QuestionPart {
  return {
    label: '1',
    prompt: { ms: it.text },
    mode: 'mcq',
    marks: 1,
    options: it.options.map((body, i) => ({ label: LABELS[i] as string, body: { ms: body } })),
    key: { kind: 'option', correct: LABELS[it.correct] as string },
  }
}

/** Shape self-check (pure; the seed and the test both run it). */
export function assertT1Fixture(): void {
  if (E2E_T1_ITEMS.length < 5) throw new Error('e2e-t1: fewer than 5 questions')
  for (const it of E2E_T1_ITEMS) QuestionPartSchema.parse(partOf(it))
}

/** Writes the 5 approved questions (the approve gate runs on each first). */
export async function seedE2eT1(ctx: SeedContext, adminId: bigint): Promise<void> {
  assertT1Fixture()
  const now = ctx.clock.now()
  await ctx.prisma.$transaction(
    async (tx: TxClient) => {
      const subject = await tx.subject.findUnique({ where: { code: E2E_T1_SUBJECT }, select: { id: true } })
      const level = await tx.educationLevel.findUnique({ where: { code: E2E_T1_LEVEL }, select: { id: true } })
      if (!subject || !level) throw new Error(`e2e-t1: subject ${E2E_T1_SUBJECT} or level ${E2E_T1_LEVEL} is missing (run the curriculum seed first)`)
      for (const [i, it] of E2E_T1_ITEMS.entries()) {
        const label = labelOf(i)
        if (await tx.questionVersion.findFirst({ where: { numberLabel: label }, select: { id: true } })) continue
        const part = partOf(it)
        const tp = (i % 4) + 1
        const failed = GATES.approve({
          id: label, parts: [part], marks: 1, subjectId: subject.id.toString(), educationLevelId: level.id.toString(), chapterId: '1', // placeholder for the approve gate only; the row's Bab is linked by linkPracticeChapters
          unitId: null, spIds: [], tp, unconfirmedLowConfidenceFields: [], hasOpenDuplicateFlag: false, mediaResolved: true,
          missingRequiredFields: [], lastEditedByAi: false, spmBound: false, hasDskpNodes: false, stem: it.text,
        })
        if (Object.keys(failed).length > 0) throw new Error(`e2e-t1: ${label} fails the approve gate: ${JSON.stringify(failed)}`)
        const question = await tx.question.create({
          data: { sourceType: 'manual', createdById: adminId, latestVersionNo: 1, liveVersionNo: 1, isActive: true, createdAt: now, updatedAt: now },
        })
        const version = await tx.questionVersion.create({
          data: {
            questionId: question.id, versionNo: 1, status: 'approved', publishedAt: now, type: 'mcq', stemMs: it.text, numberLabel: label, language: 'ms',
            subjectId: subject.id, educationLevelId: level.id, unitNodeId: null, formOrigin: 't1_t3', cognitiveLevel: (i % 3) + 1, difficultyTp: tp,
            sourceKind: 'publisher', rightsStatus: 'own', createdAt: now, updatedAt: now,
          },
        })
        await writePart(tx, version.id, part, 1, null, 1)
      }
    },
    { timeout: 60_000, maxWait: 20_000 },
  )
}
