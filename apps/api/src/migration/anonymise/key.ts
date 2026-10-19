/**
 * The pseudonymisation key (BE-35, OD-18). The tool refuses to run without it.
 *
 *   ANON_HMAC_KEY       the key itself (at least 32 characters), or
 *   ANON_HMAC_KEY_FILE  path of a file that holds it. The file must be OUTSIDE the repository and, on
 *                       POSIX, not readable by group or others (chmod 600).
 *
 * Exactly one of the two must be set. The key is never written to the repository, to an output file or
 * to a log line, and no error message repeats it (or any part of it).
 */
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { isAbsolute, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { KeyError } from './errors'

export const MIN_KEY_LENGTH = 32

type Env = Readonly<Record<string, string | undefined>>

const repoRoot = (): string => fileURLToPath(new URL('../../../../../', import.meta.url))

const real = (p: string): string => {
  try {
    return realpathSync.native(p)
  } catch {
    return resolve(p)
  }
}

const isInside = (child: string, parent: string): boolean => {
  const rel = relative(parent, child)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

export interface LoadedKey {
  /** The key bytes. Keep them in memory only. */
  key: Buffer
  /** `env` or `file`, for the log line (never the key). */
  origin: 'env' | 'file'
}

export function loadHmacKey(env: Env, roots: readonly string[] = [repoRoot(), process.cwd()]): LoadedKey {
  const inline = env.ANON_HMAC_KEY
  const file = env.ANON_HMAC_KEY_FILE
  const hasInline = inline !== undefined && inline !== ''
  const hasFile = file !== undefined && file !== ''
  if (hasInline && hasFile) throw new KeyError('Set either ANON_HMAC_KEY or ANON_HMAC_KEY_FILE, not both.')
  if (!hasInline && !hasFile) {
    throw new KeyError('Refusing to run: no pseudonymisation key. Set ANON_HMAC_KEY or ANON_HMAC_KEY_FILE (a file outside the repository).')
  }
  let text: string
  let origin: 'env' | 'file'
  if (hasInline) {
    text = inline as string
    origin = 'env'
  } else {
    origin = 'file'
    const path = resolve(file as string)
    if (!existsSync(path) || !statSync(path).isFile()) throw new KeyError('ANON_HMAC_KEY_FILE does not name a readable file.')
    const where = real(path)
    if (roots.some((r) => isInside(where, real(r)))) {
      throw new KeyError('ANON_HMAC_KEY_FILE is inside the repository or the working directory. Keep the key file outside it.')
    }
    if (process.platform !== 'win32' && (statSync(path).mode & 0o077) !== 0) {
      throw new KeyError('ANON_HMAC_KEY_FILE must not be readable by group or others (chmod 600).')
    }
    text = readFileSync(path, 'utf8')
  }
  const trimmed = text.replace(/\r?\n$/, '')
  if (trimmed.length < MIN_KEY_LENGTH) throw new KeyError(`The pseudonymisation key must be at least ${MIN_KEY_LENGTH} characters.`)
  return { key: Buffer.from(trimmed, 'utf8'), origin }
}
