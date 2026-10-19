/**
 * M02 fixture config (SRS v1.28 §6.12 DATA-M02-13; SEC-M02-01…03). The default passwords the admin
 * screens use. **Dummy values defined here for the prototype, never the live values.** Not exposed
 * by any list endpoint; a mock-only helper (`mock.config(key, value)`, §7 notes) changes them.
 *
 * These are only the built-in defaults: the M02 seed copies them into `ctx.config`, and handlers read
 * the live values with `adminDefaults(ctx)` (`handlers/admin-config.ts`). `mock.config(key, value)`
 * changes `ctx.config`, and `mock.reset()` re-seeds the defaults. Changing them here after boot has
 * no effect, so the setters are internal and not exported from the module entry.
 */

export interface M02Config {
  /** SEC-M02-01: the password of a generated school-admin account (S2 generator). */
  schoolAdminDefaultPassword: string
  /** SEC-M02-03: the S4 bulk-import default password (pre-filled field and fallback). */
  bulkImportDefaultPassword: string
  /** SEC-M02-02: the fixed 8-digit password of a complimentary student (S7). */
  compStudentDefaultPassword: string
}

export const M02_CONFIG_DEFAULTS: Readonly<M02Config> = Object.freeze({
  schoolAdminDefaultPassword: 'Sekolah2026',
  bulkImportDefaultPassword: 'Import2026',
  compStudentDefaultPassword: '20262026',
})

let current: M02Config = { ...M02_CONFIG_DEFAULTS }

export function m02Config(): Readonly<M02Config> {
  return current
}

export function setM02Config<K extends keyof M02Config>(key: K, value: M02Config[K]): void {
  current = { ...current, [key]: value }
}

export function resetM02Config(): void {
  current = { ...M02_CONFIG_DEFAULTS }
}
