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
  // The national standings are cached 30 s on the injected (fixed) clock, which would hide a battle added between two reads.
  BATTLE_STANDINGS_CACHE_SECONDS: '0',
}

/** Id of the subject the scenarios battle on; set by `seedBattleConformance`. */
/** `emptyId`: a subject with no question at all (SEJ), for the "no SPM pool" refusal. */
export const battleFixture = {
  mathId: '',
  emptyId: '',
  /**
   * Moves the injected clock of the booted app forward (`boot.ts` sets it). The robot comes once a queue entry has waited
   * `battle_bot_fallback_seconds` (30 s, FR-PA-29), so the scenarios advance the clock instead of counting polls.
   */
  advanceClock: ((): void => {
    throw new Error('battle conformance: the clock is not wired (boot.ts sets battleFixture.advanceClock)')
  }) as (ms: number) => void,
  /**
   * Inserts one finished, ranked battle between the two demo pupils (pelajar A 7000, pelajar2 B 3000; both seats real users,
   * `counts_for_ranking` true) at the injected clock, as if two pupils had played it. A real human-vs-human battle cannot be
   * played through the arena yet (the opponent is simulated until GAME-R), so the standings are proven on this row. boot.ts sets it.
   */
  seedRankedBattle: (async (): Promise<void> => {
    throw new Error('battle conformance: the seed seam is not wired (boot.ts sets battleFixture.seedRankedBattle)')
  }) as () => Promise<void>,
}

/** The default `battle_bot_fallback_seconds` (48 GAME-01) in milliseconds. */
export const BATTLE_ROBOT_WAIT_MS = 30_000

const QUESTIONS = 12
const PUBLISHED_AT = new Date('2026-10-19T09:00:00+08:00')

export async function seedBattleConformance(prisma: PrismaClient): Promise<void> {
  const math = await prisma.subject.findFirstOrThrow({ where: { code: 'MATH' } })
  const t4 = await prisma.educationLevel.findFirstOrThrow({ where: { code: 'T4' } })
  battleFixture.mathId = String(math.id)
  battleFixture.emptyId = String((await prisma.subject.findFirstOrThrow({ where: { code: 'SEJ' } })).id)
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
