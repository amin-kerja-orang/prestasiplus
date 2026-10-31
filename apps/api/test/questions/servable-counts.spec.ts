import { writeFileSync } from 'node:fs'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { prngStream } from '../../src/db/prng'
import { PrismaService } from '../../src/db/prisma.service'
import { runSeeds, seedModules } from '../../prisma/seed'
import { QUESTION_COUNT_SQL } from '../../src/modules/account/account-data.repository'
import { Be09PracticeQuestionSource } from '../../src/modules/practice/question-bridge'
import { BankFacts } from '../../src/modules/practice/reads/overview/bank-facts'
import { OverviewRepository } from '../../src/modules/practice/reads/overview/overview.repository'
import { OFFERED_LEVEL_CODES } from '../../src/modules/practice/rules'
import { QuestionsRepository, QuestionsService } from '../../src/modules/questions'
import { UsersRepository } from '../../src/modules/users'
import { SpmHubService } from '../../src/modules/spm/hub.service'
import { SpmPoolService } from '../../src/modules/spm/pool.service'
import { BattleDeps } from '../../src/modules/battle/battle.deps'
import { PracticeAssignmentsAdapter } from '../../src/modules/classes/missions/practice-assignments.adapter'
import { createTestDatabase } from '../support/db'
import { START, bootMissionsApp, insertMission, loadWorld, type MissionsTestApp } from '../missions/helpers'
import { bootSpmApp, type SpmTestApp } from '../spm/helpers'

/**
 * R1-T05 before/after evidence for QA (8b: "card = details = login = drawable", login 493, cards BM 53 / MATH 54 / SCI 50).
 * Runs on the FULL demo seed (`seedModules`, profile poc) and reports the real numbers; nothing is tuned to match. It asserts the
 * relations that must hold (every surface reads one definition) and that an admin-made T4 MCQ reaches Databank, Latih Tubi SPM and
 * Mock K1. The numbers go to the console and to `$T05_COUNTS_OUT` (a JSON file) when that variable is set.
 *
 * Final pass (T04, approved = servable lifecycle, migration 0100): the fixture question is moved review -> approved only (`SERVE_STEPS`).
 */
const SERVE_STEPS = ['review', 'approved'] as const
const SUBJECTS = ['BM', 'MATH', 'SCI'] as const

let t: SpmTestApp
let repo: QuestionsRepository
let source: Be09PracticeQuestionSource
let pool: SpmPoolService
let hub: SpmHubService
let offeredIds: string[]
const report: Record<string, unknown> = {}

const subjectId = async (code: string): Promise<string> => (await t.db.query<{ id: string }>(`select id::text id from subjects where code = $1`, [code]))[0]?.id as string
const login = async (): Promise<number> => Number((await t.db.query<{ c: string }>(QUESTION_COUNT_SQL))[0]?.c)

beforeAll(async () => {
  const db = await createTestDatabase()
  await runSeeds(seedModules, { prisma: db.prisma })
  t = await bootSpmApp({ db })
  repo = t.app.get(QuestionsRepository, { strict: false })
  // The real practice source over the app's own bank and users (what the application binds to PracticePorts).
  source = new Be09PracticeQuestionSource(repo, t.app.get(UsersRepository, { strict: false }))
  pool = t.app.get(SpmPoolService, { strict: false })
  hub = t.app.get(SpmHubService, { strict: false })
  offeredIds = (await t.db.query<{ id: string }>(`select id::text id from education_levels where code = any($1)`, [[...OFFERED_LEVEL_CODES]])).map((r) => r.id)
}, 600_000)

afterAll(async () => {
  if (process.env.T05_COUNTS_OUT) writeFileSync(process.env.T05_COUNTS_OUT, JSON.stringify(report, null, 2))
  await t?.db.drop()
  await t?.app.close()
})

describe('counts on the full demo seed: login = cards = details = drawable', () => {
  it('reports the login count, the per-subject cards, the details and a full draw for BM, MATH and SCI', async () => {
    const loginCount = await login()
    const drawableAll = await repo.count({ type: 'mcq', spmPool: true, status: 'approved', active: true })
    // Practice overview cards (Q-PRACTICE over the offered levels), the same figure the Latih Tubi chapter cards sum.
    const bank = new BankFacts(await new OverviewRepository(t.app.get(PrismaService, { strict: false })).bankMatrix())
    const cards: Record<string, unknown> = {}
    for (const code of SUBJECTS) {
      const id = await subjectId(code)
      const practiceCard = bank.practice(id, offeredIds)
      const databank = (await hub.databank()).find((d) => d.code === code)?.databankCount
      const lt = (await hub.latihTubiList()).teras.concat((await hub.latihTubiList()).elektif).find((c) => c.code === code)?.total
      const details = (await hub.latihTubiConfig(code)).total
      const poolCount = await pool.count(id)
      // A full draw: ask for exactly the card size; one more must not be fillable.
      const drawn = await pool.sample(id, poolCount, prngStream(`t05-${code}`))
      const drawnIds = drawn.map((r) => r.id)
      const servableInDb = Number((await t.db.query<{ c: string }>(`${QUESTION_COUNT_SQL} AND v.subject_id = $1`, [id]))[0]?.c)
      cards[code] = { practiceCard, databank: databank ?? null, latihTubiCard: lt ?? null, details, poolCount, drawn: drawnIds.length, distinctDrawn: new Set(drawnIds).size, loginSqlForSubject: servableInDb }
      // card = details = drawable (one definition behind every SPM surface).
      expect(databank, `${code} databank`).toBe(poolCount)
      expect(lt, `${code} latihTubi card`).toBe(poolCount)
      expect(details, `${code} details`).toBe(poolCount)
      expect(drawnIds.length, `${code} drawable`).toBe(poolCount)
      expect(new Set(drawnIds).size).toBe(drawnIds.length)
      // Everything drawn is servable: live, active, approved, an offered level.
      expect(drawn.every((r) => r.isActive && r.version.status === 'approved' && offeredIds.includes(r.version.educationLevelId ?? ''))).toBe(true)
      // D91 (T04): `bankMatrix` has `group_id IS NULL`, so the practice card equals the drawable size per surface (BM 50, not 53).
      expect(practiceCard, `${code} practice card = drawable`).toBe(poolCount)
      // The login SQL counts every servable question of any activity (stimulus-group members included), so it is an upper bound.
      expect(servableInDb, `${code} login SQL >= drawable`).toBeGreaterThanOrEqual(poolCount)
      cards[code] = { ...(cards[code] as object), gapPracticeCardVsDrawable: practiceCard - poolCount }
    }
    // The hub (Databank, Latih Tubi, Mock K1) draws only UNGROUPED single-leaf MCQs; the login SQL and the practice card count every
    // servable MCQ. The whole difference on the demo seed is the stimulus-group MCQs (SEED-GRP-PASAR-1..3, BM T5): counted, never drawn.
    let hubAll = 0
    for (const s of await t.db.query<{ id: string }>(`select id::text id from subjects where is_active`)) hubAll += await pool.count(s.id)
    const groupedServable = Number(
      (await t.db.query<{ c: string }>(`${QUESTION_COUNT_SQL} AND q.group_id IS NOT NULL`))[0]?.c,
    )
    report.seed = 'prisma/seed seedModules (profile poc)'
    report.hubDrawableAllSubjects = hubAll
    report.gapLoginVsHub = { gap: loginCount - hubAll, groupedServableMcqs: groupedServable }
    expect(loginCount - hubAll, 'login minus hub = the servable stimulus-group MCQs').toBe(groupedServable)
    report.login = { questionCount: loginCount, drawableAllSubjects: drawableAll }
    report.subjects = cards
    console.log(`T05 COUNTS ${JSON.stringify(report)}`)
    expect(loginCount, 'login count = drawable count over all subjects').toBe(drawableAll)
    expect(loginCount, 'login "N+ Soalan" (D91: every servable question of any activity)').toBe(493)
    // Known counts on the demo seed: card = details = drawable per subject (BM 50, MATH 54, SCI 50).
    const known = { BM: 50, MATH: 54, SCI: 50 } as const
    for (const code of SUBJECTS) {
      const n = known[code]
      expect(cards[code], `${code} card = details = drawable = ${String(n)}`).toMatchObject({
        practiceCard: n,
        databank: n,
        latihTubiCard: n,
        details: n,
        poolCount: n,
        drawn: n,
        distinctDrawn: n,
      })
    }
  })
})

describe('an admin-created approved T4 MCQ appears in Databank, Latih Tubi SPM and Mock K1', () => {
  it('is counted and drawn by every SPM activity of its subject, with no pool tag', async () => {
    const id = await subjectId('MATH')
    const t4 = (await t.db.query<{ id: string }>(`select id::text id from education_levels where code = 'T4'`))[0]?.id as string
    const [admin] = await t.db.query<{ id: string }>(`select id::text id from users where lower(email) = 'admin@demo.test'`)
    const seeded = (await t.db.query<{ subject_id: string; chapter_id: string | null; unit_node_id: string | null }>(
      `select v.subject_id::text subject_id, v.chapter_id::text chapter_id, v.unit_node_id::text unit_node_id from question_versions v join education_levels l on l.id = v.education_level_id where v.subject_id = $1 and l.code = 'T4' limit 1`,
      [id],
    ))[0]
    expect(seeded, 'the seed has a T4 MATH question to copy the curriculum tag from').toBeDefined()
    const sp = (await t.db.query<{ node_id: string }>(`select s.node_id::text node_id from question_version_sp_nodes s join question_versions v on v.id = s.question_version_id where v.subject_id = $1 limit 1`, [id]))[0]?.node_id

    const before = {
      databank: (await hub.databank()).find((d) => d.code === 'MATH')?.databankCount as number,
      latihTubi: (await hub.latihTubiConfig('MATH')).total,
      k1: await pool.count(id, { levelId: t4 }),
      login: await login(),
    }
    const svc = t.app.get(QuestionsService, { strict: false })
    const actor = { userId: admin?.id as string, role: 'admin' } as const
    const created = await svc.create(
      {
        subjectId: id,
        educationLevelId: t4,
        difficultyLevel: 3,
        questionText: 'Soalan T05: yang manakah jawapan yang betul?',
        questionType: 'mcq',
        options: ['Satu', 'Dua', 'Tiga', 'Empat'],
        correctAnswer: 1,
        explanation: 'Penjelasan ujian T05.',
        tag: { ...(seeded?.unit_node_id ? { unitId: seeded.unit_node_id } : {}), spIds: sp ? [sp] : [], tp: 3 },
      } as never,
      actor,
    )
    for (const status of SERVE_STEPS) await svc.bulkAction(status, [created.id], actor)
    const tags = Number((await t.db.query<{ c: string }>(`select count(*) c from question_tags where question_id = $1`, [created.id]))[0]?.c)
    expect(tags, 'no pool tag was needed').toBe(0)

    const after = {
      databank: (await hub.databank()).find((d) => d.code === 'MATH')?.databankCount as number,
      latihTubi: (await hub.latihTubiConfig('MATH')).total,
      k1: await pool.count(id, { levelId: t4 }),
      login: await login(),
    }
    report.adminQuestion = { id: created.id, before, after }
    expect(after.databank).toBe(before.databank + 1) // Databank card
    expect(after.latihTubi).toBe(before.latihTubi + 1) // Latih Tubi SPM details
    expect(after.k1).toBe(before.k1 + 1) // Mock K1 pool
    expect(after.login).toBe(before.login + 1) // login "N+ Soalan"

    // Drawn (not just counted) by the practice source (Databank + Latih Tubi SPM) and by the Mock K1 pool.
    const practiceIds = await source.sample({ subjectId: id, spmPool: true }, 100_000, prngStream('t05-src'))
    expect(practiceIds).toContain(created.id)
    const k1 = (await pool.sample(id, after.databank, prngStream('t05-k1'))).map((r) => r.id)
    expect(k1).toContain(created.id)
    // Battle SPM size reads the same rule.
    expect(await repo.count({ type: 'mcq', subjectId: id, spmPool: true, status: 'approved', active: true })).toBeGreaterThanOrEqual(after.databank)
  })
})

describe('one admin-created approved T4 MCQ is served by all five SPM_SERVABLE_SQL readers', () => {
  let m: MissionsTestApp
  const readers: Record<string, boolean> = {}

  beforeAll(async () => {
    m = await bootMissionsApp({ full: true })
  }, 300_000)

  afterAll(async () => {
    report.fiveReaders = readers
    await m?.close()
  })

  it('Databank, Latih Tubi SPM, Mock K1, Battle SPM and Misi all count and draw it, with no pool tag', async () => {
    const w = await loadWorld(m)
    const subject = w.tag.subjectId
    const t4 = w.tag.levelId
    // An otherwise empty SPM bank for the subject, so the fixture is the only candidate of every reader.
    await m.db.query(`update questions set is_active = false where id in (select question_id from question_versions where subject_id = $1)`, [subject])
    const svc = m.get(QuestionsService)
    const actor = { userId: w.admin, role: 'admin' } as const
    const made = await svc.create(
      {
        subjectId: subject,
        educationLevelId: t4,
        difficultyLevel: 3,
        questionText: 'Soalan T05 lima pembaca: yang manakah betul?',
        questionType: 'mcq',
        options: ['Satu', 'Dua', 'Tiga', 'Empat'],
        correctAnswer: 1,
        explanation: 'Penjelasan ujian T05.',
        tag: { unitId: w.tag.unitId, spIds: [w.tag.spId], tp: 3 },
      } as never,
      actor,
    )
    for (const status of SERVE_STEPS) await svc.bulkAction(status, [made.id], actor)
    expect(Number((await m.db.query<{ c: string }>(`select count(*) c from question_tags where question_id = $1`, [made.id]))[0]?.c)).toBe(0)

    // 1) Databank and 2) Latih Tubi SPM: the practice source draw with the SPM-servable filter.
    const repo = m.get(QuestionsRepository)
    const source = m.get(Be09PracticeQuestionSource)
    expect(await source.sample({ subjectId: subject, spmPool: true }, 50, prngStream('t05-db'))).toEqual([made.id])
    readers['Databank + Latih Tubi SPM (practice source)'] = true
    // 3) Mock K1: SpmPoolService count and draw.
    const pool = m.get(SpmPoolService)
    expect(await pool.count(subject)).toBe(1)
    expect((await pool.sample(subject, 1, prngStream('t05-k1'))).map((r) => r.id)).toEqual([made.id])
    readers['Mock K1 (SpmPoolService)'] = true
    // 4) Battle SPM: the lobby size and a draw.
    const battle = m.get(BattleDeps)
    battle.invalidateCache()
    expect(await battle.spmPoolCount(subject)).toBe(1)
    expect(await battle.drawQuestions({ questionType: 'spm', subjectId: subject, levelId: null }, 1, prngStream('t05-battle'))).toEqual([made.id])
    readers['Battle SPM (BattleDeps)'] = true
    // 5) Misi: a Latih Tubi mission with no chapter falls back to the SPM-servable pool.
    const mission = await insertMission(m, w, { teacherId: w.teacherA, recipients: [w.student1], questionCount: 5 })
    const res = await m.get(PracticeAssignmentsAdapter).resolve('mission', { userId: w.student1, id: mission, at: new Date(START) })
    expect(res.status === 'ok' && res.questionIds).toEqual([made.id])
    readers['Misi (assignments adapter fallback)'] = true
    // The repository count that backs them all.
    expect(await repo.count({ type: 'mcq', subjectId: subject, spmPool: true, status: 'approved', active: true })).toBe(1)
  })
})
