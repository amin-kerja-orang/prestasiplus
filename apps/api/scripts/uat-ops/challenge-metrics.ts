/**
 * S7-T04 part 15 (ruling 18): give the migrated platform challenges their `metric`, and move "Kombo 10" to the `combo` type.
 *
 * Migrated rows (ETL of 0232 and earlier) have `metric` NULL, so no evaluator ever advances them. Two steps, reported separately:
 *  1. METRIC: where `metric IS NULL`, set it by EXACT title from `MIGRATED_CHALLENGE_METRICS` (the table the ETL also uses). A row that
 *     already has a metric is never overwritten, a title not in the table is never touched.
 *  2. KOMBO: "Kombo 10" with a type other than `combo` (migrated as `streak`, ETL map `kombo` -> `streak`) becomes type `combo`, metric
 *     `best_combo` (needs migration 0232 and the contract value of Part 14).
 * INSERTS NOTHING: an expected title that is not in the table is reported as FAIL. Challenges are platform rows (a teacher challenge has no
 * v2 row), so the report holds titles and counts only, no personal data.
 * Idempotent: a second `--apply` finds nothing to change. The apply runs in one transaction.
 *
 * DRY RUN IS THE DEFAULT: it only reports. Pass `--apply` to write (the PO approves it, as for any UAT write; fold into U-OP-13).
 *
 *   DATABASE_URL=... npx tsx apps/api/scripts/uat-ops/challenge-metrics.ts            # dry run
 *   DATABASE_URL=... npx tsx apps/api/scripts/uat-ops/challenge-metrics.ts --apply    # write
 *
 * Exit code 0 ok, 1 a title is missing, 2 usage or environment error.
 */
import type { Client } from 'pg'

import { MIGRATED_CHALLENGE_METRICS } from '../../src/modules/gamification/gamification.constants'
import { exitCodeOf, formatLine, isMain, line, openDb, parseUatArgs, writeReport, type CheckLine, type UatArgsSpec } from './lib'

export const SPEC: UatArgsSpec = { name: 'challenge-metrics', allowApply: true }

export const KOMBO_TITLE = 'Kombo 10'
export const KOMBO_TYPE = 'combo'
export const KOMBO_METRIC = 'best_combo'

export interface ChallengeRow {
  id: string
  title: string
  challenge_type: string
  metric: string | null
}

export interface MetricsPlan {
  /** Step 1: rows whose NULL metric gets the title's metric. */
  metricUpdates: Array<{ id: string; title: string; metric: string }>
  /** Step 1: rows with a metric already (left alone). */
  alreadySet: number
  /** Expected titles with no row (never inserted). */
  missing: string[]
  /** Step 2: "Kombo 10" rows moved to `combo` / `best_combo`. */
  komboMoves: Array<{ id: string; fromType: string; fromMetric: string | null }>
}

/** Pure: the rows of `challenges` -> what the two steps would change. */
export function planChallengeMetrics(rows: readonly ChallengeRow[]): MetricsPlan {
  const plan: MetricsPlan = { metricUpdates: [], alreadySet: 0, missing: [], komboMoves: [] }
  for (const title of Object.keys(MIGRATED_CHALLENGE_METRICS)) {
    const found = rows.filter((r) => r.title === title)
    if (found.length === 0) {
      plan.missing.push(title)
      continue
    }
    for (const r of found) {
      if (r.metric !== null) plan.alreadySet += 1
      else plan.metricUpdates.push({ id: r.id, title, metric: MIGRATED_CHALLENGE_METRICS[title as keyof typeof MIGRATED_CHALLENGE_METRICS] })
    }
  }
  for (const r of rows) {
    if (r.title === KOMBO_TITLE && r.challenge_type !== KOMBO_TYPE) plan.komboMoves.push({ id: r.id, fromType: r.challenge_type, fromMetric: r.metric })
  }
  return plan
}

/** Pure: the plan -> report lines (titles and counts only). */
export function planLines(plan: MetricsPlan, apply: boolean): CheckLine[] {
  const verb = apply ? 'set' : 'would set'
  const lines: CheckLine[] = [line('INFO', `mode: ${apply ? 'apply' : 'dry run'}; expected titles ${String(Object.keys(MIGRATED_CHALLENGE_METRICS).length)}`)]
  lines.push(line('INFO', `step 1 metric: ${verb} ${String(plan.metricUpdates.length)} NULL metric(s); ${String(plan.alreadySet)} row(s) already have one (not overwritten)`))
  for (const u of plan.metricUpdates) lines.push(line('INFO', `step 1: "${u.title}" -> ${u.metric}`))
  for (const t of plan.missing) lines.push(line('FAIL', `expected title "${t}" is not in challenges (nothing inserted)`))
  lines.push(
    line('INFO', `step 2 kombo: ${verb} ${String(plan.komboMoves.length)} "${KOMBO_TITLE}" row(s) to type ${KOMBO_TYPE}, metric ${KOMBO_METRIC}`),
  )
  for (const m of plan.komboMoves) lines.push(line('INFO', `step 2: "${KOMBO_TITLE}" ${m.fromType}/${m.fromMetric ?? 'NULL'} -> ${KOMBO_TYPE}/${KOMBO_METRIC}`))
  const changes = plan.metricUpdates.length + plan.komboMoves.length
  lines.push(line(plan.missing.length === 0 ? 'PASS' : 'FAIL', `${String(changes)} change(s) ${apply ? 'written' : 'pending'}; ${String(plan.missing.length)} title(s) missing`))
  return lines
}

const SELECT_SQL = `SELECT id::text AS id, title, challenge_type, metric FROM challenges ORDER BY id`

/** Reads, plans and (with `apply`) writes in one transaction. A second run finds an empty plan. */
export async function runChallengeMetrics(client: Pick<Client, 'query'>, options: { apply: boolean }): Promise<{ plan: MetricsPlan; lines: CheckLine[] }> {
  if (options.apply) await client.query('BEGIN')
  try {
    const { rows } = await client.query<ChallengeRow>(SELECT_SQL)
    const plan = planChallengeMetrics(rows)
    if (options.apply) {
      for (const u of plan.metricUpdates) {
        // The IS NULL guard is repeated so a concurrent admin edit is never overwritten.
        await client.query(`UPDATE challenges SET metric = $1, updated_at = now() WHERE id = $2::bigint AND metric IS NULL`, [u.metric, u.id])
      }
      for (const m of plan.komboMoves) {
        await client.query(`UPDATE challenges SET challenge_type = $1, metric = $2, updated_at = now() WHERE id = $3::bigint AND challenge_type <> $1`, [
          KOMBO_TYPE,
          KOMBO_METRIC,
          m.id,
        ])
      }
      await client.query('COMMIT')
    }
    return { plan, lines: planLines(plan, options.apply) }
  } catch (e) {
    if (options.apply) await client.query('ROLLBACK')
    throw e
  }
}

async function main(): Promise<number> {
  const started = new Date()
  try {
    const args = parseUatArgs(process.argv.slice(2), SPEC)
    const db = await openDb()
    try {
      const { lines } = await runChallengeMetrics(db.client, { apply: args.apply })
      for (const l of lines) console.log(formatLine(l))
      console.log(`INFO report written: ${writeReport('challenge-metrics', lines, { now: started })}`)
      return exitCodeOf(lines)
    } finally {
      await db.close()
    }
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e))
    return 2
  }
}

if (isMain(import.meta.url)) void main().then((code) => process.exit(code))
