/** Injection token of the active `FileStorage`. */
export const FILE_STORAGE = Symbol('FILE_STORAGE')

/**
 * Where file bytes live (plan section 3, OD-6). Keys are server-generated, relative, lower-case
 * paths such as `avatar/<uuid>.png`; they never contain a client file name. Implementations refuse
 * a key that could leave their root. BE-37 stores intake derived files through the same interface.
 */
export interface FileStorage {
  /** Stores `bytes` under `key`. An existing key is replaced atomically. */
  put(key: string, bytes: Buffer): Promise<void>
  /** The bytes, or null when the key does not exist. */
  get(key: string): Promise<Buffer | null>
  /** Removes the object. Deleting a missing key is not an error. */
  delete(key: string): Promise<void>
  exists(key: string): Promise<boolean>
}

/**
 * Lower-case segments of `[a-z0-9_-]`, the last one with a short extension. No dots elsewhere, so
 * `..`, absolute paths, backslashes, drive letters and empty segments are all refused.
 */
const SAFE_KEY = /^[a-z0-9_-]+(\/[a-z0-9_-]+)*\/[a-z0-9_-]+\.[a-z0-9]{1,8}$/

export class UnsafeStorageKeyError extends Error {
  constructor() {
    super('Unsafe storage key')
    this.name = 'UnsafeStorageKeyError'
  }
}

export function assertSafeKey(key: string): void {
  if (key.length > 200 || !SAFE_KEY.test(key)) throw new UnsafeStorageKeyError()
}
