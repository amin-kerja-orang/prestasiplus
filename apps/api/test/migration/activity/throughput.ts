/**
 * Throughput of the activity load for synthetic practice answers (card AC7): a number to record in the PR, not a
 * pass / fail threshold. NOT a test (no `.spec.ts`, never run in CI).
 *
 * It plants N synthetic question attempts (default 1,000,000) and N/10 sessions into `staging_cloud` with
 * `generate_series` (fictitious values, surrogate ids from 10,000,001 / 20,000,001), runs the practice entities
 * through `runActivity` (dry-run, then apply) and prints rows per second. It uses the kit's batched upsert, the same
 * code path as the real run (the card's "bulk COPY, indexes after the load" variant needs a COPY dependency and
 * is not implemented, see the plan, Q11).
 *
 * Prepare a SCRATCH database first (never a shared or production one):
 *   1. an empty database migrated with `prisma migrate deploy` and the curriculum / package seeds;
 *   2. `staging_cloud` loaded from the BE-35 fixture (`cloud-tiny`) with `staging:load`;
 *   3. `migrate:core --apply` on it with the same `--as-of`.
 * Then, from apps/api:
 *   THROUGHPUT_DATABASE_URL=postgresql://user:pass@127.0.0.1:5432/pp_throughput_scratch \
 *   [THROUGHPUT_ROWS=1000000] [THROUGHPUT_BATCH=5000] [THROUGHPUT_AS_OF=2026-06-01] \
 *   npx tsx test/migration/activity/throughput.ts
 * The database name must contain "scratch" or "throughput" (a guard against pointing it at a real database).
 */
import pg from 'pg'

import { runActivity } from '../../../src/migration/load/activity'

const URL_ = process.env.THROUGHPUT_DATABASE_URL
const ROWS = Number(process.env.THROUGHPUT_ROWS ?? 1_000_000)
const BATCH = Number(process.env.THROUGHPUT_BATCH ?? 5_000)
const AS_OF = process.env.THROUGHPUT_AS_OF ?? '2026-06-01'
const ENTITIES = ['practice_sessions', 'practice_answers']
const SESSION_BASE = 10_000_000
const ATTEMPT_BASE = 20_000_000
const PER_SESSION = 10

function fail(message: string): never {
  process.stderr.write(`${message}\n`)
  process.exit(2)
}

async function main(): Promise<void> {
  if (!URL_) fail('Set THROUGHPUT_DATABASE_URL (a scratch database prepared as described in the file header).')
  if (!Number.isInteger(ROWS) || ROWS < PER_SESSION) fail('THROUGHPUT_ROWS must be an integer of at least 10.')
  const pool = new pg.Pool({ connectionString: URL_, max: 4 })
  try {
    const db = (await pool.query<{ db: string }>('select current_database() as db')).rows[0]?.db ?? ''
    if (!/scratch|throughput/i.test(db)) fail(`Refusing to run on database "${db}": its name must contain "scratch" or "throughput".`)

    const pupils = (
      await pool.query<{ id: string }>(
        `select m.legacy_id as id from etl_id_map m join user_roles r on r.user_id = m.new_id::bigint and r.role = 'student'
         where m.entity = 'users' and m.legacy_source = 'cloud' order by m.legacy_id::bigint`,
      )
    ).rows.map((r) => r.id)
    if (pupils.length === 0) fail('No migrated pupils in etl_id_map: run migrate:core --apply on this database first.')
    const subjects = (
      await pool.query<{ id: string }>(`select legacy_id as id from etl_id_map where entity = 'subjects' and legacy_source = 'cloud' order by legacy_id::bigint`)
    ).rows.map((r) => r.id)
    if (subjects.length === 0) fail('No migrated subjects in etl_id_map.')

    const sessions = Math.ceil(ROWS / PER_SESSION)
    const planted = await pool.query(`select 1 from staging_cloud.practice_sessions where id = $1`, [SESSION_BASE + 1])
    if (planted.rowCount === 0) {
      const t0 = performance.now()
      await pool.query(
        `insert into staging_cloud.practice_sessions
           (id, user_id, subject_id, mode, paper, client_uuid, total_questions, correct, accuracy, duration_seconds, syiling_earned, started_at, created_at)
         select $1::bigint + g, ($2::bigint[])[1 + (g % cardinality($2::bigint[]))], ($3::bigint[])[1 + (g % cardinality($3::bigint[]))],
                'random', 'paper1', null, ${PER_SESSION}, 5, 50, 300, 1,
                timestamptz '2026-01-01 00:00:00+00' + (g % 100000) * interval '1 minute', timestamptz '2026-01-01 00:00:00+00'
         from generate_series(1, $4::int) g`,
        [SESSION_BASE, pupils, subjects, sessions],
      )
      await pool.query(
        `insert into staging_cloud.question_attempts (id, user_id, practice_session_id, question_id, selected_option, is_correct, time_seconds, created_at)
         select $1::bigint + g, ($3::bigint[])[1 + ((1 + (g - 1) / $5::int) % cardinality($3::bigint[]))], $2::bigint + 1 + ((g - 1) / $5::int), null,
                (array['A','B','C','D'])[1 + (g % 4)], (g % 2)::text, 5 + (g % 40), timestamptz '2026-01-01 00:00:00+00' + (g % 100000) * interval '1 minute'
         from generate_series(1, $4::int) g`,
        [ATTEMPT_BASE, SESSION_BASE, pupils, ROWS, PER_SESSION],
      )
      process.stdout.write(`planted ${sessions} sessions and ${ROWS} attempts in ${((performance.now() - t0) / 1000).toFixed(1)} s\n`)
    } else {
      process.stdout.write('synthetic rows already planted; reusing them\n')
    }

    const env = { NODE_ENV: 'test', PP_ALLOW_MIGRATE_APPLY: '1' }
    const common = { pool, env, source: 'cloud' as const, asOf: AS_OF, coreAsOf: AS_OF, batchSize: BATCH, only: ENTITIES }

    const dry = await runActivity({ ...common, mode: 'dry-run' })
    process.stdout.write(`dry-run: ${dry.report.status}\n`)
    if (dry.report.status !== 'succeeded') fail('The dry-run did not succeed; the apply would be refused.')

    const t1 = performance.now()
    const applied = await runActivity({ ...common, mode: 'apply' })
    const seconds = (performance.now() - t1) / 1000
    process.stdout.write(`apply: ${applied.report.status}\n`)
    let total = 0
    for (const r of applied.report.recon) {
      total += r.loaded
      process.stdout.write(`  ${r.entity}: read ${r.sourceCount}, loaded ${r.loaded}, rejected ${r.rejected}\n`)
    }
    const answers = applied.report.recon.find((r) => r.entity === 'practice_answers')?.loaded ?? 0
    process.stdout.write(`apply wall time ${seconds.toFixed(1)} s, batch size ${BATCH}\n`)
    process.stdout.write(`throughput: ${Math.round(total / seconds)} rows/second overall, ${Math.round(answers / seconds)} answers/second\n`)
    process.stdout.write(`peak RSS ${(process.memoryUsage().rss / 1024 / 1024).toFixed(0)} MiB\n`)
  } finally {
    await pool.end()
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
