import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSeeds, seedModules } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { curriculumSeed } from '../../prisma/seed/curriculum'
import { examSeed } from '../../prisma/seed/exam'
import { questionsSeed } from '../../prisma/seed/questions'
import { BIJAK_BANK_SITTINGS, BIJAK_DEMO_PUPILS, BIJAK_DEMO_SITTINGS, bijakSittingsSeed } from '../../prisma/seed/poc/bijak-sittings'
import { classesSeed } from '../../prisma/seed/poc/classes'
import { ItemAnalysisService, PerformancePorts } from '../../src/modules/reports/performance'
import { MIN_COHORT } from '../../src/modules/reports/performance/domain/constants'
import { SchoolAdminDashboardSchema } from '@pp/contract'

import { bootIntegrationApp, type IntegrationApp } from '../bijak-integration/helpers'
import { apiOf, bootSchoolAdminApp, login, SCHOOL_ADMIN, type SchoolAdminTestApp } from '../school-admin/helpers'
import { createTestDatabase, type TestDatabase } from '../support/db'

const ALL_SITTINGS = BIJAK_DEMO_SITTINGS.length + BIJAK_BANK_SITTINGS.length
const MODULES = [identitySeed, curriculumSeed, questionsSeed, examSeed, classesSeed, bijakSittingsSeed]

/** Everything the seed wrote, ids included (the ids must be stable). */
async function fingerprint(db: Pick<TestDatabase, 'query'>) {
  return {
    attempts: await db.query(
      `select a.id::text, u.email, a.mode, a.status, a.subject, a.started_at, a.submitted_at, a.deadline_at, a.is_test,
              r.score::text, r.max_score::text, r.provisional, r.coins, r.points, r.graded::text graded
         from exam_attempts a join users u on u.id = a.user_id join attempt_results r on r.attempt_id = a.id order by a.id`,
    ),
    answers: await db.query(`select attempt_id::text, part_id, answer::text, rev, saved_at from attempt_answers order by attempt_id, part_id`),
    aggregates: await db.query(
      `select a.attempt_id::text, u.email, a.school_id is not null has_school, a.units_awarded::text, a.units_max::text, a.mode, a.status, a.submitted_at, a.duration_sec, a.is_test,
              (select count(*)::int from practice_attempt_aggregate_items i where i.aggregate_id = a.id) items
         from practice_attempt_aggregates a join users u on u.id = a.user_id order by a.attempt_id`,
    ),
    pupils: await db.query(`select email, grade, school_id is not null has_school from users where email like 'murid%@demo.test' order by email`),
    enrolments: await db.query(
      `select u.email, e.status from enrolments e join users u on u.id = e.student_id join classrooms c on c.id = e.classroom_id where c.join_code = 'DEMO4S' order by u.email`,
    ),
  }
}

describe('PoC Bijak sittings seed', () => {
  let t: IntegrationApp
  let before: Awaited<ReturnType<typeof fingerprint>>

  beforeAll(async () => {
    t = await bootIntegrationApp()
    await runSeeds([classesSeed, bijakSittingsSeed], { prisma: t.db.prisma })
    before = await fingerprint(t.db)
  }, 180_000)
  afterAll(async () => {
    await t.close()
  })

  it('is registered after exam and classes, before practice (which stays last)', () => {
    const names = seedModules.map((m) => m.name)
    expect(names.indexOf('poc-bijak-sittings')).toBeGreaterThan(names.indexOf('exam'))
    expect(names.indexOf('poc-bijak-sittings')).toBeGreaterThan(names.indexOf('poc-classes'))
    expect(names.indexOf('practice')).toBe(names.length - 1)
    expect(bijakSittingsSeed.kind).toBe('demo')
  })

  it('gives DEMO001 at least 6 pupils in the demo class and 6 pupils with submitted non-test sittings', async () => {
    const pupils = await t.db.query<{ email: string }>(
      `select u.email from enrolments e join users u on u.id = e.student_id join classrooms c on c.id = e.classroom_id
        join schools s on s.id = u.school_id where c.join_code = 'DEMO4S' and s.code = 'DEMO001' and u.grade = 10 and e.status = 'active'`,
    )
    expect(pupils.length).toBeGreaterThanOrEqual(6)
    expect(BIJAK_DEMO_PUPILS.length).toBeGreaterThanOrEqual(3)
    const [row] = await t.db.query<{ sittings: string; pupils: string }>(
      `select count(*)::text sittings, count(distinct a.user_id)::text pupils from exam_attempts a join users u on u.id = a.user_id join schools s on s.id = u.school_id
        join attempt_results r on r.attempt_id = a.id
        where s.code = 'DEMO001' and a.status in ('submitted', 'auto_submitted') and a.is_test = false`,
    )
    expect(Number(row?.pupils)).toBeGreaterThanOrEqual(6)
    expect(Number(row?.sittings)).toBe(ALL_SITTINGS)
  })

  it('has varied scores, right and wrong MCQ answers, and no wallet rows from the seed', async () => {
    const rows = await t.db.query<{ score: string; max_score: string }>(`select score::text, max_score::text from attempt_results`)
    const scores = new Set(rows.map((r) => Number(r.score)))
    expect(scores.size).toBeGreaterThanOrEqual(4)
    expect(rows.map((r) => Number(r.max_score)).sort((a, b) => a - b)).toEqual([...Array(BIJAK_BANK_SITTINGS.length).fill(2), ...Array(BIJAK_DEMO_SITTINGS.length).fill(10)])
    const [wrong] = await t.db.query<{ n: string }>(
      `select count(*)::text n from attempt_results r, jsonb_array_elements(r.graded->'questions') q where (q->>'attempted')::boolean and (q->>'awarded')::numeric = 0`,
    )
    expect(Number(wrong?.n)).toBeGreaterThan(0)
    const [ledger] = await t.db.query<{ n: string }>(`select count(*)::text n from coin_ledger l join users u on u.id = l.user_id where u.email like 'murid%@demo.test'`)
    expect(Number(ledger?.n)).toBe(0)
  })

  it('writes one BE-12 aggregate per sitting with the school snapshot, and spreads the days', async () => {
    const [agg] = await t.db.query<{ n: string; with_school: string; days: string }>(
      `select count(*)::text n, count(school_id)::text with_school, count(distinct (submitted_at at time zone 'Asia/Kuala_Lumpur')::date)::text days from practice_attempt_aggregates where source = 'bijak'`,
    )
    expect(Number(agg?.n)).toBe(ALL_SITTINGS)
    expect(agg?.with_school).toBe(agg?.n)
    expect(Number(agg?.days)).toBeGreaterThanOrEqual(5)
  })

  it('BE-19 aggregate: at least MIN_COHORT contributing pupils for DEMO001', async () => {
    const [school] = await t.db.query<{ id: string }>(`select id::text from schools where code = 'DEMO001'`)
    const bijak = t.app.get(PerformancePorts).bijak
    const totals = await bijak.totals({ schoolIds: [school!.id], modes: ['exam', 'latihan'] }, 'school')
    expect(totals).toHaveLength(1)
    expect(totals[0]?.pupils).toBeGreaterThanOrEqual(MIN_COHORT)
    expect(totals[0]?.sittings).toBe(ALL_SITTINGS)
    const perUser = await bijak.totals({ schoolIds: [school!.id], modes: ['exam', 'latihan'] }, 'user')
    expect(perUser.length).toBeGreaterThanOrEqual(6)
    const sittings = await bijak.sittings({ schoolIds: [school!.id] })
    expect(sittings.every((s) => s.subjectCode === 'MAT' && !s.provisional)).toBe(true)
  })

  it('BE-19 item analysis of DEMO001 is not empty: lettered correct option, popular wrong option, at least 5 attempts', async () => {
    const [school] = await t.db.query<{ id: string }>(`select id::text from schools where code = 'DEMO001'`)
    const [admin] = await t.db.query<{ id: string }>(`select id::text from users where email = 'admin@demo.test'`)
    const items = t.app.get(ItemAnalysisService, { strict: false })
    const res = await items.school(
      { userId: admin!.id, role: 'admin', scope: { level: 'national', label: 'Kebangsaan' }, isTest: false },
      {} as never,
      school!.id,
    )
    expect(res.questions.length).toBeGreaterThanOrEqual(1)
    const q = res.questions.find((x) => x.attempts >= 5)
    expect(q, JSON.stringify(res.questions)).toBeDefined()
    expect(q?.correctOption.letter).toMatch(/^[A-D]$/)
    expect(q?.popularWrongOption?.letter).toMatch(/^[A-D]$/)
    expect(q?.popularWrongCount).toBeGreaterThan(0)
    expect(q?.wrongPct).toBeGreaterThan(0)
  })

  it('is idempotent: a re-run creates nothing and keeps the ids', async () => {
    await runSeeds([classesSeed, bijakSittingsSeed], { prisma: t.db.prisma })
    expect(await fingerprint(t.db)).toEqual(before)
  })

  it('is deterministic: a second fresh database gets identical rows', async () => {
    const other = await createTestDatabase()
    try {
      await runSeeds(MODULES, { prisma: other.prisma })
      expect(await fingerprint(other)).toEqual(before)
    } finally {
      await other.drop()
    }
  }, 120_000)

  it('keeps the seed folder rules: no Math.random, Date.now or new Date()', () => {
    const file = fileURLToPath(new URL('../../prisma/seed/poc/bijak-sittings.ts', import.meta.url))
    expect(readFileSync(file, 'utf8')).not.toMatch(/Math\.random|Date\.now\(|new Date\(\)/)
  })
})

describe('PoC Bijak sittings seed: BE-21 school-admin dashboard of DEMO001', () => {
  let t: SchoolAdminTestApp

  beforeAll(async () => {
    t = await bootSchoolAdminApp()
    await runSeeds([curriculumSeed, questionsSeed, examSeed, classesSeed, bijakSittingsSeed], { prisma: t.db.prisma })
  }, 180_000)
  afterAll(async () => {
    await t.close()
  })

  it('reports at least 5 student accounts (the k=5 gate of the dashboard)', async () => {
    const res = await apiOf(await login(t, SCHOOL_ADMIN)).get('/admin-sekolah/dashboard')
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const d = SchoolAdminDashboardSchema.parse(res.body.data)
    expect(d.school.code).toBe('DEMO001')
    expect(d.cards.pupils).toBeGreaterThanOrEqual(5)
  })

  // NOTE: this app binds the default NoSchoolPerformance port (the real BE-19 binding is on branch
  // be/BE-21-perf-port, not merged on this base), so the dashboard performance block is empty here. The Bijak
  // data behind it is asserted in the first describe through the BE-19 aggregate (PerformancePorts) instead.
})
