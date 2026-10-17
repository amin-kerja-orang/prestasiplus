/**
 * Virtual dataset primitive (F-09; D11, overview §6.6, ADR-0013).
 *
 * - `defineVirtualDataset` — a `Store` + `TransactionalStore` over a compiled distribution.
 * - Spec DSL — `exact`, `split`, `nest`, `nestSplit`, `fit2d`, `marginal`, `totalOf`.
 * - `defineNamedQueries` / `checkNamedQueries` — one definition per displayed count.
 * - `assertFeasible` / `checkFeasibility` — the build-time spec check.
 * - `defineDisplayConstant` / `listDisplayConstants` — the documented D11 exception (XL-34).
 */
export * from './data-profile'
export * from './dataset'
export * from './display-constants'
export * from './errors'
export * from './feasibility'
export * from './fit2d'
export * from './named-queries'
export * from './spec'
export * from './types'
