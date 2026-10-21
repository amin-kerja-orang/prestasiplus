/**
 * Interrupt handling (AM-10).
 *
 *   - a registry of directories that hold RAW personal data while a command runs (`registerSensitive`);
 *   - `emergencyWipeSync`: synchronous zero-overwrite + removal of every registered directory (rmSync as the fallback);
 *   - `installSignalHandlers`: the FIRST SIGINT/SIGTERM/SIGHUP (and SIGBREAK on Windows) aborts the run, so the client is
 *     killed and the normal clean-up runs; a SECOND one runs `emergencyWipeSync` and exits with 130.
 */
import { closeSync, fsyncSync, lstatSync, openSync, readdirSync, rmSync, writeSync, constants as fsConstants } from 'node:fs'
import { join } from 'node:path'

const sensitive = new Set<string>()

/** Registers a directory with raw data; call the returned function when it is gone. */
export function registerSensitive(path: string): () => void {
  sensitive.add(path)
  return () => void sensitive.delete(path)
}

export function sensitivePaths(): string[] {
  return [...sensitive]
}

const ZEROS = Buffer.alloc(1024 * 1024)

function zeroFileSync(path: string, size: number): void {
  const fd = openSync(path, fsConstants.O_RDWR | (fsConstants.O_NOFOLLOW ?? 0))
  try {
    let done = 0
    while (done < size) done += writeSync(fd, ZEROS, 0, Math.min(ZEROS.length, size - done), done)
    fsyncSync(fd)
  } finally {
    closeSync(fd)
  }
}

function zeroTreeSync(path: string): void {
  const st = lstatSync(path)
  if (st.isSymbolicLink()) return // never follow
  if (st.isDirectory()) {
    for (const name of readdirSync(path)) zeroTreeSync(join(path, name))
  } else if (st.isFile() && st.nlink === 1) {
    zeroFileSync(path, st.size)
  }
}

/** Best effort and synchronous: whatever fails, `rmSync` still removes the directory. */
export function emergencyWipeSync(paths: readonly string[] = sensitivePaths()): void {
  for (const path of paths) {
    try {
      zeroTreeSync(path)
    } catch {
      // fall through to the plain removal
    }
    try {
      rmSync(path, { recursive: true, force: true })
    } catch {
      // nothing more can be done in a signal handler
    }
  }
}

export interface SignalTarget {
  on(signal: string, listener: () => void): unknown
}

export function signalNames(platform: string): string[] {
  return ['SIGINT', 'SIGTERM', 'SIGHUP', ...(platform === 'win32' ? ['SIGBREAK'] : [])]
}

export function installSignalHandlers(options: {
  target: SignalTarget
  abort: AbortController
  platform: string
  exit: (code: number) => void
  err: (line: string) => void
  wipe?: () => void
}): void {
  let count = 0
  const handler = (): void => {
    count++
    if (count === 1) {
      options.err('Interrupted: stopping and cleaning up. Press Ctrl+C again to delete the raw data at once and quit.')
      options.abort.abort()
      return
    }
    ;(options.wipe ?? emergencyWipeSync)()
    options.exit(130)
  }
  for (const name of signalNames(options.platform)) options.target.on(name, handler)
}
