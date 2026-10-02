/**
 * Small helpers for repository methods.
 */

/**
 * `groupCount` (tables, datasets and the repository's named-query `groupCount`) **omits groups whose
 * count is zero**: a virtual dataset aggregates its non-empty cells, and a table only sees existing
 * rows. When a screen lists every group (e.g. a tile per subject, including "0"), fill the gaps with
 * the full key list from the owner's lookup:
 *
 * ```ts
 * withZeroCounts(questions.groupCount('Q-ELIGIBLE', 'subjectId'), curriculum.subjectIds())
 * ```
 *
 * The result has every key of `keys` in that order (0 when absent), followed by any other keys of
 * `counts` in their original order.
 */
export function withZeroCounts<K>(
  counts: ReadonlyMap<K, number>,
  keys: Iterable<K>,
): Map<K, number> {
  const out = new Map<K, number>()
  for (const k of keys) out.set(k, counts.get(k) ?? 0)
  for (const [k, n] of counts) if (!out.has(k)) out.set(k, n)
  return out
}
