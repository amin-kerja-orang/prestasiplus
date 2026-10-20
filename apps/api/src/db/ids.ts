/** Postgres `bigint` upper bound. */
const BIGINT_MAX = 9223372036854775807n

/** The API carries bigint ids as decimal strings (contract `IdSchema`). */
export function idToString(id: bigint | number): string {
  const value = typeof id === 'number' ? BigInt(id) : id
  if (value < 0n || value > BIGINT_MAX) throw new RangeError('id out of range')
  return value.toString()
}

/** Inverse of `idToString`; throws `RangeError` for anything that is not a canonical bigint id. */
export function idFromString(text: string): bigint {
  if (!/^(0|[1-9]\d{0,18})$/.test(text)) throw new RangeError('invalid id')
  const value = BigInt(text)
  if (value > BIGINT_MAX) throw new RangeError('id out of range')
  return value
}

export function isIdString(text: string): boolean {
  try {
    idFromString(text)
    return true
  } catch {
    return false
  }
}
