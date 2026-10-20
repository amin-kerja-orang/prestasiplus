/**
 * Practice demo seed (BE-12): a few COMPLETED sessions with their answer rows and the matching mastery
 * counters for two seeded demo students (`pelajar@demo.test`, `pelajarmaju@demo.test` of the core identity
 * seed). `pelajar2@demo.test` stays empty on purpose (the "no history" state).
 *
 * - The question bank is not part of this card (BE-09), so the answer rows have `question_id = NULL`; they
 *   carry the curriculum dimensions (subject, level, chapter) from the curriculum seed, which is what the
 *   history and the mastery figures need. No served list (`practice_session_questions` needs a question) and
 *   no revision queue (rows need a question id) are written.
 * - Idempotent: a session is matched by its natural key (user + a fixed `client_uuid`). An existing session
 *   is left as it is, with its answers and counters; the mastery counters are raised only when a session is
 *   created, so a re-run never double counts.
 * - Deterministic: fixed uuids, times derived from `ctx.clock` (the ADR-0006 anchor), no randomness.
 * - `legacy_*` is never set. Fictitious data only.
 * - Demo kind: refused in production unless ALLOW_DEMO_SEED. Skips (does not fail) when an account or a
 *   curriculum row it needs is missing, so it can run next to a partial seed list.
 */
import type { PrismaClient } from '../../src/db/client'
import type { SeedModule } from './index'

const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE

type Mode = 'random' | 'chapter' | 'past_year'

interface SessionPlan {
  /** Fixed client key: the natural key of the session together with the user. */
  clientUuid: string
  email: string
  mode: Mode
  subject: string
  level: string | null
  /** Printed chapter number of the subject and level (chapter mode only). */
  chapterNumber?: number
  questions: number
  correct: number
  /** How long before the seed anchor the session was completed. */
  daysAgo: number
  timeSpentSec: number
}

export const PRACTICE_SESSIONS: readonly SessionPlan[] = [
  { clientUuid: '6c0f5a1e-0001-4a10-9b00-0000000000a1', email: 'pelajar@demo.test', mode: 'random', subject: 'MATH', level: 'D1', questions: 10, correct: 7, daysAgo: 3, timeSpentSec: 300 },
  { clientUuid: '6c0f5a1e-0002-4a10-9b00-0000000000a2', email: 'pelajar@demo.test', mode: 'chapter', subject: 'MATH', level: 'D1', chapterNumber: 1, questions: 5, correct: 4, daysAgo: 1, timeSpentSec: 180 },
  { clientUuid: '6c0f5a1e-0003-4a10-9b00-0000000000b1', email: 'pelajarmaju@demo.test', mode: 'random', subject: 'BM', level: 'D1', questions: 10, correct: 9, daysAgo: 2, timeSpentSec: 240 },
  { clientUuid: '6c0f5a1e-0004-4a10-9b00-0000000000b2', email: 'pelajarmaju@demo.test', mode: 'past_year', subject: 'SEJ', level: 'T4', questions: 5, correct: 2, daysAgo: 1, timeSpentSec: 200 },
]

/** Letters of the option picked: a right answer is B, a wrong one is C (the key of an unlinked answer is unknown, so this is only a stable demo value). */
const pickedLabel = (isCorrect: boolean): string => (isCorrect ? 'B' : 'C')

async function seedSession(db: PrismaClient, plan: SessionPlan, now: Date): Promise<void> {
  const user = await db.user.findFirst({ where: { email: plan.email }, select: { id: true } })
  const subject = await db.subject.findUnique({ where: { code: plan.subject }, select: { id: true } })
  const level = plan.level === null ? null : await db.educationLevel.findUnique({ where: { code: plan.level }, select: { id: true } })
  if (!user || !subject || (plan.level !== null && !level)) return
  const chapter =
    plan.chapterNumber === undefined || !level
      ? null
      : await db.chapter.findFirst({
          where: { subjectId: subject.id, educationLevelId: level.id, chapterNumber: plan.chapterNumber, inTree: true },
          orderBy: { id: 'asc' },
          select: { id: true },
        })
  if (plan.chapterNumber !== undefined && !chapter) return

  const exists = await db.practiceSession.findFirst({ where: { userId: user.id, clientUuid: plan.clientUuid }, select: { id: true } })
  if (exists) return

  const completedAt = new Date(now.getTime() - plan.daysAgo * DAY)
  const startedAt = new Date(completedAt.getTime() - plan.timeSpentSec * 1000)
  const step = Math.floor((plan.timeSpentSec * 1000) / plan.questions)
  await db.$transaction(async (tx) => {
    const session = await tx.practiceSession.create({
      data: {
        userId: user.id,
        clientUuid: plan.clientUuid,
        mode: plan.mode,
        subjectId: subject.id,
        educationLevelId: level?.id ?? null,
        chapterId: chapter?.id ?? null,
        questionCount: plan.questions,
        status: 'completed',
        correctCount: plan.correct,
        timeSpentSec: plan.timeSpentSec,
        // BR-09: points are 10 x correct, the session's own coins are the correct answers.
        pointsEarned: 10 * plan.correct,
        coinsEarned: plan.correct,
        startedAt,
        completedAt,
        createdAt: startedAt,
        updatedAt: completedAt,
      },
    })
    await tx.practiceAnswer.createMany({
      data: Array.from({ length: plan.questions }, (_, i) => ({
        sessionId: session.id,
        userId: user.id,
        questionId: null,
        subjectId: subject.id,
        educationLevelId: level?.id ?? null,
        chapterId: chapter?.id ?? null,
        questionType: 'mcq',
        // The first `correct` answers are right: a stable, easy to read pattern.
        selectedLabel: pickedLabel(i < plan.correct),
        isCorrect: i < plan.correct,
        answeredAt: new Date(startedAt.getTime() + (i + 1) * step),
        historical: false,
        clientUuid: plan.clientUuid,
        createdAt: completedAt,
      })),
    })
    // BR-20: the counters follow the answers (raised only here, so a re-run cannot double count).
    await tx.mastery.upsert({
      where: { userId_subjectId: { userId: user.id, subjectId: subject.id } },
      create: { userId: user.id, subjectId: subject.id, correct: plan.correct, answered: plan.questions, lastAnsweredAt: completedAt },
      update: { correct: { increment: plan.correct }, answered: { increment: plan.questions }, lastAnsweredAt: completedAt },
    })
  })
}

export const practiceSeed: SeedModule = {
  name: 'practice',
  async run(ctx) {
    const now = ctx.clock.now()
    for (const plan of PRACTICE_SESSIONS) await seedSession(ctx.prisma, plan, now)
  },
}
