import { createHash } from 'node:crypto'

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

/** Short stable hash for a value that must not be stored (reject `offending` column). */
export function hashValue(value: unknown): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex').slice(0, 16)}`
}

/** Hash of the inputs of a run (dump file hashes, entity list, ...), used as the dry-run / apply link. */
export function hashInput(parts: readonly string[]): string {
  const h = createHash('sha256')
  for (const part of parts) h.update(`${part.length}:${part};`)
  return h.digest('hex')
}
