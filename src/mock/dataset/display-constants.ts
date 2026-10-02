/**
 * Documented display constants (D11 exception, XL-34, overview §6.6): an observed display figure
 * that no dataset definition reproduces (e.g. M06 hub "Jumlah Soalan" 20,529 / 14,673,
 * DV-M06-01). Each lives in its owner module's `constants/`, is declared here with its DV id, is
 * **excluded from the dataset fit check**, and must never be shown on the same screen as a
 * contradicting computed figure. `listDisplayConstants()` feeds the unit test that lists them all.
 */

export const DISPLAY_CONSTANT = 'DISPLAY_CONSTANT' as const

export interface DisplayConstantDef<V> {
  /** Owner module, e.g. `'M06'`. */
  module: string
  /** Name inside the module, e.g. `'hubTotalBm'`. */
  name: string
  value: V
  /** The deviation id that documents it, e.g. `'DV-M06-01'`. */
  dv: string
  /** Where it is shown (screen ids) — for reviewers. */
  shownOn?: readonly string[]
  note?: string
}

export interface DisplayConstant<V> extends DisplayConstantDef<V> {
  readonly kind: typeof DISPLAY_CONSTANT
}

const registry = new Map<string, DisplayConstant<unknown>>()

export function defineDisplayConstant<V>(def: DisplayConstantDef<V>): DisplayConstant<V> {
  if (!def.module || !def.name)
    throw new Error('defineDisplayConstant: module and name are required')
  if (!/^DV-[A-Z0-9]+-\d+$/.test(def.dv)) {
    throw new Error(
      `defineDisplayConstant(${def.module}.${def.name}): dv must look like DV-M06-01, got '${def.dv}'`,
    )
  }
  const key = `${def.module}.${def.name}`
  const existing = registry.get(key)
  if (existing) {
    // Re-evaluating the same module (HMR, test isolation) is fine; a different value is a bug.
    if (existing.value !== def.value || existing.dv !== def.dv) {
      throw new Error(`defineDisplayConstant: '${key}' is already declared with another value`)
    }
    return existing as DisplayConstant<V>
  }
  const constant = Object.freeze({ ...def, kind: DISPLAY_CONSTANT }) as DisplayConstant<V>
  registry.set(key, constant)
  return constant
}

/** Every declared display constant, sorted by module and name. */
export function listDisplayConstants(): DisplayConstant<unknown>[] {
  return [...registry.values()].sort(
    (a, b) => a.module.localeCompare(b.module) || a.name.localeCompare(b.name),
  )
}
