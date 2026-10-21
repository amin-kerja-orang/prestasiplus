export { GamesModule } from './games.module'
export { GamesCoreModule } from './core/core.module'
export { GamesPorts, NoBattle, NoWeeklyPractice, FallbackPlatformAccuracy } from './core/ports'
export type {
  BattleReadPort,
  BotCandidate,
  BotPickInput,
  BotPoolPort,
  GameResultInput,
  GameResultOutcome,
  GameRewardsPort,
  PlatformAccuracySource,
  WeeklyPracticeRow,
  WeeklyPracticeSource,
} from './core/ports'
export { WalletGameRewards, gameRow } from './core/wallet-rewards'
export { GameReadService } from './core/game-read.service'
export { GameQuestions, toServed } from './core/game-questions.service'
export type { GameQuestionFilter, ServedQuestion } from './core/game-questions.service'
export { GameSubjects, ROOM_SUBJECT_CODES } from './core/subjects'
export { GameUsers } from './core/game-users'
export type { GameUser } from './core/game-users'
