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
import { upsertAnswerRow } from '../../src/modules/practice/answer-log.port'
import type { SeedModule } from './index'

const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE

type Mode = 'random' | 'chapter' | 'past_year' | 'latih_tubi'

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
  { clientUuid: '6c0f5a1e-0001-4a10-9b00-0000000000a1', email: 'pelajar@demo.test', mode: 'random', subject: 'MATH', level: 'T4', questions: 10, correct: 7, daysAgo: 3, timeSpentSec: 300 },
  { clientUuid: '6c0f5a1e-0002-4a10-9b00-0000000000a2', email: 'pelajar@demo.test', mode: 'chapter', subject: 'MATH', level: 'T4', chapterNumber: 1, questions: 5, correct: 4, daysAgo: 1, timeSpentSec: 180 },
  { clientUuid: '6c0f5a1e-0003-4a10-9b00-0000000000b1', email: 'pelajarmaju@demo.test', mode: 'random', subject: 'BM', level: 'T5', questions: 10, correct: 9, daysAgo: 2, timeSpentSec: 240 },
  { clientUuid: '6c0f5a1e-0004-4a10-9b00-0000000000b2', email: 'pelajarmaju@demo.test', mode: 'past_year', subject: 'SEJ', level: 'T4', questions: 5, correct: 2, daysAgo: 1, timeSpentSec: 200 },
]

/**
 * Latih Tubi sessions of the five Form 4 pupils of the PoC Bijak sittings seed (`murid4` to `murid8@demo.test`, school DEMO001, Matematik),
 * so the shared answer reader (S10-T01) has activity for the Matematik demo class and the school-admin practice block (k = 5: with
 * `pelajar` there are 6 contributing pupils). Reports read `practice_answers` only (XS-8, D113), and a Bijak sitting reaches that store
 * through its own writer (S3-T04), so a seed that stops at `exam_attempts` leaves the reports empty. `pelajar2` stays without history.
 * A separate list from `PRACTICE_SESSIONS`: a pupil that does not exist (the run has no Bijak sittings seed) is skipped quietly.
 */
export const PRACTICE_SESSIONS_DEMO_CLASS: readonly SessionPlan[] = [
  { clientUuid: '6c0f5a1e-0005-4a10-9b00-0000000000c4', email: 'murid4@demo.test', mode: 'latih_tubi', subject: 'MATH', level: 'T4', questions: 10, correct: 8, daysAgo: 2, timeSpentSec: 300 },
  { clientUuid: '6c0f5a1e-0005-4a10-9b00-0000000000c5', email: 'murid5@demo.test', mode: 'latih_tubi', subject: 'MATH', level: 'T4', questions: 10, correct: 7, daysAgo: 3, timeSpentSec: 320 },
  { clientUuid: '6c0f5a1e-0005-4a10-9b00-0000000000c6', email: 'murid6@demo.test', mode: 'latih_tubi', subject: 'MATH', level: 'T4', questions: 10, correct: 6, daysAgo: 4, timeSpentSec: 280 },
  { clientUuid: '6c0f5a1e-0005-4a10-9b00-0000000000c7', email: 'murid7@demo.test', mode: 'latih_tubi', subject: 'MATH', level: 'T4', questions: 10, correct: 5, daysAgo: 5, timeSpentSec: 340 },
  { clientUuid: '6c0f5a1e-0005-4a10-9b00-0000000000c8', email: 'murid8@demo.test', mode: 'latih_tubi', subject: 'MATH', level: 'T4', questions: 10, correct: 4, daysAgo: 6, timeSpentSec: 360 },
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
    // AC-PA-01: every write goes through the port's SQL. The session's mode is the answer's mode (the seed
    // modes random / past_year are legacy modes, still valid under ck_practice_answers_mode) and attempt_id is the
    // session id. No question is linked, so question_id is null and the idempotency index never matches: the
    // `exists` check above is what keeps a re-run from writing twice.
    for (let i = 0; i < plan.questions; i++) {
      const isCorrect = i < plan.correct
      await upsertAnswerRow(tx, {
        userId: String(user.id),
        attemptId: session.id,
        sessionId: session.id,
        questionId: null,
        questionVersionNo: null,
        partRef: null,
        mode: plan.mode,
        subjectId: String(subject.id),
        educationLevelId: level === null || level === undefined ? null : String(level.id),
        chapterId: chapter === null ? null : String(chapter.id),
        topicId: null,
        difficulty: null,
        questionType: 'mcq',
        isCorrect,
        marksAwarded: isCorrect ? 1 : 0,
        marksMax: 1,
        answeredAt: new Date(startedAt.getTime() + (i + 1) * step),
        isTest: false,
        // The first `correct` answers are right: a stable, easy to read pattern.
        selectedLabel: pickedLabel(isCorrect),
        timeSeconds: null,
      })
    }
    // The port does not set these two: keep the seed's earlier values (created_at = completion, the session's client key).
    await tx.practiceAnswer.updateMany({ where: { sessionId: session.id }, data: { createdAt: completedAt, clientUuid: plan.clientUuid } })
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
    for (const plan of [...PRACTICE_SESSIONS, ...PRACTICE_SESSIONS_DEMO_CLASS]) await seedSession(ctx.prisma, plan, now)
  },
}
