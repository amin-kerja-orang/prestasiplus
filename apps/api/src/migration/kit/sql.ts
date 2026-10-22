import { createHash, createHmac } from 'node:crypto'

import type pg from 'pg'

const IDENT = /^[a-z_][a-z0-9_]{0,62}$/

/**
 * Quotes a table or column name that comes from loader code (never from input data). Names are
 * restricted to lower-case snake_case so a typo can never become an injection.
 */
export function quoteIdent(name: string): string {
  if (!IDENT.test(name)) throw new RangeError(`Invalid SQL identifier "${name}".`)
  return `"${name}"`
}

/** JSON for `jsonb_populate_recordset`: bigint becomes a decimal string, Date an ISO string. */
export function toJson(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) => (typeof v === 'bigint' ? v.toString() : v))
}

function canonical(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString()
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(value).sort()) {
      out[key] = canonical((value as Record<string, unknown>)[key])
    }
    return out
  }
  return value === undefined ? null : value
}

/** Stable SHA-256 (hex) of a normalised source row: key order and `undefined` vs `null` do not matter. */
export function hashRow(values: Record<string, unknown>): string {
  return createHash('sha256').update(JSON.stringify(canonical(values))).digest('hex')
}

/**
 * Keyed hash for a value that must not be stored (reject `offending` column): HMAC-SHA-256 under
 * `key`, truncated. The key is a per-run random secret held in memory only (see `Rejects`), so the
 * hash of a low-entropy value (phone, IC) cannot be brute-forced from the stored rows.
 */
export function hashValue(value: unknown, key: Uint8Array): string {
  return `hmac:${createHmac('sha256', key).update(JSON.stringify(canonical(value))).digest('hex').slice(0, 16)}`
}

const PERSONAL_ID = /@|\d{10,}/

/** An IC (yymmdd-pb-nnnn) or a phone number (nnn-nnn-nnnn) with ":" in place of the usual separator. */
const SPLIT_PERSONAL_SHAPES: readonly RegExp[] = [/^\d{6}:\d{2}:\d{4}$/, /^\d{3}:\d{3}:\d{4}$/]

/** True when one segment of a legacy id looks like an e-mail address, an IC number or a phone number. */
function segmentLooksPersonal(segment: string): boolean {
  // Digits split by spaces or dashes (900101-14-5678, 012-345 6789) are an IC or phone number too.
  return PERSONAL_ID.test(segment) || segment.replace(/[\s-]/g, '').replace(/\D/g, '').length >= 10
}

/**
 * A `legacyId` must be a surrogate primary key of the source row. An e-mail address, or a run of 10
 * or more digits (IC number, phone number), is personal data and is refused. A composite id joins
 * surrogate keys with `:` (`challenge:user:day`); each segment is checked on its own, so several short
 * keys never add up to a false positive. The message never repeats the value.
 */
export function assertSurrogateLegacyId(legacyId: string, where: string): void {
  // A non-composite id is checked as a whole. A composite id is checked per segment, and a composite that is only an
  // IC (yymmdd:pb:nnnn) or a phone number (nnn:nnn:nnnn) split by ":" is refused by its shape.
  const personal = legacyId.includes(':')
    ? legacyId.split(':').some(segmentLooksPersonal) || SPLIT_PERSONAL_SHAPES.some((re) => re.test(legacyId))
    : segmentLooksPersonal(legacyId)
  if (personal) {
    throw new RangeError(
      `${where}: legacyId looks like personal data (contains "@" or 10 or more digits); use the surrogate primary key of the source row.`,
    )
  }
}

/** Hash of the inputs of a run (dump file hashes, entity list, ...), used as the dry-run / apply link. */
export function hashInput(parts: readonly string[]): string {
  const h = createHash('sha256')
  for (const part of parts) h.update(`${part.length}:${part};`)
  return h.digest('hex')
}

/**
 * Digest SQL of a staged table, shared by BE-28 and BE-29 (MIG-07): the sum, as numeric, of a 60-bit slice of the md5 of every
 * `_row_hash` (a NULL counts as ''). Order independent, deterministic and constant in memory, where a `string_agg` of the row
 * hashes would pass Postgres's 1 GB text limit near 30 million rows. Any row added, deleted or changed moves the count or the sum.
 * Input hashes stored by runs made with the earlier `md5(string_agg(...))` recipe no longer match: re-run dry-run, then apply.
 */
export const ROW_HASH_DIGEST_SQL = `coalesce(sum(('x' || substr(md5(coalesce("_row_hash", '')), 1, 15))::bit(60)::bigint::numeric), 0)::text`

/** `{ n: row count, h: digest }` of one staged table (`schema` and `table` come from loader code, never from input). */
export async function tableDigest(
  pool: Pick<pg.Pool, 'query'>,
  schema: string,
  table: string,
): Promise<{ n: string; h: string }> {
  const res = await pool.query<{ n: string; h: string }>(
    `SELECT count(*)::text AS n, ${ROW_HASH_DIGEST_SQL} AS h FROM ${quoteIdent(schema)}.${quoteIdent(table)}`,
  )
  return { n: res.rows[0]?.n ?? '0', h: res.rows[0]?.h ?? '0' }
}
