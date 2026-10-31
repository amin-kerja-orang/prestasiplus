import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { BattleDeps } from '../../src/modules/battle/battle.deps'
import { GameQuestions } from '../../src/modules/games'
import { Be09PracticeQuestionSource } from '../../src/modules/practice/question-bridge'
import { QuestionsRepository } from '../../src/modules/questions'
import { SpmPoolService } from '../../src/modules/spm/pool.service'
import { bulkMcqs } from '../helpers/bulk-bank'
import { bootMissionsApp, loadWorld, type MissionsTestApp, type World } from '../missions/helpers'

/**
 * QLOAD G4 blocker B1: the per-row shape predicate (`mcqShape`, `singleMcqLeaf`) used to be a plain WHERE in `scope()`, which the
 * planner turned into a cross-product join filter (10k pool rows: 4.5 s, 60k: 160 s). A subject with a pool of 12,000 questions,
 * after ANALYZE, must count in well under a second on every hot path, and the counts must equal an independent SQL count.
 */

const POOL = 12_000
const BOUND_MS = 1000 // generous (the fixed plan runs in about 0.2 s at this size; the broken one took 4 s and grows with the square)
let t: MissionsTestApp
let w: World
let chapter: string

const timed = async <T>(label: string, f: () => Promise<T>): Promise<{ value: T; ms: number }> => {
  const s = performance.now()
  const value = await f()
  const ms = performance.now() - s
  process.stdout.write(`QLOAD shape timing ${label}: ${ms.toFixed(0)} ms\n`)
  return { value, ms }
}

beforeAll(async () => {
  t = await bootMissionsApp({ full: true })
  w = await loadWorld(t)
  chapter = (await t.db.query<{ id: string }>(`insert into chapters (subject_id, education_level_id, name, chapter_number) values ($1, $2, 'Bab prestasi', 1) returning id::text`, [w.tag.subjectId, w.tag.levelId]))[0]?.id as string
  await bulkMcqs(t.db, { count: POOL, subjectId: w.tag.subjectId, levelId: w.tag.levelId, chapterId: chapter, poolEvery: 1, label: 'QL-PERF' })
  await t.db.query('analyze')
}, 300_000)

afterAll(async () => {
  await t.close()
})

const sqlCount = async (extra: string): Promise<number> =>
  (
    await t.db.query<{ n: number }>(
      `select count(*)::int n from questions q join question_versions v on v.question_id = q.id and v.version_no = q.live_version_no
        where q.is_active and v.status = 'approved' and v.type = 'mcq' and v.subject_id = $1 ${extra}`,
      [w.tag.subjectId],
    )
  )[0]?.n as number

describe('shaped counts stay linear at a 12k pool', () => {
  it('battle spmPoolCount', async () => {
    const deps = t.get(BattleDeps)
    deps.invalidateCache()
    const { value, ms } = await timed('battle spmPoolCount', () => deps.spmPoolCount(w.tag.subjectId))
    expect(ms).toBeLessThan(BOUND_MS)
    expect(value).toBe(await sqlCount(`and exists (select 1 from question_tags g where g.question_id = q.id and g.kind = 'pool') and q.group_id is null`))
    expect(value).toBeGreaterThanOrEqual(POOL)
  })

  it('battle spmPoolCount is single flight: concurrent callers share one read', async () => {
    const deps = t.get(BattleDeps)
    deps.invalidateCache()
    const repo = t.get(QuestionsRepository)
    const original = repo.count.bind(repo)
    let calls = 0
    repo.count = async (f) => {
      calls += 1
      return original(f)
    }
    try {
      const all = await Promise.all(Array.from({ length: 8 }, () => deps.spmPoolCount(w.tag.subjectId)))
      expect(new Set(all).size).toBe(1)
      expect(calls).toBe(1)
    } finally {
      repo.count = original
    }
  })

  it('SPM pool count (single-leaf shape)', async () => {
    const pool = t.get(SpmPoolService)
    const { value, ms } = await timed('spm pool count', () => new SpmPoolService(t.get(QuestionsRepository), { get: () => '0' } as never, { now: () => new Date() } as never).count(w.tag.subjectId))
    void pool
    expect(ms).toBeLessThan(BOUND_MS)
    expect(value).toBe(await sqlCount(`and exists (select 1 from question_tags g where g.question_id = q.id and g.kind = 'pool') and q.group_id is null`))
  })

  it('Jutawan gate eligibleCount', async () => {
    const { value, ms } = await timed('games eligibleCount', () => t.get(GameQuestions).eligibleCount({ subjectId: w.tag.subjectId, educationLevelId: w.tag.levelId }))
    expect(ms).toBeLessThan(BOUND_MS)
    expect(value).toBe(await sqlCount(`and v.education_level_id = ${w.tag.levelId} and q.group_id is null and (select count(*) from part_options o join question_parts p on p.id = o.part_id where p.question_version_id = v.id) between 2 and 4`))
  })

  it('practice chapterCounts(exact) and chapterPage', async () => {
    const source = t.get(Be09PracticeQuestionSource)
    const counted = await timed('chapterCounts exact', () => source.chapterCounts([chapter], true))
    expect(counted.ms).toBeLessThan(BOUND_MS)
    expect(counted.value.get(chapter)).toBe(POOL)
    const page = await timed('chapterPage', () => source.chapterPage(chapter, [], 20))
    expect(page.ms).toBeLessThan(BOUND_MS)
    expect(page.value).toHaveLength(20)
  })

  it('sampleIds with a shape does not widen when the eligible set is exhausted', async () => {
    const repo = t.get(QuestionsRepository)
    const ids = await repo.sampleIds({ subjectId: w.tag.subjectId, chapterId: chapter, mcqShape: { minOptions: 2, maxOptions: 4 } }, POOL + 500, 1)
    expect(ids).toHaveLength(POOL)
  })
})
