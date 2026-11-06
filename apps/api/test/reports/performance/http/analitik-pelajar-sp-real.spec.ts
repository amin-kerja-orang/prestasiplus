import { PerformanceAnalyticsSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { CurriculumSpMapAdapter } from '../../../../src/modules/curriculum/sp-map.adapter'
import { PracticeReadsModule } from '../../../../src/modules/practice/reads'
import { PerformanceModule, PerformancePorts } from '../../../../src/modules/reports/performance'
import { bootIntegrationApp, type Client, loginAs, type IntegrationApp } from '../../../bijak-integration/helpers'
import { expectError, parseData } from '../../../curriculum/helpers'

/**
 * AC-MUR-5-1, AC-MUR-5-2, AC-MUR-5-3 over the REAL HTTP path (S10-T04 part 3b, #924): `AppModule` boots with the
 * real wiring and NO fake SP map; `PerformancePorts` is given `CurriculumSpMapAdapter` by `CurriculumModule`, and
 * the answer reader is the real `AnswerFactsAdapter` of `PracticeReadsModule`. The tree, the SP tags and the
 * pupils' answer rows are test fixtures (SQL); no production code writes `practice_answers` here. Every code is
 * unique per run, and the figures are read only for the subjects this spec creates, so no seed value matters.
 */
let t: IntegrationApp
let run = ''
let levelId = ''
let alice: Client
let bob: Client
let cara: Client

const q = async <T extends object>(sql: string, args: unknown[] = []): Promise<T[]> => t.db.query<T>(sql, args)

async function addPupil(email: string, name: string, schoolCode: string): Promise<void> {
  await q(
    `insert into users (name, email, school_id, grade, password_hash)
       select $1, $2, s.id, 10, (select password_hash from users where email = 'guru@demo.test') from schools s where s.code = $3`,
    [name, email, schoolCode],
  )
  await q(`insert into user_roles (user_id, role) select id, 'student' from users where email = $1`, [email])
}

async function node(subject: string, kind: string, code: string, title: string, parent: string | null, sort: number): Promise<string> {
  const [row] = await q<{ id: string }>(
    `insert into curriculum_nodes (subject_id, education_level_id, kind, code, title, parent_id, sort_order, edition)
     values ($1::bigint, $2::bigint, $3, $4, $5, $6::bigint, $7, 'KSSM sp-real') returning id::text`,
    [subject, levelId, kind, code, title, parent, sort],
  )
  return row!.id
}

async function subject(code: string, sort: number): Promise<string> {
  const [row] = await q<{ id: string }>(`insert into subjects (code, name, name_en, color, sort_order, is_active) values ($1, $2, $2, '#000000', $3, true) returning id::text`, [code, `Subjek ${code}`, sort])
  return row!.id
}

/** An approved question (one version) tagged to the given SP nodes. */
async function question(spIds: string[]): Promise<string> {
  const [qr] = await q<{ id: string }>(`insert into questions default values returning id::text`)
  const [v] = await q<{ id: string }>(
    `insert into question_versions (question_id, version_no, type, stem_ms, status) values ($1::bigint, 1, 'mcq', 'Soalan peta SP sebenar', 'approved') returning id::text`,
    [qr!.id],
  )
  for (const sp of spIds) await q(`insert into question_version_sp_nodes (question_version_id, node_id) values ($1::bigint, $2::bigint)`, [v!.id, sp])
  return qr!.id
}

/** Fixture answers of a pupil to a question: `n` rows, the first `right` correct. */
async function answers(email: string, questionId: string, subjectId: string, n: number, right: number): Promise<void> {
  for (let i = 0; i < n; i++) {
    await q(
      `insert into practice_answers (user_id, question_id, subject_id, education_level_id, is_correct, answered_at, is_test, mode)
       select u.id, $2::bigint, $3::bigint, $4::bigint, $5, '2026-10-19 08:00:00+08'::timestamptz, false, 'latih_tubi' from users u where u.email = $1`,
      [email, questionId, subjectId, levelId, i < right],
    )
  }
}

const aliceEmail = (): string => `alice.${run}@demo.test`
const mine = (r: ReturnType<typeof PerformanceAnalyticsSchema.parse>, code: string) => r.subjects.find((s) => s.code === code)
let subjA = ''
let subjT = ''
let subjU = ''

beforeAll(async () => {
  t = await bootIntegrationApp({ extraModules: [PerformanceModule, PracticeReadsModule] })
  run = Math.random().toString(36).slice(2, 8).toUpperCase()
  subjA = `SPA${run}`
  subjT = `SPT${run}`
  subjU = `SPU${run}`
  const [lv] = await q<{ id: string }>(`select id::text from education_levels where grade = 10 order by sort_order, id limit 1`)
  levelId = lv!.id

  // Subject A: sk -> two units -> four SPs. Subject T: SPs but no tags. Subject U: no SP nodes at all.
  const a = await subject(subjA, -3000)
  const t1 = await subject(subjT, -2999)
  const u = await subject(subjU, -2998)
  const sk = await node(a, 'sk', `A${run}`, 'Standard Kandungan A', null, 1)
  const unit1 = await node(a, 'unit', `A${run}.1`, 'Kemahiran Membaca', sk, 1)
  const unit2 = await node(a, 'unit', `A${run}.2`, 'Kemahiran Menulis', sk, 2)
  const sp1 = await node(a, 'sp', '1.1.1', 'SP satu', unit1, 1)
  const sp2 = await node(a, 'sp', '1.1.2', 'SP dua', unit1, 2)
  const sp3 = await node(a, 'sp', '1.1.3', 'SP tiga', unit1, 3)
  await node(a, 'sp', '2.1.1', 'SP empat', unit2, 1)
  const skT = await node(t1, 'sk', `T${run}`, 'Standard Kandungan T', null, 1)
  await node(t1, 'sp', '1.1.1', 'SP tanpa tag', skT, 1)

  await addPupil(aliceEmail(), 'Murid Alice', 'DEMO001')
  await addPupil(`bob.${run}@demo.test`, 'Murid Bob', 'DEMO001')
  await addPupil(`cara.${run}@demo.test`, 'Murid Cara', 'DEMO001')

  const qa = await question([sp1])
  const qb = await question([sp2])
  const qc = await question([sp3])
  const qbab = await question([]) // a Bab-only question: no SP row
  const qt = await question([])
  const qu = await question([])

  await answers(aliceEmail(), qa, a, 10, 8) // 80 % mahir
  await answers(aliceEmail(), qb, a, 10, 6) // 60 % sederhana
  await answers(aliceEmail(), qc, a, 10, 3) // 30 % lemah
  await answers(aliceEmail(), qbab, a, 4, 4) // counts in the subject figures only
  await answers(`cara.${run}@demo.test`, qt, t1, 5, 5)
  await answers(`cara.${run}@demo.test`, qu, u, 5, 2)

  alice = await loginAs(t, aliceEmail())
  bob = await loginAs(t, `bob.${run}@demo.test`)
  cara = await loginAs(t, `cara.${run}@demo.test`)
}, 180_000)
afterAll(async () => {
  await t?.close()
})

describe('binding', () => {
  it('PerformancePorts serves the curriculum adapter, no fake, no provideSpMap', () => {
    expect(t.app.get(PerformancePorts).spMap).toBeInstanceOf(CurriculumSpMapAdapter)
  })
})

describe('AC-MUR-5-1: the pupil SP tab on real rows', () => {
  it('shows the tiles by band, the counts, the ring and the per-subject figures', async () => {
    const res = await alice.get('/api/analytics/me')
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const r = parseData(res, PerformanceAnalyticsSchema)
    const s = mine(r, subjA)
    expect(s, 'the tab of the spec subject').toBeDefined()
    expect(s!.map.tiles.map((x) => [x.code, x.status, x.strand])).toEqual([
      ['1.1.1', 'mahir', 'Kemahiran Membaca'],
      ['1.1.2', 'sederhana', 'Kemahiran Membaca'],
      ['1.1.3', 'lemah', 'Kemahiran Membaca'],
      ['2.1.1', 'belum', 'Kemahiran Menulis'],
    ])
    expect(s!.counts).toEqual({ mahir: 1, sederhana: 1, lemah: 1, belum: 1 })
    expect(s!.ringTotal).toBe(4)
    // 30 SP answers (17 right) + 4 Bab-only answers (4 right) = 21 of 34: the Bab-only answers count in the subject figures only.
    expect(s!.answered).toBe(34)
    expect(s!.accuracy).toBeCloseTo((21 / 34) * 100, 0)
  })

  it('lists the weak SP with its answered count and accuracy, and topWeak holds it', async () => {
    const r = parseData(await alice.get('/api/analytics/me'), PerformanceAnalyticsSchema)
    const s = mine(r, subjA)!
    expect(s.weak.map((w) => [w.code, w.answered, w.accuracy])).toEqual([['1.1.3', 10, 30]])
    expect(r.topWeak.filter((w) => w.subjectCode === subjA).map((w) => w.code)).toEqual(['1.1.3'])
  })
})

describe('AC-MUR-5-2/-3: belum tiles and subjects without tags', () => {
  it('a pupil with no answers to the subject keeps the tab: every SP is "belum", no error', async () => {
    const r = parseData(await bob.get('/api/analytics/me'), PerformanceAnalyticsSchema)
    const s = mine(r, subjA)!
    expect(s.map.tiles.map((x) => x.status)).toEqual(['belum', 'belum', 'belum', 'belum'])
    expect(s.counts).toEqual({ mahir: 0, sederhana: 0, lemah: 0, belum: 4 })
    expect(s.answered).toBe(0)
    expect(s.accuracy).toBeNull()
    expect(s.weak).toEqual([])
  })

  it('a subject whose SPs carry no tag keeps its tab with every SP "belum", even with answers', async () => {
    const r = parseData(await cara.get('/api/analytics/me'), PerformanceAnalyticsSchema)
    const s = mine(r, subjT)!
    expect(s.map.tiles.map((x) => x.status)).toEqual(['belum'])
    expect(s.answered).toBe(5)
    expect(s.weak).toEqual([])
  })

  it('a subject with no SP nodes yields no tab, and no error', async () => {
    const res = await cara.get('/api/analytics/me')
    expect(res.status).toBe(200)
    const r = parseData(res, PerformanceAnalyticsSchema)
    expect(mine(r, subjU)).toBeUndefined()
    expect(r.topWeak.some((w) => w.subjectCode === subjU)).toBe(false)
  })
})

describe('privacy', () => {
  it('another pupil reads none of the answers of the pupil, through /analytics/me or /performance/students', async () => {
    const aliceId = alice.userId
    expectError(await bob.get(`/api/performance/students/${aliceId}`), 'NOT_FOUND')
    const own = parseData(await bob.get('/api/analytics/me'), PerformanceAnalyticsSchema)
    expect(mine(own, subjA)!.answered).toBe(0)
    expect(own.topWeak.filter((w) => w.subjectCode === subjA)).toEqual([])
  })

  it('an unauthenticated caller gets 401', async () => {
    expectError(await t.agent().get('/api/analytics/me'), 'UNAUTHORIZED')
  })
})
