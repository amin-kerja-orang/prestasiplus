/** Shared helpers of the semantic checks (`checks.ts`, `bank-checks.ts`). */
import type pg from 'pg'

import { quoteIdent } from '../kit/sql'
import type { LegacySource } from '../kit/types'
import type { EntityCheck, StatCheck } from './types'

export interface CheckContext {
  pool: pg.Pool
  source: LegacySource
  entities: readonly EntityCheck[]
}

export const MAX_DETAIL_ITEMS = 20

/** True when `schema.table` exists (so a check can say "not available" instead of failing on a missing relation). */
export async function exists(pool: pg.Pool, schema: string | null, table: string): Promise<boolean> {
  const name = schema === null ? quoteIdent(table) : `${quoteIdent(schema)}.${quoteIdent(table)}`
  const res = await pool.query<{ ok: boolean }>(`SELECT to_regclass($1) IS NOT NULL AS ok`, [name])
  return res.rows[0]?.ok === true
}

export const reported = (name: string, kind: StatCheck['kind'], detail: string): StatCheck => ({
  name,
  kind,
  expected: null,
  actual: null,
  status: 'reported',
  detail,
})

export const capped = (items: readonly string[]): string =>
  items.length <= MAX_DETAIL_ITEMS ? items.join('; ') : `${items.slice(0, MAX_DETAIL_ITEMS).join('; ')}; ... (${items.length} in all)`

/** The latest recon row of an entity that ran (a `not-run` entity has no apply run to read). */
export const entityOf = (entities: readonly EntityCheck[], name: string): EntityCheck | undefined => {
  const e = entities.find((x) => x.entity === name)
  return e === undefined || e.status === 'not-run' ? undefined : e
}
