import { Inject, Injectable } from '@nestjs/common'
import { SPM_HISTORY_PAGE_SIZE, type SpmHistoryMod, type SpmHistoryResponse, type SpmMyStats } from '@pp/contract'

import { toMytTimestamp } from '../../common/time/myt'
import type { SpmCaller } from './hub.service'
import { SpmPorts, type SpmHistoryChip } from './ports'
import { wholePercent } from './rules'

/** The chip behind a `mod` value: the legacy `past_year` is read as `databank`, `ramalan` as `tracking_a` (OPT-MODE-SESI). */
export function chipOf(mod: SpmHistoryMod): SpmHistoryChip {
  if (mod === 'past_year') return 'databank'
  if (mod === 'ramalan') return 'tracking_a'
  return mod
}

/**
 * "Prestasi SPM Anda" figures and the Sejarah Kuiz SPM list (S3-T07 part F). Everything comes through the ports: answers and
 * sittings from `practice/` (S5), Syiling from the M14 ledger. The tiles are over ALL modes, never narrowed by the chip.
 */
@Injectable()
export class SpmHistoryService {
  constructor(@Inject(SpmPorts) private readonly ports: SpmPorts) {}

  /** The four tiles (`SpmOverview.me`, `SpmHistoryResponse.meta.stats`). */
  async stats(caller: SpmCaller): Promise<SpmMyStats> {
    const options = { includeTest: caller.isTest }
    const [answers, coins] = await Promise.all([this.ports.answerStats.statsFor(caller.userId, options), this.ports.coins.earnedCoins(caller.userId, options)])
    return { sessions: answers.sessions, avgAccuracy: wholePercent(answers.correct, answers.answered), coins, answered: answers.answered }
  }

  async history(caller: SpmCaller, query: { mod?: SpmHistoryMod; type?: SpmHistoryMod; halaman?: number }): Promise<SpmHistoryResponse> {
    const mod = query.mod ?? query.type ?? 'all'
    const page = query.halaman ?? 1
    const [list, stats] = await Promise.all([
      this.ports.history.page({ userId: caller.userId, includeTest: caller.isTest, chip: chipOf(mod), page, pageSize: SPM_HISTORY_PAGE_SIZE }),
      this.stats(caller),
    ])
    return {
      data: list.rows.map((r) => ({ ...r, completedAt: toMytTimestamp(r.completedAt) })),
      meta: { page, pageSize: SPM_HISTORY_PAGE_SIZE, pageCount: Math.max(1, Math.ceil(list.total / SPM_HISTORY_PAGE_SIZE)), total: list.total, mod: chipOf(mod), stats },
    }
  }
}
