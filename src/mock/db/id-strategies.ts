/**
 * Id strategies (overview §6.5 "Id strategies", ADR-0006 §5, SRS §7.4 numeric-id exception).
 *
 * | Strategy | New id |
 * |---|---|
 * | `sequence({ runtimeStart })` | first free id ≥ a monotonic counter that starts at `runtimeStart`; seeded rows keep their fixed ids and are skipped |
 * | `maxPlusOne()` | highest id ever stored + 1 (like MySQL auto-increment: deleted ids are not reused) |
 * | `floor({ start })` | max(`start`, highest runtime id ≥ `start` + 1); ids below `start` (anchors, generated ranges) never move it (XL-37) |
 * | `uuid(stream)` | deterministic RFC 4122 v4-shaped UUID from the named PRNG stream |
 * | `opaque(prefix, stream)` | deterministic opaque string, e.g. mock tokens and new session ids |
 *
 * Every allocator keeps a small JSON-able counter state (`IdCounterState`) that F-07 persists with
 * the table diff, so ids stay unique across reloads. All strategies skip ids that are taken.
 *
 * The project's documented ranges are in `./id-ranges.ts`.
 */

import type { PrngRegistry } from '../determinism/prng'
import { MockDbError } from './errors'
import type { StoreId } from './store'

export type IdStrategyKind = 'sequence' | 'maxPlusOne' | 'floor' | 'uuid' | 'opaque'

/** Persisted allocator state. Only the fields of the strategy's kind are set. */
export interface IdCounterState {
  kind: IdStrategyKind
  /** `sequence`: the next candidate id. */
  next?: number
  /** `maxPlusOne` / `floor`: the high-water mark. */
  hw?: number
  /** `uuid` / `opaque`: how many ids were drawn. */
  n?: number
}

export interface IdContext<Id extends StoreId> {
  taken: (id: Id) => boolean
  prng: PrngRegistry
}

export interface IdAllocator<Id extends StoreId> {
  next(ctx: IdContext<Id>): Id
  /** An explicit id was stored (seed row, anchor, hydrated or remote row). */
  observe(id: Id): void
  getState(): IdCounterState
  setState(state: IdCounterState): void
  reset(): void
}

export interface IdStrategy<Id extends StoreId> {
  readonly kind: IdStrategyKind
  /** A new allocator (one per table instance). */
  create(): IdAllocator<Id>
}

const MAX_ATTEMPTS = 1_000_000

/**
 * Monotonic merge of two counter states of the same strategy: the max of `next`, `hw` and `n`.
 * Used when applying another tab's changes so that a counter never moves backwards.
 */
export function mergeIdState(current: IdCounterState, incoming: IdCounterState): IdCounterState {
  if (current.kind !== incoming.kind) {
    throw new MockDbError(
      'INVALID',
      `Cannot merge id state of kind ${incoming.kind} into ${current.kind}`,
    )
  }
  const out: IdCounterState = { kind: current.kind }
  for (const field of ['next', 'hw', 'n'] as const) {
    const a = current[field]
    const b = incoming[field]
    if (a !== undefined || b !== undefined) out[field] = Math.max(a ?? -Infinity, b ?? -Infinity)
  }
  return out
}

function checkStart(label: string, value: number): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new MockDbError('INVALID', `${label} must be a positive integer, got ${String(value)}`)
  }
  return value
}

function checkState(
  kind: IdStrategyKind,
  state: IdCounterState,
  field: 'next' | 'hw' | 'n',
): number {
  const value = state[field]
  if (state.kind !== kind || typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new MockDbError(
      'INVALID',
      `Id state ${JSON.stringify(state)} does not fit strategy ${kind}`,
    )
  }
  return value
}

function firstFree(from: number, taken: (id: number) => boolean): number {
  let id = from
  for (let i = 0; i < MAX_ATTEMPTS; i++, id++) {
    if (!taken(id)) return id
  }
  throw new MockDbError('ID_EXHAUSTED', `No free id found from ${String(from)}`)
}

function asNumericId(id: StoreId, kind: IdStrategyKind): number {
  if (typeof id === 'number' && Number.isSafeInteger(id)) return id
  throw new MockDbError('INVALID', `Strategy ${kind} needs integer ids, got ${JSON.stringify(id)}`)
}

/** Seeded rows keep fixed ids; new rows get the first free id ≥ `runtimeStart` (then onwards). */
export function sequence(options: { runtimeStart: number }): IdStrategy<number> {
  const runtimeStart = checkStart('sequence.runtimeStart', options.runtimeStart)
  return {
    kind: 'sequence',
    create() {
      let counter = runtimeStart
      return {
        next(ctx) {
          const id = firstFree(counter, ctx.taken)
          counter = id + 1
          return id
        },
        observe(id) {
          // An explicit runtime id moves the counter past it, so it is never handed out again,
          // even after the row is removed. Seeded ids below `runtimeStart` never move it.
          const n = asNumericId(id, 'sequence')
          if (n >= runtimeStart && n >= counter) counter = n + 1
        },
        getState: () => ({ kind: 'sequence', next: counter }),
        setState: (state) => void (counter = checkState('sequence', state, 'next')),
        reset: () => void (counter = runtimeStart),
      }
    },
  }
}

/** New id = highest id ever stored + 1 (deleted ids are not reused). */
export function maxPlusOne(): IdStrategy<number> {
  return {
    kind: 'maxPlusOne',
    create() {
      let hw = 0
      return {
        next(ctx) {
          const id = firstFree(hw + 1, ctx.taken)
          hw = id
          return id
        },
        observe(id) {
          const n = asNumericId(id, 'maxPlusOne')
          if (n > hw) hw = n
        },
        getState: () => ({ kind: 'maxPlusOne', hw }),
        setState: (state) => void (hw = checkState('maxPlusOne', state, 'hw')),
        reset: () => void (hw = 0),
      }
    },
  }
}

/**
 * New id = max(`start`, highest runtime id + 1). `start` lies above every reserved anchor range of
 * the store (XL-37), so ids below it never move the counter.
 */
export function floor(options: { start: number }): IdStrategy<number> {
  const start = checkStart('floor.start', options.start)
  return {
    kind: 'floor',
    create() {
      let hw = start - 1
      return {
        next(ctx) {
          const id = firstFree(hw + 1, ctx.taken)
          hw = id
          return id
        },
        observe(id) {
          const n = asNumericId(id, 'floor')
          if (n >= start && n > hw) hw = n
        },
        getState: () => ({ kind: 'floor', hw }),
        setState(state) {
          hw = Math.max(start - 1, checkState('floor', state, 'hw'))
        },
        reset: () => void (hw = start - 1),
      }
    },
  }
}

function drawStrategy(
  kind: 'uuid' | 'opaque',
  stream: string,
  make: (rng: ReturnType<PrngRegistry['fresh']>) => string,
): IdStrategy<string> {
  if (!stream) throw new MockDbError('INVALID', `${kind}: stream name is required`)
  return {
    kind,
    create() {
      let n = 0
      return {
        next(ctx) {
          for (let i = 0; i < MAX_ATTEMPTS; i++) {
            const id = make(ctx.prng.fresh(`${stream}#${String(n)}`))
            n++
            if (!ctx.taken(id)) return id
          }
          throw new MockDbError('ID_EXHAUSTED', `${kind}(${stream}): no free id`)
        },
        observe(id) {
          if (typeof id !== 'string' || id === '') {
            throw new MockDbError(
              'INVALID',
              `Strategy ${kind} needs string ids, got ${JSON.stringify(id)}`,
            )
          }
        },
        getState: () => ({ kind, n }),
        setState: (state) => void (n = checkState(kind, state, 'n')),
        reset: () => void (n = 0),
      }
    },
  }
}

const HEX = '0123456789abcdef'

/** Deterministic UUID (version 4 / variant 1 bits set) from draw `n` of stream `stream`. */
export function uuid(stream: string): IdStrategy<string> {
  return drawStrategy('uuid', stream, (rng) => {
    const bytes: number[] = []
    for (let i = 0; i < 4; i++) {
      const word = rng.uint32()
      bytes.push(word >>> 24, (word >>> 16) & 0xff, (word >>> 8) & 0xff, word & 0xff)
    }
    bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40
    bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80
    let out = ''
    bytes.forEach((b, i) => {
      if (i === 4 || i === 6 || i === 8 || i === 10) out += '-'
      out += (HEX[b >>> 4] ?? '') + (HEX[b & 0x0f] ?? '')
    })
    return out
  })
}

const ALNUM = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

/** Deterministic opaque string `prefix` + `length` alphanumerics (default 40). */
export function opaque(prefix: string, stream: string, length = 40): IdStrategy<string> {
  if (!Number.isSafeInteger(length) || length < 8) {
    throw new MockDbError('INVALID', `opaque: length must be an integer ≥ 8, got ${String(length)}`)
  }
  return drawStrategy('opaque', stream, (rng) => {
    let out = prefix
    for (let i = 0; i < length; i++) out += ALNUM[Math.floor(rng.next() * ALNUM.length)] ?? ''
    return out
  })
}
