/**
 * `GET /api/duta/recommendations` (SRS M06 §7 #21, M25 §7 #2) as a PROVISIONAL handler: the owner is
 * M24, which is not built yet. M06 hosts it with the DutaCard shape (§6.8) and the fictitious Duta
 * seeds (§6.10); M24 moves it unchanged (same path, same body).
 *
 * BR-M06-27: a random active `bintang` ambassador (seedable: `?seed=` or the mock sampling streams,
 * `setRandomSeed`); with `?subject=` an ambassador whose subject equals it is preferred when one
 * exists. Never picks an `inspirasi` or `tetamu` ambassador. Answers `{data: null}` when none is active.
 */

import { ok, queryInt, queryString, requireAuth, route, type RouteDef } from '@/mock/define'
import { mulberry32 } from '@/mock/determinism'

import { DUTA_SEED, type DutaCard } from '../data/config'

/** Provisional-endpoint tag (build-plan: provisional stores keep the contract; the owner moves it). */
export const DUTA_PROVISIONAL = { owner: 'M24', provisional: true } as const

export const dutaRoutes: RouteDef[] = [
  route('GET', '/api/duta/recommendations', [requireAuth()], (req, ctx) => {
    const subject = queryString(req.query, 'subject')?.trim()
    const seed = queryInt(req.query, 'seed')
    const rng = seed !== undefined ? mulberry32(seed) : ctx.prng.stream('m06.duta')
    const bintang = DUTA_SEED.filter((d) => d.active && d.tier === 'bintang')
    const matching = subject ? bintang.filter((d) => d.subject === subject) : []
    const pool: readonly DutaCard[] = matching.length > 0 ? matching : bintang
    return ok(pool.length === 0 ? null : { ...rng.pick(pool) })
  }),
]
