/**
 * Dump pipeline CLI (AM-10): .cloud production MySQL -> `pp-staging-dump/1` directory, CODE part of the dump step.
 * Plain Node entry, run by AMIN (the human, OD-2 / OD-18) on a PC with full-disk encryption. Never run by an agent, never
 * pointed at a cloud host from here. Live data only ever reaches `.migration-out/` (git-ignored) of that PC.
 *
 *   dump:check   --out <dir in .migration-out>
 *       Preflight. Reads NO data rows: server version, time zones, grants, the column list of the database compared with
 *       ddl/spec.ts, and COUNT(*) per table. Writes schema-report.json and schema-report.md.
 *   dump:cloud   --out <dir in .migration-out> [--datetime-offset +08:00] [--tables a,b]
 *       Grant check (exit 3 = nothing read), schema read, then ONE client session in a consistent read-only snapshot.
 *       Writes a RAW dump (manifest.json with raw:true, <table>.ndjson, schema-report.*). Delete it the same day.
 *   dump:produce --work <dir in .migration-out> [--datetime-offset +08:00] [--tables a,b]
 *       The whole step: key check, dump:cloud into <work>/raw, the anonymiser into <work>/anon (with its leak scan), and the
 *       raw directory is wiped in a `finally`. Prints only aggregates (rows, bytes, sha256 of anon/manifest.json, seconds).
 *   dump:wipe    --dir <dir in .migration-out>
 *       Overwrites every file with zeros once, fsyncs, unlinks, removes the directories. Refuses symlinks and anything
 *       outside .migration-out.
 *
 * Environment (never flags: a connection string or password on a command line lands in shell history):
 *   CLOUD_MYSQL_DEFAULTS_FILE  path of a MySQL option file ([client] host, port, user, password, database, ssl-mode).
 *                              Must be OUTSIDE the repository and the working directory, chmod 600 on POSIX.
 *   CLOUD_MYSQL_CLIENT         optional path of the mysql/mariadb client binary (default `mysql`; `mysql.exe` on Windows).
 *   ANON_HMAC_KEY_FILE / ANON_HMAC_KEY   the pseudonymisation key, dump:produce only (use a FRESH key per run).
 * The client gets `--defaults-extra-file=<file>` as its first argument; SQL goes in on stdin.
 *
 * Exit codes: 0 ok, 1 failed (client error, interrupted, unexpected), 2 usage or configuration (bad flags, option file,
 * no key, no client binary, output location not acceptable), 3 the account is not read-only (nothing was read),
 * 4 anonymiser default deny (a column has no rule; dump:produce, checked before connecting), 5 leak scan hit
 * (dump:produce; the output was deleted), 6 row-count mismatch or a bad export stream (the partial output was deleted).
 */
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { AnonymiseUsageError, CoverageError, InputError, LeakScanError, OutputError } from '../anonymise/errors'
import { DEFAULT_CONFIG_PATH, loadConfigFile } from '../anonymise/cli'
import { loadHmacKey } from '../anonymise/key'
import { assertOutputUsable, type runAnonymise } from '../anonymise/run'
import type { AnonConfig } from '../anonymise/rules'
import { ProfileOutputError } from '../profile'
import { scrub, scrubbingLogger } from '../staging/log'
import { DumpFormatError } from '../staging/readers'
import { dumpCloud, runCheck } from './cloud'
import { makeClientConfig, type SpawnFn } from './client'
import { ClientError, DumpAbortedError, DumpError, DumpUsageError, ExportStreamError, ReadOnlyRequiredError, WipeRefusedError } from './errors'
import { loadOptionFile, WINDOWS_WARNING } from './option-file'
import { produceDump } from './produce'
import { refusalMessage } from './cloud'
import { WIPE_NOTE, wipeDir } from './wipe'

export const DUMP_EXIT = { ok: 0, failed: 1, usage: 2, notReadOnly: 3, coverage: 4, leak: 5, stream: 6 } as const

export interface DumpCliDeps {
  /** Tests only: pretend to run on another platform (default process.platform). */
  platform?: string
  env?: Readonly<Record<string, string | undefined>>
  out?: (line: string) => void
  err?: (line: string) => void
  /** SIGINT/SIGTERM: kills the client and deletes the partial output. */
  signal?: AbortSignal
  /** Tests only. */
  spawn?: SpawnFn
  config?: AnonConfig
  runAnonymise?: typeof runAnonymise
  now?: () => Date
}

const KNOWN_FLAGS: Record<string, readonly string[]> = {
  'dump:check': ['out'],
  'dump:cloud': ['out', 'datetime-offset', 'tables'],
  'dump:produce': ['work', 'datetime-offset', 'tables'],
  'dump:wipe': ['dir'],
}

function parseFlags(argv: readonly string[]): { command: string | undefined; flags: Map<string, string> } {
  const flags = new Map<string, string>()
  let command: string | undefined
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i] as string
    if (!token.startsWith('--')) {
      if (command !== undefined) throw new DumpUsageError('Unexpected extra argument.')
      command = token
      continue
    }
    const eq = token.indexOf('=')
    const name = eq === -1 ? token.slice(2) : token.slice(2, eq)
    let value: string | undefined = eq === -1 ? undefined : token.slice(eq + 1)
    if (value === undefined && argv[i + 1] !== undefined && !(argv[i + 1] as string).startsWith('--')) value = argv[++i] as string
    if (value === undefined || value === '') throw new DumpUsageError(`--${name.replace(/[^a-z-]/g, '')} needs a value.`)
    flags.set(name, value)
  }
  return { command, flags }
}

const CONNECTION_STRING = /^[a-z][a-z0-9+.-]*:\/\//i

function parseTables(value: string | undefined): string[] | undefined {
  if (value === undefined) return undefined
  const names = value.split(',').map((s) => s.trim()).filter(Boolean)
  if (names.length === 0) throw new DumpUsageError('--tables needs at least one table name.')
  for (const n of names) if (!/^[a-z][a-z0-9_]*$/.test(n)) throw new DumpUsageError('--tables takes plain table names separated by commas.')
  return names
}

const fmt = (n: number): string => n.toLocaleString('en-US')

export async function runDumpCli(argv: readonly string[], deps: DumpCliDeps = {}): Promise<number> {
  const env = deps.env ?? process.env
  const platform = deps.platform ?? process.platform
  const out = deps.out ?? ((line: string) => console.log(line))
  const err = deps.err ?? ((line: string) => console.error(line))
  // Anything that could be a secret is scrubbed from every line, whatever happens.
  const secrets: string[] = []
  for (const v of [env.ANON_HMAC_KEY]) if (v) secrets.push(v)
  const log = scrubbingLogger({ out, err }, secrets)

  try {
    const { command, flags } = parseFlags(argv)
    if (command === undefined || !(command in KNOWN_FLAGS)) throw new DumpUsageError('Use dump:check, dump:cloud, dump:produce or dump:wipe.')
    for (const name of flags.keys()) if (!(KNOWN_FLAGS[command] as readonly string[]).includes(name)) throw new DumpUsageError('Unknown flag.')
    for (const v of flags.values()) {
      if (CONNECTION_STRING.test(v)) throw new DumpUsageError('Do not put a connection string on the command line. Use CLOUD_MYSQL_DEFAULTS_FILE (an option file outside the repository).')
    }

    if (command === 'dump:wipe') {
      const dir = flags.get('dir')
      if (!dir) throw new DumpUsageError('Give --dir <directory inside a .migration-out folder>.')
      const r = await wipeDir(dir)
      log.info(`Wiped ${r.files} file(s), ${fmt(r.bytes)} bytes, ${r.dirs} director${r.dirs === 1 ? 'y' : 'ies'}.`)
      log.info(WIPE_NOTE)
      return DUMP_EXIT.ok
    }

    const needsOut = command === 'dump:produce' ? 'work' : 'out'
    const target = flags.get(needsOut)
    if (!target) throw new DumpUsageError(`Give --${needsOut} <directory inside a .migration-out folder>.`)
    const offset = flags.get('datetime-offset')
    const tables = parseTables(flags.get('tables'))
    const outDir = resolve(target)

    // dump:produce: the key and the rules first, before any connection (and before any raw byte exists).
    let produceInputs: { key: Buffer; config: AnonConfig } | undefined
    if (command === 'dump:produce') {
      const { key, origin } = loadHmacKey(env)
      secrets.push(key.toString('utf8'))
      log.info(`Pseudonymisation key loaded from ${origin === 'env' ? 'ANON_HMAC_KEY' : 'ANON_HMAC_KEY_FILE'}.`)
      if (origin === 'env') log.warn('ANON_HMAC_KEY was set inline: it may be in your shell history. Prefer ANON_HMAC_KEY_FILE.')
      produceInputs = { key, config: deps.config ?? loadConfigFile(DEFAULT_CONFIG_PATH) }
    }

    const optionFile = loadOptionFile(env, platform)
    secrets.push(...optionFile.secrets)
    for (const w of optionFile.warnings) log.warn(w)
    const client = makeClientConfig(env, platform, optionFile, { spawn: deps.spawn, signal: deps.signal })
    if (platform === 'win32' && !optionFile.warnings.includes(WINDOWS_WARNING)) log.warn(WINDOWS_WARNING)

    if (command === 'dump:check') {
      const r = await runCheck({ client, outDir, log, tables, now: deps.now })
      const t = r.report.totals
      log.info(`Schema: ${t.tables_present} of ${t.tables_expected} spec tables present, ${t.rows === null ? 'rows not counted' : `${fmt(t.rows)} rows`}.`)
      log.info(`Report: ${r.outDir}/schema-report.md (and .json).`)
      if (!r.verdict.readOnly) {
        log.warn(refusalMessage(r.verdict))
        return DUMP_EXIT.notReadOnly
      }
      log.info('Grants: read-only (accepted).')
      return DUMP_EXIT.ok
    }

    if (command === 'dump:cloud') {
      assertOutputUsable(outDir)
      const r = await dumpCloud({ client, outDir, log, tables, datetimeOffset: offset, now: deps.now })
      log.info(`Output: ${r.tables.length} tables, ${fmt(r.totalRows)} rows in ${r.outDir}. RAW personal data: run dump:wipe --dir on it the same day.`)
      return DUMP_EXIT.ok
    }

    // dump:produce
    const { key, config } = produceInputs as { key: Buffer; config: AnonConfig }
    const r = await produceDump({ client, workDir: outDir, key, config, log, tables, datetimeOffset: offset, now: deps.now, runAnonymise: deps.runAnonymise })
    for (const t of r.tables) log.info(`${t.table}: ${fmt(t.rows)} rows, ${fmt(t.bytes)} bytes`)
    log.info(`Anonymised dump: ${r.tables.length} tables, ${fmt(r.totalRows)} rows in ${r.anonDir}.`)
    log.info(`sha256 of anon/manifest.json: ${r.manifestSha256}`)
    log.info(`Elapsed: ${(r.elapsedMs / 1000).toFixed(1)} s. The raw dump was deleted. Share ${r.anonDir} out-of-band, encrypted.`)
    return DUMP_EXIT.ok
  } catch (e) {
    if (e instanceof CoverageError) {
      log.warn(`${e.message} Add the rules to anon.config.json, then run again. No data was fetched.`)
      return DUMP_EXIT.coverage
    }
    if (e instanceof LeakScanError) {
      log.warn(e.message)
      return DUMP_EXIT.leak
    }
    if (e instanceof ReadOnlyRequiredError) {
      log.warn(e.message)
      return DUMP_EXIT.notReadOnly
    }
    if (e instanceof ExportStreamError) {
      log.warn(`${argv[0] ?? 'dump'} failed: ${e.message} The partial output was deleted.`)
      return DUMP_EXIT.stream
    }
    if (e instanceof DumpUsageError || e instanceof AnonymiseUsageError || e instanceof WipeRefusedError || e instanceof OutputError || e instanceof ProfileOutputError) {
      log.warn(e.message)
      return DUMP_EXIT.usage
    }
    if (e instanceof DumpAbortedError) {
      log.warn('Interrupted. The partial output was deleted.')
      return DUMP_EXIT.failed
    }
    if (e instanceof ClientError || e instanceof DumpError || e instanceof InputError || e instanceof DumpFormatError) {
      log.warn(`${argv[0] ?? 'dump'} failed: ${e.message}`)
      return DUMP_EXIT.failed
    }
    // Unknown error: class and code only, a message may echo a value.
    const code = (e as { code?: unknown })?.code
    log.warn(scrub(`${argv[0] ?? 'dump'} failed with an unexpected ${e instanceof Error ? e.name : 'error'}${typeof code === 'string' ? ` (${code})` : ''}.`, secrets))
    return DUMP_EXIT.failed
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const abort = new AbortController()
  process.once('SIGINT', () => abort.abort())
  process.once('SIGTERM', () => abort.abort())
  runDumpCli(process.argv.slice(2), { signal: abort.signal }).then(
    (code) => {
      process.exitCode = code
    },
    () => {
      process.exitCode = DUMP_EXIT.failed
    },
  )
}
