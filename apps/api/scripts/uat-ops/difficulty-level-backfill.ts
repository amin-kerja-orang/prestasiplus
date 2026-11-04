/**
 * U-OP-19 (DM-47, S1-T02): backfill `question_versions.difficulty_level` after migration 0128.
 *
 * Writes `least(5, difficulty_tp)` only where `difficulty_level IS NULL` and `difficulty_tp` is 1..6 (TP 6 gives 5). `difficulty_tp` is never
 * changed; rows with no TP stay NULL (readers fall back to `least(5, tp)`, else 3, and the gate still refuses Terbit without a typed value).
 * Idempotent (a second run finds nothing to write). Batches of 5,000 by version id, one short transaction per batch.
 *
 * DRY RUN IS THE DEFAULT: it only counts. Pass `--apply` to write.
 *
 *   DATABASE_URL=... npx tsx apps/api/scripts/uat-ops/difficulty-level-backfill.ts              # dry run (count only)
 *   DATABASE_URL=... npx tsx apps/api/scripts/uat-ops/difficulty-level-backfill.ts --apply      # write
 *   (--dry-run is accepted and means the default; --batch-size=N overrides the 5,000)
 *
 * The connection string comes from the environment, never from this file.
 */
import { Client } from 'pg'

export const DEFAULT_BATCH_SIZE = 5000

export interface BackfillOptions {
  /** Count only; nothing is written. */
  dryRun: boolean
  batchSize?: number
  log?: (line: string) => void
}

export interface BackfillResult {
  dryRun: boolean
  /** Rows that qualify (dry run) or were written (apply). */
  rows: number
  batches: number
}

const WHERE = `difficulty_level IS NULL AND difficulty_tp BETWEEN 1 AND 6`

export async function backfillDifficultyLevel(client: Pick<Client, 'query'>, options: BackfillOptions): Promise<BackfillResult> {
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE
  if (!Number.isInteger(batchSize) || batchSize < 1) throw new Error('batch size must be a positive integer')
  const log = options.log ?? (() => undefined)
  if (options.dryRun) {
    const { rows } = await client.query<{ n: string }>(`SELECT count(*)::text AS n FROM question_versions WHERE ${WHERE}`)
    const n = Number(rows[0]!.n)
    log(`dry run: ${String(n)} question versions would get difficulty_level = least(5, difficulty_tp)`)
    return { dryRun: true, rows: n, batches: Math.ceil(n / batchSize) }
  }
  let written = 0
  let batches = 0
  for (;;) {
    // The WHERE clause is repeated in the UPDATE so a concurrent save that typed a value is never overwritten.
    const res = await client.query(
      `UPDATE question_versions SET difficulty_level = least(5, difficulty_tp)
        WHERE id IN (SELECT id FROM question_versions WHERE ${WHERE} ORDER BY id LIMIT $1) AND ${WHERE}`,
      [batchSize],
    )
    const n = res.rowCount ?? 0
    if (n === 0) break
    written += n
    batches += 1
    log(`batch ${String(batches)}: ${String(n)} rows (total ${String(written)})`)
  }
  log(`done: ${String(written)} question versions written`)
  return { dryRun: false, rows: written, batches }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const apply = args.includes('--apply') && !args.includes('--dry-run')
  const sizeArg = args.find((a) => a.startsWith('--batch-size='))
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  const client = new Client({ connectionString: url })
  await client.connect()
  try {
    await backfillDifficultyLevel(client, { dryRun: !apply, ...(sizeArg ? { batchSize: Number(sizeArg.slice('--batch-size='.length)) } : {}), log: (l) => console.log(l) })
  } finally {
    await client.end()
  }
}

if (process.argv[1] !== undefined && /difficulty-level-backfill\.[cm]?[jt]s$/.test(process.argv[1])) {
  main().catch((e: unknown) => {
    console.error(e)
    process.exit(1)
  })
}
