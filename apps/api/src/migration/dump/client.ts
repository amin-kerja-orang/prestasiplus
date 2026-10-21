/**
 * The MySQL command-line client as a child process (AM-10). No driver is used.
 *
 *   - `--defaults-extra-file=<option file>` is ALWAYS the first argument; host, user and password never appear on
 *     the command line (no flag for them exists in this tool);
 *   - SQL goes to stdin, never into an argument;
 *   - stdout is yielded line by line as it arrives (a table is never buffered whole);
 *   - stderr is kept (capped) and scrubbed before it reaches an error message.
 */
import { spawn as nodeSpawn, type ChildProcess, type SpawnOptions } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import { createInterface } from 'node:readline'

import { scrub } from '../staging/log'
import { ClientError, DumpAbortedError, DumpUsageError } from './errors'
import type { OptionFile } from './option-file'

export type SpawnFn = (command: string, args: readonly string[], options: SpawnOptions) => ChildProcess

export interface ClientConfig {
  binary: string
  optionFile: OptionFile
  /** Environment handed to the child (MYSQL_PWD and MYSQL_HOST are removed). */
  env: Record<string, string | undefined>
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
  return [`--defaults-extra-file=${optionFile}`, ...CLIENT_FLAGS]
}

type Env = Readonly<Record<string, string | undefined>>

export function resolveClientBinary(env: Env, platform: string): string {
  const named = env.CLOUD_MYSQL_CLIENT
  if (named !== undefined && named !== '') {
    if (/[\\/]/.test(named) && (!existsSync(named) || !statSync(named).isFile())) {
      throw new DumpUsageError('CLOUD_MYSQL_CLIENT does not name an existing file.')
    }
    return named
  }
  return platform === 'win32' ? 'mysql.exe' : 'mysql'
}

export function makeClientConfig(
  env: Env,
  platform: string,
  optionFile: OptionFile,
  extra: { spawn?: SpawnFn; signal?: AbortSignal } = {},
): ClientConfig {
  const childEnv: Record<string, string | undefined> = { ...env }
  delete childEnv.MYSQL_PWD
  delete childEnv.MYSQL_HOST
  return {
    binary: resolveClientBinary(env, platform),
    optionFile,
    env: childEnv,
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
