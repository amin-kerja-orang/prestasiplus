// Config helpers for ChartCanvas (F-17). Chart configs are plain object/array trees
// that may hold functions (callbacks, scriptable options) and non-plain values
// (CanvasGradient, Date); those are kept by reference, everything else is copied.
import { toRaw } from 'vue'

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false
  const proto = Object.getPrototypeOf(value) as unknown
  return proto === Object.prototype || proto === null
}

/** Deep copy of plain objects and arrays (reactive proxies unwrapped); other values by reference. */
export function cloneConfig<T>(value: T): T {
  const raw = toRaw(value) as unknown
  if (Array.isArray(raw)) return raw.map((item: unknown) => cloneConfig(item)) as T
  if (isPlainObject(raw)) {
    const copy: Record<string, unknown> = {}
    for (const key of Object.keys(raw)) copy[key] = cloneConfig(raw[key])
    return copy as T
  }
  return raw as T
}

/** Structural equality of plain objects and arrays; functions and other values by identity. */
export function configEqual(a: unknown, b: unknown): boolean {
  const x = toRaw(a)
  const y = toRaw(b)
  if (Object.is(x, y)) return true
  if (Array.isArray(x) || Array.isArray(y)) {
    if (!Array.isArray(x) || !Array.isArray(y) || x.length !== y.length) return false
    return x.every((item: unknown, i) => configEqual(item, y[i]))
  }
  if (isPlainObject(x) && isPlainObject(y)) {
    const keys = Object.keys(x)
    if (keys.length !== Object.keys(y).length) return false
    return keys.every((key) => Object.hasOwn(y, key) && configEqual(x[key], y[key]))
  }
  return false
}

/** True when two plugin lists hold the same plugin objects in the same order. */
export function samePlugins(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((plugin, i) => toRaw(plugin) === toRaw(b[i]))
}
