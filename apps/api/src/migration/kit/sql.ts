import { createHash, createHmac } from 'node:crypto'

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

/**
 * A `legacyId` must be a surrogate primary key of the source row. An e-mail address, or a run of 10
 * or more digits (IC number, phone number), is personal data and is refused. The message never
 * repeats the value.
 */
export function assertSurrogateLegacyId(legacyId: string, where: string): void {
  // Digits split by spaces or dashes (900101-14-5678, 012-345 6789) are an IC or phone number too.
  if (PERSONAL_ID.test(legacyId) || legacyId.replace(/[\s-]/g, '').replace(/\D/g, '').length >= 10) {
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
