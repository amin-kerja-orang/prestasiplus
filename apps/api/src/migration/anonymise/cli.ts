/**
 * Anonymiser CLI (BE-35). Plain Node entry, run by the LEAD on the lead's PC only (OD-18).
 *
 *   anonymise:run  --source <dump dir | pg> --out <dir inside .migration-out> [--config <anon.config.json>] [--source-schema <schema>]
 *   anonymise:scan --dir <dump dir> [--allow-email-domains a.test,b.test]    (patterns only; also works on a synthetic fixture)
 *
 * `--source pg` reads `CLOUD_SOURCE_URL` (a READ-ONLY role on a restore; the same guard as staging:load).
 * A connection string is never accepted on the command line, so it cannot land in shell history.
 * The key comes from `ANON_HMAC_KEY` or `ANON_HMAC_KEY_FILE` (outside the repository). Without it the tool
 * refuses to run. The tool never writes to the source.
 *
 * Exit codes: 0 ok, 1 failed, 2 usage or configuration error (also: no key), 3 the source role can write
 * (nothing was read), 4 default deny (a column has no rule, nothing was read), 5 the leak scan found
 * personal-looking data (the output was deleted).
 */
import { existsSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { CloudSource, CloudSourceConfigError, CloudSourceConnectError, ReadOnlyViolationError } from '../cloud-source'
import { TABLES } from '../ddl/spec'
import { prepareOutputDir, ProfileOutputError } from '../profile'
import { scrub, scrubbingLogger, secretsFromUrl } from '../staging/log'
import { DirReader, DumpFormatError, PgReader, type TableReader } from '../staging/readers'
import { AnonymiseUsageError, ConfigError, CoverageError, InputError, LeakScanError, OutputError } from './errors'
import { loadHmacKey } from './key'
import { LeakScanner, scanDumpDirectory } from './leak-scan'
import { assertNotOverlapping, assertOutputUsable, runAnonymise } from './run'
import { checkCoverage, parseConfig } from './rules'

export const ANON_EXIT = { ok: 0, failed: 1, usage: 2, sourceRefused: 3, coverage: 4, leak: 5 } as const

export const DEFAULT_CONFIG_PATH = fileURLToPath(new URL('./anon.config.json', import.meta.url))

export interface AnonCliDeps {
  env?: Readonly<Record<string, string | undefined>>
  out?: (line: string) => void
  err?: (line: string) => void
}

const KNOWN_FLAGS: Record<string, readonly string[]> = {
  'anonymise:run': ['source', 'out', 'config', 'source-schema'],
  'anonymise:scan': ['dir', 'allow-email-domains'],
}

function parseFlags(argv: readonly string[]): { command: string | undefined; flags: Map<string, string> } {
  const flags = new Map<string, string>()
  let command: string | undefined
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i] as string
    if (!token.startsWith('--')) {
      if (command !== undefined) throw new AnonymiseUsageError('Unexpected extra argument.')
      command = token
      continue
    }
    const eq = token.indexOf('=')
    const name = eq === -1 ? token.slice(2) : token.slice(2, eq)
    let value: string | undefined = eq === -1 ? undefined : token.slice(eq + 1)
    if (value === undefined && argv[i + 1] !== undefined && !(argv[i + 1] as string).startsWith('--')) value = argv[++i] as string
    if (value === undefined || value === '') throw new AnonymiseUsageError(`--${name.replace(/[^a-z-]/g, '')} needs a value.`)
    flags.set(name, value)
  }
  return { command, flags }
}

const CONNECTION_STRING = /^[a-z][a-z0-9+.-]*:\/\//i

export function loadConfigFile(path: string) {
  if (!existsSync(path) || !statSync(path).isFile()) throw new ConfigError('The config file does not exist.')
  let json: unknown
  try {
    json = JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    throw new ConfigError('The config file is not valid JSON.')
  }
  return parseConfig(json)
}

export async function runAnonymiseCli(argv: readonly string[], deps: AnonCliDeps = {}): Promise<number> {
  const env = deps.env ?? process.env
  const out = deps.out ?? ((line: string) => console.log(line))
  const err = deps.err ?? ((line: string) => console.error(line))
  // The key and any connection string are scrubbed from every line, whatever happens.
  const secrets: string[] = [...secretsFromUrl(env.CLOUD_SOURCE_URL)]
  for (const v of [env.ANON_HMAC_KEY]) if (v) secrets.push(v)
  const log = scrubbingLogger({ out, err }, secrets)

  let reader: TableReader | undefined
  try {
    const { command, flags } = parseFlags(argv)
    if (command !== 'anonymise:run' && command !== 'anonymise:scan') {
      throw new AnonymiseUsageError('Use anonymise:run or anonymise:scan.')
    }
    for (const name of flags.keys()) {
      if (!(KNOWN_FLAGS[command] as readonly string[]).includes(name)) throw new AnonymiseUsageError('Unknown flag.')
    }

    if (command === 'anonymise:scan') {
      const dir = flags.get('dir')
      if (!dir) throw new AnonymiseUsageError('Give --dir <dump directory>.')
      const extra = (flags.get('allow-email-domains') ?? '').split(',').map((s) => s.trim()).filter(Boolean)
      const scan = await scanDumpDirectory(dir, new LeakScanner(null, { allowedEmailDomains: ['example.test', ...extra] }))
      log.info(`Scanned ${scan.rowsScanned} rows, ${scan.cellsScanned} cells.`)
      if (scan.hits.length > 0) {
        throw new LeakScanError(scan.hits)
      }
      log.info('Leak scan: clean (patterns only).')
      return ANON_EXIT.ok
    }

    // 1. The key. No key, no run (before anything else is opened).
    const { key, origin } = loadHmacKey(env)
    secrets.push(key.toString('utf8'))
    log.info(`Pseudonymisation key loaded from ${origin === 'env' ? 'ANON_HMAC_KEY' : 'ANON_HMAC_KEY_FILE'}.`)

    // 2. Rules and default deny, before the source or the output is touched.
    const config = loadConfigFile(resolve(flags.get('config') ?? DEFAULT_CONFIG_PATH))
    checkCoverage(TABLES, config)

    // 3. Source and output.
    const source = flags.get('source')
    if (!source) throw new AnonymiseUsageError('Give --source <dump directory> or --source pg.')
    if (CONNECTION_STRING.test(source)) {
      throw new AnonymiseUsageError('Do not put a connection string on the command line. Set CLOUD_SOURCE_URL (from a restricted file) and use --source pg.')
    }
    const outFlag = flags.get('out')
    if (!outFlag) throw new AnonymiseUsageError('Give --out <directory inside a .migration-out folder>.')
    let sourceDir: string | undefined
    if (source === 'pg') {
      if (!env.CLOUD_SOURCE_URL) throw new AnonymiseUsageError('CLOUD_SOURCE_URL is not set (a read-only role on the restore).')
    } else {
      sourceDir = resolve(source)
    }
    assertNotOverlapping(resolve(outFlag), sourceDir) // before anything is created
    const outDir = prepareOutputDir(resolve(outFlag))
    assertOutputUsable(outDir, sourceDir)

    if (source === 'pg') {
      const opened = await CloudSource.open({ url: env.CLOUD_SOURCE_URL, schema: flags.get('source-schema') })
      for (const w of opened.warnings) log.warn(w)
      reader = new PgReader(opened)
    } else {
      reader = new DirReader(sourceDir as string)
    }

    const result = await runAnonymise({ reader, outDir, config, key, sourceDir, log })
    log.info(`Output: ${result.tables.length} tables, ${result.totalRows} rows in ${outDir}. Share it out-of-band, encrypted, and delete it after the rehearsal.`)
    return ANON_EXIT.ok
  } catch (e) {
    if (e instanceof CoverageError) {
      log.warn(e.message)
      return ANON_EXIT.coverage
    }
    if (e instanceof LeakScanError) {
      log.warn(e.message)
      return ANON_EXIT.leak
    }
    if (e instanceof ReadOnlyViolationError) {
      log.warn(e.message)
      return ANON_EXIT.sourceRefused
    }
    if (e instanceof AnonymiseUsageError || e instanceof CloudSourceConfigError) {
      log.warn(e.message)
      return ANON_EXIT.usage
    }
    if (
      e instanceof OutputError ||
      e instanceof ProfileOutputError ||
      e instanceof InputError ||
      e instanceof DumpFormatError ||
      e instanceof CloudSourceConnectError
    ) {
      log.warn(`${argv[0] ?? 'anonymise'} failed: ${e.message}`)
      return ANON_EXIT.failed
    }
    // Unknown error: class and SQLSTATE only, a driver message may echo a value.
    const code = (e as { code?: unknown })?.code
    log.warn(scrub(`${argv[0] ?? 'anonymise'} failed with an unexpected ${e instanceof Error ? e.name : 'error'}${typeof code === 'string' ? ` (${code})` : ''}.`, secrets))
    return ANON_EXIT.failed
  } finally {
    await reader?.close().catch(() => undefined)
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runAnonymiseCli(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code
    },
    () => {
      process.exitCode = ANON_EXIT.failed
    },
  )
}
