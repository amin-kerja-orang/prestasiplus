import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { mulberry32, prngStream } from '../../src/db/prng'
import { spmSeed } from '../../prisma/seed/spm'
import { FixedClock } from '../../src/db/clock'
import { BattleDeps } from '../../src/modules/battle/battle.deps'
import { QuestionPool } from '../../src/modules/classes/missions/question-pool'
import { GameQuestions } from '../../src/modules/games'
import { JutawanService } from '../../src/modules/games/solo/jutawan/jutawan.service'
import { DuplicateDetector } from '../../src/modules/intake/workflow/duplicate-detector'
import { Be09PracticeQuestionSource } from '../../src/modules/practice/question-bridge'
import { ELIGIBLE_IDS_MAX, QuestionsRepository } from '../../src/modules/questions'
import { AUDIT_RUNNING_MESSAGE, QualityService } from '../../src/modules/questions/workflow/quality/quality.service'
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
let otherLevel: string
let chapterA: string
let chapterB: string
let fiveOption: string[]
/** Five-option questions keyed E at an OFFERED level (T4): in the SPM pool for practice and the hub, never in the battle size. */
let fiveOptionSpm: string[]
let fourOption: string[]
/** R1-B06: SPM-servable level ids (T4, T5): the pool is defined by level, not by the legacy pool tag. */
let offeredIds: Set<string>

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
        where sl.subject_id = $1 and l.code in ('T4','T5') and l.id <> $2::bigint and exists (select 1 from chapters c where c.subject_id = sl.subject_id and c.education_level_id = l.id and c.is_active) order by l.sort_order, l.id limit 1`,
      [w.tag.subjectId, w.tag.levelId],
    )
  )[0]?.id as string
  chapterId = (await t.db.query<{ id: string }>(`select id::text id from chapters where subject_id = $1 and education_level_id = $2 and is_active order by id limit 1`, [w.tag.subjectId, dLevel]))[0]?.id as string
  expect(dLevel && chapterId).toBeTruthy()
  s1 = await client(t, STUDENT_1)
  // Secondary-only: the fixture level is a real Tingkatan (the Darjah levels are hidden), which the seed already fills; switch those rows off so the bulk rows are the only eligible ones.
  await t.db.query(`update questions set is_active = false where id in (select question_id from question_versions where subject_id = $1 and education_level_id = $2)`, [w.tag.subjectId, dLevel])
  repo = t.get(QuestionsRepository)
  offeredIds = new Set((await t.db.query<{ id: string }>(`select id::text id from education_levels where code in ('T4','T5')`)).map((r) => r.id))
  primary = await bulkMcqs(t.db, { count: SUBJECT_BIG + 300, subjectId: w.tag.subjectId, levelId: dLevel, chapterId, heldEvery: 20, draftEvery: 25, label: 'QL-P' })
  form4 = await bulkMcqs(t.db, { count: POOLED, subjectId: w.tag.subjectId, levelId: w.tag.levelId, poolEvery: 2, heldEvery: 50, label: 'QL-F' })
  otherLevel = (
    await t.db.query<{ id: string }>(`select sl.education_level_id::text id from subject_levels sl join education_levels l on l.id = sl.education_level_id where sl.subject_id = $1 and l.stage <> 'primary' and l.is_active and sl.education_level_id not in ($2, $3) order by l.sort_order limit 1`, [w.tag.subjectId, dLevel, w.tag.levelId])
  )[0]?.id as string
  expect(otherLevel).toBeTruthy()
  // Five-option questions keyed E (the loader admits 3 to 8 options): never battle- or games-servable.
  fiveOption = await bulkMcqs(t.db, { count: 300, subjectId: w.tag.subjectId, levelId: otherLevel, optionCount: 5, keyIndex: 5, poolEvery: 1, label: 'QL-E5' })
  fiveOptionSpm = await bulkMcqs(t.db, { count: 40, subjectId: w.tag.subjectId, levelId: w.tag.levelId, optionCount: 5, keyIndex: 5, label: 'QL-E5S' })
  fourOption = await bulkMcqs(t.db, { count: 45, subjectId: w.tag.subjectId, levelId: otherLevel, poolEvery: 1, label: 'QL-E4' })
  // Two chapters at that level: A holds 3 plain MCQs and one with two parts (not servable); B holds 2.
  const mk = async (n: number): Promise<string> =>
    (await t.db.query<{ id: string }>(`insert into chapters (subject_id, education_level_id, name, chapter_number) values ($1, $2, $3, $4) returning id::text`, [w.tag.subjectId, otherLevel, `Bab QL ${String(n)}`, 900 + n]))[0]?.id as string
  chapterA = await mk(1)
  chapterB = await mk(2)
  const inA = await bulkMcqs(t.db, { count: 4, subjectId: w.tag.subjectId, levelId: otherLevel, chapterId: chapterA, label: 'QL-CA' })
  await bulkMcqs(t.db, { count: 2, subjectId: w.tag.subjectId, levelId: otherLevel, chapterId: chapterB, label: 'QL-CB' })
  await t.db.query(
    `insert into question_parts (question_version_id, position, depth, label, prompt_ms, marks, mode)
     select v.id, 2, 1, '2', 'Bahagian kedua.', 1, 'mcq' from question_versions v where v.question_id = $1 and v.version_no = 1`,
    [inA[inA.length - 1]],
  )
  // The second part is a complete MCQ leaf too (three options, a key), so the bank can hydrate the question; it is just not servable.
  await t.db.query(
    `with p as (select p.id from question_parts p join question_versions v on v.id = p.question_version_id where v.question_id = $1 and p.position = 2),
          o as (insert into part_options (part_id, label, body_ms, position) select p.id, l.label, 'Pilihan ' || l.label, l.pos from p cross join (values ('A', 1), ('B', 2), ('C', 3)) l(label, pos) returning 1)
     insert into answer_keys (part_id, kind, content) select id, 'option', '{"kind":"option","correct":"A"}'::jsonb from p`,
    [inA[inA.length - 1]],
  )
  // Fresh planner statistics, as autovacuum gives after a real load.
  await t.db.query('analyze')
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
    expect((await repo.getMany(pooled, 'live')).every((r) => offeredIds.has(r.version.educationLevelId ?? ''))).toBe(true)
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
    const expected = (await t.db.query<{ n: number }>(`select count(*)::int n from questions q join question_versions v on v.question_id = q.id and v.version_no = q.live_version_no where q.is_active and v.status = 'published' and v.type = 'mcq' and v.subject_id = $1 and exists (select 1 from education_levels ol where ol.id = v.education_level_id and ol.code in ('T4','T5') and ol.is_active) and exists (select 1 from subject_levels sl where sl.subject_id = v.subject_id and sl.education_level_id = v.education_level_id) and not exists (select 1 from question_tags g where g.question_id = q.id and g.kind = 'pksk_domain')`, [w.tag.subjectId]))[0]?.n
    expect(total).toBe(expected)
    expect(total).toBeGreaterThan(2000)
    expect(cells.every((c) => offeredIds.has(c.levelId ?? ''))).toBe(true) // only the offered levels (T4, T5) are in the pool
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
    const expected = (await t.db.query<{ n: number }>(`select count(*)::int n from questions q join question_versions v on v.question_id = q.id and v.version_no = q.live_version_no where q.is_active and v.status = 'published' and v.type = 'mcq' and v.subject_id = $1 and exists (select 1 from education_levels ol where ol.id = v.education_level_id and ol.code in ('T4','T5') and ol.is_active) and exists (select 1 from subject_levels sl where sl.subject_id = v.subject_id and sl.education_level_id = v.education_level_id)`, [w.tag.subjectId]))[0]?.n
    expect(total).toBe(expected)
    expect(total).toBeGreaterThan(2000)
    const t4 = await pool.count(w.tag.subjectId, { levelId: w.tag.levelId })
    expect(t4).toBeGreaterThanOrEqual(POOLED / 2)
    expect(t4).toBeLessThanOrEqual(total)
    // dLevel is a Tingkatan (secondary-only): its eligible rows are SPM-servable by level alone (no pool tag, R1-B06).
    expect(await pool.count(w.tag.subjectId, { levelId: dLevel })).toBe(primary.length)
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
    expect(drawn.every((r) => offeredIds.has(r.version.educationLevelId ?? '') && r.isActive && r.version.status === 'published')).toBe(true)
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
    expect((await repo.getMany(ids as string[], 'live')).every((r) => offeredIds.has(r.version.educationLevelId ?? ''))).toBe(true)
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
    expect((await repo.getMany(spm, 'live')).every((r) => offeredIds.has(r.version.educationLevelId ?? ''))).toBe(true)
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

describe('servable shape in SQL (battle, games, BR-16)', () => {
  it('a five-option question keyed E is never drawn into a battle, and the pool count and the draw agree', async () => {
    const deps = t.get(BattleDeps)
    deps.invalidateCache()
    const banned = new Set([...fiveOption, ...fiveOptionSpm])
    for (let i = 0; i < 30; i++) {
      const ids = (await deps.drawQuestions({ questionType: 'biasa', subjectId: w.tag.subjectId, levelId: otherLevel }, 10, prngStream(`e5-${String(i)}`))) as string[]
      expect(ids).toHaveLength(10)
      for (const id of ids) expect(banned.has(id), `${id} has five options`).toBe(false)
    }
    // Every drawn question grades: the key index is 0..3.
    const ids = (await deps.drawQuestions({ questionType: 'spm', subjectId: w.tag.subjectId, levelId: null }, 25, prngStream('e5-spm'))) as string[]
    for (const id of ids) {
      expect(banned.has(id)).toBe(false)
      expect(await deps.arenaQuestion(id)).not.toBeNull()
      expect(await deps.gradeAnswer(id, 0)).not.toBeNull()
    }
    // The size shown in the lobby is the size a draw can serve (count and draw share the same filter).
    const size = await deps.spmPoolCount(w.tag.subjectId)
    expect(await deps.drawQuestions({ questionType: 'spm', subjectId: w.tag.subjectId, levelId: null }, size, prngStream('e5-all'))).toHaveLength(size)
    expect(await deps.drawQuestions({ questionType: 'spm', subjectId: w.tag.subjectId, levelId: null }, size + 1, prngStream('e5-all'))).toBeNull()
    // The five-option questions at an offered level (T4) are in the SPM pool for practice and the hub, but not in the battle size.
    expect(await t.get(SpmPoolService).count(w.tag.subjectId)).toBe(size + fiveOptionSpm.length)
  })

  it('games draw only 2 to 4 option questions, and still fill the draw when most of the level has five options', async () => {
    const games = t.get(GameQuestions)
    const banned = new Set(fiveOption)
    const drawn = await games.sample({ subjectId: w.tag.subjectId, educationLevelId: otherLevel }, 20, prngStream('e5-g'))
    expect(drawn).toHaveLength(20)
    for (const s of drawn) {
      expect(banned.has(s.question.id)).toBe(false)
      expect(s.question.options.length).toBeLessThanOrEqual(4)
    }
    expect(fourOption.length).toBeGreaterThan(20)
  })

  it('BR-16: a chapter holding one non-servable MCQ counts only the servable ones, so the next chapter can unlock', async () => {
    const source = t.get(Be09PracticeQuestionSource)
    expect((await source.chapterCounts([chapterA])).get(chapterA)).toBe(4) // the cheap count (BR-15 list) sees four plain MCQs
    const counts = await source.chapterCounts([chapterA, chapterB], true)
    expect(counts.get(chapterA)).toBe(3) // the exact count (BR-16) drops the two-part one
    expect(counts.get(chapterB)).toBe(2)
    expect(await source.chapterPage(chapterA, [], 10)).toHaveLength(3)
    const locked = await s1.post('/practice/sessions', { mode: 'chapter', chapterId: chapterB, count: 5 })
    expect(locked.status).toBe(409)
    const started = await s1.post('/practice/sessions', { mode: 'chapter', chapterId: chapterA, count: 10 })
    expect(started.status, JSON.stringify(started.body)).toBe(201)
    const served = started.body.data.questions as { id: string }[]
    expect(served).toHaveLength(3)
    for (const q of served) {
      const r = await s1.post(`/practice/sessions/${started.body.data.sessionId as string}/check-answer`, { questionId: q.id, selectedOptionId: 0 })
      expect(r.status, JSON.stringify(r.body)).toBe(200)
    }
    expect((await s1.post(`/practice/sessions/${started.body.data.sessionId as string}/submit`, { timeSpent: 30 })).status).toBe(200)
    const open = await s1.post('/practice/sessions', { mode: 'chapter', chapterId: chapterB, count: 5 })
    expect(open.status, JSON.stringify(open.body)).toBe(201)
  })

  it('excludeIds is one array parameter: a very long exclude list works', async () => {
    const f = { subjectId: w.tag.subjectId, educationLevelId: dLevel, excludeIds: primary.slice(0, 5500) }
    const ids = await repo.sampleIds(f, 50, 3)
    expect(ids).toHaveLength(50)
    const skip = new Set(primary.slice(0, 5500))
    for (const id of ids) expect(skip.has(id)).toBe(false)
  })
})

describe('seed spm no longer loads a whole subject', () => {
  it('builds the Tracking A set of a subject whose pool is above the eligibleIds cap', async () => {
    await t.db.query(`insert into spm_subject_configs (subject_id, grp, display_order) values ($1, 'teras', 1) on conflict do nothing`, [w.tag.subjectId])
    const poolSize = await t.get(SpmPoolService).count(w.tag.subjectId)
    expect(poolSize).toBeGreaterThan(2000)
    await spmSeed.run({ profile: 'poc', clock: new FixedClock(new Date('2026-10-19T01:00:00Z')), prng: () => prngStream('seed'), prisma: t.db.prisma } as never)
    const set = await t.db.query<{ n: number; id: string }>(
      `select s.id::text id, (select count(*)::int from spm_tracking_set_questions q where q.set_id = s.id) n from spm_tracking_sets s where s.subject_id = $1 and s.year = 2026 and s.set_no = 1`,
      [w.tag.subjectId],
    )
    expect(set).toHaveLength(1)
    expect(set[0]?.n).toBe(poolSize)
    const ordered = await t.db.query<{ ok: boolean }>(`select bool_and(question_id > prev) ok from (select question_id, lag(question_id, 1, 0) over (order by position) prev from spm_tracking_set_questions where set_id = $1) x`, [set[0]?.id])
    expect(ordered[0]?.ok).toBe(true)
  })
})

describe('quality audit timing (Q5)', () => {
  it('audits the whole fixture bank in short per-batch statements (no long transaction)', async () => {
    const quality = t.get(QualityService)
    const total = (await t.db.query<{ n: number }>(`select count(*)::int n from questions`))[0]?.n as number
    const started = performance.now()
    await quality.audit({ userId: w.admin, role: 'admin', requestId: null, ip: null, isTest: false })
    const ms = performance.now() - started
    process.stdout.write(`QLOAD audit timing: ${String(total)} questions in ${String(Math.round(ms))} ms (${(ms / total).toFixed(2)} ms per question)\n`)
    expect((await t.db.query<{ n: number }>(`select count(*)::int n from question_quality_scores`))[0]?.n).toBe(total)
    // 300k questions at this rate stay far below one hour; the old single transaction was capped at 120 s.
    expect((ms / total) * 300_000).toBeLessThan(600_000)
    expect((await t.db.query<{ n: number }>(`select count(*)::int n from quality_audits where finished_at is not null`))[0]?.n).toBeGreaterThan(0)
  })
})

describe('G4 follow-ups', () => {
  it('audit: an unfinished fresh run refuses a second one (409), a stale one does not, overlapping runs keep every score', async () => {
    const quality = t.get(QualityService)
    const actor = { userId: w.admin, role: 'admin', requestId: null, ip: null, isTest: false } as const
    const total = (await t.db.query<{ n: number }>(`select count(*)::int n from questions`))[0]?.n as number
    const clockNow = (t.clock as { now(): Date }).now()
    const open = (await t.db.query<{ id: string }>(`insert into quality_audits (created_at) values ($1) returning id::text`, [new Date(clockNow.getTime() - 60_000)]))[0]?.id as string
    await expect(quality.audit(actor)).rejects.toMatchObject({ status: 409, message: AUDIT_RUNNING_MESSAGE })
    // The refused run wrote no row of its own.
    expect((await t.db.query<{ n: number }>(`select count(*)::int n from quality_audits where finished_at is null`))[0]?.n).toBe(1)
    // A crashed run older than the window no longer blocks.
    await t.db.query(`update quality_audits set created_at = $2 where id = $1`, [open, new Date(clockNow.getTime() - 2 * 3600_000)])
    const settled = await Promise.allSettled([quality.audit(actor), quality.audit(actor)])
    expect(settled.some((r) => r.status === 'fulfilled')).toBe(true)
    for (const r of settled) if (r.status === 'rejected') expect(r.reason).toMatchObject({ status: 409 })
    // Whatever the interleaving, no score of the finished run was swept away by the other.
    expect((await t.db.query<{ n: number }>(`select count(*)::int n from question_quality_scores`))[0]?.n).toBe(total)
    expect((await t.db.query<{ n: number }>(`select count(*)::int n from question_quality_scores where audit_id is null`))[0]?.n).toBe(0)
    await t.db.query(`delete from quality_audits where finished_at is null`)
  })

  it('Jutawan gate: eligibleCount counts only what a draw can serve (no five-option or two-part questions)', async () => {
    const games = t.get(GameQuestions)
    const count = await games.eligibleCount({ subjectId: w.tag.subjectId, educationLevelId: otherLevel })
    expect(count).toBe(fourOption.length + 5) // the 45 plain ones plus 3 + 2 in the chapters; 300 five-option and the two-part one are out
    const all = (await t.db.query<{ n: number }>(`select count(*)::int n from questions q join question_versions v on v.question_id = q.id and v.version_no = q.live_version_no where q.is_active and v.status = 'published' and v.type = 'mcq' and v.subject_id = $1 and v.education_level_id = $2`, [w.tag.subjectId, otherLevel]))[0]?.n as number
    expect(all).toBeGreaterThan(count + 250)
    expect((await games.sample({ subjectId: w.tag.subjectId, educationLevelId: otherLevel }, count, prngStream('gate'))).length).toBeGreaterThan(0)
  })

  it('SPM pool counts use the same shape as the draw (a pool-tagged two-part question is in neither); timing note', async () => {
    const pool = t.get(SpmPoolService)
    const twoPart = (await t.db.query<{ id: string }>(`select question_id::text id from question_versions v where v.number_label like 'QL-CA-%' and (select count(*) from question_parts p where p.question_version_id = v.id) = 2`))[0]?.id as string
    const before = await pool.count(w.tag.subjectId)
    await t.db.query(`insert into question_tags (question_id, kind, code) values ($1, 'pool', 'spm')`, [twoPart])
    const after = await new SpmPoolService(repo, { get: () => '0' } as never, { now: () => new Date() } as never).count(w.tag.subjectId)
    expect(after).toBe(before)
    const drawn = await pool.sample(w.tag.subjectId, 400, prngStream('shape'))
    expect(drawn.map((r) => r.id)).not.toContain(twoPart)
    const filter = { subjectId: w.tag.subjectId, type: 'mcq', spmPool: true, ungrouped: true, status: 'published', active: true } as const
    const timed = async (f: Parameters<QuestionsRepository['count']>[0]): Promise<number> => {
      const s0 = performance.now()
      await repo.groupCountsByLevelTp(f)
      return performance.now() - s0
    }
    const plain = await timed(filter)
    const shaped = await timed({ ...filter, singleMcqLeaf: true })
    process.stdout.write(`QLOAD pool count timing over ${String(before)} pool rows: plain ${plain.toFixed(0)} ms, with single-leaf shape ${shaped.toFixed(0)} ms\n`)
    await t.db.query(`delete from question_tags where question_id = $1 and kind = 'pool'`, [twoPart])
  })
})

describe('re-G4 minors', () => {
  const actor = () => ({ userId: w.admin, role: 'admin', requestId: null, ip: null, isTest: false }) as const

  it('battle: a rejected read is not cached (the next call re-reads), a resolved one is', async () => {
    const clock = new FixedClock(new Date('2026-10-19T01:00:00Z'))
    const count = vi.fn().mockRejectedValueOnce(new Error('db down')).mockResolvedValue(7)
    const deps = new BattleDeps({} as never, {} as never, {} as never, { count } as never, {} as never, clock)
    await expect(deps.spmPoolCount('1')).rejects.toThrow('db down')
    await expect(deps.spmPoolCount('1')).resolves.toBe(7)
    await expect(deps.spmPoolCount('1')).resolves.toBe(7)
    expect(count).toHaveBeenCalledTimes(2)
  })

  it('Jutawan page: tile counts are read once per subject for N page views within 60 s, in parallel; a failed read is not cached', async () => {
    const clock = new FixedClock(new Date('2026-10-19T01:00:00Z'))
    let inflight = 0
    let peak = 0
    const eligibleCount = vi.fn(async (f: { subjectId: string }) => {
      inflight += 1
      peak = Math.max(peak, inflight)
      await new Promise((r) => setTimeout(r, 20))
      inflight -= 1
      return f.subjectId === '1' ? 5 : 0
    })
    const svc = new JutawanService(
      {} as never,
      { stats: async () => ({}) } as never,
      {} as never,
      { eligibleCount } as never,
      { levelIdOfGrade: async () => '9' } as never,
      { subjects: async () => [{ id: 1n, code: 'MATH', name: 'Matematik' }, { id: 2n, code: 'BI', name: 'English' }] } as never,
      {} as never,
      clock,
    )
    const caller = { userId: '1' } as never
    const pages = await Promise.all([svc.page(caller, '10'), svc.page(caller, '10'), svc.page(caller, '10')])
    await svc.page(caller, '10')
    expect(eligibleCount).toHaveBeenCalledTimes(2)
    expect(peak).toBe(2)
    expect((pages[0] as { subjects: { id: string; count: number }[] }).subjects).toEqual([expect.objectContaining({ id: '1', count: 5 })])
    clock.set(new Date(clock.now().getTime() + 61_000))
    await svc.page(caller, '10')
    expect(eligibleCount).toHaveBeenCalledTimes(4)
    eligibleCount.mockRejectedValueOnce(new Error('down'))
    clock.set(new Date(clock.now().getTime() + 61_000))
    await expect(svc.page(caller, '10')).rejects.toThrow('down')
    await svc.page(caller, '10')
    expect(eligibleCount.mock.calls.length).toBeGreaterThanOrEqual(6)
  })

  it('quality summary: the action list is the 200 highest ids (id descending) while the totals count every action row', async () => {
    const quality = t.get(QualityService)
    await quality.audit(actor())
    await t.db.query(`update question_quality_scores set score = 10`)
    const sum = await quality.summary()
    const scored = (await t.db.query<{ n: number }>(`select count(*)::int n from question_quality_scores`))[0]?.n as number
    expect(scored).toBeGreaterThan(400) // beyond the 2 x 200 trim point, so the bounded selection really ran
    expect(sum.activeActionCount).toBe(scored)
    expect(sum.buckets.lemahKritikal).toBe(scored)
    expect(sum.actionList).toHaveLength(200)
    const top = await t.db.query<{ id: string }>(`select question_id::text id from question_quality_scores order by question_id desc limit 200`)
    expect(sum.actionList.map((r) => r.id)).toEqual(top.map((r) => r.id))
  })

  it('audit: a crashed (stale, unfinished) run is removed when the next run starts; a fresh one is kept and blocks', async () => {
    const quality = t.get(QualityService)
    const now = (t.clock as { now(): Date }).now()
    await t.db.query(`delete from quality_audits where finished_at is null`)
    await t.db.query(`insert into quality_audits (created_at) values ($1), ($2)`, [new Date(now.getTime() - 3 * 3600_000), new Date(now.getTime() - 2 * 3600_000)])
    await quality.audit(actor())
    expect((await t.db.query<{ n: number }>(`select count(*)::int n from quality_audits where finished_at is null`))[0]?.n).toBe(0)
    await t.db.query(`insert into quality_audits (created_at) values ($1)`, [new Date(now.getTime() - 60_000)])
    await expect(quality.audit(actor())).rejects.toMatchObject({ status: 409 })
    expect((await t.db.query<{ n: number }>(`select count(*)::int n from quality_audits where finished_at is null`))[0]?.n).toBe(1)
    await t.db.query(`delete from quality_audits where finished_at is null`)
  })
})
