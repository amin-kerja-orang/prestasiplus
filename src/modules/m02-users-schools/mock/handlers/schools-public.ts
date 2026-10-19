/**
 * Public school lookups (SRS v1.18 §7 #38, #40, #41; M01 #20; F-23). Guests allowed (G): the live
 * endpoints answer without a session (OBSERVED, §9).
 *
 * - #38 `GET /api/schools/search?q=&state=&limit=&id=` → 200 `{data: SchoolSummary[]}`, active
 *   schools only, default limit 20, no maximum.
 * - #40 `GET /api/jpn` → 200 `{data: Jpn[]}` (16).
 * - #41 `GET /api/jpn/:id/ppd` → 200 `{data: Ppd[]}`; 404 for an unknown JPN.
 */

import { int, notFound, ok, queryInt, queryString, route, type RouteDef } from '@/mock/define'

import type { Jpn, Ppd, SchoolSummary } from '../../api/schools'
import { schoolsRepo } from '../repository/schools'

export const schoolPublicRoutes: RouteDef[] = [
  route('GET', '/api/schools/search', (req) => {
    const id = queryInt(req.query, 'id')
    const limit = queryInt(req.query, 'limit')
    const q = queryString(req.query, 'q')
    const state = queryString(req.query, 'state')
    const data: SchoolSummary[] = schoolsRepo.search({
      ...(q === undefined ? {} : { q }),
      ...(state === undefined ? {} : { state }),
      ...(limit === undefined ? {} : { limit }),
      ...(id === undefined ? {} : { id }),
    })
    return ok(data)
  }),
  route('GET', '/api/jpn', () => {
    const data: Jpn[] = schoolsRepo.jpnList()
    return ok(data)
  }),
  route(
    'GET',
    '/api/jpn/:id/ppd',
    (req) => {
      const data: Ppd[] | undefined = schoolsRepo.ppdList(Number(req.params.id))
      return data ? ok(data) : notFound()
    },
    { params: { id: int() } },
  ),
]
