/**
 * M25 routes (SRS M25 v1.2 §7). #1 `GET /api/buku-nota/heatmap`: student and admin only (guest 401,
 * other roles 403, BR-M25-01); the data is the session user's own, any query value is ignored
 * (V-M25-01). #2 `GET /api/duta/recommendations` belongs to M24 (M06 hosts it provisionally) and is
 * not registered here.
 */

import { ok, requireRole, route, type RouteDef } from '@/mock/define'

import { HEATMAP_PATH } from '../../api/settings'
import type { HeatmapResponse } from '../../api/types'
import { heatmap } from '../repository/heatmap'

export const m25Routes: RouteDef[] = [
  route('GET', HEATMAP_PATH, [requireRole('student', 'admin')], (req) => {
    if (!req.session) throw new Error('a guard must run before this handler')
    const body: HeatmapResponse = { subjects: heatmap.forUser(req.session.userId) }
    return ok(body)
  }),
]
