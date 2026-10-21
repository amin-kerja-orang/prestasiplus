import { Inject, Injectable } from '@nestjs/common'
import type { DutaCard } from '@pp/contract'

import { CLOCK, type Clock } from '../../db/clock'
import { fnv1a32, mulberry32 } from '../../db/prng'
import { SpmRepository } from './spm.repository'

/**
 * `GET /api/duta/recommendations` (M06-14), PROVISIONAL hosting of an M24 endpoint (same path, same body).
 * BR-M06-27: a random active `bintang` profile; with a subject, one of that subject is preferred when it exists.
 * Never an `inspirasi`, a `tetamu` or an inactive profile. `seed` makes the pick deterministic; without it the
 * stream is seeded from the clock (never `Math.random`).
 */
@Injectable()
export class DutaService {
  constructor(
    @Inject(SpmRepository) private readonly repo: SpmRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async recommend(query: { subject?: unknown; seed?: unknown }): Promise<DutaCard | null> {
    const subject = typeof query.subject === 'string' ? query.subject.trim() : ''
    // A seed that is not an integer is ignored, as in the mock.
    const seed = typeof query.seed === 'string' && /^-?\d+$/.test(query.seed.trim()) ? Number(query.seed.trim()) : undefined
    const rng = seed !== undefined ? mulberry32(seed) : mulberry32(fnv1a32(`m06.duta:${String(this.clock.now().getTime())}`))
    const bintang = await this.repo.activeBintang()
    const matching = subject === '' ? [] : bintang.filter((d) => d.subject === subject)
    const pool = matching.length > 0 ? matching : bintang
    if (pool.length === 0) return null
    const d = rng.pick(pool)
    return { slug: d.slug, name: d.name, initials: d.initials, tier: d.tier, tagline: d.tagline, subject: d.subject, state: d.state, rating: d.rating, active: d.isActive }
  }
}
