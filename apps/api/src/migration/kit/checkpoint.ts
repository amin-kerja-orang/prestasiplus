import type { SqlExecutor } from './types'

export interface Checkpoint {
  /** Last processed source key (text) of the last committed batch; `null` before the first one. */
  lastKey: string | null
  /** Number of batches already committed; the next batch is `batch + 1`. */
  batch: number
}

/** The resume point of `(run, entity)`, or the start of the entity when none was saved yet. */
export async function loadCheckpoint(db: SqlExecutor, runId: string, entity: string): Promise<Checkpoint> {
  const res = await db.query<{ last_key: string | null; batch: number }>(
    `SELECT last_key, batch FROM etl_checkpoints WHERE run_id = $1::bigint AND entity = $2`,
    [runId, entity],
  )
  const row = res.rows[0]
  return row ? { lastKey: row.last_key, batch: row.batch } : { lastKey: null, batch: 0 }
}

/**
 * Saves the resume point. Call it on the SAME transaction client as the batch's writes, so the
 * checkpoint and the data commit or roll back together (BE-NFR-17); a crash can then never skip or
 * repeat a batch.
 */
export async function saveCheckpoint(
  db: SqlExecutor,
  runId: string,
  entity: string,
  checkpoint: Checkpoint,
): Promise<void> {
  await db.query(
    `INSERT INTO etl_checkpoints (run_id, entity, last_key, batch) VALUES ($1::bigint, $2, $3, $4)
     ON CONFLICT (run_id, entity) DO UPDATE SET last_key = EXCLUDED.last_key, batch = EXCLUDED.batch, updated_at = now()`,
    [runId, entity, checkpoint.lastKey, checkpoint.batch],
  )
}
