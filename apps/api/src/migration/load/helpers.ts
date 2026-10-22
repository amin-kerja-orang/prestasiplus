/**
 * Small helpers shared by the step files.
 */
import { quoteIdent } from '../kit/sql'
import { upsertByLegacy, type LegacyRow } from '../kit/upsert'
import type { BatchContext, BatchResult } from '../kit/runner'
import type { RejectSpec } from '../transform/common'

/** Records a reject for a source row. `reason`, `column` and a code-like enum value only: never row values. */
export function rejectRow(ctx: BatchContext, entity: string, legacyId: string, spec: RejectSpec): void {
  ctx.rejects.add({
    entity,
    legacyId,
    reason: spec.reason,
    column: spec.column,
    enumValue: spec.enumValue,
    allowedCodes: spec.allowedCodes,
  })
}

/**
 * Upserts one batch through the kit, rejects the repeats of a legacy id inside the batch, and registers
 * the new ids in `etl_id_map` for the next steps. Returns the counts for the reconciliation.
 */
export async function upsertAndMap(
  ctx: BatchContext,
  entity: string,
  table: string,
  columns: readonly string[],
  rows: readonly LegacyRow[],
  opts: { register?: boolean } = {},
): Promise<BatchResult> {
  if (rows.length === 0) return { inserted: 0, updated: 0, unchanged: 0 }
  const res = await upsertByLegacy(ctx.db, { table, source: ctx.source, columns, rows })
  for (const legacyId of res.duplicates) {
    ctx.rejects.add({ entity, legacyId, reason: 'DUPLICATE_KEY', column: 'id' })
  }
  if (opts.register !== false) await ctx.idMap.registerMany(entity, res.ids)
  return { inserted: res.inserted, updated: res.updated, unchanged: res.unchanged }
}

export function sumResults(...results: BatchResult[]): BatchResult {
  return results.reduce<BatchResult>(
    (a, r) => ({
      inserted: (a.inserted ?? 0) + (r.inserted ?? 0),
      updated: (a.updated ?? 0) + (r.updated ?? 0),
      unchanged: (a.unchanged ?? 0) + (r.unchanged ?? 0),
    }),
    {},
  )
}

/** Existing rows of a reference table by upper-cased code, for the values a migrated row must keep (seed rows or its own earlier load). */
export async function existingByCode<T extends object>(
  ctx: BatchContext,
  table: string,
  columns: readonly string[],
  codes: readonly string[],
): Promise<Map<string, T>> {
  const out = new Map<string, T>()
  if (codes.length === 0) return out
  const select = columns.map(quoteIdent).join(', ')
  const res = await ctx.db.query<{ code: string } & Record<string, unknown>>(
    `SELECT upper(code) AS code, ${select} FROM ${quoteIdent(table)}
     WHERE upper(code) = ANY($1::text[]) AND (legacy_source IS NULL OR legacy_source = $2)`,
    [codes, ctx.source],
  )
  for (const r of res.rows) out.set(r.code, r as unknown as T)
  return out
}
