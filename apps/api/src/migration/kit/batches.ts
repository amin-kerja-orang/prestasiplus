/**
 * Groups an (async) iterable into arrays of at most `size` items, lazily: memory stays at one
 * batch. Plan 14.5 uses 1,000 to 10,000 rows per batch.
 */
export async function* batches<T>(
  source: AsyncIterable<T> | Iterable<T>,
  size: number,
): AsyncGenerator<T[], void, undefined> {
  if (!Number.isInteger(size) || size < 1) throw new RangeError('Batch size must be a positive integer.')
  let current: T[] = []
  for await (const item of source) {
    current.push(item)
    if (current.length >= size) {
      yield current
      current = []
    }
  }
  if (current.length > 0) yield current
}
