/**
 * The fixture default passwords on `ctx.config` (DATA-M02-13, SEC-M02-01…03; the hook `config`).
 *
 * `window.__mock.config(key, value)` is a built-in hook onto `ctx.config`; the M02 seed writes the
 * three defaults into it (dummy values from `m02-config.ts`, never the live ones), so a test that calls
 * `mock.config('schoolAdminDefaultPassword', 'x')` changes what these handlers return, and `mock.reset()`
 * restores the defaults. The endpoint below is a PROPOSED addition (SRS §7 lists none although the
 * screens show the three values, §6.12).
 */

import {
  ok,
  requireRole,
  route,
  type MockContext,
  type RouteDef,
  type SeedContext,
} from '@/mock/define'

import type { AdminDefaults } from '../../api/users'
import { m02Config, type M02Config } from '../m02-config'

/** The config keys of DATA-M02-13. */
export const ADMIN_CONFIG_KEYS: readonly (keyof M02Config)[] = Object.freeze([
  'schoolAdminDefaultPassword',
  'bulkImportDefaultPassword',
  'compStudentDefaultPassword',
])

/** Seed phase: writes the defaults into `ctx.config` (`reset` clears the config first, then seeds). */
export function seedAdminConfig(config: SeedContext['config']): void {
  const defaults = m02Config()
  for (const key of ADMIN_CONFIG_KEYS) config.set(key, defaults[key])
}

/** The current values (`ctx.config`, else the built-in defaults). */
export function adminDefaults(ctx: Pick<MockContext, 'config'>): AdminDefaults {
  const defaults = m02Config()
  return {
    schoolAdminDefaultPassword: ctx.config.get(
      'schoolAdminDefaultPassword',
      defaults.schoolAdminDefaultPassword,
    ),
    bulkImportDefaultPassword: ctx.config.get(
      'bulkImportDefaultPassword',
      defaults.bulkImportDefaultPassword,
    ),
    compStudentDefaultPassword: ctx.config.get(
      'compStudentDefaultPassword',
      defaults.compStudentDefaultPassword,
    ),
  }
}

export const adminConfigRoutes: RouteDef[] = [
  route('GET', '/api/admin/config/defaults', [requireRole('admin')], (_req, ctx) =>
    ok(adminDefaults(ctx)),
  ),
]
