import { assertSafeKey, type FileStorage } from './file-storage'

/** Runs `fn` and returns its value as a promise; a thrown error becomes a rejection (like the disk one). */
function settle<T>(fn: () => T): Promise<T> {
  try {
    return Promise.resolve(fn())
  } catch (err) {
    return Promise.reject(err instanceof Error ? err : new Error(String(err)))
  }
}

/** In-memory implementation for tests (same key rules as the disk one). */
export class InMemoryStorage implements FileStorage {
  private readonly objects = new Map<string, Buffer>()

  put(key: string, bytes: Buffer): Promise<void> {
    return settle(() => {
      assertSafeKey(key)
      this.objects.set(key, Buffer.from(bytes))
    })
  }

  get(key: string): Promise<Buffer | null> {
    return settle(() => {
      assertSafeKey(key)
      const found = this.objects.get(key)
      return found ? Buffer.from(found) : null
    })
  }

  delete(key: string): Promise<void> {
    return settle(() => {
      assertSafeKey(key)
      this.objects.delete(key)
    })
  }

  exists(key: string): Promise<boolean> {
    return settle(() => {
      assertSafeKey(key)
      return this.objects.has(key)
    })
  }

  /** Test helper: the stored keys. */
  keys(): string[] {
    return [...this.objects.keys()]
  }
}
