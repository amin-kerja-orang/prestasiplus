import type { PrismaClient } from '../../../src/db/client'

/**
 * Boot wiring of the battle conformance scenarios (BE-44). The conformance seed has six published MCQs, so a queue could
 * never draw its 10 keyless questions: this adds 12 published, active single-answer MCQs (right option B, id 1) of the
 * subject MATH at Tingkatan 4 (the level of the demo students, grade 10 and 11). Fictitious text only.
 *
 * The battle limits are raised like the other volume ceilings (production code is not changed).
 */
export const battleConformanceEnv: Record<string, string> = {
  THROTTLE_BATTLE_READ_PER_MINUTE: '100000',
  THROTTLE_BATTLE_WRITE_PER_MINUTE: '100000',
  THROTTLE_BATTLE_POLL_PER_MINUTE: '100000',
  THROTTLE_BATTLE_SEARCH_PER_MINUTE: '100000',
}

/** Id of the subject the scenarios battle on; set by `seedBattleConformance`. */
export const battleFixture = { mathId: '' }

const QUESTIONS = 12
const PUBLISHED_AT = new Date('2026-10-19T09:00:00+08:00')

export async function seedBattleConformance(prisma: PrismaClient): Promise<void> {
  const math = await prisma.subject.findFirstOrThrow({ where: { code: 'MATH' } })
  const t4 = await prisma.educationLevel.findFirstOrThrow({ where: { code: 'T4' } })
  battleFixture.mathId = String(math.id)
  // Like every seeded published question these carry the full curriculum tag (unit, one SP, cognitive level, TP), so
  // the question-bank scenarios that clone the first published row keep working.
  const nodes = await prisma.curriculumNode.findMany({
    where: { subjectId: math.id, educationLevelId: t4.id, kind: { in: ['unit', 'sk', 'sp'] } },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    select: { id: true, kind: true, parentId: true },
  })
  const sp = nodes.find((n) => n.kind === 'sp')
  const sk = nodes.find((n) => n.id === sp?.parentId)
  const unit = nodes.find((n) => n.id === sk?.parentId)
  if (!sp || !unit) throw new Error('battle conformance: no MATH T4 unit/SP node in the curriculum seed')
  for (let i = 1; i <= QUESTIONS; i++) {
    const text = `Soalan conformance battle ${String(i)}`
    const q = await prisma.question.create({ data: { sourceType: 'manual', latestVersionNo: 1, liveVersionNo: 1, isActive: true } })
    const v = await prisma.questionVersion.create({
      data: {
        questionId: q.id,
        versionNo: 1,
        status: 'approved',
        publishedAt: PUBLISHED_AT,
        type: 'mcq',
        stemMs: text,
        numberLabel: `CB-${String(i)}`,
        language: 'ms',
        subjectId: math.id,
        educationLevelId: t4.id,
        unitNodeId: unit.id,
        cognitiveLevel: 1,
        difficultyTp: 3,
        formOrigin: 't4',
        sourceKind: 'publisher',
        rightsStatus: 'own',
      },
    })
    await prisma.questionVersionSpNode.create({ data: { questionVersionId: v.id, nodeId: sp.id } })
    const part = await prisma.questionPart.create({
      data: { questionVersionId: v.id, position: 1, depth: 1, label: '1', promptMs: text, marks: 1, mode: 'mcq', reveal: 'after_submit' },
    })
    await prisma.partOption.createMany({
      data: ['Satu', 'Dua', 'Tiga', 'Empat'].map((bodyMs, j) => ({ partId: part.id, label: 'ABCD'[j] as string, bodyMs, position: j + 1 })),
    })
    await prisma.answerKey.create({ data: { partId: part.id, kind: 'option', content: { kind: 'option', correct: 'B' } } })
  }
}
