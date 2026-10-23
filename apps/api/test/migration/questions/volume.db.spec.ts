/**
 * QLOAD volume check, behind `QLOAD_VOLUME=1` (it takes minutes): `QLOAD_VOLUME_N` synthetic questions (default 50,000, about
 * four options each) are generated INSIDE the database into `archive_cloud`, then dry-run, apply, a re-run and the rollback are
 * timed and the counts asserted. The timings are printed (`QLOAD volume:` lines) so they can be quoted per 100,000 questions.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { rollbackLegacy } from '../../../src/migration/verify'
import { bootQuestions, questionTableCounts, type QuestionsHarness } from './helpers'

const enabled = process.env.QLOAD_VOLUME === '1'
const N = Number(process.env.QLOAD_VOLUME_N ?? 50_000)
const HOUR = 3_600_000
const d = enabled ? describe : describe.skip

let h: QuestionsHarness
const secs = (t0: number): string => ((Date.now() - t0) / 1000).toFixed(1)
const log = (line: string): void => void process.stdout.write(`QLOAD volume: ${line}\n`)

beforeAll(async () => {
  if (!enabled) return
  h = await bootQuestions()
}, HOUR)
afterAll(async () => {
  await h?.close()
})

d(`volume (${N} questions)`, () => {
  // Every 20th question is a draft (excluded), every 50th (not a multiple of 20) keeps only two options (rejected),
  // every 7th is a Tingkatan 4 question (pool tag); levels 1 and 2, subjects 1 and 2, chapters 1 to 3.
  const draft = Math.floor(N / 20)
  const two = Array.from({ length: N }, (_, k) => k + 1).filter((i) => i % 50 === 1 && i % 20 !== 0).length
  const eligible = N - draft
  const loaded = eligible - two
  const pooled = Array.from({ length: N }, (_, k) => k + 1).filter((i) => i % 20 !== 0 && i % 50 !== 1 && i % 7 === 0).length

  it('generates the archive', async () => {
    const t0 = Date.now()
    await h.pool.query(
      `insert into archive_cloud.questions (id, subject_id, education_level_id, chapter_id, topic_id, difficulty_level, type, status, body, explanation, created_at, updated_at)
       select i, 1 + i % 2, case when i % 7 = 0 then 2 else 1 end, 1 + i % 3, null, (1 + i % 5)::text, 'mcq',
              case when i % 20 = 0 then 'draf' else 'diluluskan' end,
              'Soalan sintetik nombor ' || i || ': ' || repeat('teks panjang ', 20) || '?', 'Penjelasan sintetik ' || i, now(), now()
         from generate_series(1, $1::int) i`,
      [N],
    )
    await h.pool.query(
      `insert into archive_cloud.question_options (id, question_id, label, body, is_correct)
       select i * 10 + k, i, substr('ABCD', k, 1), 'Pilihan ' || k || ' soalan ' || i || ' ' || repeat('x', 30), case when k = 1 + i % 4 then '1' else '0' end
         from generate_series(1, $1::int) i, generate_series(1, 4) k
        where not (i % 50 = 1 and k > 2)`,
      [N],
    )
    await h.pool.query('analyze archive_cloud.questions')
    await h.pool.query('analyze archive_cloud.question_options')
    log(`generated ${N} questions in ${secs(t0)} s`)
    expect(await h.count('archive_cloud.questions')).toBe(N)
  }, HOUR)

  it('dry-run, apply, re-run (dry-run + apply)', async () => {
    const before = await questionTableCounts(h.pool)
    const opts = { batchSize: 1000 }
    let t0 = Date.now()
    const dry = await h.run('dry-run', opts)
    log(`dry-run ${secs(t0)} s`)
    expect(dry.report.status).toBe('succeeded')
    expect(await questionTableCounts(h.pool)).toEqual(before)

    t0 = Date.now()
    const apply = await h.run('apply', opts)
    const applySecs = (Date.now() - t0) / 1000
    log(`apply ${applySecs.toFixed(1)} s (${((applySecs * 100_000) / N).toFixed(0)} s per 100k)`)
    expect(apply.report.recon[0]).toMatchObject({ sourceCount: N, eligibleCount: eligible, loaded, rejected: two, status: 'ok' })
    const after = await questionTableCounts(h.pool)
    expect(after.questions - before.questions).toBe(loaded)
    expect(after.question_versions - before.question_versions).toBe(loaded)
    expect(after.part_options - before.part_options).toBe(loaded * 4)
    expect(after.answer_keys - before.answer_keys).toBe(loaded)
    expect(after.question_tags - before.question_tags).toBe(pooled)
    expect(await h.count('etl_id_map', `t.entity = 'questions'`)).toBe(loaded)

    t0 = Date.now()
    const dry2 = await h.run('dry-run', opts)
    log(`re-run dry-run ${secs(t0)} s`)
    t0 = Date.now()
    const again = await h.run('apply', opts)
    log(`re-run apply ${secs(t0)} s`)
    expect(dry2.report.status).toBe('succeeded')
    expect(again.report.counters.questions).toMatchObject({ inserted: 0, updated: 0, unchanged: loaded })
    expect(await questionTableCounts(h.pool)).toEqual(after)
  }, HOUR)

  it('rollback', async () => {
    const db = h.h.env.db.name
    const env = { ...h.runEnv, PP_ALLOW_MIGRATE_ROLLBACK: '1', PP_MIGRATE_TARGET_DB: db }
    const t0 = Date.now()
    const report = await rollbackLegacy({ pool: h.pool, env, source: 'cloud', confirmDb: db })
    const s = (Date.now() - t0) / 1000
    log(`rollback ${s.toFixed(1)} s (${((s * 100_000) / N).toFixed(0)} s per 100k)`)
    expect(report.tables.find((t) => t.table === 'questions')?.deleted).toBe(loaded)
    expect(await h.count('questions', `t.legacy_source = 'cloud'`)).toBe(0)
  }, HOUR)
})
