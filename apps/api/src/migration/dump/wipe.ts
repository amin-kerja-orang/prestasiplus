/**
 * `dump:wipe` (AM-10): delete a raw dump the same day. Each regular file is overwritten with zeros once (1 MiB chunks,
 * streamed), fsynced, unlinked; then the directories are removed.
 *
 * Refuses (and deletes nothing) when the target is a symbolic link, contains a symbolic link or any entry that is neither
 * a regular file nor a directory, is not strictly below a `.migration-out` folder, or is outside the working directory and
 * the repository root.
 *
 * Overwriting is best effort: on an SSD, wear levelling and journaling file systems can keep old blocks. Full-disk
 * encryption is the real protection; this only removes the readable file.
 */
import { existsSync, lstatSync, readdirSync, realpathSync } from 'node:fs'
import { open, rmdir, unlink } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'

import { defaultOutputRoots } from '../profile/render'
import { WipeRefusedError } from './errors'

export const WIPE_NOTE =
  'Note: overwriting files is best effort. On an SSD, wear levelling and file-system journals can keep old blocks; full-disk encryption is the real guard.'

const CHUNK = 1024 * 1024

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

export interface WipeResult {
  files: number
  bytes: number
  dirs: number
}

interface Entry {
  path: string
  dir: boolean
  size: number
}

function inventory(root: string): Entry[] {
  const out: Entry[] = []
  const walk = (path: string): void => {
    const st = lstatSync(path)
    if (st.isSymbolicLink()) throw new WipeRefusedError('The directory contains a symbolic link; refusing to wipe (nothing was deleted).')
    if (st.isDirectory()) {
      for (const name of readdirSync(path)) walk(join(path, name))
      out.push({ path, dir: true, size: 0 })
    } else if (st.isFile()) {
      out.push({ path, dir: false, size: st.size })
    } else {
      throw new WipeRefusedError('The directory contains an entry that is neither a file nor a directory; refusing to wipe (nothing was deleted).')
    }
  }
  walk(root)
  return out
}

async function overwriteAndRemove(path: string, size: number): Promise<void> {
  const handle = await open(path, 'r+')
  try {
    const zeros = Buffer.alloc(Math.min(CHUNK, Math.max(size, 1)))
    let done = 0
    while (done < size) {
      const n = Math.min(zeros.length, size - done)
      await handle.write(zeros, 0, n, done)
      done += n
    }
    await handle.sync()
  } finally {
    await handle.close()
  }
  await unlink(path)
}

/** `missingOk`: a missing directory is not an error (the wipe in a `finally` may run twice). */
export async function wipeDir(dir: string, options: { roots?: readonly string[]; missingOk?: boolean } = {}): Promise<WipeResult> {
  const wanted = resolve(dir)
  let st
  try {
    st = lstatSync(wanted)
  } catch {
    if (options.missingOk) return { files: 0, bytes: 0, dirs: 0 }
    throw new WipeRefusedError('The directory does not exist.')
  }
  if (st.isSymbolicLink()) throw new WipeRefusedError('The target is a symbolic link; refusing to wipe.')
  if (!st.isDirectory()) throw new WipeRefusedError('The target is not a directory.')
  const where = real(wanted)
  const segments = where.split(sep)
  const at = segments.lastIndexOf('.migration-out')
  if (at === -1 || at === segments.length - 1) {
    throw new WipeRefusedError('The target must be a directory strictly inside a ".migration-out" folder.')
  }
  if (!(options.roots ?? defaultOutputRoots()).some((r) => isInside(where, real(r)))) {
    throw new WipeRefusedError('The target must be under the working directory or the repository root.')
  }
  const entries = inventory(where) // refuses before anything is touched
  const result: WipeResult = { files: 0, bytes: 0, dirs: 0 }
  for (const e of entries) {
    if (e.dir) continue
    await overwriteAndRemove(e.path, e.size)
    result.files++
    result.bytes += e.size
  }
  for (const e of entries) {
    if (!e.dir) continue
    if (existsSync(e.path)) await rmdir(e.path)
    result.dirs++
  }
  return result
}
