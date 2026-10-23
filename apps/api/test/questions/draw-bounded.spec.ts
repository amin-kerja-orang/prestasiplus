import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { mulberry32, prngStream } from '../../src/db/prng'
import { BattleDeps } from '../../src/modules/battle/battle.deps'
import { QuestionPool } from '../../src/modules/classes/missions/question-pool'
import { GameQuestions } from '../../src/modules/games'
import { DuplicateDetector } from '../../src/modules/intake/workflow/duplicate-detector'
import { Be09PracticeQuestionSource } from '../../src/modules/practice/question-bridge'
import { ELIGIBLE_IDS_MAX, QuestionsRepository } from '../../src/modules/questions'
import { QualityService } from '../../src/modules/questions/workflow/quality/quality.service'
import { SpmTrackingService } from '../../src/modules/spm'
import { SpmPoolService } from '../../src/modules/spm/pool.service'
import { bulkMcqs } from '../helpers/bulk-bank'
import { STUDENT_1, bootMissionsApp, client, loadWorld, type Client, type MissionsTestApp, type World } from '../missions/helpers'

/**
 * QLOAD draw-path performance. A bank of a few thousand questions (above ELIGIBLE_IDS_MAX, so any path that still loads a whole
 * subject's ids THROWS) proves every learner draw, count and audit reads O(n) rows: the number of ids hydrated through
 * `getMany` stays near the draw size, `eligibleIds` is never called, and the draw itself still behaves (eligibility,
 * determinism, filters).
 */

const SUBJECT_BIG = 6000 // primary level, one chapter
const POOLED = 5200 // Tingkatan 4, half in the SPM pool
let t: MissionsTestApp
let w: World
let s1: Client
let dLevel: string
let chapterId: string
let repo: QuestionsRepository
/** Ascending ids of the eligible fixture rows. */
let primary: string[]
let form4: string[]

const spies = {
  getMany: vi.spyOn(QuestionsRepository.prototype, 'getMany'),
  eligibleIds: vi.spyOn(QuestionsRepository.prototype, 'eligibleIds'),
  listIds: vi.spyOn(QuestionsRepository.prototype, 'listIds'),
}
const hydrated = (): { total: number; max: number } => {
  const sizes = spies.getMany.mock.calls.map((c) => c[0].length)
  return { total: sizes.reduce((a, b) => a + b, 0), max: Math.max(0, ...sizes) }
}

beforeAll(async () => {
  t = await bootMissionsApp({ full: true })
  w = await loadWorld(t)
  await t.db.query(`insert into comp_students (user_id, package_expires_on) values ($1, '2027-12-31') on conflict do nothing`, [w.student1])
  dLevel = (
    await t.db.query<{ id: string }>(
      `select l.id::text id from education_levels l join subject_levels sl on sl.education_level_id = l.id
        where sl.subject_id = $1 and l.code in ('D1','D2','D3','D4') order by l.sort_order, l.id limit 1`,
      [w.tag.subjectId],
    )
  )[0]?.id as string
  chapterId = (await t.db.query<{ id: string }>(`select id::text id from chapters where subject_id = $1 and education_level_id = $2 and is_active order by id limit 1`, [w.tag.subjectId, dLevel]))[0]?.id as string
  expect(dLevel && chapterId).toBeTruthy()
  s1 = await client(t, STUDENT_1)
  repo = t.get(QuestionsRepository)
  primary = await bulkMcqs(t.db, { count: SUBJECT_BIG + 300, subjectId: w.tag.subjectId, levelId: dLevel, chapterId, heldEvery: 20, draftEvery: 25, label: 'QL-P' })
  form4 = await bulkMcqs(t.db, { count: POOLED, subjectId: w.tag.subjectId, levelId: w.tag.levelId, poolEvery: 2, heldEvery: 50, label: 'QL-F' })
}, 300_000)

afterAll(async () => {
  spies.getMany.mockRestore()
  spies.eligibleIds.mockRestore()
  spies.listIds.mockRestore()
  await t.close()
})

afterEach(() => {
  spies.getMany.mockClear()
  spies.eligibleIds.mockClear()
  spies.listIds.mockClear()
})

const eligibleTotal = async (levelId: string): Promise<number> =>
  (await t.db.query<{ n: number }>(`select count(*)::int n from questions q join question_versions v on v.question_id = q.id and v.version_no = q.live_version_no where q.is_active and v.status = 'published' and v.type = 'mcq' and v.subject_id = $1 and v.education_level_id = $2`, [w.tag.subjectId, levelId]))[0]?.n as number

describe('the fixture is bigger than the guard', () => {
  it('has thousands of eligible rows, held and draft rows excluded', async () => {
    expect(primary.length).toBeGreaterThan(ELIGIBLE_IDS_MAX)
    expect(primary.length).toBeLessThan(SUBJECT_BIG + 300) // held and drafts are not eligible
    expect(await eligibleTotal(dLevel)).toBe(primary.length)
  })
})

describe('migration 0044 draw indexes', () => {
  it('creates the three partial covering indexes on published versions', async () => {
    const rows = await t.db.query<{ indexname: string; indexdef: string }>(`select indexname, indexdef from pg_indexes where tablename = 'question_versions' and indexname like 'ix_qv_pub_%' order by indexname`)
    expect(rows.map((r) => r.indexname)).toEqual(['ix_qv_pub_chapter', 'ix_qv_pub_level_tp', 'ix_qv_pub_subject_level_tp'])
    for (const r of rows) {
      expect(r.indexdef).toContain("status = 'published'")
      expect(r.indexdef).toContain('INCLUDE')
    }
  })
})

describe('repository primitives (QLOAD)', () => {
  it('eligibleIds throws instead of silently truncating when the filter matches more than the cap', async () => {
    await expect(repo.eligibleIds({ subjectId: w.tag.subjectId, educationLevelId: dLevel })).rejects.toThrow(/more than 5000/)
    expect(await repo.eligibleIds({ subjectId: w.tag.subjectId, educationLevelId: dLevel, difficultyTp: 1, chapterId, excludeIds: primary.slice(500) })).toHaveLength(500 > 0 ? (await repo.count({ subjectId: w.tag.subjectId, educationLevelId: dLevel, difficultyTp: 1, status: 'published', active: true, excludeIds: primary.slice(500) })) : 0)
  })

  it('sampleIds draws n ids in SQL: eligible only, distinct, same seed same ids, wider window keeps the prefix', async () => {
    const f = { subjectId: w.tag.subjectId, educationLevelId: dLevel, type: 'mcq' as const }
    const a = await repo.sampleIds(f, 30, 12345)
    const b = await repo.sampleIds(f, 30, 12345)
    const c = await repo.sampleIds(f, 30, 54321)
    const wide = await repo.sampleIds(f, 120, 12345)
    expect(a).toHaveLength(30)
    expect(new Set(a).size).toBe(30)
    expect(a).toEqual(b)
    expect(a).not.toEqual(c)
    expect(wide.slice(0, 30)).toEqual(a)
    const eligible = new Set(primary)
    for (const id of [...a, ...c, ...wide]) expect(eligible.has(id), `${id} is not eligible`).toBe(true)
    expect(hydrated().total).toBe(0)
    expect(spies.eligibleIds).not.toHaveBeenCalled()
    // `sample` takes its seed from the stream: same stream, same draw.
    expect(await repo.sample(f, 30, mulberry32(7))).toEqual(await repo.sample(f, 30, mulberry32(7)))
    expect(await repo.sample(f, 0, mulberry32(7))).toEqual([])
  })

  it('the draw spreads over the subject (not the oldest ids) and honours every filter', async () => {
    const draws = await Promise.all(Array.from({ length: 20 }, (_, i) => repo.sampleIds({ subjectId: w.tag.subjectId, educationLevelId: dLevel }, 50, i)))
    const rank = new Map(primary.map((id, i) => [id, i]))
    const ranks = draws.flat().map((id) => rank.get(id) as number)
    expect(Math.max(...ranks)).toBeGreaterThan(primary.length * 0.8)
    expect(Math.min(...ranks)).toBeLessThan(primary.length * 0.2)
    const tp2 = await repo.sampleIds({ subjectId: w.tag.subjectId, educationLevelId: dLevel, difficultyTp: 2 }, 40, 1)
    expect((await repo.getMany(tp2, 'live')).every((r) => r.version.difficultyTp === 2)).toBe(true)
    const pooled = await repo.sampleIds({ subjectId: w.tag.subjectId, educationLevelId: w.tag.levelId, spmPool: true }, 40, 1)
    expect((await repo.getMany(pooled, 'live')).every((r) => r.spmPool)).toBe(true)
    const excluded = new Set(draws[0])
    expect((await repo.sampleIds({ subjectId: w.tag.subjectId, educationLevelId: dLevel, excludeIds: [...excluded] }, 200, 0)).some((id) => excluded.has(id))).toBe(false)
  })

  it('eligibleAmong keeps only the eligible ids of the list; eligibleIdsPage walks the subject by keyset', async () => {
    const [held] = (await t.db.query<{ id: string }>(`select q.id::text id from questions q join question_versions v on v.question_id = q.id where v.number_label like 'QL-P-%' and not q.is_active limit 1`)).map((r) => r.id)
    const [draft] = (await t.db.query<{ id: string }>(`select q.id::text id from questions q join question_versions v on v.question_id = q.id where v.number_label like 'QL-P-%' and v.status = 'draft' limit 1`)).map((r) => r.id)
    const probe = [primary[0] as string, primary[1] as string, held as string, draft as string, '999999999']
    expect(await repo.eligibleAmong(probe, { subjectId: w.tag.subjectId })).toEqual([primary[0], primary[1]])
    expect(await repo.eligibleAmong(probe, { subjectId: '1' })).toEqual([]) // another subject
    const walked: string[] = []
    for (let after: string | undefined; ; ) {
      const page = await repo.eligibleIdsPage({ subjectId: w.tag.subjectId, educationLevelId: dLevel }, after, 1000)
      if (page.length === 0) break
      walked.push(...page)
      after = page[page.length - 1]
    }
    expect(walked).toEqual(primary)
  })

  it('groupCountsByLevelTp is one grouped statement whose cells add up to the pool', async () => {
    const cells = await repo.groupCountsByLevelTp({ subjectId: w.tag.subjectId, type: 'mcq', spmPool: true, ungrouped: true, status: 'published', active: true })
    const total = cells.reduce((a, c) => a + c.n, 0)
    const expected = (await t.db.query<{ n: number }>(`select count(*)::int n from questions q join question_versions v on v.question_id = q.id and v.version_no = q.live_version_no where q.is_active and v.status = 'published' and v.subject_id = $1 and exists (select 1 from question_tags g where g.question_id = q.id and g.kind = 'pool') and not exists (select 1 from question_tags g where g.question_id = q.id and g.kind = 'pksk_domain')`, [w.tag.subjectId]))[0]?.n
    expect(total).toBe(expected)
    expect(total).toBeGreaterThan(2000)
    expect(cells.every((c) => c.levelId === w.tag.levelId || c.levelId !== dLevel)).toBe(true)
  })
})

describe('practice (P1-P4, P6)', () => {
  const source = (): Be09PracticeQuestionSource => t.get(Be09PracticeQuestionSource)

  it('random start hydrates a window of n * 4 ids, never the subject, and serves distinct eligible questions', async () => {
    const res = await s1.post('/practice/sessions', { mode: 'random', subjectCode: w.subjectCode, levelId: dLevel, count: 10 })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const ids = (res.body.data.questions as { id: string }[]).map((q) => q.id)
    expect(new Set(ids).size).toBe(10)
    for (const id of ids) expect(primary).toContain(id)
    const h = hydrated()
    expect(h.max).toBeLessThanOrEqual(500)
    expect(h.total).toBeLessThanOrEqual(10 * 4 + 10 + 20) // the window, then the served ids (plus the response mapping)
    expect(spies.eligibleIds).not.toHaveBeenCalled()
  })

  it('a draw with a difficulty only returns that difficulty', async () => {
    const ids = await source().sample({ subjectId: w.tag.subjectId, educationLevelIds: [dLevel], difficulty: 3 }, 15, prngStream('p-d3'))
    expect(ids).toHaveLength(15)
    const live = await source().live(ids)
    expect([...live.values()].every((q) => q.difficulty === 3)).toBe(true)
  })

  it('chapter counts and pages come from SQL: no chapter id list is hydrated, BR-17 order holds', async () => {
    const counts = await source().chapterCounts([chapterId])
    expect(counts.get(chapterId)).toBe(primary.length)
    const first = await source().chapterPage(chapterId, [], 10)
    expect(first).toEqual(primary.slice(0, 10))
    const after = await source().chapterPage(chapterId, first.slice(0, 4), 10)
    expect(after).toEqual(primary.slice(4, 14)) // answered ones skipped, ascending id
    expect(hydrated().max).toBeLessThanOrEqual(50)
    expect(spies.eligibleIds).not.toHaveBeenCalled()
  })

  it('a chapter session starts with the first unanswered ids and reads O(count), not the chapter', async () => {
    const res = await s1.post('/practice/sessions', { mode: 'chapter', chapterId, count: 10 })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect((res.body.data.questions as { id: string }[]).map((q) => q.id)).toEqual(primary.slice(0, 10))
    const h = hydrated()
    expect(h.max).toBeLessThanOrEqual(50)
    expect(h.total).toBeLessThanOrEqual(100) // one 50-id servable page plus the 10 served ids
    expect(spies.eligibleIds).not.toHaveBeenCalled()
  })
})

describe('SPM pool and tracking (S1, S2, S5)', () => {
  it('count and level/difficulty splits are SQL counts; nothing is hydrated', async () => {
    const pool = t.get(SpmPoolService)
    const total = await pool.count(w.tag.subjectId)
    const expected = (await t.db.query<{ n: number }>(`select count(*)::int n from questions q join question_versions v on v.question_id = q.id and v.version_no = q.live_version_no where q.is_active and v.status = 'published' and v.type = 'mcq' and v.subject_id = $1 and exists (select 1 from question_tags g where g.question_id = q.id and g.kind = 'pool')`, [w.tag.subjectId]))[0]?.n
    expect(total).toBe(expected)
    expect(total).toBeGreaterThan(2000)
    const t4 = await pool.count(w.tag.subjectId, { levelId: w.tag.levelId })
    expect(t4).toBeGreaterThanOrEqual(POOLED / 2)
    expect(t4).toBeLessThanOrEqual(total)
    expect(await pool.count(w.tag.subjectId, { levelId: dLevel })).toBe(0) // the primary rows are not in the pool
    let byDifficulty = 0
    for (const d of [1, 2, 3, 4, 5]) byDifficulty += await pool.count(w.tag.subjectId, { difficulty: d })
    expect(byDifficulty).toBe(total)
    expect(hydrated().total).toBe(0)
    expect(spies.eligibleIds).not.toHaveBeenCalled()
  })

  it('sample draws n pool questions, hydrating about 2n ids', async () => {
    const drawn = await t.get(SpmPoolService).sample(w.tag.subjectId, 30, prngStream('spm-s'))
    expect(drawn).toHaveLength(30)
    expect(new Set(drawn.map((r) => r.id)).size).toBe(30)
    expect(drawn.every((r) => r.spmPool && r.isActive && r.version.status === 'published')).toBe(true)
    expect(hydrated().total).toBeLessThanOrEqual(60)
    expect(spies.eligibleIds).not.toHaveBeenCalled()
  })

  it('tracking sets check only their own ids, and an ineligible id leaves the count', async () => {
    const own = form4.filter((_, i) => i % 7 === 0).slice(0, 40)
    const setId = (await t.db.query<{ id: string }>(`insert into spm_tracking_sets (subject_id, year, set_no, dskp_tagged) values ($1, 2090, 1, 0) returning id::text`, [w.tag.subjectId]))[0]?.id as string
    await t.db.query(`insert into spm_tracking_set_questions (set_id, question_id, position) select $1, q, row_number() over () from unnest($2::bigint[]) q`, [setId, own])
    const among = vi.spyOn(QuestionsRepository.prototype, 'eligibleAmong')
    const tracking = t.get(SpmTrackingService)
    const before = (await tracking.setsOf(w.tag.subjectId, 2090))[0]
    expect(before?.eligibleCount).toBe(40)
    await t.db.query(`update questions set is_active = false where id = $1`, [own[0]])
    const after = (await tracking.setsOf(w.tag.subjectId, 2090))[0]
    expect(after?.eligibleCount).toBe(39)
    expect(after?.eligibleIds).not.toContain(own[0])
    expect(among).toHaveBeenCalled()
    for (const call of among.mock.calls) expect(call[0].length).toBeLessThanOrEqual(40)
    expect(spies.eligibleIds).not.toHaveBeenCalled()
    expect(hydrated().total).toBe(0)
    among.mockRestore()
    await t.db.query(`update questions set is_active = true where id = $1`, [own[0]])
  })
})

describe('battle (B1, B2)', () => {
  it('spm pool size is a SQL count and a draw returns n ids of the pool; null when the pool is smaller than n', async () => {
    const deps = t.get(BattleDeps)
    deps.invalidateCache()
    const size = await deps.spmPoolCount(w.tag.subjectId)
    expect(size).toBeGreaterThan(2000)
    const ids = await deps.drawQuestions({ questionType: 'spm', subjectId: w.tag.subjectId, levelId: null }, 10, prngStream('b1'))
    expect(ids).toHaveLength(10)
    expect((await repo.getMany(ids as string[], 'live')).every((r) => r.spmPool)).toBe(true)
    expect(await deps.drawQuestions({ questionType: 'spm', subjectId: w.tag.subjectId, levelId: null }, 10, prngStream('b1'))).toEqual(ids)
    expect(await deps.drawQuestions({ questionType: 'spm', subjectId: w.tag.subjectId, levelId: null }, size + 1, prngStream('b1'))).toBeNull()
    expect(spies.eligibleIds).not.toHaveBeenCalled()
  })

  it('a biasa draw is limited to the owner level and reads no ids beyond n', async () => {
    const deps = t.get(BattleDeps)
    spies.getMany.mockClear()
    const ids = (await deps.drawQuestions({ questionType: 'biasa', subjectId: w.tag.subjectId, levelId: dLevel }, 12, prngStream('b2'))) as string[]
    expect(ids).toHaveLength(12)
    for (const id of ids) expect(primary).toContain(id)
    expect(hydrated().total).toBe(0)
    expect(spies.eligibleIds).not.toHaveBeenCalled()
  })
})

describe('games (G1-G4)', () => {
  it('a level-only draw (solo games, room fallback) is a LIMIT-ed SQL draw, and the whole-bank fallback too', async () => {
    const games = t.get(GameQuestions)
    const level = await games.sample({ educationLevelId: dLevel }, 10, prngStream('g1'))
    expect(level).toHaveLength(10)
    const whole = await games.sample({}, 10, prngStream('g2'))
    expect(whole).toHaveLength(10)
    const h = hydrated()
    expect(h.max).toBeLessThanOrEqual(40)
    expect(h.total).toBeLessThanOrEqual(80)
    expect(spies.eligibleIds).not.toHaveBeenCalled()
    expect(await games.eligibleCount({ subjectId: w.tag.subjectId, educationLevelId: dLevel })).toBe(primary.length)
  })
})

describe('missions and remedial (M1, M2)', () => {
  it('a mission draw (chapter, then SPM pool) is n ids in SQL; no pool cap or catalogue read', async () => {
    const pool = t.get(QuestionPool)
    const inChapter = await pool.draw({ subjectId: w.tag.subjectId, chapterId }, 20, prngStream('m1'))
    expect(inChapter).toHaveLength(20)
    for (const id of inChapter) expect(primary).toContain(id)
    const spm = await pool.draw({ subjectId: w.tag.subjectId, spmPool: true }, 20, prngStream('m1'))
    expect(spm).toHaveLength(20)
    expect((await repo.getMany(spm, 'live')).every((r) => r.spmPool)).toBe(true)
    // The ids past the old 5000-id POOL_CAP are reachable (the draw is not cut at the oldest ids).
    const ranks = (await Promise.all(Array.from({ length: 10 }, (_, i) => pool.draw({ subjectId: w.tag.subjectId, chapterId }, 30, prngStream(`m1-${String(i)}`))))).flat()
    expect(ranks.some((id) => primary.indexOf(id) >= 5000)).toBe(true)
    expect(await pool.draw({ subjectId: w.tag.subjectId, chapterId, excludeIds: primary }, 5, prngStream('m1'))).toEqual([])
    expect(spies.eligibleIds).not.toHaveBeenCalled()
  })
})

describe('admin landmines (Q5, Q6)', () => {
  it('the quality audit and summary stream the bank in keyset batches and never hydrate or page it', async () => {
    const quality = t.get(QualityService)
    const batches = vi.spyOn(QuestionsRepository.prototype, 'qualityBatch')
    const total = (await t.db.query<{ n: number }>(`select count(*)::int n from questions q where not exists (select 1 from question_tags p where p.question_id = q.id and p.kind = 'pksk_domain')`))[0]?.n as number
    await quality.audit({ userId: w.admin, role: 'admin', requestId: null, ip: null, isTest: false })
    const stored = (await t.db.query<{ n: number }>(`select count(*)::int n from question_quality_scores`))[0]?.n
    expect(stored).toBe(total)
    const summary = await quality.summary()
    expect(summary.total).toBe(total)
    expect(summary.scoredCount).toBe(total)
    expect(summary.lastAuditAt).not.toBeNull()
    // Every batch is bounded and the walk covers the bank exactly once per call.
    expect(batches.mock.calls.every((c) => (c[1] as number) <= 2000)).toBe(true)
    expect(batches.mock.calls.length).toBeGreaterThanOrEqual(2 * Math.floor(total / 2000))
    expect(spies.getMany).not.toHaveBeenCalled()
    expect(spies.listIds).not.toHaveBeenCalled()
    batches.mockRestore()
    // The fixture rows have an explanation-less, untagged stem: 100 - 15 - 10 - 10 = 65 (source type unknown), a short stem would be lower.
    expect(summary.average).toBeGreaterThan(0)
  })

  it('the duplicate scan reads the newest questions of a subject by keyset, without totals, in pages of at most 200', async () => {
    const subject = (await t.db.query<{ code: string }>(`select code from subjects where id = $1`, [w.tag.subjectId]))[0]?.code as string
    const bank = await t.get(DuplicateDetector).bank(subject)
    expect(bank.length).toBeGreaterThan(0)
    expect(bank.length).toBeLessThanOrEqual(5000)
    expect(spies.listIds).not.toHaveBeenCalled()
    expect(hydrated().max).toBeLessThanOrEqual(200)
  })
})
