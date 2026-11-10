import { Inject, Injectable } from '@nestjs/common'

import { compareCandidates, percentileOf } from '../domain/kedudukan'
import { firstNameOf } from '../domain/ranking'
import {
  KEDUDUKAN_PORT,
  type KedudukanCandidate,
  type KedudukanPort,
  type KedudukanScope,
} from '../ports/kedudukan.port'
import type { Ctx, PerformanceRanking } from './types'

type ScopeEntry = PerformanceRanking['scopes'][number]

/** "Sekitar anda": up to this many pupils on each side of the viewer. */
const NEARBY_SIDE = 2

/**
 * Kedudukan (R1-MUR-18, API-RPT-13). Rank = 1 + the pupils of the scope pool ordered before the viewer by the chain of
 * 48 GAME-16 on the current wallet balance ("Kedudukan dikira berdasarkan baki syiling."). One entry per applicable scope
 * (kelas only for a pupil in a class; sekolah only with a school; negeri with null figures when the school has no state;
 * kebangsaan always). Other pupils are shown by their first given name only (D-A12, FR-MUR-18-7); the id is never sent.
 * Only a pupil has a standing: any other active role gets no scopes (the page shows "Kedudukan belum tersedia").
 */
@Injectable()
export class RankingService {
  constructor(@Inject(KEDUDUKAN_PORT) private readonly port: KedudukanPort) {}

  async rankings(ctx: Ctx): Promise<PerformanceRanking> {
    if (ctx.role !== 'student') return { syiling: 0, scopes: [] }
    const viewer = await this.port.viewer(ctx.userId)
    if (viewer === null) return { syiling: 0, scopes: [] }

    const applicable: KedudukanScope[] = []
    if (viewer.inClass) applicable.push('kelas')
    if (viewer.schoolId !== null) applicable.push('sekolah')
    applicable.push('negeri', 'kebangsaan')

    const scopes: ScopeEntry[] = []
    for (const scope of applicable) {
      if (scope === 'negeri' && viewer.state === null) {
        scopes.push({ scope, rank: null, total: null, percentile: null, nearby: [] })
        continue
      }
      const entry = await this.standing(ctx.userId, scope)
      if (entry !== null) scopes.push(entry)
    }
    return { syiling: viewer.syiling, scopes }
  }

  private async standing(userId: string, scope: KedudukanScope): Promise<ScopeEntry | null> {
    const pool = await this.port.pool(userId, scope)
    if (pool === null) return null
    const sorted: KedudukanCandidate[] = [...pool.candidates].sort(compareCandidates)
    const at = sorted.findIndex((c) => c.userId === userId)
    if (at < 0) return null
    const mine = sorted[at]?.syiling ?? 0
    // Position inside the viewer's own syiling group, then the pupils above the group.
    const tieBefore = sorted.slice(0, at).filter((c) => c.syiling === mine).length
    const rank = pool.higher + tieBefore + 1
    const total = Math.max(pool.total, rank)
    const from = Math.max(0, at - NEARBY_SIDE)
    const nearby = sorted.slice(from, at + NEARBY_SIDE + 1).map((c, i) => {
      const offset = from + i - at
      const me = c.userId === userId
      return {
        rank: rank + offset,
        name: me ? c.name : firstNameOf(c.name),
        syiling: c.syiling,
        me,
      }
    })
    return { scope, rank, total, percentile: percentileOf(rank, total), nearby }
  }
}
