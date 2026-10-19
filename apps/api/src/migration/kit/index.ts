/**
 * Migration kit (BE-34, plan section 14). Loaders (BE-27 .. BE-30) import from here only:
 *
 *   upsertByLegacy   idempotent bulk upsert by (legacy_source, legacy_id), skips unchanged hashes
 *   IdMap            etl_id_map lookups (resolve parents, register derived rows)
 *   Rejects          reason-coded rejects, never row values
 *   RunLedger        etl_runs / etl_recon access
 *   loadCheckpoint / saveCheckpoint, batches
 *   resolveSelfReferences   pass 2 of the two-pass self-reference load
 *   Runner           dry-run (default) and apply with the dry-run gate
 *   registerMigrateCommand  how a `migrate:*` CLI command self-registers
 */
export { batches } from './batches'
export { loadCheckpoint, saveCheckpoint, type Checkpoint } from './checkpoint'
export { IdMap } from './id-map'
export {
  emptyCounters,
  RunLedger,
  type EntityCounters,
  type ReconRow,
  type RunCounters,
  type RunRow,
  type StartRun,
} from './ledger'
export {
  findMigrateCommand,
  listMigrateCommands,
  registerMigrateCommand,
  unregisterMigrateCommand,
  type CliContext,
  type CommandArgs,
  type MigrateCommand,
} from './registry'
export { Rejects, type RejectInput } from './rejects'
export {
  ApplyRefusedError,
  RunInProgressError,
  Runner,
  type BatchContext,
  type BatchResult,
  type EntityStep,
  type RunOptions,
  type RunReport,
} from './runner'
export { resolveSelfReferences, type SelfReferenceSpec } from './self-reference'
export { hashInput, hashRow, hashValue } from './sql'
export {
  assertLegacySource,
  LEGACY_SOURCES,
  REJECT_REASONS,
  type LegacySource,
  type LoadStats,
  type RejectReason,
  type RunMode,
  type RunStatus,
  type SqlExecutor,
} from './types'
export { upsertByLegacy, type LegacyRow, type UpsertResult, type UpsertSpec } from './upsert'
