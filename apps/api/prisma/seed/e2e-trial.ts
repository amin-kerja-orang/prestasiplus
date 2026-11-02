/**
 * E2E FIXTURE (R1, mid-quiz trial limit): dedicated, UNSUBSCRIBED Tingkatan 4 pupils (one per browser viewport: the spec spends a pupil's last answer, and the three viewport projects run against one database) whose free-trial counter sits at 49 of the 50
 * (`TRIAL_LIMIT`), so the `@api` browser spec reaches the 402 `TRIAL_EXHAUSTED` on the second answer of a quiz. It is its own pupil on purpose:
 * the shared demo pupils must never run out of trial.
 *
 * Called ONLY from the guarded `e2e` seed (`e2e.ts`: profile `e2e`, `E2E_SEED=1`, refuses when `countsAsProduction`). It is not a seed module of its own.
 * Idempotent: a re-run resets `trial_questions_used` to 49 (also after a spec used it up). Unsubscribed means DEMO001 has no active school
 * subscription and the pupil is not a complimentary student (`SubscriptionService.isSubscribed`); the demo seed adds neither.
 * Fictitious name, example.test address, demo password convention (`core/demo-password.ts`).
 */
import type { PrismaClient } from '../../src/db/client'
import { demoPasswordHash } from './core/demo-password'
import type { SeedContext } from './index'

/** Pupil 1 = 375 px, 2 = 768 px, 3 = 1280 px (the `@api` spec picks by viewport width). */
export const E2E_TRIAL_PUPILS = [
  { email: 'murid.trial.e2e@example.test', username: 'murid-trial-e2e', name: 'Murid Percubaan Ujian' },
  { email: 'murid.trial2.e2e@example.test', username: 'murid-trial2-e2e', name: 'Murid Percubaan Ujian Dua' },
  { email: 'murid.trial3.e2e@example.test', username: 'murid-trial3-e2e', name: 'Murid Percubaan Ujian Tiga' },
] as const
export const E2E_TRIAL_PUPIL_EMAIL = E2E_TRIAL_PUPILS[0].email
/** One answer left before the limit of 50 (`TRIAL_LIMIT` in subscriptions.constants.ts): the next first check passes, the one after is 402. */
export const E2E_TRIAL_USED = 49

export async function seedE2eTrial(ctx: SeedContext): Promise<void> {
  const prisma: PrismaClient = ctx.prisma
  const school = await prisma.school.findUnique({ where: { code: 'DEMO001' }, select: { id: true } })
  if (!school) throw new Error('e2e trial seed: school DEMO001 is missing (core-identity must run first)')
  const createdAt = ctx.clock.now()
  for (const pupil of E2E_TRIAL_PUPILS) {
    const existing = await prisma.user.findFirst({ where: { email: { equals: pupil.email, mode: 'insensitive' } } })
    const data = {
      name: pupil.name,
      email: pupil.email,
      username: pupil.username,
      schoolId: school.id,
      grade: 10,
      isActive: true,
      isSuspended: false,
      trialQuestionsUsed: E2E_TRIAL_USED,
    }
    const user = existing
      ? await prisma.user.update({ where: { id: existing.id }, data: { ...data, passwordHash: existing.passwordHash ?? (await demoPasswordHash()) } })
      : await prisma.user.create({ data: { ...data, passwordHash: await demoPasswordHash(), createdAt } })
    await prisma.userRole.upsert({ where: { userId_role: { userId: user.id, role: 'student' } }, create: { userId: user.id, role: 'student', createdAt }, update: {} })
  }
}
