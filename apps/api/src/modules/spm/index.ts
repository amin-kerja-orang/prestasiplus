export { SpmModule } from './spm.module'
export { SpmPortsModule } from './spm-ports.module'
export { SpmPorts, NoStructuredAttempts, NoPapers, NoAnswerStats, NoCoins, NoHistory } from './ports'
export type {
  SpmAnswerStats,
  SpmAnswerStatsSource,
  SpmCoinSource,
  SpmHistoryChip,
  SpmHistoryPageQuery,
  SpmHistoryRowData,
  SpmHistorySource,
  SpmPaperSource,
  SpmStructuredAttemptSource,
  SpmStructuredStats,
} from './ports'
export { SPM_ANSWER_MODES, SPM_COIN_SOURCES, SPM_SESSION_MODES } from './config'
export { SpmTrackingService } from './tracking.service'
export type { SetView } from './tracking.service'
export { setStatus, isStartable, gradeOf, heroClassOf, markPaper2, weakTopicsOf } from './rules'
