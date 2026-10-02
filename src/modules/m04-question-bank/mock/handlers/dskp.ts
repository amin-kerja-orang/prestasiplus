/**
 * The DSKP cascade of S2 / S4 (SRS v1.16 §7 #28–#30 = M10 #39–#41): `GET /api/guru/dskp/bidang`,
 * `/sk` and `/sp`, bare arrays as live. The records are the M10 `dskp` store (F-30, owner M10), read
 * through its repository; M04 keeps no DSKP copy (the provisional store of the M04-T1 plan is
 * replaced by it, build-plan §2.4).
 *
 * Admin and teacher sessions may read them (M10 guard `T`; S2/S4 are admin screens). A missing or
 * unknown parameter answers `[]` (as live: the selects stay empty).
 *
 * **Hand-over to M10-T1:** these three routes are registered here so the M04 forms work now. The
 * router rejects a duplicate route at boot, so M10-T1 must not register #39–#41 again: it deletes
 * `handlers/dskp.ts` from M04 and registers them in M10 in the same change (or leaves them here).
 */

import { queryInt, raw, requireRole, route, type RouteDef } from '@/mock/define'

import { dskpStore } from './dskp-source'

const guard = requireRole('admin', 'teacher')

export const dskpRoutes: RouteDef[] = [
  route('GET', '/api/guru/dskp/bidang', [guard], async (req) => {
    const dskp = await dskpStore()
    const subjectId = queryInt(req.query, 'subjectId')
    const educationLevelId = queryInt(req.query, 'educationLevelId')
    if (subjectId === undefined || educationLevelId === undefined) return raw(200, [])
    return raw(
      200,
      dskp.bidang({ subjectId, educationLevelId }).map((b) => ({
        id: b.id,
        code: b.code,
        name: b.name,
      })),
    )
  }),
  route('GET', '/api/guru/dskp/sk', [guard], async (req) => {
    const dskp = await dskpStore()
    const bidangId = queryInt(req.query, 'bidangId')
    if (bidangId === undefined) return raw(200, [])
    return raw(
      200,
      dskp.sk(bidangId).map((s) => ({ id: s.id, code: s.code, description: s.description })),
    )
  }),
  route('GET', '/api/guru/dskp/sp', [guard], async (req) => {
    const dskp = await dskpStore()
    const skId = queryInt(req.query, 'skId')
    if (skId === undefined) return raw(200, [])
    return raw(
      200,
      dskp.sp(skId).map((s) => ({ id: s.id, code: s.code, description: s.description })),
    )
  }),
]
