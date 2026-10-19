/**
 * Fixture configuration of the mock (overview §6.4 `ctx.config`, §6.13 `config(key, value)`), e.g.
 * the default password of generated accounts (M02). Seeds set defaults; the test hook overrides
 * them. Values are plain data.
 */

export interface MockConfig {
  get<T = unknown>(key: string): T | undefined
  /** The value of `key`, or `fallback` when it is not set. */
  get<T>(key: string, fallback: T): T
  set(key: string, value: unknown): void
  has(key: string): boolean
  /** A snapshot of every key. */
  entries(): Record<string, unknown>
  clear(): void
}

export function createMockConfig(initial: Record<string, unknown> = {}): MockConfig {
  const values = new Map<string, unknown>(Object.entries(initial))
  return {
    get<T>(key: string, fallback?: T): T | undefined {
      return values.has(key) ? (values.get(key) as T) : fallback
    },
    set(key, value) {
      values.set(key, value)
    },
    has: (key) => values.has(key),
    entries: () => Object.fromEntries(values),
    clear: () => values.clear(),
  }
}
