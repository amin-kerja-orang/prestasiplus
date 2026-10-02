/**
 * Mock storage primitives (F-05; overview §6.5). Persistence and cross-tab broadcast
 * (`persistence.ts`, `broadcast.ts`) are added by F-07 on top of `Db.onCommit` / `diff` /
 * `loadDiff` / `applyChanges`.
 */
export * from './errors'
export * from './id-ranges'
export * from './id-strategies'
export * from './store'
export * from './table'
export * from './transaction'
export * from './where'
