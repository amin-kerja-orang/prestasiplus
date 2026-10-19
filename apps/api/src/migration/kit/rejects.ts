import { randomBytes } from 'node:crypto'

import { assertSurrogateLegacyId, hashValue } from './sql'
import { REJECT_REASONS, type RejectReason, type SqlExecutor } from './types'

export interface RejectInput {
  entity: string
  /** Source primary key of the rejected row (an id, not personal data). */
  legacyId: string | null
  reason: RejectReason
  /** The v2 / source column that caused the reject. */
  column?: string
  /**
   * The offending ENUM value (a code such as `teacher_x`). It is stored as is only when it is in
   * `allowedCodes` (the known codes of that column), or when it looks like a code: letters, digits,
   * `_ . : -`, at most 64 characters, with a letter and at most 4 digits. Anything else (a phone or IC
   * number, free text) is stored as a keyed hash. Never pass a name, e-mail, IC, phone or free text here.
   */
  enumValue?: string
  /** Known codes of the column; an `enumValue` in this list is stored raw. */
  allowedCodes?: readonly string[]
  /** Any other value that must be traceable but not stored: only its hash is kept. */
  valueToHash?: unknown
}

interface PendingReject {
  entity: string
  legacyId: string | null
  reason: RejectReason
  column: string | null
  offending: string | null
}

const CODE_LIKE = /^[A-Za-z0-9_.:-]{1,64}$/

function storeRaw(value: string, allowed: readonly string[] | undefined): boolean {
  if (allowed?.includes(value)) return true
  return CODE_LIKE.test(value) && /[A-Za-z]/.test(value) && (value.match(/\d/g) ?? []).length <= 4
}

/**
 * Collects rejected rows (reason codes only, never the row's values: BE-NFR-11, BE-MIG-07) and
 * writes them to `etl_rejects`. Nothing is written until `flush`, so a batch that rolls back leaves
 * no reject rows behind (the runner flushes inside the batch transaction).
 */
export class Rejects {
  private pending: PendingReject[] = []
  private readonly byEntity = new Map<string, Map<RejectReason, number>>()
  /** Per-run secret for the reject hashes. In memory only, never stored. */
  private readonly hashKey = randomBytes(32)

  add(input: RejectInput): void {
    if (!(REJECT_REASONS as readonly string[]).includes(input.reason)) {
      throw new RangeError(`Unknown reject reason "${input.reason}".`)
    }
    if (input.legacyId !== null) assertSurrogateLegacyId(input.legacyId, 'Rejects.add')
    let offending: string | null = null
    if (input.enumValue !== undefined) {
      offending = storeRaw(input.enumValue, input.allowedCodes) ? input.enumValue : hashValue(input.enumValue, this.hashKey)
    } else if (input.valueToHash !== undefined) {
      offending = hashValue(input.valueToHash, this.hashKey)
    }
    this.pending.push({
      entity: input.entity,
      legacyId: input.legacyId,
      reason: input.reason,
      column: input.column ?? null,
      offending,
    })
  }

  /** Rejects not yet flushed. */
  get size(): number {
    return this.pending.length
  }

  /** Counts per entity and reason since construction (flushed or not). */
  counts(entity: string): Partial<Record<RejectReason, number>> {
    return Object.fromEntries(this.byEntity.get(entity) ?? [])
  }

  /** Writes pending rejects with one statement and clears the buffer. */
  async flush(db: SqlExecutor, runId: string | bigint): Promise<number> {
    const rows = this.pending
    if (rows.length === 0) return 0
    await db.query(
      `INSERT INTO etl_rejects (run_id, entity, legacy_id, reason, column_name, offending)
       SELECT $1::bigint, v.entity, v.legacy_id, v.reason, v.column_name, v.offending
       FROM unnest($2::text[], $3::text[], $4::text[], $5::text[], $6::text[])
         AS v(entity, legacy_id, reason, column_name, offending)`,
      [
        String(runId),
        rows.map((r) => r.entity),
        rows.map((r) => r.legacyId),
        rows.map((r) => r.reason),
        rows.map((r) => r.column),
        rows.map((r) => r.offending),
      ],
    )
    for (const r of rows) {
      const per = this.byEntity.get(r.entity) ?? new Map<RejectReason, number>()
      per.set(r.reason, (per.get(r.reason) ?? 0) + 1)
      this.byEntity.set(r.entity, per)
    }
    this.pending = []
    return rows.length
  }

  /** Drops pending rejects (the batch rolled back). */
  clear(): void {
    this.pending = []
  }
}
