import { z } from '../zod'
import { GAMES_MESSAGES, gamesCount } from './common'

/** Admin game settings (M16-51, M16-52). Role `admin` only; other roles 403 "This action is unauthorized.". */

export const GamesAdminOverviewSchema = z
  .strictObject({
    stats: z.strictObject({
      rooms: gamesCount,
      playing: gamesCount,
      finished: gamesCount,
      players: gamesCount.meta({ description: 'Distinct users in rooms.' }),
    }),
    settings: z.strictObject({ boardgameQuizTiles: z.number().int().min(0).max(38) }),
  })
  .meta({ id: 'GamesAdminOverview' })
export type GamesAdminOverview = z.infer<typeof GamesAdminOverviewSchema>

/** `boardgame_quiz_tiles` integer 0..38, else 422 VALIDATION_ERROR "Nilai mesti antara 0 dan 38." (fields.boardgame_quiz_tiles). */
export const GamesAdminSettingsUpdateRequestSchema = z
  .object({
    boardgame_quiz_tiles: z
      .number({ error: GAMES_MESSAGES.quizTiles })
      .int({ error: GAMES_MESSAGES.quizTiles })
      .min(0, { error: GAMES_MESSAGES.quizTiles })
      .max(38, { error: GAMES_MESSAGES.quizTiles }),
  })
  .meta({ id: 'GamesAdminSettingsUpdateRequest' })
export type GamesAdminSettingsUpdateRequest = z.infer<typeof GamesAdminSettingsUpdateRequestSchema>

export const GamesAdminSettingsResultSchema = z
  .strictObject({ boardgameQuizTiles: z.number().int().min(0).max(38) })
  .meta({ id: 'GamesAdminSettingsResult' })
export type GamesAdminSettingsResult = z.infer<typeof GamesAdminSettingsResultSchema>
