/**
 * Shared helper of the UAT data-operations scripts (`apps/api/scripts/uat-ops/`), created by S4-T03 and imported by the later scripts
 * (S3-T08, S4-T04, S4-T08). Self-contained: plain `pg`, no Prisma, no Nest, so a script starts fast and a spec can import it anywhere.
 *
 * Rules every script follows (plan section 7, S4-T08):
 *  - `--dry-run` is the default; `--apply` must be explicit, and a read-only script refuses it (usage error, exit code 2);
 *  - one line per check as `PASS` / `FAIL` / `INFO` / `SKIP` (`line()`), written to the screen and to a report under `.evidence/uat-ops/`;
 *  - reports hold counts and curriculum ids/names only: never a pupil name, e-mail or any other personal data, and never the connection string;
 *  - exit codes: 0 ok, 1 a check FAILed, 2 usage or environment error.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import pg from 'pg'

export type LineStatus = 'PASS' | 'FAIL' | 'INFO' | 'SKIP'

export interface CheckLine {
  status: LineStatus
  text: string
}

export type FlagSpec = { type: 'boolean' } | { type: 'string' }

export interface UatArgsSpec {
  /** Script name for the usage text, e.g. `bulk-chapter-dry-run`. */
  name: string
  /** `true` when the script can write and accepts `--apply`; `false` (default) makes `--apply` a usage error. */
  allowApply?: boolean
  /** Other named flags (without the leading dashes), e.g. `{ subject: { type: 'string' } }`. */
  flags?: Record<string, FlagSpec>
}

export interface UatArgs {
  /** `true` unless `--apply` was given. */
  dryRun: boolean
  apply: boolean
  /** Parsed other flags: booleans as `true`, strings as their value; absent flags are absent. */
  values: Record<string, string | boolean>
}

/** A wrong command line or a missing environment value: the script prints the message and exits with 2. */
export class UsageError extends Error {
  override readonly name = 'UsageError'
}

/** `--dry-run` (default), `--apply`, and the named flags of `spec` (`--flag value` or `--flag=value`). Anything else is a usage error. */
export function parseUatArgs(argv: readonly string[], spec: UatArgsSpec): UatArgs {
  const flags = spec.flags ?? {}
  let dryRunFlag = false
  let apply = false
  const values: Record<string, string | boolean> = {}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? ''
    if (!arg.startsWith('--')) throw new UsageError(`unexpected argument ${arg}`)
    const eq = arg.indexOf('=')
    const name = eq === -1 ? arg.slice(2) : arg.slice(2, eq)
    const inline = eq === -1 ? undefined : arg.slice(eq + 1)
    if (name === 'dry-run' || name === 'apply') {
      if (inline !== undefined) throw new UsageError(`--${name} takes no value`)
      if (name === 'apply') {
        if (!spec.allowApply) throw new UsageError(`${spec.name} is read-only: there is no --apply`)
        apply = true
      } else {
        dryRunFlag = true
      }
      continue
    }
    const flag = Object.hasOwn(flags, name) ? flags[name] : undefined
    if (!flag) throw new UsageError(`unknown argument --${name}`)
    if (flag.type === 'boolean') {
      if (inline !== undefined) throw new UsageError(`--${name} takes no value`)
      values[name] = true
    } else {
      const value = inline ?? argv[++i]
      if (value === undefined || value === '' || value.startsWith('--')) throw new UsageError(`--${name} needs a value`)
      values[name] = value
    }
  }
  if (apply && dryRunFlag) throw new UsageError('--dry-run and --apply cannot be combined')
  return { dryRun: !apply, apply, values }
}

export function line(status: LineStatus, text: string): CheckLine {
  return { status, text }
}

export function formatLine(l: CheckLine): string {
  return `${l.status} ${l.text}`
}

/** 1 when any line is a FAIL, else 0. */
export function exitCodeOf(lines: readonly CheckLine[]): 0 | 1 {
  return lines.some((l) => l.status === 'FAIL') ? 1 : 0
}

/** The repository root, from this file (`apps/api/scripts/uat-ops/lib.ts`). */
export function repoRoot(): string {
  return resolve(fileURLToPath(new URL('.', import.meta.url)), '../../../..')
}

/** `2026-11-05T10:20:30.123Z` -> `2026-11-05T10-20-30-123Z` (safe in a file name on every OS). */
export function timestampForFile(now: Date): string {
  return now.toISOString().replace(/[:.]/g, '-')
}

/** Removes the connection string (whole, and any `scheme://user:pass@host` URL) from a report text. */
export function scrubSecrets(text: string, env: NodeJS.ProcessEnv = process.env): string {
  let out = text
  const url = env.DATABASE_URL
  if (url) out = out.split(url).join('[redacted]')
  return out.replace(/\b[a-z][a-z0-9+.-]*:\/\/[^\s/@]+:[^\s/@]*@\S+/gi, '[redacted]')
}

export interface ReportOptions {
  /** Defaults to the current time. */
  now?: Date
  /** Repository root; defaults to the one of this file. Tests pass a temp folder. */
  root?: string
}

/** Where a report goes: `<root>/.evidence/uat-ops/<name>-<ISO timestamp>.txt` (lines) or `.json` (object). */
export function reportPath(name: string, kind: 'txt' | 'json', options: ReportOptions = {}): string {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) throw new UsageError(`report name ${name} must be lower-case letters, digits and dashes`)
  return join(options.root ?? repoRoot(), '.evidence', 'uat-ops', `${name}-${timestampForFile(options.now ?? new Date())}.${kind}`)
}

/**
 * Writes the report and returns its path. An array of lines becomes a `.txt` (one `STATUS text` per line); any other value a `.json`
 * (2-space indent). The text is scrubbed of the connection string. Caller keeps personal data out of what it passes.
 */
export function writeReport(name: string, content: readonly CheckLine[] | object, options: ReportOptions = {}): string {
  const isLines = Array.isArray(content)
  const path = reportPath(name, isLines ? 'txt' : 'json', options)
  const body = isLines ? `${(content as readonly CheckLine[]).map(formatLine).join('\n')}\n` : `${JSON.stringify(content, null, 2)}\n`
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, scrubSecrets(body), 'utf8')
  return path
}

export interface UatDb {
  client: pg.Client
  /** Runs `fn` inside `BEGIN READ ONLY ... ROLLBACK`: the callback cannot write even by mistake. */
  readOnly<T>(fn: (client: pg.Client) => Promise<T>): Promise<T>
  close(): Promise<void>
}

/** A `pg` client from `DATABASE_URL`. Throws `UsageError` when it is not set (the value itself is never printed). */
export async function openDb(env: NodeJS.ProcessEnv = process.env): Promise<UatDb> {
  const url = env.DATABASE_URL
  if (!url) throw new UsageError('DATABASE_URL is not set.')
  const client = new pg.Client({ connectionString: url })
  await client.connect()
  return {
    client,
    async readOnly(fn) {
      await client.query('BEGIN READ ONLY')
      try {
        return await fn(client)
      } finally {
        await client.query('ROLLBACK')
      }
    },
    close: () => client.end(),
  }
}

/** True when the module at `metaUrl` is the script node was started with (`if (isMain(import.meta.url)) ...`). */
export function isMain(metaUrl: string): boolean {
  return Boolean(process.argv[1]) && resolve(process.argv[1] as string) === fileURLToPath(metaUrl)
}
