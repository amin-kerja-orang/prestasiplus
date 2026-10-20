/**
 * Card AC8: EXPLAIN ANALYZE of the answer read and the median of 20 heatmap reads for one of 20 students on a
 * generated 100k-row answer table. SKIPPED unless BE48_PERF=1 (it builds a large table). Optional:
 *   BE48_PERF_ROWS (default 100000), BE48_PERF_OUT (file for the report).
 *
 *   BE48_PERF=1 npm run be:test -- test/heatmap/perf
 */
import { writeFileSync } from 'node:fs'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { HeatmapPorts, HeatmapService } from '../../src/modules/heatmap'
import type { CurriculumTestApp } from '../curriculum/helpers'
import { bootHeatmapApp } from './helpers'

const ENABLED = process.env.BE48_PERF === '1'
const ROWS = Number(process.env.BE48_PERF_ROWS ?? 100_000)
const RUNS = 20

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? (s[m] as number) : ((s[m - 1] as number) + (s[m] as number)) / 2
}

describe.skipIf(!ENABLED)('AC8: heatmap read on 20 students and a generated answer table', () => {
  let t: CurriculumTestApp
  const report: string[] = []

  beforeAll(async () => {
    t = await bootHeatmapApp()
    await t.db.query(
      `insert into users (name, email, grade, school_id)
       select 'Murid Ujian ' || g, 'perf.' || g || '@example.test', 3, (select school_id from users where email = 'pelajar@demo.test') from generate_series(1, 20) g`,
    )
    // 40 in-tree chapters of the seeded curriculum are the dimensions; 1 in 6 answers has no chapter
    await t.db.query(
      `with pick as (select id, subject_id from chapters where in_tree order by id limit 40),
            c as (select id, subject_id, row_number() over (order by id) as n, count(*) over () as total from pick)
       insert into practice_answers (user_id, subject_id, chapter_id, is_correct, answered_at)
       select u.id, c.subject_id, case when g % 6 = 0 then null else c.id end, (g % 3 <> 0),
              timestamptz '2026-10-19 12:00+08' - ((g * 104729 % 180) || ' days')::interval
         from (select id from users where email like 'perf.%') u
         cross join generate_series(1, ($1::int / 20)) g
         join c on c.n = 1 + ((g * 7919 + u.id) % c.total)`,
      [ROWS],
    )
    await t.db.query('analyze practice_answers')
  }, 600_000)

  afterAll(async () => {
    if (process.env.BE48_PERF_OUT) writeFileSync(process.env.BE48_PERF_OUT, report.join('\n'))
    await t?.close()
  })

  it('records the plans and the median of 20 reads', async () => {
    const total = Number((await t.db.query<{ n: string }>('select count(*) as n from practice_answers'))[0]?.n)
    const users = await t.db.query<{ id: string }>(`select id::text from users where email like 'perf.%' order by id`)
    const uid = users[0]?.id as string
    const mine = Number((await t.db.query<{ n: string }>('select count(*) as n from practice_answers where user_id = $1::bigint', [uid]))[0]?.n)
    report.push(`answers: ${String(total)}, students: ${String(users.length)}, rows of the measured student: ${String(mine)}`)

    // the default port's read (BE-12 PracticeRepository.answers: the user's rows, no question join)
    const scan = await t.db.query<Record<string, string>>(
      `explain (analyze, buffers) select * from practice_answers where user_id = ${uid} and is_test = false order by answered_at asc, id asc`,
    )
    report.push('--- EXPLAIN (ANALYZE, BUFFERS): default port read (PracticeRepository.answers, real mode) ---', ...scan.map((r) => r['QUERY PLAN'] as string))
    // the grouping query of BE-13 chapterAnswerCounts (the adapter the LEAD can plug in after #53)
    const group = await t.db.query<Record<string, string>>(
      `explain (analyze, buffers) select chapter_id, count(*) as attempts, count(*) filter (where is_correct) as correct
         from practice_answers where user_id = ${uid} and chapter_id is not null and not is_test
        group by chapter_id having count(*) >= 5 order by chapter_id`,
    )
    report.push('--- EXPLAIN (ANALYZE, BUFFERS): grouping query (BE-13 chapterAnswerCounts shape) ---', ...group.map((r) => r['QUERY PLAN'] as string))

    const service = t.app.get(HeatmapService)
    const port = t.app.get(HeatmapPorts).answerCounts
    const time = async (fn: () => Promise<unknown>): Promise<number[]> => {
      const out: number[] = []
      for (let i = 0; i < RUNS + 1; i++) {
        const t0 = performance.now()
        await fn()
        if (i > 0) out.push(performance.now() - t0) // the first run warms the plan cache
      }
      return out
    }
    const full = await time(() => service.forCaller({ userId: uid, isTest: false }))
    const counts = await time(() => port.chapterAnswerCounts(uid, 5, false))
    report.push(`--- HeatmapService.forCaller, ${String(RUNS)} runs: median ${median(full).toFixed(1)} ms, max ${Math.max(...full).toFixed(1)} ms`)
    report.push(`--- answer counts (default port) alone, ${String(RUNS)} runs: median ${median(counts).toFixed(1)} ms`)
    const result = await service.forCaller({ userId: uid, isTest: false })
    report.push(`--- cells shown: ${String(result.subjects.flatMap((s) => s.topics).length)} in ${String(result.subjects.length)} subjects`)
    console.log(report.join('\n'))
    expect(median(full)).toBeGreaterThan(0)
  }, 600_000)
})
