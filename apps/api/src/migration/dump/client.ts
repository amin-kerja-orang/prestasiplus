/**
 * The MySQL command-line client as a child process (AM-10). No driver is used.
 *
 *   - `--defaults-file=<option file>` is ALWAYS the first argument (the client reads that one file and no other option file); host, user and password never appear on
 *     the command line (no flag for them exists in this tool);
 *   - SQL goes to stdin, never into an argument;
 *   - stdout is yielded line by line as it arrives (a table is never buffered whole);
 *   - stderr is kept (capped) and scrubbed before it reaches an error message.
 */
import { spawn as nodeSpawn, type ChildProcess, type SpawnOptions } from 'node:child_process'
import { accessSync, constants as fsConstants, statSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { tmpdir } from 'node:os'
import { delimiter, isAbsolute, join, resolve } from 'node:path'
import { createInterface } from 'node:readline'

import { scrub } from '../staging/log'
import { ClientError, DumpAbortedError, DumpUsageError } from './errors'
import { isInside, real, repoRoot, type OptionFile } from './option-file'

export type SpawnFn = (command: string, args: readonly string[], options: SpawnOptions) => ChildProcess

export interface ClientConfig {
  binary: string
  optionFile: OptionFile
  /** Environment handed to the child: the allow-list only (see `childEnvironment`). */
  env: Record<string, string>
  spawn: SpawnFn
  signal?: AbortSignal
}

export const CLIENT_FLAGS: readonly string[] = [
  '--batch',
  '--raw',
  '--skip-column-names',
  '--quick',
  '--default-character-set=utf8mb4',
  '--no-auto-rehash',
  '--local-infile=0',
  '--max-allowed-packet=268435456',
]

export function clientArgs(optionFile: string): string[] {
  return [`--defaults-file=${optionFile}`, ...CLIENT_FLAGS]
}

type Env = Readonly<Record<string, string | undefined>>

// No HOME (POSIX) and no APPDATA (Windows): the client has no home-directory option file to find.
const POSIX_ENV = ['PATH', 'LANG', 'LC_ALL', 'TZ', 'MYSQL_UNIX_PORT']
const WIN_ENV = [...POSIX_ENV, 'SystemRoot', 'TEMP', 'TMP', 'USERPROFILE', 'PATHEXT', 'ComSpec']

/**
 * The environment of the client: an allow-list. Nothing else (no ANON_* key, no MYSQL_PWD, no CLOUD_* variable)
 * reaches the child. On Windows names are matched without regard to case. `MYSQL_TEST_LOGIN_FILE` points to a file that does not
 * exist (random name under the temp directory), so a `.mylogin.cnf` is never read.
 */
export function childEnvironment(env: Env, platform: string): Record<string, string> {
  const allowed = platform === 'win32' ? WIN_ENV : POSIX_ENV
  const wanted = new Set(allowed.map((n) => (platform === 'win32' ? n.toUpperCase() : n)))
  const out: Record<string, string> = {}
  for (const [name, value] of Object.entries(env)) {
    if (value === undefined) continue
    if (wanted.has(platform === 'win32' ? name.toUpperCase() : name)) out[name] = value
  }
  out.MYSQL_TEST_LOGIN_FILE = join(tmpdir(), `pp-no-login-${randomBytes(8).toString('hex')}`, 'mylogin.cnf')
  return out
}

function isExecutableFile(path: string, platform: string): boolean {
  try {
    if (!statSync(path).isFile()) return false
    if (platform !== 'win32') accessSync(path, fsConstants.X_OK)
    return true
  } catch {
    return false
  }
}

/** Walks PATH itself: only absolute entries count, the working directory is never searched. */
export function findOnPath(names: readonly string[], env: Env, platform: string): string | undefined {
  const pathValue = (platform === 'win32' ? Object.entries(env).find(([k]) => k.toUpperCase() === 'PATH')?.[1] : env.PATH) ?? ''
  for (const entry of pathValue.split(platform === 'win32' ? ';' : delimiter)) {
    const dir = entry.trim().replace(/^"|"$/g, '')
    if (dir === '' || !isAbsolute(dir)) continue
    for (const name of names) {
      const candidate = join(dir, name)
      if (isExecutableFile(candidate, platform)) return candidate
    }
  }
  return undefined
}

/**
 * The client binary as an absolute path. `CLOUD_MYSQL_CLIENT` (a path, or a bare name that is looked up on PATH) or, when
 * unset, `mysql` (`mysql.exe` / `mysql` on Windows) on PATH. A binary inside the repository or the working directory
 * (real path) is refused: a planted file must not run with the database credentials.
 */
export function resolveClientBinary(env: Env, platform: string, roots: readonly string[] = [repoRoot(), process.cwd()]): string {
  const named = env.CLOUD_MYSQL_CLIENT
  let found: string | undefined
  if (named !== undefined && named !== '') {
    if (/[\\/]/.test(named)) {
      const path = resolve(named)
      if (!isExecutableFile(path, platform)) throw new DumpUsageError('CLOUD_MYSQL_CLIENT does not name an existing, executable file.')
      found = path
    } else {
      found = findOnPath([named], env, platform)
    }
  } else {
    found = findOnPath(platform === 'win32' ? ['mysql.exe', 'mysql'] : ['mysql'], env, platform)
  }
  if (!found) throw new DumpUsageError('The MySQL client binary was not found. Install the mysql (or mariadb) client or set CLOUD_MYSQL_CLIENT to its full path.')
  const where = real(found)
  if (roots.some((r) => isInside(where, real(r)))) {
    throw new DumpUsageError('The MySQL client binary is inside the repository or the working directory. Use an installed client outside it.')
  }
  return found
}

export function makeClientConfig(
  env: Env,
  platform: string,
  optionFile: OptionFile,
  extra: { spawn?: SpawnFn; signal?: AbortSignal; roots?: readonly string[] } = {},
): ClientConfig {
  return {
    binary: resolveClientBinary(env, platform, extra.roots),
    optionFile,
    env: childEnvironment(env, platform),
    spawn: extra.spawn ?? (nodeSpawn as SpawnFn),
    signal: extra.signal,
  }
}

const STDERR_CAP = 16 * 1024

/**
 * Only the error numbers and SQLSTATEs of stderr are shown: a server message can echo a data value (for example an
 * invalid JSON text) and a connect error can name the user and host. The number is enough to look the error up.
 */
function errorCodes(text: string): string {
  const found = [...text.matchAll(/ERROR\s+(\d+)\s+\((\w+)\)/g)].slice(0, 3).map((m) => `ERROR ${m[1]} (${m[2]})`)
  return found.join(' | ')
}

/**
 * Runs one client session with `sql` on stdin and yields stdout lines. Throws `DumpUsageError` when the binary cannot be
 * started, `ClientError` (scrubbed stderr) on a non-zero exit, `DumpAbortedError` after an abort. Closing the generator
 * early kills the child.
 */
export async function* runClient(config: ClientConfig, sql: string): AsyncGenerator<string, void, undefined> {
  if (config.signal?.aborted) throw new DumpAbortedError('Interrupted.')
  const child = config.spawn(config.binary, clientArgs(config.optionFile.path), {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: config.env as NodeJS.ProcessEnv,
    windowsHide: true,
    shell: false,
  })
  let stderr = ''
  child.stderr?.setEncoding('utf8')
  child.stderr?.on('data', (chunk: string) => {
    if (stderr.length < STDERR_CAP) stderr += chunk.slice(0, STDERR_CAP - stderr.length)
  })
  let spawnError: NodeJS.ErrnoException | undefined
  const closed = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolveClose) => {
    child.on('error', (e: NodeJS.ErrnoException) => {
      spawnError = e
      resolveClose({ code: null, signal: null })
    })
    child.on('close', (code, signal) => resolveClose({ code, signal }))
  })
  const onAbort = (): void => {
    child.kill('SIGTERM')
  }
  config.signal?.addEventListener('abort', onAbort, { once: true })
  child.stdin?.on('error', () => undefined) // the client may exit before it has read everything (EPIPE)
  child.stdin?.end(sql)

  let finished = false
  try {
    if (child.stdout) {
      child.stdout.setEncoding('utf8')
      const rl = createInterface({ input: child.stdout, crlfDelay: Infinity })
      for await (const line of rl) yield line
    }
    const { code, signal } = await closed
    finished = true
    if (spawnError) {
      if (spawnError.code === 'ENOENT') {
        throw new DumpUsageError('The MySQL client binary was not found. Install the mysql (or mariadb) client or set CLOUD_MYSQL_CLIENT to its full path.')
      }
      throw new DumpUsageError(`The MySQL client could not be started (${spawnError.code ?? 'error'}).`)
    }
    if (config.signal?.aborted) throw new DumpAbortedError('Interrupted.')
    if (code !== 0) {
      const secrets = config.optionFile.secrets
      const detail = scrub(errorCodes(stderr), secrets)
      throw new ClientError(`The MySQL client failed (${signal ? `signal ${signal}` : `exit ${code}`})${detail ? `: ${detail}` : '.'}`)
    }
  } finally {
    config.signal?.removeEventListener('abort', onAbort)
    if (!finished) child.kill('SIGTERM')
  }
}

export async function collectClient(config: ClientConfig, sql: string): Promise<string[]> {
  const lines: string[] = []
  for await (const line of runClient(config, sql)) lines.push(line)
  return lines
}
