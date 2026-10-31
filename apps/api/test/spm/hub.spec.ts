import {
  SpmDatabankSubjectSchema,
  SpmLatihTubiConfigSchema,
  SpmLatihTubiListSchema,
  SpmOverviewSchema,
  SpmSubjektifOverviewSchema,
  SpmTrackingAHubSchema,
  SpmTrackingASubjectResultSchema,
  type SpmLatihTubiCard,
  type SpmTrackingASubject,
} from '@pp/contract'
import { z } from 'zod'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { PracticePorts } from '../../src/modules/practice'
import { SpmTrackingService } from '../../src/modules/spm'
import {
  addPool,
  addQuestion,
  addSet,
  bootSpmApp,
  expectError,
  idOf,
  loginAs,
  loginModPelajar,
  parseData,
  type Client,
  type SpmTestApp,
} from './helpers'

let t: SpmTestApp
let student: Client
let student2: Client
let admin: Client

/** Ids of the ADDMATH set fixtures (target 20). */
const am: string[] = []

const uid = async (email: string) => (await t.db.query<{ id: string }>('select id::text from users where email = $1', [email]))[0]?.id as string

beforeAll(async () => {
  t = await bootSpmApp()
  const { db } = t
  // A controlled bank: the demo questions and the demo sets go.
  await db.query('delete from questions')
  await db.query('delete from spm_tracking_sets')

  // SEJ (teras, target 40): 8 pool questions with known level and difficulty, plus the ones that must not count.
  const sejTp = [1, 2, 2, 3, 4, 5, 6, null]
  for (const [i, tp] of sejTp.entries()) await addQuestion(db, { subject: 'SEJ', level: i < 4 ? 'T4' : 'T5', tp })
  await addQuestion(db, { subject: 'SEJ', tp: 2, status: 'draft' }) // unpublished
  await addQuestion(db, { subject: 'SEJ', tp: 2, active: false }) // deactivated
  await addQuestion(db, { subject: 'SEJ', tp: 2, pool: false }) // not in the SPM pool
  await addQuestion(db, { subject: 'SEJ', type: 'structured', pool: true }) // not multiple choice
  // MATH (spm 40): exactly 40, so the card is open until one leaves.
  await addPool(db, 'MATH', 40)
  await addPool(db, 'PERNIAGA', 3)
  await addPool(db, 'BA', 2) // BA is configured but not on the Tahun Lepas list

  // Subjektif: visible structured questions (BM 2, SK 1, MATH 3) and ones that do not count.
  for (const s of ['BM', 'BM', 'SK', 'MATH', 'MATH', 'MATH']) await addQuestion(db, { subject: s, type: 'structured', pool: false })
  await addQuestion(db, { subject: 'BM', type: 'structured', pool: false, status: 'draft' })
  await addQuestion(db, { subject: 'BM', type: 'structured', pool: false, active: false })

  // Tracking A: ADDMATH (size 20): bersih, bank_besar (23), belum_cukup (5 and 2).
  for (let i = 0; i < 48; i++) am.push(await addQuestion(db, { subject: 'ADDMATH', pool: false }))
  await addSet(db, 'ADDMATH', 1, am.slice(0, 20), { dskpTagged: 7 })
  await addSet(db, 'ADDMATH', 2, am.slice(20, 43), { dskpTagged: 99 })
  await addSet(db, 'ADDMATH', 3, am.slice(43, 48))
  await addSet(db, 'ADDMATH', 4, am.slice(0, 20).reverse())
  await addSet(db, 'ADDMATH', 5, am.slice(43, 45))
  // SEJ: one clean set of 40 (a teras subject sorts before the elektif ADDMATH).
  const sejSet: string[] = []
  for (let i = 0; i < 40; i++) sejSet.push(await addQuestion(db, { subject: 'SEJ', pool: false }))
  await addSet(db, 'SEJ', 1, sejSet)
  // GEO (size 40): eight sets of 3 questions, all locked.
  const geo = await Promise.all([1, 2, 3].map(() => addQuestion(db, { subject: 'GEO', pool: false })))
  for (let n = 1; n <= 8; n++) await addSet(db, 'GEO', n, geo)

  // Practice history for the overview: pelajar 2 SPM sessions (+ ones that do not count), admin 1 + 1 test row.
  const p = await uid('pelajar@demo.test')
  const a = await uid('admin@demo.test')
  const session = (user: string, mode: string, n: number, correct: number, coins: number, isTest = false) =>
    db.query(
      `insert into practice_sessions (user_id, mode, question_count, correct_count, coins_earned, status, started_at, completed_at, is_test)
       values ($1, $2, $3, $4, $5, 'completed', '2026-10-18T01:00:00Z', '2026-10-18T01:10:00Z', $6)`,
      [user, mode, n, correct, coins, isTest],
    )
  await session(p, 'past_year', 10, 5, 6)
  await session(p, 'latih_tubi', 10, 8, 9)
  await session(p, 'random', 10, 10, 50)
  await session(p, 'ramalan', 10, 10, 50, true)
  await session(a, 'ramalan', 4, 2, 3)
  await session(a, 'past_year', 6, 6, 8, true)

  student = await loginAs(t, 'student')
  student2 = await loginAs(t, 'student2')
  admin = await loginAs(t, 'admin')
}, 240_000)

afterAll(async () => {
  await t.close()
})

describe('AC2 Tahun Lepas databank (M06-02)', () => {
  it('lists the subjects with a databank order, sorted by it, with the live pool size', async () => {
    const rows = parseData(await student.get('/api/spm/databank'), z.array(SpmDatabankSubjectSchema))
    const order = ['BM', 'BI', 'MATH', 'SCI', 'SEJ', 'BIO', 'EKON', 'PHY', 'GEO', 'CHEM', 'ADDMATH', 'PI', 'PM', 'PSV', 'PSI', 'PERNIAGA', 'AKAUN', 'TI']
    expect(rows.map((r) => r.code)).toEqual(order)
    const by = Object.fromEntries(rows.map((r) => [r.code, r.databankCount]))
    // SEJ: 8 counted; the draft, the deactivated, the non-pool and the structured one are not.
    expect(by).toMatchObject({ SEJ: 8, MATH: 40, PERNIAGA: 3, BM: 0, ADDMATH: 0 })
    expect(rows.find((r) => r.code === 'BA')).toBeUndefined()
    expect(rows[0]).toMatchObject({ code: 'BM', name: 'Bahasa Melayu' })
    expect(typeof rows[0]?.nameEn).toBe('string')
  })
})

describe('AC2 Latih Tubi cards (M06-03)', () => {
  it('groups by group in display order; locked only with a target and a smaller pool', async () => {
    const l = parseData(await student.get('/api/spm/latih-tubi'), SpmLatihTubiListSchema)
    expect(l.teras.map((c) => c.code)).toEqual(['BM', 'BI', 'MATH', 'SCI', 'SEJ', 'PI', 'PM'])
    expect(l.elektif.map((c) => c.code)).toEqual(['GEO', 'BIO', 'CHEM', 'PHY', 'PERNIAGA', 'AKAUN', 'EKON', 'ADDMATH', 'PSV', 'BA', 'TI', 'PSI'])
    const card = (code: string): SpmLatihTubiCard => [...l.teras, ...l.elektif].find((c) => c.code === code) as SpmLatihTubiCard
    expect(card('BM')).toMatchObject({ total: 0, targetType: 'custom', targetSize: 34, locked: true })
    expect(card('MATH')).toMatchObject({ total: 40, targetType: 'spm', targetSize: 40, locked: false })
    expect(card('SEJ')).toMatchObject({ total: 8, locked: true })
    expect(card('PERNIAGA')).toMatchObject({ total: 3, targetType: null, targetSize: null, locked: false })
    expect(card('BA')).toMatchObject({ total: 2, targetType: 'latihan', targetSize: 40, locked: true })
  })

  it('a deactivated question leaves the pool: MATH 40 becomes 39 and locks, then recovers', async () => {
    const id = (await t.db.query<{ id: string }>(`select q.id::text from questions q join question_versions v on v.question_id = q.id join subjects s on s.id = v.subject_id where s.code = 'MATH' and v.type = 'mcq' order by q.id limit 1`))[0]?.id as string
    await t.db.query('update questions set is_active = false where id = $1', [id])
    try {
      const l = parseData(await student.get('/api/spm/latih-tubi'), SpmLatihTubiListSchema)
      expect(l.teras.find((c) => c.code === 'MATH')).toMatchObject({ total: 39, locked: true })
      const db = parseData(await student.get('/api/spm/databank'), z.array(SpmDatabankSubjectSchema))
      expect(db.find((r) => r.code === 'MATH')?.databankCount).toBe(39)
    } finally {
      await t.db.query('update questions set is_active = true where id = $1', [id])
    }
    expect(parseData(await student.get('/api/spm/latih-tubi/MATH'), SpmLatihTubiConfigSchema).total).toBe(40)
  })
})

describe('AC3 Latih Tubi setup (M06-04)', () => {
  it('SEJ: level and difficulty counts keyed by the education level ids, the target as the only option', async () => {
    const t4 = await idOf(t.db, 'education_levels', 'T4')
    const t5 = await idOf(t.db, 'education_levels', 'T5')
    const c = parseData(await student.get('/api/spm/latih-tubi/SEJ'), SpmLatihTubiConfigSchema)
    expect(c).toMatchObject({ code: 'SEJ', total: 8, targetType: 'spm', targetSize: 40 })
    expect(c.levelCounts).toEqual({ [t4]: 4, [t5]: 4 })
    // TP 6 counts as 5 and an unset TP as 1 (the flat wire).
    expect(c.difficultyStats).toEqual({ '1': 2, '2': 2, '3': 1, '4': 1, '5': 2 })
    expect(c.difficultyByLevel[t4]).toEqual({ '1': 1, '2': 2, '3': 1, '4': 0, '5': 0 })
    expect(c.difficultyByLevel[t5]).toEqual({ '1': 1, '2': 0, '3': 0, '4': 1, '5': 2 })
    expect(Object.keys(c.difficultyStats)).toEqual(['1', '2', '3', '4', '5'])
    expect(c.countOptions).toEqual([{ value: 40, label: '40 (Target SPM)', isTarget: true }])
    expect(c.defaultCount).toBe(40)
  })

  it('custom and latihan targets name their family; no target gives the free options and default 10', async () => {
    expect(parseData(await student.get('/api/spm/latih-tubi/BM'), SpmLatihTubiConfigSchema).countOptions).toEqual([{ value: 34, label: '34 (Target Custom)', isTarget: true }])
    const am = parseData(await student.get('/api/spm/latih-tubi/addmath'), SpmLatihTubiConfigSchema)
    expect(am.countOptions[0]?.label).toBe('20 (Target Latihan)')
    expect(am.defaultCount).toBe(20)
    const free = parseData(await student.get('/api/spm/latih-tubi/PERNIAGA'), SpmLatihTubiConfigSchema)
    expect(free.countOptions.map((o) => [o.value, o.label, o.isTarget])).toEqual([5, 10, 20, 30, 40, 50, 60].map((n) => [n, String(n), false]))
    expect(free.defaultCount).toBe(10)
    expect(free.total).toBe(3)
  })

  it('BA stays reachable; an unknown code and a subject that is not configured are 404 "Not Found."', async () => {
    expect(parseData(await student.get('/api/spm/latih-tubi/BA'), SpmLatihTubiConfigSchema).total).toBe(2)
    expectError(await student.get('/api/spm/latih-tubi/NOPE'), 'NOT_FOUND', 'Not Found.')
    expectError(await student.get('/api/spm/latih-tubi/SK'), 'NOT_FOUND', 'Not Found.')
  })
})

describe('AC8 overview (M06-01)', () => {
  it('computes the hub figures from the pool; yearsAvailable is 0; Tracking A is the sum of all ready counts', async () => {
    const o = parseData(await student.get('/api/spm/overview'), SpmOverviewSchema)
    const subjectCount = Number((await t.db.query<{ n: string }>(`select count(distinct sl.subject_id)::text n from subject_levels sl join subjects s on s.id = sl.subject_id join education_levels l on l.id = sl.education_level_id where s.is_active and l.grade in (10, 11)`))[0]?.n)
    // Pool over the 19 subjects: SEJ 8 + MATH 40 + PERNIAGA 3 + BA 2 = 53; the databank list leaves BA out.
    expect(o.stats).toMatchObject({ totalQuestions: 53, yearsAvailable: 0, subjectCount })
    expect(o.modules).toMatchObject({ databank: 51, latihTubi: 53 })
    expect(o.modules.databank).toBeLessThanOrEqual(o.stats.totalQuestions)
    // ADDMATH 20+20+5+20+2 = 67, SEJ 40, GEO 8 sets x 3.
    expect(o.stats.trackingAQuestions).toBe(67 + 40 + 24)
    expect(o.modules.trackingA).toBe(o.stats.trackingAQuestions)
    expect(o.modules.subjektifSets).toBe(7)
  })

  it('me: only the SPM modes of the caller; Mod Pelajar rows count only in Mod Pelajar', async () => {
    expect(parseData(await student.get('/api/spm/overview'), SpmOverviewSchema).me).toEqual({ sessions: 2, avgAccuracy: 65, coins: 15, answered: 20 })
    expect(parseData(await student2.get('/api/spm/overview'), SpmOverviewSchema).me).toEqual({ sessions: 0, avgAccuracy: 0, coins: 0, answered: 0 })
    expect(parseData(await admin.get('/api/spm/overview'), SpmOverviewSchema).me).toEqual({ sessions: 1, avgAccuracy: 50, coins: 3, answered: 4 })
    const mod = await loginModPelajar(t, 'admin')
    expect(parseData(await mod.get('/api/spm/overview'), SpmOverviewSchema).me).toEqual({ sessions: 2, avgAccuracy: 75, coins: 11, answered: 10 })
  })
})

describe('AC4 / AC5 Tracking A (M06-05, M06-06)', () => {
  it('student: lanes, open subjects (teras before elektif) and no readiness', async () => {
    const h = parseData(await student.get('/api/spm/tracking-a'), SpmTrackingAHubSchema)
    expect(h.readiness).toBeNull()
    expect(h.openSubjects.map((c) => c.code)).toEqual(['SEJ', 'ADDMATH'])
    expect(h.openSubjects[1]).toMatchObject({ readyQuestions: 60, bankBesarSets: 1, bersihSets: 2, bankSource: 23, startableSets: 3, targetType: 'latihan', targetSize: 20 })
    expect(h.openSubjects[0]).toMatchObject({ readyQuestions: 40, bankBesarSets: 0, bersihSets: 1, bankSource: null, startableSets: 1 })
    expect(h.objectiveLane).toEqual({ subjects: 2, sets: 4, questions: 40 + 20 + 23 + 20 })
    // BM 2 and BI 0 visible structured questions; the two bahasa subjects always.
    expect(h.bahasaLane).toEqual({ subjects: 2, sets: 2 })
    expect(h.bahasa.map((b) => [b.code, b.sets])).toEqual([['BM', 2], ['BI', 0]])
    expect(h.openSubjects.every((c) => c.code !== 'BM' && c.code !== 'BI')).toBe(true)
  })

  it('admin: readiness tiles follow the readiness order with the computed percentages and at most 6 locked sets', async () => {
    const r = parseData(await admin.get('/api/spm/tracking-a'), SpmTrackingAHubSchema).readiness
    const tile = (c: string) => r?.tiles.find((x) => x.code === c)
    expect(tile('ADDMATH')).toMatchObject({ targetSize: 20, bersih: 2, bankBesar: 1, locked: 2, total: 5, readiness: 60, hasBankBesar: true })
    expect(tile('ADDMATH')?.lockedSets).toEqual([{ setNo: 3, readyCount: 5, target: 20 }, { setNo: 5, readyCount: 2, target: 20 }])
    expect(tile('SEJ')).toMatchObject({ bersih: 1, bankBesar: 0, locked: 0, total: 1, readiness: 100, hasBankBesar: false })
    expect(tile('GEO')).toMatchObject({ locked: 8, total: 8, readiness: 0 })
    expect(tile('GEO')?.lockedSets).toHaveLength(6)
    expect(tile('GEO')?.lockedSets.map((s) => s.setNo)).toEqual([1, 2, 3, 4, 5, 6])
    expect(tile('GEO')?.lockedSets[0]).toEqual({ setNo: 1, readyCount: 3, target: 40 })
    expect(tile('BI')).toMatchObject({ total: 0, readiness: 0, lockedSets: [] })
    expect(r?.summary).toEqual({ bersih: 3, bankBesar: 1, locked: 2 + 8 })
  })

  it('S6 ADDMATH: startable sets first, then locked, each by set number; ready sum covers all sets', async () => {
    const s = parseData(await student.get('/api/spm/tracking-a/ADDMATH'), SpmTrackingASubjectResultSchema) as SpmTrackingASubject
    expect(s.summary).toEqual({ bersih: 2, bankBesar: 1, readyQuestions: 67, belumCukup: 2 })
    expect(s.sets.map((x) => x.setNo)).toEqual([1, 2, 4, 3, 5])
    expect(s.sets[0]).toEqual({ setNo: 1, status: 'bersih', readyCount: 20, bankSource: null, dskpTagged: 7, dskpTotal: 20 })
    // dskpTagged never exceeds the total shown.
    expect(s.sets[1]).toEqual({ setNo: 2, status: 'bank_besar', readyCount: 20, bankSource: 23, dskpTagged: 23, dskpTotal: 23 })
    expect(s.sets[3]).toMatchObject({ setNo: 3, status: 'belum_cukup', readyCount: 5, bankSource: null })
    expect(s).toMatchObject({ code: 'ADDMATH', targetType: 'latihan', targetSize: 20 })
    expect(parseData(await student.get('/api/spm/tracking-a/addmath'), SpmTrackingASubjectResultSchema)).toEqual(s)
  })

  it('a subject without sets lists none; BM and BI redirect with the real subject id; unknown codes are 404', async () => {
    const empty = parseData(await student.get('/api/spm/tracking-a/PERNIAGA'), SpmTrackingASubjectResultSchema) as SpmTrackingASubject
    expect(empty.sets).toEqual([])
    expect(empty.summary).toEqual({ bersih: 0, bankBesar: 0, readyQuestions: 0, belumCukup: 0 })
    for (const code of ['BM', 'BI']) {
      const id = await idOf(t.db, 'subjects', code)
      expect(parseData(await student.get(`/api/spm/tracking-a/${code}`), SpmTrackingASubjectResultSchema)).toEqual({ redirect: `/latihan-berstruktur?subject_id=${id}&scope=spm&track=bahasa` })
    }
    expectError(await student.get('/api/spm/tracking-a/XYZ'), 'NOT_FOUND', 'Not Found.')
    expectError(await student.get('/api/spm/tracking-a/SK'), 'NOT_FOUND', 'Not Found.')
  })

  it('a question that stops being eligible leaves the set count with no write to the set tables', async () => {
    const before = await t.db.query<{ n: string; u: string }>(`select count(*)::text n, max(updated_at)::text u from spm_tracking_sets`)
    const links = Number((await t.db.query<{ n: string }>('select count(*)::text n from spm_tracking_set_questions'))[0]?.n)
    const first = am[0] as string
    await t.db.query('update questions set is_active = false where id = $1', [first])
    try {
      const s = parseData(await student.get('/api/spm/tracking-a/ADDMATH'), SpmTrackingASubjectResultSchema) as SpmTrackingASubject
      // Sets 1 and 4 lose it: 19 of 20 is belum_cukup.
      expect(s.sets.find((x) => x.setNo === 1)).toMatchObject({ status: 'belum_cukup', readyCount: 19 })
      expect(s.sets.find((x) => x.setNo === 4)).toMatchObject({ status: 'belum_cukup', readyCount: 19 })
      expect(s.summary).toMatchObject({ bersih: 0, bankBesar: 1, belumCukup: 4 })
      const h = parseData(await student.get('/api/spm/tracking-a'), SpmTrackingAHubSchema)
      expect(h.openSubjects.find((c) => c.code === 'ADDMATH')?.startableSets).toBe(1)
    } finally {
      await t.db.query('update questions set is_active = true where id = $1', [first])
    }
    // Unpublished (a draft live version is not eligible) leaves the bank_besar set: 23 becomes 22, still 20 ready.
    const inBank = am[25] as string
    await t.db.query(`update question_versions set status = 'draft' where question_id = $1`, [inBank])
    try {
      const s = parseData(await student.get('/api/spm/tracking-a/ADDMATH'), SpmTrackingASubjectResultSchema) as SpmTrackingASubject
      expect(s.sets.find((x) => x.setNo === 2)).toMatchObject({ status: 'bank_besar', readyCount: 20, bankSource: 22 })
    } finally {
      await t.db.query(`update question_versions set status = 'approved' where question_id = $1`, [inBank])
    }
    const after = await t.db.query<{ n: string; u: string }>(`select count(*)::text n, max(updated_at)::text u from spm_tracking_sets`)
    expect(after).toEqual(before)
    expect(Number((await t.db.query<{ n: string }>('select count(*)::text n from spm_tracking_set_questions'))[0]?.n)).toBe(links)
    expect((parseData(await student.get('/api/spm/tracking-a/ADDMATH'), SpmTrackingASubjectResultSchema) as SpmTrackingASubject).summary.bersih).toBe(2)
  })
})

describe('AC6 ramalanQuestionIds binds to the practice ramalan port', () => {
  const sid = () => idOf(t.db, 'subjects', 'ADDMATH')

  it('is the module service that the practice module calls', () => {
    expect(t.app.get(PracticePorts).ramalan).toBe(t.app.get(SpmTrackingService))
  })

  it('null for an unknown set (set, year or subject), [] for belum_cukup', async () => {
    const svc = t.app.get(SpmTrackingService)
    const subject = await sid()
    expect(await svc.ramalanQuestionIds(subject, 2026, 99)).toBeNull()
    expect(await svc.ramalanQuestionIds(subject, 2025, 1)).toBeNull()
    expect(await svc.ramalanQuestionIds('abc', 2026, 1)).toBeNull()
    expect(await svc.ramalanQuestionIds('99999999', 2026, 1)).toBeNull()
    expect(await svc.ramalanQuestionIds(subject, 2026, 3)).toEqual([])
  })

  it('bersih: the eligible ids in position order; bank_besar: cut to the size', async () => {
    const svc = t.app.get(SpmTrackingService)
    const subject = await sid()
    expect(await svc.ramalanQuestionIds(subject, 2026, 1)).toEqual(am.slice(0, 20))
    // Set 4 holds the same questions in reverse: the order is the position, not the id.
    expect(await svc.ramalanQuestionIds(subject, 2026, 4)).toEqual(am.slice(0, 20).reverse())
    expect(await svc.ramalanQuestionIds(subject, 2026, 2)).toEqual(am.slice(20, 40))
  })

  it('an ineligible question is skipped; a set that falls below the size answers []', async () => {
    const svc = t.app.get(SpmTrackingService)
    const subject = await sid()
    const gone = am[22] as string
    await t.db.query('update questions set is_active = false where id = $1', [gone])
    try {
      const ids = (await svc.ramalanQuestionIds(subject, 2026, 2)) as string[]
      expect(ids).toHaveLength(20)
      expect(ids).not.toContain(gone)
      expect(ids).toEqual([...am.slice(20, 22), ...am.slice(23, 41)])
      await t.db.query('update questions set is_active = false where id = $1', [am[23] as string])
      await t.db.query('update questions set is_active = false where id = $1', [am[24] as string])
      await t.db.query('update questions set is_active = false where id = $1', [am[25] as string])
      expect(await svc.ramalanQuestionIds(subject, 2026, 2)).toEqual([])
    } finally {
      await t.db.query('update questions set is_active = true where id = any($1::bigint[])', [[gone, am[23], am[24], am[25]]])
    }
  })
})

describe('AC7 Subjektif (M06-07)', () => {
  it('15 subjects, teras first then by name; sets are the visible structured questions', async () => {
    const s = parseData(await student.get('/api/spm/subjektif'), SpmSubjektifOverviewSchema)
    expect(s.subjects).toHaveLength(15)
    expect(s.subjects.slice(0, 5).map((x) => x.name)).toEqual(['Bahasa Inggeris', 'Bahasa Melayu', 'Matematik', 'Sains', 'Sejarah'])
    expect(s.subjects.slice(0, 5).every((x) => x.group === 'teras')).toBe(true)
    const elektif = s.subjects.slice(5).map((x) => x.name)
    expect(s.subjects.slice(5).every((x) => x.group === 'elektif')).toBe(true)
    expect(elektif).toEqual([...elektif].sort((a, b) => a.localeCompare(b, 'ms')))
    const bySubject = Object.fromEntries(s.subjects.map((x) => [x.name, x.sets]))
    expect(bySubject).toMatchObject({ 'Bahasa Melayu': 2, Matematik: 3, 'Sains Komputer': 1, Sejarah: 1, 'Bahasa Inggeris': 0 })
    // The draft and the deactivated BM question are not counted (BM 2, MATH 3, SK 1 and the SEJ one).
    expect(s.subjects.reduce((a, x) => a + x.sets, 0)).toBe(7)
  })

  it('the stats come from the structured-attempt port for the caller only', async () => {
    const p = await uid('pelajar@demo.test')
    const o = await uid('pelajar2@demo.test')
    const bm = await idOf(t.db, 'subjects', 'BM')
    const math = await idOf(t.db, 'subjects', 'MATH')
    t.attempts.rows.length = 0
    t.attempts.rows.push(
      { userId: p, subjectId: bm, questionId: '1', pct: 75 },
      { userId: p, subjectId: math, questionId: '2', pct: 50.4 },
      { userId: p, subjectId: math, questionId: '2', pct: 20, isTest: true },
      { userId: o, subjectId: bm, questionId: '9', pct: 100 },
    )
    t.attempts.calls.length = 0
    const mine = parseData(await student.get('/api/spm/subjektif'), SpmSubjektifOverviewSchema)
    expect(mine.stats).toEqual({ setsAnswered: 2, subjectsTried: 2, bestScore: 75, bestSetsSaved: 2 })
    expect(t.attempts.calls[0]).toMatchObject({ userId: p, includeTest: false })
    expect(t.attempts.calls[0]?.subjectIds).toHaveLength(15)
    // Another user's attempts never change my figures, and an empty history is "Belum Ada".
    expect(parseData(await student2.get('/api/spm/subjektif'), SpmSubjektifOverviewSchema).stats).toEqual({ setsAnswered: 1, subjectsTried: 1, bestScore: 100, bestSetsSaved: 1 })
    t.attempts.rows.length = 0
    expect(parseData(await student.get('/api/spm/subjektif'), SpmSubjektifOverviewSchema).stats).toEqual({ setsAnswered: 0, subjectsTried: 0, bestScore: null, bestSetsSaved: 0 })
  })
})
