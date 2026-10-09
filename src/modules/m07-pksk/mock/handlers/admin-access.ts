/**
 * SRS M07 v1.7 §7 #14-#18 (admin PKSK access, screen S8), all admin only (guest 401, other roles
 * 403, FR-M07-59):
 *
 * | # | Route | Notes |
 * |---|---|---|
 * | 14 | `GET /api/admin/pksk-access` | `?search&page`, `grantedAt` desc then `id` desc, 20 per page |
 * | 15 | `GET /api/admin/pksk-access/stats` | `{activeTotal, t1, t4}` (BR-M07-08) |
 * | 16 | `POST /api/admin/pksk-access` | grant (BR-M07-14) |
 * | 17 | `POST /api/admin/pksk-access/:id/revoke` | revoke (BR-M07-15) |
 * | 18 | `GET /api/pksk-packages` | the 3 packages (M19-owned, hosted here) |
 *
 * A grant or a revoke writes the M07 access store, so the student endpoints (#1, #3-#6, #21-#23)
 * see it at once (BR-M07-07). A rejected request (4xx) writes nothing.
 */

import {
  conflict,
  created,
  int,
  notFound,
  ok,
  pageParams,
  paged,
  queryString,
  route,
  validationError,
  type RouteDef,
} from '@/mock/define'
import { users } from '@/modules/m01-authentication/mock'

import { pkskAccessRepo, pkskPackagesRepo } from '../repository/stores'
import { adminOnly, asInt, obj, userIdOf } from './common'

export const ACCESS_PAGE_SIZE = 20

export const ACCESS_FLASH = {
  granted: 'Akses PKSK berjaya diberi.',
  revoked: 'Akses PKSK telah ditarik balik.',
} as const

/** Server copy (SRS §5, §8.2; UNVERIFIED COPY unless marked INFERRED). */
export const ACCESS_MESSAGES = {
  userNotFound: 'Pengguna tidak dijumpai.',
  package: 'Sila pilih pakej.', // INFERRED
  expiresAt: 'Tarikh tamat tidak sah.', // INFERRED
  notFound: 'Rekod akses tidak dijumpai.', // INFERRED
  notActive: 'Akses ini tidak aktif dan tidak boleh ditarik balik.', // INFERRED
} as const

/** A real calendar date `YYYY-MM-DD`. */
function isDateKey(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  const d = new Date(`${v}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v
}

export const adminAccessRoutes: RouteDef[] = [
  // #14
  route('GET', '/api/admin/pksk-access', [adminOnly], (req, ctx) => {
    const page = pageParams(req.query, { pageSize: ACCESS_PAGE_SIZE })
    const res = pkskAccessRepo.adminList(
      { search: queryString(req.query, 'search') ?? '', ...page },
      ctx.clock.now(),
    )
    return paged(res, page)
  }),

  // #15
  route('GET', '/api/admin/pksk-access/stats', [adminOnly], (_req, ctx) =>
    ok(pkskAccessRepo.stats(ctx.clock.now())),
  ),

  // #16
  route('POST', '/api/admin/pksk-access', [adminOnly], (req, ctx) => {
    const body = obj(req.body)
    const fields: Record<string, string> = {}

    const userId = asInt(body.userId)
    if (userId === undefined || !users.get(userId)) fields.userId = ACCESS_MESSAGES.userNotFound

    const packageId = asInt(body.packageId)
    if (packageId === undefined || !pkskPackagesRepo.get(packageId)) {
      fields.packageId = ACCESS_MESSAGES.package
    }

    // No lower or upper bound: a past date gives an already-expired row (BR-M07-14).
    let expiresAt: string | null = null
    const rawExpiry = body.expiresAt
    if (rawExpiry !== undefined && rawExpiry !== null && rawExpiry !== '') {
      if (typeof rawExpiry !== 'string' || !isDateKey(rawExpiry.trim())) {
        fields.expiresAt = ACCESS_MESSAGES.expiresAt
      } else expiresAt = rawExpiry.trim()
    }

    if (Object.keys(fields).length > 0) return validationError(fields)
    const now = ctx.clock.now()
    const row = pkskAccessRepo.grant(
      {
        userId: userId as number,
        packageId: packageId as number,
        expiresAt,
        grantedById: userIdOf(req),
      },
      now,
    )
    return created(pkskAccessRepo.view(row, now), { status: ACCESS_FLASH.granted })
  }),

  // #17
  route(
    'POST',
    '/api/admin/pksk-access/:id/revoke',
    [adminOnly],
    (req, ctx) => {
      const id = Number(req.params.id)
      if (!pkskAccessRepo.get(id)) return notFound(ACCESS_MESSAGES.notFound)
      const now = ctx.clock.now()
      const row = pkskAccessRepo.revoke(id, now)
      if (!row) return conflict(ACCESS_MESSAGES.notActive)
      return ok(pkskAccessRepo.view(row, now), { status: ACCESS_FLASH.revoked })
    },
    { params: { id: int() } },
  ),

  // #18 (M19-owned; the fixture is hosted by M07 until M19)
  route('GET', '/api/pksk-packages', [adminOnly], () => ok(pkskPackagesRepo.list())),
]
