/**
 * Migration CLI skeleton (BE-34). Run with `npx tsx src/migration/cli.ts <command> [flags]` from
 * `apps/api` (BE-27 adds the npm script).
 *
 *   migrate:list                       lists registered commands
 *   migrate:<name> [--dry-run|--apply] a command registered by BE-27 .. BE-30
 *
 * `--dry-run` is the default; `--apply` needs a passing dry-run on the same input hash.
 * Exit codes: 0 ok, 1 run failed or reconciliation mismatch, 2 usage or configuration error,
 * 3 `--apply` refused (no passing dry-run), 4 another run on the same input is active.
 *
 * Commands self-register: every `.ts` / `.js` file in `src/migration/commands/` is imported at
 * start-up and calls `registerMigrateCommand` (see `kit/registry.ts`). The kit has no real entity.
 */
import { existsSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import pg from 'pg'

import {
  ApplyRefusedError,
  findMigrateCommand,
  listMigrateCommands,
  RunInProgressError,
  type CliContext,
  type CommandArgs,
} from './kit'

export const EXIT = { ok: 0, failed: 1, usage: 2, applyRefused: 3, busy: 4 } as const

export class UsageError extends Error {}

/** `--dry-run` / `--apply` choose the mode (default dry-run); giving both is an error. */
export function parseArgs(argv: readonly string[]): { command: string | undefined; args: CommandArgs } {
  const flags = new Map<string, string | true>()
  const positional: string[] = []
  let dryRun = false
  let apply = false
  let command: string | undefined
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i] as string
    if (!token.startsWith('--')) {
      if (command === undefined) command = token
      else positional.push(token)
      continue
    }
    const eq = token.indexOf('=')
    const name = eq === -1 ? token.slice(2) : token.slice(2, eq)
    if (name === 'dry-run') dryRun = true
    else if (name === 'apply') apply = true
    else if (eq !== -1) flags.set(name, token.slice(eq + 1))
    else if (argv[i + 1] !== undefined && !(argv[i + 1] as string).startsWith('--')) flags.set(name, argv[++i] as string)
    else flags.set(name, true)
  }
  if (dryRun && apply) throw new UsageError('Use either --dry-run or --apply, not both.')
  return { command, args: { mode: apply ? 'apply' : 'dry-run', flags, positional } }
}

/** Imports every file in `src/migration/commands/` so the commands register themselves. */
export async function loadCommands(dir = new URL('./commands/', import.meta.url)): Promise<void> {
  const path = fileURLToPath(dir)
  if (!existsSync(path)) return
  for (const file of readdirSync(path).sort()) {
    if (/\.(spec|test)\.[tj]s$|\.d\.ts$/.test(file) || !/\.[tj]s$/.test(file)) continue
    await import(pathToFileURL(resolve(path, file)).href)
  }
}

export interface CliDeps {
  env?: Readonly<Record<string, string | undefined>>
  out?: (line: string) => void
  err?: (line: string) => void
  /** Provide a pool in tests; otherwise one is created from `DATABASE_URL`. */
  pool?: pg.Pool
}

/** Runs one CLI invocation and returns the exit code (the caller exits the process). */
export async function runCli(argv: readonly string[], deps: CliDeps = {}): Promise<number> {
  const env = deps.env ?? process.env
  const out = deps.out ?? ((line: string) => console.log(line))
  const err = deps.err ?? ((line: string) => console.error(line))

  let parsed: ReturnType<typeof parseArgs>
  try {
    parsed = parseArgs(argv)
  } catch (e) {
    err(e instanceof Error ? e.message : String(e))
    return EXIT.usage
  }
  const { command, args } = parsed

  if (command === undefined || command === 'migrate:list') {
    const all = listMigrateCommands()
    if (all.length === 0) out('No migrate:* commands are registered yet.')
    for (const c of all) out(`${c.name}  ${c.summary}`)
    return EXIT.ok
  }
  const found = findMigrateCommand(command)
  if (!found) {
    err(`Unknown command "${command}". Run migrate:list.`)
    return EXIT.usage
  }

  const ownPool = deps.pool === undefined
  let pool = deps.pool
  if (!pool) {
    const url = env.DATABASE_URL
    if (!url) {
      err('DATABASE_URL is not set (see .env.api.example).')
      return EXIT.usage
    }
    pool = new pg.Pool({ connectionString: url, max: 4 })
  }
  const ctx: CliContext = { pool, env, out, err }
  try {
    return await found.run(args, ctx)
  } catch (e) {
    if (e instanceof ApplyRefusedError) {
      err(e.message)
      return EXIT.applyRefused
    }
    if (e instanceof RunInProgressError) {
      err(e.message)
      return EXIT.busy
    }
    // Messages from the kit carry ids and counts only; never print row values.
    err(`${command} failed: ${e instanceof Error ? e.message : String(e)}`)
    return EXIT.failed
  } finally {
    if (ownPool) await pool.end()
  }
}

async function main(): Promise<void> {
  await loadCommands()
  process.exitCode = await runCli(process.argv.slice(2))
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : String(e))
    process.exit(EXIT.failed)
  })
}
