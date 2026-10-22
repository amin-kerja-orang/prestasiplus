/**
 * Dump pipeline CLI (AM-10): .cloud production MySQL -> `pp-staging-dump/1` directory, CODE part of the dump step.
 * Plain Node entry, run by the operator (OD-18 A) on a PC with full-disk encryption. Never run by an agent, never
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
 *       outside .migration-out. A file with several hard links is unlinked only (reported).
 *
 *   dump:grants  --database <name> --account "'user'@'host'"
 *       Makes NO connection and needs no option file. Prints, to stdout, the SQL the data owner runs: CREATE USER ... REQUIRE SSL
 *       (the password placeholder stays literal) and one column-level GRANT SELECT per spec table (spec columns minus the
 *       redacted ones), plus the metadata-only information_schema query for column-name questions.
 *       With such an account dump:check and dump:cloud work; a spec column it cannot see is reported as "missing or not granted".
 *
 * Output paths (--out, --work, --dir) are resolved against the working directory. Under `npm run <cmd> -w @pp/api` that
 * directory is `apps/api`, so `--out .migration-out/x` means `apps/api/.migration-out/x`. The location (inside a
 * `.migration-out` folder, new or empty, no stale `.partial`) is checked BEFORE any connection is opened.
 *
 * Environment (never flags: a connection string or password on a command line lands in shell history):
 *   CLOUD_MYSQL_DEFAULTS_FILE  path of a MySQL option file ([client] host, port, user, password, database, ssl-mode).
 *                              Must be OUTSIDE the repository and the working directory, chmod 600 on POSIX.
 *   CLOUD_MYSQL_CLIENT         optional path (or name on PATH) of the mysql/mariadb client. Default: `mysql` (`mysql.exe` on
 *                              Windows) found by walking PATH (never the working directory). A client inside the repository
 *                              or the working directory is refused.
 *   ANON_HMAC_KEY_FILE / ANON_HMAC_KEY   the pseudonymisation key, dump:produce only (use a FRESH key per run).
 * The client gets `--defaults-file=<file>` as its first argument (no other option file is read); SQL goes in on stdin. Its
 * environment is an allow-list (PATH, LANG, LC_ALL, TZ, MYSQL_UNIX_PORT, MYSQL_TEST_LOGIN_FILE pointing nowhere; no HOME; on Windows also SystemRoot, TEMP, TMP, USERPROFILE,
 * PATHEXT, ComSpec): the key and every other variable stay out of the child.
 *
 * Option file keys: only host, port, user, password, database, socket, protocol, ssl-mode, ssl, ssl-ca, ssl-capath, ssl-cert, ssl-key,
 * ssl-verify-server-cert, skip-ssl, default-character-set (`_` = `-`). Any other key (init-command, execute, plugin-dir, tee, pager,
 * loose-*, abbreviations such as hos=) is refused with exit 2, naming the key. Options of [client] and [mysql] are applied in
 * file order and the last one wins; the checks use the effective values.
 *
 * Integers of 2^53 or more: the raw files keep them exactly, but the anonymiser and the loader read JSON with JSON.parse and would
 * round them. dump:cloud and dump:produce therefore refuse a dump that has any (exit 6, the message names the tables only, the partial
 * output / the raw directory is wiped and nothing else is written). Decimals with 16 or more integer digits are not checked.
 *
 * TLS: a remote host in the option file is refused (exit 2) unless it sets ssl-mode=VERIFY_IDENTITY or VERIFY_CA (MariaDB
 * client: ssl plus ssl-verify-server-cert). REQUIRED, PREFERRED, DISABLED, ssl=0 or no setting are refused: use
 * VERIFY_IDENTITY or an SSH tunnel to 127.0.0.1 (a local host needs no TLS).
 *
 * Grants: only USAGE, SELECT (column-level too), SHOW VIEW and SHOW DATABASES are accepted. Anything else, a role grant or an
 * unreadable grant list is refused with exit 3 before a single row is read; PROCESS, REPLICATION CLIENT, BINLOG MONITOR and
 * LOCK TABLES are refused as well.
 *
 * Signals: SIGINT, SIGTERM, SIGHUP (and SIGBREAK on Windows). The first one aborts: the client is killed, the partial output
 * and (dump:produce) the raw directory are deleted, the exit code is 1 (an interrupted run never exits 0, also when the
 * anonymiser had already finished). A second one deletes the raw/partial directories synchronously and exits 130.
 *
 * Exit codes: 0 ok, 1 failed (client error, interrupted, unexpected), 2 usage or configuration (bad flags, option file, TLS,
 * no key, no client binary, output location not acceptable), 3 the account is not read-only (nothing was read),
 * 4 anonymiser default deny (a column has no rule; dump:produce, checked before connecting), 5 leak scan hit
 * (dump:produce; the output was deleted), 6 row-count mismatch or a bad export stream (the partial output was deleted).
 */
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { TABLES } from '../ddl/spec'
import { AnonymiseUsageError, CoverageError, InputError, LeakScanError, OutputError } from '../anonymise/errors'
import { DEFAULT_CONFIG_PATH, loadConfigFile } from '../anonymise/cli'
import { loadHmacKey } from '../anonymise/key'
import type { runAnonymise } from '../anonymise/run'
import type { AnonConfig } from '../anonymise/rules'
import { ProfileOutputError } from '../profile'
import { scrub, scrubbingLogger } from '../staging/log'
import { DumpFormatError } from '../staging/readers'
import { dumpCloud, refusalMessage, runCheck } from './cloud'
import { installSignalHandlers, installStdioGuards } from './cleanup'
import { makeClientConfig, type SpawnFn } from './client'
import { ClientError, DumpAbortedError, DumpError, DumpUsageError, ExportStreamError, ReadOnlyRequiredError, WipeRefusedError } from './errors'
import { buildGrantScript } from './grants-sql'
import { loadOptionFile, WINDOWS_WARNING } from './option-file'
import { produceDump } from './produce'
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
  wipe?: typeof wipeDir
  now?: () => Date
}

const KNOWN_FLAGS: Record<string, readonly string[]> = {
  'dump:check': ['out'],
  'dump:cloud': ['out', 'datetime-offset', 'tables'],
  'dump:produce': ['work', 'datetime-offset', 'tables'],
  'dump:wipe': ['dir'],
  'dump:grants': ['database', 'account'],
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
    if (command === undefined || !(command in KNOWN_FLAGS)) throw new DumpUsageError('Use dump:check, dump:cloud, dump:produce, dump:wipe or dump:grants.')
    for (const name of flags.keys()) if (!(KNOWN_FLAGS[command] as readonly string[]).includes(name)) throw new DumpUsageError('Unknown flag.')
    for (const v of flags.values()) {
      if (CONNECTION_STRING.test(v)) throw new DumpUsageError('Do not put a connection string on the command line. Use CLOUD_MYSQL_DEFAULTS_FILE (an option file outside the repository).')
    }

    if (command === 'dump:grants') {
      const database = flags.get('database')
      const account = flags.get('account')
      if (!database || !account) throw new DumpUsageError("Give --database <name> and --account \"'user'@'host'\".")
      for (const line of buildGrantScript(database, account, TABLES)) out(line)
      return DUMP_EXIT.ok
    }

    if (command === 'dump:wipe') {
      const dir = flags.get('dir')
      if (!dir) throw new DumpUsageError('Give --dir <directory inside a .migration-out folder>.')
      const r = await wipeDir(dir)
      log.info(`${r.files} file(s) overwritten with zeros and removed (${fmt(r.bytes)} bytes); ${r.hardLinked} file(s) unlinked only; ${r.dirs} director${r.dirs === 1 ? 'y' : 'ies'} removed.`)
      if (r.hardLinked > 0) log.warn(`${r.hardLinked} file(s) had more than one hard link: unlinked but NOT overwritten (the other links still hold the data).`)
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
      const r = await dumpCloud({ client, outDir, log, tables, datetimeOffset: offset, now: deps.now })
      log.info(`Output: ${r.tables.length} tables, ${fmt(r.totalRows)} rows in ${r.outDir}. RAW personal data: run dump:wipe --dir on it the same day.`)
      return DUMP_EXIT.ok
    }

    // dump:produce
    const { key, config } = produceInputs as { key: Buffer; config: AnonConfig }
    const r = await produceDump({ client, workDir: outDir, key, config, log, tables, datetimeOffset: offset, now: deps.now, runAnonymise: deps.runAnonymise, wipe: deps.wipe })
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
  installStdioGuards(process)
  installSignalHandlers({
    target: process,
    abort,
    platform: process.platform,
    exit: (code) => process.exit(code),
    err: (line) => console.error(line),
  })
  runDumpCli(process.argv.slice(2), { signal: abort.signal }).then(
    (code) => {
      process.exitCode = code
    },
    () => {
      process.exitCode = DUMP_EXIT.failed
    },
  )
}
