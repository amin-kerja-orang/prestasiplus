/**
 * Card AC5: EXPLAIN ANALYZE and the median of 20 runs of the dashboard read for 20 students and a generated
 * 100k-row answer table. SKIPPED unless BE13_PERF=1 (it builds a large table). Optional:
 *   BE13_PERF_ROWS (default 100000), BE13_PERF_QUESTIONS (default 130000), BE13_PERF_BANK_TTL_MS (default 10000), BE13_PERF_OUT (file for the report).
 *
 *   BE13_PERF=1 npm run be:test -- test/practice-reads/overview/perf
 */
import { writeFileSync } from 'node:fs'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { idFromString } from '../../../src/db/ids'
import { OverviewService } from '../../../src/modules/practice/reads/overview/overview.service'
import { bootOverviewApp, chapterIdOf, idOf } from './helpers'
import type { CurriculumTestApp } from '../../curriculum/helpers'

const ENABLED = process.env.BE13_PERF === '1'
const ROWS = Number(process.env.BE13_PERF_ROWS ?? 100_000)
const QUESTIONS = Number(process.env.BE13_PERF_QUESTIONS ?? 130_000)
const RUNS = 20
/** 0 = every read counts the bank (worst case); 10000 = the production default. */
const TTL = Number(process.env.BE13_PERF_BANK_TTL_MS ?? 10_000)

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? (s[m] as number) : ((s[m - 1] as number) + (s[m] as number)) / 2
}

describe.skipIf(!ENABLED)('AC5: dashboard read on 20 students and a generated answer table', () => {
  let t: CurriculumTestApp
  const report: string[] = []

  beforeAll(async () => {
    t = await bootOverviewApp({ withArticles: true, bankTtlMs: TTL })
    const math = await idOf(t.db, 'subjects', 'MATH')
    const bm = await idOf(t.db, 'subjects', 'BM')
    const sej = await idOf(t.db, 'subjects', 'SEJ')
    const d1 = await idOf(t.db, 'education_levels', 'D1')
    const chapter = await chapterIdOf(t.db, 'MATH', 'D1', 1)
    await t.db.query(
      `insert into users (name, email, grade, school_id)
       select 'Murid Ujian ' || g, 'perf.' || g || '@example.test', 3, (select school_id from users where email = 'pelajar@demo.test') from generate_series(1, 20) g`,
    )
    // a realistic bank: published objective questions over three subjects
    await t.db.query(
      `with q as (insert into questions (source_type, live_version_no, is_active) select 'manual', 1, true from generate_series(1, $1::int) returning id)
       insert into question_versions (question_id, version_no, status, type, stem_ms, subject_id, education_level_id, chapter_id, difficulty_tp, published_at)
       select id, 1, 'approved', 'mcq', 'Soalan prestasi ' || id, (array[$2::bigint, $3::bigint, $4::bigint])[1 + (id % 3)], $5::bigint,
              case when id % 7 = 0 then $6::bigint else null end, 1 + (id % 6), now() from q`,
      [QUESTIONS, math, bm, sej, d1, chapter],
    )
    await t.db.query(
      `insert into practice_answers (user_id, question_id, subject_id, chapter_id, is_correct, answered_at)
       select u.id, 1 + (g * 7919 % $1::int), (array[$2::bigint, $3::bigint, $4::bigint])[1 + (g % 3)], case when g % 5 = 0 then $5::bigint else null end,
              (g % 3 <> 0), timestamptz '2026-10-19 12:00+08' - ((g * 104729 % 180) || ' days')::interval - ((g % 86400) || ' seconds')::interval
         from (select id, row_number() over (order by id) as n from users where email like 'perf.%') u
         cross join generate_series(1, ($6::int / 20)) g`,
      [QUESTIONS, math, bm, sej, chapter, ROWS],
    )
    await t.db.query('analyze practice_answers')
    await t.db.query('analyze questions')
    await t.db.query('analyze question_versions')
  }, 600_000)

  afterAll(async () => {
    if (process.env.BE13_PERF_OUT) writeFileSync(process.env.BE13_PERF_OUT, report.join('\n'))
    await t.close()
  })

  it('records the plan of the answer query and the median of 20 dashboard reads', async () => {
    const total = Number((await t.db.query<{ n: string }>('select count(*) as n from practice_answers'))[0]?.n)
    const users = await t.db.query<{ id: string }>(`select id::text from users where email like 'perf.%' order by id`)
    expect(users.length).toBe(20)
    const uid = users[0]?.id as string
    report.push(`answers: ${total}, students: ${users.length}, bank questions: ${QUESTIONS}, bank counts reused for ${TTL} ms`)

    const plan = await t.db.query<Record<string, string>>(
      `explain (analyze, buffers) select count(*) as answered, count(*) filter (where is_correct) as correct from practice_answers
        where user_id = ${idFromString(uid)} and answered_at >= '2026-10-19 00:00+08' and answered_at < '2026-10-26 00:00+08' and is_test = false`,
    )
    report.push('--- EXPLAIN (ANALYZE, BUFFERS): this-week answer figures of one student ---', ...plan.map((r) => r['QUERY PLAN'] as string))

    const service = t.app.get(OverviewService)
    const runs = async (userId: string): Promise<number[]> => {
      const out: number[] = []
      for (let i = 0; i < RUNS + 1; i++) {
        const t0 = performance.now()
        await service.dashboard({ userId, role: 'student', isTest: false })
        if (i > 0) out.push(performance.now() - t0) // the first run warms the plan cache
      }
      return out
    }
    const all: number[] = []
    for (const u of users.slice(0, 4)) all.push(median(await runs(u.id)))
    const ms = await runs(uid)
    report.push(`--- dashboard service read, ${RUNS} runs for one student: median ${median(ms).toFixed(1)} ms, max ${Math.max(...ms).toFixed(1)} ms`)
    report.push(`--- median of the per-student medians (4 students): ${median(all).toFixed(1)} ms`)

    const bank = await t.db.query<Record<string, string>>(
      `explain (analyze, buffers) select v.subject_id, v.education_level_id as level_id, v.difficulty_tp as tp, (v.type = 'mcq') as mcq, count(*)::int as n
         from questions q join question_versions v on v.question_id = q.id and v.version_no = q.live_version_no
        where q.is_active and v.status = 'approved' group by 1, 2, 3, 4`,
    )
    report.push('--- EXPLAIN (ANALYZE, BUFFERS): bank matrix ---', ...bank.map((r) => r['QUERY PLAN'] as string))
    console.log(report.join('\n'))
    expect(median(ms)).toBeGreaterThan(0)
  }, 600_000)
})
