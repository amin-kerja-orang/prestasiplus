/**
 * Small, stable string hashes for seeding (ADR-0006 §2).
 *
 * The values must never change between releases: every generated row, sample and id of the mock
 * depends on them. Unit tests pin golden values.
 */

const FNV_OFFSET_32 = 0x811c9dc5
const FNV_PRIME_32 = 0x01000193

/**
 * FNV-1a, 32-bit, over the UTF-16 code units of `input`. Returns an unsigned 32-bit integer.
 * Code units above 0xFF are fed as two bytes (low, high) so that non-Latin names hash stably.
 */
export function fnv1a32(input: string): number {
  let hash = FNV_OFFSET_32
  for (let i = 0; i < input.length; i++) {
    const unit = input.charCodeAt(i)
    hash = Math.imul(hash ^ (unit & 0xff), FNV_PRIME_32)
    if (unit > 0xff) hash = Math.imul(hash ^ (unit >>> 8), FNV_PRIME_32)
  }
  return hash >>> 0
}
