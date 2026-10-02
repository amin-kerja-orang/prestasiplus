/**
 * SRS M07 v1.7 §7 student endpoints:
 *
 * | # | Route | Notes |
 * |---|---|---|
 * | 1 | `GET /api/pksk/me/access` | `{T1, T4}` by BR-M07-07 |
 * | 2 | `GET /api/pksk-domains` | the 15 domains by `order` |
 * | 3 | `GET /api/pksk/levels/:level/dashboard` | readiness, Bahagian B mastery (BR-M07-09..11) |
 * | 4 | `GET /api/pksk/levels/:level/domains` | three Bahagian sections with counts and mastery |
 * | 5 | `GET /api/pksk/levels/:level/domains/:code` | provisional practice set (BR-M07-25), no `isCorrect` |
 * | 6 | `GET /api/pksk/levels/:level/exam-attempts` | own attempts, newest first |
 * | 21 | `POST /api/pksk/levels/:level/domains/:code/practice-sessions` | one M05 session, mode `pksk` |
 * | 22 | `GET /api/pksk/levels/:level/exam` | provisional exam, 30 / 70 / 1, no `isCorrect` |
 * | 23 | `POST /api/pksk/levels/:level/exam-attempts` | provisional scored attempt (BR-M07-09/10) |
 *
 * Auth: any logged-in user (401); level 404 first, then 403 without access (FR-M07-19).
 * The handlers only shape requests and responses; the rules live in the repositories.
 */

import { API_ERROR_CODES } from '@/api/errors'
import { toIsoMyt } from '@/lib/time'
import { created, fail, notFound, ok, requireAuth, route, type RouteDef } from '@/mock/define'
import { questions, type Question } from '@/modules/m04-question-bank/mock'
import { practice } from '@/modules/m05-practice/mock'

import { BAHAGIAN_SECTIONS, EXAM_PLAN, PRACTICE_SIZE } from '../data/domains'
import { examScore, gradeOf, round1 } from '../repository/rules'
import { pkskAccessRepo, pkskDomainsRepo, pkskProgressRepo } from '../repository/stores'
import type { Bahagian, PkskDomain, PkskLevel } from '../repository/types'
import {
  gateLevel,
  isCorrect,
  parseAnswers,
  servedQuestion,
  userIdOf,
  type AnswerInput,
} from './common'

const approved = (domainIds: number[], level: PkskLevel): Question[] => [
  ...questions.pkskList({ domainIds, targetLevel: level, status: 'approved', pageSize: 1000 }).rows,
]

const domainView = (d: PkskDomain) => ({
  id: d.id,
  code: d.code,
  name: d.name,
  icon: d.icon,
  color: d.color,
})

const mean = (values: readonly number[]): number =>
  values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length

/** The questions of a submission, each checked against the domains and level it may belong to. */
function resolveAnswered(
  answers: readonly AnswerInput[],
  level: PkskLevel,
  domainIds: ReadonlySet<number>,
): Map<number, Question> | null {
  const out = new Map<number, Question>()
  for (const a of answers) {
    const q = questions.pkskGet(a.questionId)
    if (
      !q ||
      q.status !== 'approved' ||
      q.pkskTargetLevel !== level ||
      q.pkskDomainId === null ||
      !domainIds.has(q.pkskDomainId)
    ) {
      return null
    }
    out.set(q.id, q)
  }
  return out
}

const invalid = () =>
  fail(422, API_ERROR_CODES.VALIDATION_ERROR, 'Jawapan tidak sah.', {
    answers: 'Jawapan tidak sah.',
  })

export const studentRoutes: RouteDef[] = [
  route('GET', '/api/pksk/me/access', [requireAuth()], (req, ctx) =>
    ok(pkskAccessRepo.levelAccess(userIdOf(req), ctx.clock.now())),
  ),

  route('GET', '/api/pksk-domains', [requireAuth()], () => ok(pkskDomainsRepo.list())),

  route('GET', '/api/pksk/levels/:level/dashboard', [requireAuth()], (req, ctx) => {
    const gate = gateLevel(req, ctx)
    if (!gate.ok) return gate.response
    const userId = userIdOf(req)
    const attempts = pkskProgressRepo.attempts(userId, gate.level)
    const avg = mean(attempts.map((a) => a.scorePct))
    return ok({
      level: gate.level,
      readiness: { scorePct: Math.round(avg), grade: gradeOf(avg) },
      examCount: attempts.length,
      bahagianBAvgPct: round1(mean(attempts.map((a) => a.bahagianBPct))),
      domains: pkskDomainsRepo.ofBahagian('B').map((d) => ({
        ...domainView(d),
        masteryPct: pkskProgressRepo.mastery(userId, gate.level, d.id),
      })),
    })
  }),

  route('GET', '/api/pksk/levels/:level/domains', [requireAuth()], (req, ctx) => {
    const gate = gateLevel(req, ctx)
    if (!gate.ok) return gate.response
    const userId = userIdOf(req)
    return ok(
      (['A', 'B', 'C'] as Bahagian[]).map((bahagian) => ({
        bahagian,
        ...BAHAGIAN_SECTIONS[bahagian],
        domains: pkskDomainsRepo.ofBahagian(bahagian).map((d) => ({
          ...domainView(d),
          questionCount: questions.countWhere({
            pkskDomainId: d.id,
            pkskTargetLevel: gate.level,
            status: 'approved',
          }),
          masteryPct: pkskProgressRepo.mastery(userId, gate.level, d.id),
        })),
      })),
    )
  }),

  route('GET', '/api/pksk/levels/:level/domains/:code', [requireAuth()], (req, ctx) => {
    const gate = gateLevel(req, ctx)
    if (!gate.ok) return gate.response
    const domain = pkskDomainsRepo.byCode(String(req.params.code))
    if (!domain) return notFound()
    const userId = userIdOf(req)
    const pool = approved([domain.id], gate.level)
    ctx.prng.stream(`m07:practice:${String(userId)}`).shuffle(pool)
    pkskProgressRepo.markLoaded(userId, gate.level, domain.id, ctx.clock.now())
    return ok({
      domain: { id: domain.id, code: domain.code, name: domain.name, bahagian: domain.bahagian },
      questions: pool.slice(0, PRACTICE_SIZE).map(servedQuestion),
    })
  }),

  route('GET', '/api/pksk/levels/:level/exam-attempts', [requireAuth()], (req, ctx) => {
    const gate = gateLevel(req, ctx)
    if (!gate.ok) return gate.response
    return ok(
      pkskProgressRepo.attempts(userIdOf(req), gate.level).map((a) => ({
        id: a.id,
        completedAt: a.completedAt,
        scorePct: a.scorePct,
        grade: a.grade,
      })),
    )
  }),

  route(
    'POST',
    '/api/pksk/levels/:level/domains/:code/practice-sessions',
    [requireAuth()],
    (req, ctx) => {
      const gate = gateLevel(req, ctx)
      if (!gate.ok) return gate.response
      const domain = pkskDomainsRepo.byCode(String(req.params.code))
      if (!domain) return notFound()
      const answers = parseAnswers(req.body)
      if (!Array.isArray(answers)) return answers
      const served = resolveAnswered(answers, gate.level, new Set([domain.id]))
      if (!served) return invalid()
      const userId = userIdOf(req)
      const now = ctx.clock.now()
      const scored = answers.map((a) => ({
        questionId: a.questionId,
        isCorrect: isCorrect(served.get(a.questionId) as Question, a),
        selected: a.optionIndex,
      }))
      const correct = scored.filter((s) => s.isCorrect).length
      const masteryPct = Math.round((correct / scored.length) * 100)
      const loaded = pkskProgressRepo.takeLoaded(userId, gate.level, domain.id)
      // BR-M07-26: the session belongs to M05 (mode `pksk`); M05 credits M14 (step 6).
      const result = practice.completeSession({
        userId,
        mode: 'pksk',
        pkskDomainId: domain.id,
        pkskTargetLevel: gate.level,
        answers: scored,
        startedAt: Math.min(loaded ?? now, now),
        completedAt: now,
      })
      pkskProgressRepo.setMastery(userId, gate.level, domain.id, masteryPct)
      const g = result.gamification
      return created({
        masteryPct,
        sessionId: result.session.id,
        gamification: {
          coinsEarned: g.coinsEarned,
          pointsEarned: g.pointsEarned,
          streakCount: g.streakCount,
          totalBalance: g.totalBalance,
        },
      })
    },
  ),

  route('GET', '/api/pksk/levels/:level/exam', [requireAuth()], (req, ctx) => {
    const gate = gateLevel(req, ctx)
    if (!gate.ok) return gate.response
    const rng = ctx.prng.stream(`m07:exam:${String(userIdOf(req))}`)
    return ok({
      sections: EXAM_PLAN.map((part) => {
        const ids = pkskDomainsRepo.ofBahagian(part.bahagian).map((d) => d.id)
        const pool = approved(ids, gate.level)
        rng.shuffle(pool)
        return {
          bahagian: part.bahagian,
          weightPct: part.weightPct,
          questions: pool.slice(0, part.count).map(servedQuestion),
        }
      }),
    })
  }),

  route('POST', '/api/pksk/levels/:level/exam-attempts', [requireAuth()], (req, ctx) => {
    const gate = gateLevel(req, ctx)
    if (!gate.ok) return gate.response
    const answers = parseAnswers(req.body)
    if (!Array.isArray(answers)) return answers
    const all = new Set(pkskDomainsRepo.list().map((d) => d.id))
    const served = resolveAnswered(answers, gate.level, all)
    if (!served) return invalid()
    const bahagianOf = (q: Question): Bahagian =>
      (pkskDomainsRepo.get(q.pkskDomainId as number) as PkskDomain).bahagian
    const right: Record<Bahagian, number> = { A: 0, B: 0, C: 0 }
    const given: Record<Bahagian, number> = { A: 0, B: 0, C: 0 }
    for (const a of answers) {
      const q = served.get(a.questionId) as Question
      const b = bahagianOf(q)
      given[b] += 1
      if (isCorrect(q, a)) right[b] += 1
    }
    // More items than the composition (BR-M07-13) cannot come from the served exam.
    if (EXAM_PLAN.some((p) => given[p.bahagian] > p.count)) return invalid()
    const pct = (b: Bahagian) => {
      const total = (EXAM_PLAN.find((p) => p.bahagian === b) as { count: number }).count
      return round1((right[b] / total) * 100)
    }
    const [a, b, c] = [pct('A'), pct('B'), pct('C')] as [number, number, number]
    const scorePct = examScore(a, b, c)
    const row = pkskProgressRepo.addAttempt({
      userId: userIdOf(req),
      level: gate.level,
      completedAt: toIsoMyt(ctx.clock.now()),
      scorePct,
      bahagianAPct: a,
      bahagianBPct: b,
      bahagianCPct: c,
    })
    return created({
      id: row.id,
      completedAt: row.completedAt,
      scorePct: row.scorePct,
      grade: row.grade,
    })
  }),
]
