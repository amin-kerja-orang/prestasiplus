import type pg from 'pg'

import type { RunMode } from './types'

/** Parsed command line of a `migrate:*` command. `--dry-run` is the default mode. */
export interface CommandArgs {
  mode: RunMode
  /** `--name value` and `--name=value` flags other than `--dry-run` / `--apply`; bare `--name` is `true`. */
  flags: ReadonlyMap<string, string | true>
  /** Arguments that are not flags. */
  positional: readonly string[]
}

export interface CliContext {
  /** Connected lazily: the pool does not touch the database until the first query. */
  pool: pg.Pool
  env: Readonly<Record<string, string | undefined>>
  out(line: string): void
  err(line: string): void
}

/**
 * A `migrate:*` command (BE-27 .. BE-30 add theirs). Returns the process exit code: 0 success,
 * 1 the run failed or a reconciliation row mismatched. Throw `ApplyRefusedError` (the runner does)
 * and the CLI maps it to exit code 3.
 */
export interface MigrateCommand {
  name: `migrate:${string}`
  summary: string
  run(args: CommandArgs, ctx: CliContext): Promise<number>
}

const commands = new Map<string, MigrateCommand>()

/** Commands call this at import time; `cli.ts` imports every file in `src/migration/commands/`. */
export function registerMigrateCommand(command: MigrateCommand): void {
  if (!command.name.startsWith('migrate:')) throw new RangeError(`Command "${command.name}" must start with "migrate:".`)
  if (commands.has(command.name)) throw new Error(`Command "${command.name}" is registered twice.`)
  commands.set(command.name, command)
}

export function listMigrateCommands(): MigrateCommand[] {
  return [...commands.values()].sort((a, b) => (a.name < b.name ? -1 : 1))
}

export function findMigrateCommand(name: string): MigrateCommand | undefined {
  return commands.get(name)
}

/** Test helper: removes a command so a test can register its own. */
export function unregisterMigrateCommand(name: string): void {
  commands.delete(name)
}
