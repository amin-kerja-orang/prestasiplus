/**
 * Named count queries (D11, overview §6.6): every count shown on a screen is a named query on the
 * owner's store (e.g. M04 §4.1 Q-ALL, Q-ELIGIBLE(subject); M05 §6.14.2 Q-ANS-ALL). Registering
 * them in one place gives each figure one definition, and lets the build check each documented
 * value (`expected`) against the compiled dataset (`checkNamedQueries`).
 *
 * ```ts
 * const Q = defineNamedQueries(questions, {
 *   'Q-ALL': { where: { pkskDomainId: null }, expected: 465_278, source: 'M04 §4.1' },
 *   'Q-ELIGIBLE(subject)': {
 *     where: (subjectId: number) => ({ subjectId, status: 'approved', isActive: true }),
 *     expected: [{ args: [3], value: 13_872 }],
 *   },
 * })
 * Q['Q-ALL'].count()                  // 465278
 * Q['Q-ELIGIBLE(subject)'].count(3)   // 13872
 * ```
 *
 * Arithmetic between queries (e.g. "Total Soalan" = Q-ACTIVE + Q-PKSK) stays in the repository.
 */

import type { QueryOptions, QueryResult, Store, StoreId, Where } from '../db/store'
import type { Prng } from '../determinism/prng'
import type { DatasetIssue } from './errors'

type AnyArgsFn<R> = (...args: never) => R

export interface NamedQueryDef<Row> {
  /** A fixed condition, or a function of the query's parameters. */
  where?: Where<Row> | AnyArgsFn<Where<Row>>
  /** Documented value(s) from the owner SRS: a number (no parameters) or per-argument values. */
  expected?: number | readonly { args: readonly unknown[]; value: number }[]
  /** Where the figure is documented, e.g. `'M04 §4.1'`. */
  source?: string
}

type ArgsOf<D> = D extends { where: (...args: infer A) => unknown } ? A : []

export interface NamedQuery<Row extends { id: StoreId }, A extends readonly unknown[]> {
  readonly id: string
  readonly source: string | undefined
  readonly expected: NamedQueryDef<Row>['expected']
  where(...args: A): Where<Row>
  count(...args: A): number
  groupCount<G extends keyof Row>(field: G, ...args: A): Map<Row[G], number>
  query(options: Omit<QueryOptions<Row>, 'where'>, ...args: A): QueryResult<Row>
  sample(n: number, rng: Prng, ...args: A): Row[]
}

export type NamedQueries<
  Row extends { id: StoreId },
  D extends Record<string, NamedQueryDef<Row>>,
> = {
  readonly [Q in keyof D]: NamedQuery<Row, ArgsOf<D[Q]>>
}

export function defineNamedQueries<
  Row extends { id: StoreId },
  const D extends Record<string, NamedQueryDef<Row>>,
>(store: Store<Row>, defs: D): NamedQueries<Row, D> {
  const out: Record<string, NamedQuery<Row, readonly unknown[]>> = {}
  for (const [id, def] of Object.entries(defs)) {
    const whereOf = (...args: readonly unknown[]): Where<Row> => {
      const w = def.where
      if (w === undefined) return {}
      return typeof w === 'function' ? (w as (...a: readonly unknown[]) => Where<Row>)(...args) : w
    }
    out[id] = {
      id,
      source: def.source,
      expected: def.expected,
      where: whereOf,
      count: (...args) => store.count(whereOf(...args)),
      groupCount: (field, ...args) => store.groupCount(field, whereOf(...args)),
      query: (options, ...args) => store.query({ ...options, where: whereOf(...args) }),
      sample: (n, rng, ...args) => store.sample(whereOf(...args), n, rng),
    }
  }
  return out as unknown as NamedQueries<Row, D>
}

/** Compares every documented `expected` value with the computed count. */
export function checkNamedQueries(
  queries: Record<string, NamedQuery<{ id: StoreId }, readonly unknown[]>> | object,
): DatasetIssue[] {
  const issues: DatasetIssue[] = []
  for (const q of Object.values(queries) as NamedQuery<{ id: StoreId }, readonly unknown[]>[]) {
    const exp = q.expected
    if (exp === undefined) continue
    const cases = typeof exp === 'number' ? [{ args: [] as readonly unknown[], value: exp }] : exp
    for (const { args, value } of cases) {
      const actual = q.count(...args)
      if (actual !== value) {
        issues.push({
          code: 'NAMED_QUERY',
          message: `${q.id}(${args.map((a) => JSON.stringify(a)).join(', ')}) = ${String(actual)}, documented ${String(value)}${q.source ? ` (${q.source})` : ''}`,
        })
      }
    }
  }
  return issues
}
