/**
 * Staging CLI (BE-27). Plain Node entry (run from the root: `npm run staging:load -w @pp/api -- ...`).
 *
 *   staging:load    [--source cloud] [--from <dump dir>] [--source-schema <schema>] [--allow-extra-columns] [--tables a,b]
 *   staging:profile [--out <dir containing .migration-out>] [--tables a,b]
 *
 * Environment: `DATABASE_URL` is the TARGET database (it gets the `staging_cloud` and `archive_cloud`
 * schemas, dropped and recreated). The input is a dump directory (`--from`) OR the read-only
 * `CLOUD_SOURCE_URL`, never both. `staging:load` also needs `PP_ALLOW_STAGING_RESET=1`, a target database
 * named `*_staging` (or listed in `PP_STAGING_DB_ALLOWLIST`) and NODE_ENV not production.
 * Exit codes: 0 ok, 1 failed, 2 usage or configuration error, 3 the source role can write (nothing was
 * read), 4 the destructive-reset guard refused (nothing was changed).
 */
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import pg from 'pg'

import { CloudSource, CloudSourceConfigError, CloudSourceConnectError, ReadOnlyViolationError } from '../cloud-source'
import { collectProfile, ProfileOutputError, writeProfile } from '../profile'
import { findTable, type TableSpec } from '../ddl/spec'
import { LEGACY_SOURCES, type LegacySource } from '../kit/types'
import { serverIdentity, StagingResetRefusedError } from './guard'
import { scrub, scrubbingLogger, secretsFromUrl } from './log'
import { loadStaging, LoaderError } from './load'
import { DirReader, DumpFormatError, PgReader, type TableReader } from './readers'

export const STAGING_EXIT = { ok: 0, failed: 1, usage: 2, sourceRefused: 3, resetRefused: 4 } as const

export interface StagingCliDeps {
  env?: Readonly<Record<string, string | undefined>>
  out?: (line: string) => void
  err?: (line: string) => void
  /** A pool on the target database (tests); otherwise one is created from `DATABASE_URL`. */
  pool?: pg.Pool
  now?: Date
}

class UsageError extends Error {}

/** `--tables a,b` as spec tables (a subset load or profile). */
function parseTables(value: string | undefined): TableSpec[] | undefined {
  if (value === undefined) return undefined
  return value.split(',').map((name) => {
    const spec = findTable(name.trim())
    if (!spec) throw new UsageError('--tables names a table that is not in the staging spec.')
    return spec
  })
}

function parseFlags(argv: readonly string[]): { command: string | undefined; flags: Map<string, string | true> } {
  const flags = new Map<string, string | true>()
  let command: string | undefined
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i] as string
    if (!token.startsWith('--')) {
      if (command === undefined) command = token
      else throw new UsageError(`Unexpected argument "${token}".`)
      continue
    }
    const eq = token.indexOf('=')
    if (eq !== -1) flags.set(token.slice(2, eq), token.slice(eq + 1))
    else if (argv[i + 1] !== undefined && !(argv[i + 1] as string).startsWith('--')) flags.set(token.slice(2), argv[++i] as string)
    else flags.set(token.slice(2), true)
  }
  return { command, flags }
}

const flagString = (flags: Map<string, string | true>, name: string): string | undefined => {
  const v = flags.get(name)
  if (v === true) throw new UsageError(`--${name} needs a value.`)
  return v
}

export async function runStagingCli(argv: readonly string[], deps: StagingCliDeps = {}): Promise<number> {
  const env = deps.env ?? process.env
  const out = deps.out ?? ((line: string) => console.log(line))
  const err = deps.err ?? ((line: string) => console.error(line))
  const secrets = [...secretsFromUrl(env.CLOUD_SOURCE_URL), ...secretsFromUrl(env.DATABASE_URL)]
  const log = scrubbingLogger({ out, err }, secrets)

  const ownPool = deps.pool === undefined
  let pool = deps.pool
  let reader: TableReader | undefined
  let onPoolError: ((e: Error) => void) | undefined
  try {
    const { command, flags } = parseFlags(argv)
    if (command !== 'staging:load' && command !== 'staging:profile') {
      throw new UsageError('Use staging:load or staging:profile.')
    }
    if (!pool) {
      if (!env.DATABASE_URL) throw new UsageError('DATABASE_URL (the target database) is not set.')
      pool = new pg.Pool({ connectionString: env.DATABASE_URL, max: 4 })
    }
    // An idle client can fail after the run started; report it scrubbed instead of crashing with a raw message.
    if (typeof pool.on === 'function') {
      onPoolError = (e: Error) => log.warn(`The database connection reported an error (${(e as { code?: string }).code ?? 'unknown'}).`)
      pool.on('error', onPoolError)
    }

    if (command === 'staging:profile') {
      const tables = parseTables(flagString(flags, 'tables'))
      const report = await collectProfile(pool, deps.now, { tables: tables?.map((t) => t.name) })
      const outDir = flagString(flags, 'out') ?? resolve('.migration-out')
      const files = writeProfile(report, outDir)
      log.info(`Profile written: ${files.md} and ${files.json}.`)
      return STAGING_EXIT.ok
    }

    const sourceFlag = flagString(flags, 'source') ?? 'cloud'
    if (!(LEGACY_SOURCES as readonly string[]).includes(sourceFlag)) throw new UsageError('Unknown --source. Allowed: cloud, my.')
    const source = sourceFlag as LegacySource
    const from = flagString(flags, 'from')
    if (from !== undefined && env.CLOUD_SOURCE_URL) {
      throw new UsageError('Give either --from <dump dir> or CLOUD_SOURCE_URL, not both.')
    }
    if (from !== undefined) reader = new DirReader(from)
    else if (env.CLOUD_SOURCE_URL) {
      const opened = await CloudSource.open({
        url: env.CLOUD_SOURCE_URL,
        schema: flagString(flags, 'source-schema'),
        target: await serverIdentity(pool),
      })
      for (const w of opened.warnings) log.warn(w)
      reader = new PgReader(opened)
    } else throw new UsageError('Give --from <dump dir> or set CLOUD_SOURCE_URL (a read-only role).')

    const result = await loadStaging(pool, reader, {
      source,
      allowExtraColumns: flags.has('allow-extra-columns'),
      log,
      env,
      tables: parseTables(flagString(flags, 'tables')),
    })
    const absent = result.tables.filter((t) => t.absent).length
    log.info(`Done: ${result.tables.length} tables (${absent} absent from the input), ${result.totalRows} rows.`)
    return STAGING_EXIT.ok
  } catch (e) {
    if (e instanceof UsageError || e instanceof CloudSourceConfigError) {
      log.warn(e.message)
      return STAGING_EXIT.usage
    }
    if (e instanceof StagingResetRefusedError) {
      log.warn(e.message)
      return STAGING_EXIT.resetRefused
    }
    if (e instanceof ReadOnlyViolationError) {
      log.warn(e.message)
      return STAGING_EXIT.sourceRefused
    }
    if (
      e instanceof LoaderError ||
      e instanceof DumpFormatError ||
      e instanceof CloudSourceConnectError ||
      e instanceof ProfileOutputError
    ) {
      log.warn(`${argv[0] ?? 'staging'} failed: ${e.message}`)
      return STAGING_EXIT.failed
    }
    // Unknown error: print the class and SQLSTATE only, a driver message may echo a value.
    const code = (e as { code?: unknown })?.code
    log.warn(scrub(`${argv[0] ?? 'staging'} failed with an unexpected ${e instanceof Error ? e.name : 'error'}${typeof code === 'string' ? ` (${code})` : ''}.`, secrets))
    return STAGING_EXIT.failed
  } finally {
    await reader?.close().catch(() => undefined)
    if (onPoolError) pool?.removeListener('error', onPoolError)
    if (ownPool) await pool?.end().catch(() => undefined)
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runStagingCli(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code
    },
    () => {
      process.exitCode = STAGING_EXIT.failed
    },
  )
}
