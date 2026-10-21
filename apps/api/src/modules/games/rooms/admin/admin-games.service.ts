import { Inject, Injectable } from '@nestjs/common'
import {
  GamesAdminSettingsUpdateRequestSchema,
  type GamesAdminOverview,
  type GamesAdminSettingsResult,
} from '@pp/contract'

import { CLOCK, type Clock } from '../../../../db/clock'
import { quizTilesInvalid } from '../../errors'
import { DEFAULT_QUIZ_TILES } from '../../games.constants'
import { RoomsRepository } from '../rooms.repository'

/** Admin game settings (M16-51, M16-52). Statistics exclude test rooms. */
@Injectable()
export class AdminGamesService {
  constructor(
    @Inject(RoomsRepository) private readonly repo: RoomsRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async overview(): Promise<GamesAdminOverview> {
    return {
      stats: await this.repo.stats(),
      settings: { boardgameQuizTiles: (await this.repo.quizTiles()) ?? DEFAULT_QUIZ_TILES },
    }
  }

  async setQuizTiles(body: unknown): Promise<GamesAdminSettingsResult> {
    const r = GamesAdminSettingsUpdateRequestSchema.safeParse(
      typeof body === 'object' && body !== null ? body : {},
    )
    if (!r.success) throw quizTilesInvalid()
    await this.repo.setQuizTiles(r.data.boardgame_quiz_tiles, this.clock.now())
    return { boardgameQuizTiles: r.data.boardgame_quiz_tiles }
  }
}
