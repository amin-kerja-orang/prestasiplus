import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { Prisma } from '../../src/db/generated/client'
import { QuestionsRepository } from '../../src/modules/questions'
import { filterOf } from '../../src/modules/questions/serving'
import type { SampleFilter } from '../../src/modules/questions/types'
import { bulkMcqs } from '../helpers/bulk-bank'
import { bootQuestionsApp, questionIdOf, type QuestionsTestApp } from './helpers'

/**
 * `QuestionsRepository.sampleIds` reads a hash-ordered window of cheap candidates and checks them by id (see its doc). Here it is
 * compared with the OLD definition on a real database: one scan of the whole eligibility definition ordered by the same hash. The
 * old shape path (window of 3n rows, shape check on those only) is reproduced as well. Rows are made ineligible by predicates that only the
 * learner macros evaluate (an unresolved figure flag, a leaf without a key), so the cheap scan still proposes them.
 */
describe('sampleIds two-phase draw equals the single scan (database)', () => {
  let t: QuestionsTestApp
  let repo: QuestionsRepository
  let levelId: string
  const subjects: Record<string, string> = {}

  const makeSubject = async (code: string): Promise<string> => {
    const [row] = await t.db.query<{ id: string }>(
      `INSERT INTO subjects (code, name, name_en, color, is_active) VALUES ($1, $1, $1, '#112233', true) RETURNING id::text`,
      [code],
    )
    await t.db.query(`INSERT INTO subject_levels (subject_id, education_level_id) VALUES ($1::bigint, $2::bigint)`, [row!.id, levelId])
    return row!.id
  }

  /** The old draw, as the code had it: the whole definition (`scopeSql`, learner visible) ordered by the hash, LIMIT n. */
  const oldDraw = async (filter: SampleFilter, n: number, seed: number): Promise<string[]> => {
    const { mcqShape, singleMcqLeaf, ...plain } = filter
    const { from, where } = repo.scopeSql({ ...plain, status: 'approved', active: true }, true)
    const rows = async (limit: number): Promise<string[]> => {
      const q = Prisma.sql`SELECT q.id::text AS id ${from} WHERE ${where} ORDER BY hashtextextended(q.id::text, ${seed}::bigint), q.id LIMIT ${limit}`
      return (await t.db.query<{ id: string }>(q.text, q.values.map(String))).map((r) => r.id)
    }
    if (!mcqShape && !singleMcqLeaf) return rows(n)
    const candidates = await rows(n * 3)
    const passing = new Set(await repo.eligibleAmong(candidates, { ...plain, ...(mcqShape ? { mcqShape } : {}), ...(singleMcqLeaf ? { singleMcqLeaf } : {}) }))
    return candidates.filter((id) => passing.has(id)).slice(0, n)
  }

  /** The first n ids of the whole order that pass everything, however deep (what a draw that is never short would return). */
  const exactDraw = async (filter: SampleFilter, n: number, seed: number): Promise<string[]> => {
    const plain: SampleFilter = { ...filter }
    delete plain.mcqShape
    delete plain.singleMcqLeaf
    const all = await oldDraw(plain, 100_000, seed)
    const passing = new Set(await repo.eligibleAmong(all, filter))
    return all.filter((id) => passing.has(id)).slice(0, n)
  }

  beforeAll(async () => {
    t = await bootQuestionsApp()
    repo = t.app.get(QuestionsRepository)
    await questionIdOf(t.db, 'SEED-MCQ-MATH-T4')
    levelId = (await t.db.query<{ l: string }>(`SELECT education_level_id::text AS l FROM question_versions WHERE number_label = 'SEED-MCQ-MATH-T4'`))[0]!.l
    for (const code of ['TPMIX', 'TPLOW', 'TPTINY', 'TPONE', 'TPNONE', 'TPSHAPE']) subjects[code] = await makeSubject(code)
    // Mixed: 1200 rows, about 15 percent not eligible (a flag nobody dismissed, a leaf without a key).
    await bulkMcqs(t.db, { count: 1200, subjectId: subjects.TPMIX!, levelId, label: 'TP-MIX', poolEvery: 0 })
    await t.db.query(
      `UPDATE question_versions SET stimulus_flag = 'figure_only' WHERE number_label LIKE 'TP-MIX-%' AND substring(number_label from '[0-9]+$')::int % 10 IN (0, 1)`,
    )
    await t.db.query(
      `DELETE FROM answer_keys WHERE part_id IN (SELECT p.id FROM question_parts p JOIN question_versions v ON v.id = p.question_version_id
        WHERE v.number_label LIKE 'TP-MIX-%' AND substring(v.number_label from '[0-9]+$')::int % 20 = 2)`,
    )
    // Low pass rate: 2000 rows, only every 40th is eligible.
    await bulkMcqs(t.db, { count: 2000, subjectId: subjects.TPLOW!, levelId, label: 'TP-LOW' })
    await t.db.query(`UPDATE question_versions SET stimulus_flag = 'figure_only' WHERE number_label LIKE 'TP-LOW-%' AND substring(number_label from '[0-9]+$')::int % 40 <> 0`)
    // Tiny: 5 rows, 3 eligible.
    await bulkMcqs(t.db, { count: 5, subjectId: subjects.TPTINY!, levelId, label: 'TP-TINY' })
    await t.db.query(`UPDATE question_versions SET stimulus_flag = 'figure_only' WHERE number_label IN ('TP-TINY-0', 'TP-TINY-3')`)
    // One eligible row among 2500 that all pass the cheap scan: widening has to run to the end of the candidates.
    await bulkMcqs(t.db, { count: 2500, subjectId: subjects.TPONE!, levelId, label: 'TP-ONE' })
    await t.db.query(`UPDATE question_versions SET stimulus_flag = 'figure_only' WHERE number_label LIKE 'TP-ONE-%' AND number_label <> 'TP-ONE-1777'`)
    // None eligible.
    await bulkMcqs(t.db, { count: 600, subjectId: subjects.TPNONE!, levelId, label: 'TP-NONE' })
    await t.db.query(`UPDATE question_versions SET stimulus_flag = 'figure_only' WHERE number_label LIKE 'TP-NONE-%'`)
    // Shape: 1960 rows whose key names no option (fail the shape, pass every learner macro) and 40 with 4 options (pass).
    await bulkMcqs(t.db, { count: 1960, subjectId: subjects.TPSHAPE!, levelId, label: 'TP-SHAPE-BAD', optionCount: 4, keyIndex: 8 })
    await bulkMcqs(t.db, { count: 40, subjectId: subjects.TPSHAPE!, levelId, label: 'TP-SHAPE-OK', optionCount: 4 })
    await t.db.query(`ANALYZE`)
  }, 120_000)

  afterAll(async () => {
    await t.close()
  })

  const latihTubi = (subject: string): SampleFilter => ({ ...filterOf('latih_tubi_spm', { subjectId: subject }) })
  const plainSpm = (subject: string): SampleFilter => ({ subjectId: subject, type: 'mcq', spmPool: true, ungrouped: true })

  it('mixed bank: the same ids as the old single scan, for several seeds and sizes, plain and shaped', async () => {
    for (const seed of [1, 2, 3, 12345, 2581720956]) {
      for (const n of [5, 10, 40]) {
        for (const f of [plainSpm(subjects.TPMIX!), latihTubi(subjects.TPMIX!), { subjectId: subjects.TPMIX!, type: 'mcq' as const }]) {
          const got = await repo.sampleIds(f, n, seed)
          expect(got, `seed ${String(seed)} n ${String(n)}`).toEqual(await oldDraw(f, n, seed))
          expect(got).toHaveLength(n)
        }
      }
    }
  })

  it('every id drawn is eligible and no ineligible row is ever drawn', async () => {
    const eligible = new Set(await repo.eligibleAmong((await t.db.query<{ id: string }>(`SELECT q.id::text id FROM questions q JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.live_version_no WHERE v.subject_id = $1::bigint`, [subjects.TPMIX])).map((r) => r.id), latihTubi(subjects.TPMIX!)))
    expect(eligible.size).toBeGreaterThan(800)
    expect(eligible.size).toBeLessThan(1200)
    for (const seed of [7, 8, 9]) for (const id of await repo.sampleIds(latihTubi(subjects.TPMIX!), 200, seed)) expect(eligible.has(id)).toBe(true)
  })

  it('narrow and wide requests of one seed agree (prefix property)', async () => {
    const f = latihTubi(subjects.TPMIX!)
    const small = await repo.sampleIds(f, 10, 42)
    const big = await repo.sampleIds(f, 100, 42)
    expect(big.slice(0, 10)).toEqual(small)
    expect(await repo.sampleIds(f, 10, 42)).toEqual(small)
    expect(await repo.sampleIds(f, 10, 43)).not.toEqual(small)
  })

  it('low pass rate (1 in 40): the draw is the same as the old scan, and is full', async () => {
    const f = plainSpm(subjects.TPLOW!)
    for (const seed of [1, 2, 3]) {
      const got = await repo.sampleIds(f, 20, seed)
      expect(got).toHaveLength(20)
      expect(got).toEqual(await oldDraw(f, 20, seed))
    }
  })

  it('low pass rate with the shape check: full draws that the old 3n window could not fill', async () => {
    const f = latihTubi(subjects.TPLOW!)
    for (const seed of [1, 2, 3]) {
      const got = await repo.sampleIds(f, 20, seed)
      expect(got).toEqual(await exactDraw(f, 20, seed))
      expect(got).toHaveLength(20)
      expect(got).toEqual(await oldDraw(f, 20, seed)) // every row of this subject passes the shape, so the old draw is full too: same ids
    }
  })

  it('shape pass rate of 2 percent: the old 3n window comes up short, the draw now fills and is the true prefix of the order', async () => {
    const f = latihTubi(subjects.TPSHAPE!)
    for (const seed of [1, 2, 3]) {
      const old = await oldDraw(f, 20, seed)
      expect(old.length, 'the old draw is short here (it checked 60 rows only)').toBeLessThan(20)
      const got = await repo.sampleIds(f, 20, seed)
      expect(got).toHaveLength(20)
      expect(got).toEqual(await exactDraw(f, 20, seed))
      expect(got.slice(0, old.length)).toEqual(old) // what the old draw did return is the start of the new one
    }
    expect(await repo.sampleIds(f, 100, 1)).toHaveLength(40) // exhaustion: all 40 passing rows, no more
  })

  it('tiny subject: all of its eligible rows, never more', async () => {
    const f = latihTubi(subjects.TPTINY!)
    const got = await repo.sampleIds(f, 10, 5)
    expect(got).toHaveLength(3)
    expect([...got].sort()).toEqual([...(await oldDraw(plainSpm(subjects.TPTINY!), 10, 5))].sort())
    expect(await repo.sampleIds(f, 2, 5)).toHaveLength(2)
    expect(await repo.sampleIds({ subjectId: '999999999' }, 10, 5)).toEqual([])
  })

  it('exhaustion: one eligible row among 2500 candidates is found; none gives an empty draw', async () => {
    const only = (await t.db.query<{ id: string }>(`SELECT q.id::text id FROM questions q JOIN question_versions v ON v.question_id = q.id WHERE v.number_label = 'TP-ONE-1777'`))[0]!.id
    for (const seed of [1, 2, 3]) {
      expect(await repo.sampleIds(latihTubi(subjects.TPONE!), 10, seed)).toEqual([only])
      expect(await repo.sampleIds(plainSpm(subjects.TPONE!), 10, seed)).toEqual([only])
    }
    expect(await repo.sampleIds(latihTubi(subjects.TPNONE!), 10, 1)).toEqual([])
    expect(await repo.sampleIds({ subjectId: subjects.TPNONE!, type: 'mcq' }, 10, 1)).toEqual([])
  })
})
