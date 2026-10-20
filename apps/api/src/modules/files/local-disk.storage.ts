import { randomBytes } from 'node:crypto'
import { mkdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'

import { assertSafeKey, type FileStorage, UnsafeStorageKeyError } from './file-storage'

function isMissing(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 'ENOENT'
}

/** Local volume implementation (`FILE_STORAGE_DIR`). Owner-only permissions, atomic writes. */
export class LocalDiskStorage implements FileStorage {
  private readonly root: string

  constructor(root: string) {
    this.root = resolve(root)
  }

  private pathOf(key: string): string {
    assertSafeKey(key)
    const path = resolve(this.root, key)
    // Defence in depth: the key check already forbids anything that could leave the root.
    if (!path.startsWith(this.root + sep)) throw new UnsafeStorageKeyError()
    return path
  }

  async put(key: string, bytes: Buffer): Promise<void> {
    const path = this.pathOf(key)
    await mkdir(dirname(path), { recursive: true, mode: 0o700 })
    const temp = `${path}.${randomBytes(6).toString('hex')}.tmp`
    try {
      await writeFile(temp, bytes, { flag: 'wx', mode: 0o600 })
      await rename(temp, path)
    } catch (err) {
      await unlink(temp).catch(() => undefined)
      throw err
    }
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      return await readFile(this.pathOf(key))
    } catch (err) {
      if (isMissing(err)) return null
      throw err
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(this.pathOf(key))
    } catch (err) {
      if (!isMissing(err)) throw err
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      return (await stat(this.pathOf(key))).isFile()
    } catch (err) {
      if (isMissing(err)) return false
      throw err
    }
  }
}
