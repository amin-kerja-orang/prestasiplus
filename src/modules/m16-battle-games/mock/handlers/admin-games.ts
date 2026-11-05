/**
 * SRS M16 v1.6 §7 #51-#52 and API-ADM-08, API-ADM-23: Tetapan Permainan. Admin only (BR-M16-01): 401 without a session,
 * 403 for any other role. Validation is the contract's, strict as on the server: an unknown key is a 422 on that key and
 * one bad value saves nothing. The mock writes no audit event.
 */

import {
  GamesAdminSettingsUpdateRequestSchema,
  GamesAdminSpinSegmentsUpdateRequestSchema,
} from '@pp/contract'

import { ok, requireRole, route, validationError, type MockResponse, type RouteDef } from '@/mock/define'

import { roomsRepo } from '../repository'

type Issue = { code: string; path: readonly PropertyKey[]; message: string; keys?: readonly string[] }

/** As `strictFieldsOf` of the API: first message per dotted path; an unknown key is named. */
function refused(issues: readonly Issue[]): MockResponse {
  const fields: Record<string, string> = {}
  const add = (path: string, message: string): void => {
    if (!Object.hasOwn(fields, path)) {
      Object.defineProperty(fields, path, { value: message, enumerable: true, writable: true, configurable: true })
    }
  }
  for (const issue of issues) {
    const path = issue.path.map(String).join('.')
    if (issue.code === 'unrecognized_keys') {
      for (const key of issue.keys ?? []) {
        add(path ? `${path}.${key}` : key, `The ${key} field is not allowed.`)
      }
    } else {
      add(path || '_', issue.message)
    }
  }
  return validationError(fields, issues.find((i) => i.code !== 'unrecognized_keys')?.message)
}

const StrictSettings = GamesAdminSettingsUpdateRequestSchema.strict()

export const adminGamesRoutes: RouteDef[] = [
  // #51
  route('GET', '/api/admin/games', [requireRole('admin')], () => ok(roomsRepo.adminOverview())),

  // #52
  route('PUT', '/api/admin/games/settings', [requireRole('admin')], (req) => {
    const parsed = StrictSettings.safeParse(req.body ?? {})
    if (!parsed.success) return refused(parsed.error.issues)
    return ok(roomsRepo.saveAdminSettings(parsed.data))
  }),

  // API-ADM-23
  route('GET', '/api/admin/games/spin-segments', [requireRole('admin')], () =>
    ok(roomsRepo.spinSegments()),
  ),

  route('PUT', '/api/admin/games/spin-segments', [requireRole('admin')], (req) => {
    const parsed = GamesAdminSpinSegmentsUpdateRequestSchema.safeParse(req.body ?? {})
    if (!parsed.success) return refused(parsed.error.issues)
    return ok(roomsRepo.saveSpinSegments(parsed.data.segments))
  }),
]
