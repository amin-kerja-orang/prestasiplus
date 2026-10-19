/**
 * Materialised M08 stores (SRS M08 v1.11 §6). The M08-owned read models: SpRecord, RiskProfile,
 * TimelinePost, RankingEntry, LeaderboardStanding (display rows), SchoolSpmHistory, ItemStatistic and
 * LearnerActivityStats. HeadcountConfig / HeadcountEntry belong to M08-T1b (`headcount*`).
 */

import { defineTable, floor, ID_RANGES, opaque } from '@/mock/define'

import type {
  ActivityRow,
  ItemStatisticRow,
  ItemSummaryRow,
  RankingEntryRow,
  RiskProfileRow,
  SpmHistoryRow,
  SpRecordRow,
  StandingRow,
  TimelinePostRow,
} from '../repository/types'

const natural = (stream: string) => opaque('k_', stream, 12)

export const spRecordsTable = defineTable<SpRecordRow>({
  name: 'm08.spRecords',
  ids: natural('m08:sp-records'),
  indexes: ['userId', 'subjectId'],
})

export const riskProfilesTable = defineTable<RiskProfileRow>({
  name: 'm08.riskProfiles',
  ids: natural('m08:risk-profiles'),
  indexes: ['classroomId', 'userId'],
})

export const timelinePostsTable = defineTable<TimelinePostRow>({
  name: 'm08.timelinePosts',
  ids: floor({ start: ID_RANGES.questionsRuntimeFloor }),
  indexes: ['userId'],
})

export const rankingEntriesTable = defineTable<RankingEntryRow>({
  name: 'm08.rankingEntries',
  ids: floor({ start: ID_RANGES.questionsRuntimeFloor }),
})

export const standingsTable = defineTable<StandingRow>({
  name: 'm08.standings',
  ids: natural('m08:standings'),
  indexes: ['period', 'userId'],
})

export const spmHistoryTable = defineTable<SpmHistoryRow>({
  name: 'm08.spmHistory',
  ids: natural('m08:spm-history'),
  indexes: ['schoolId'],
})

export const itemStatisticsTable = defineTable<ItemStatisticRow>({
  name: 'm08.itemStatistics',
  ids: natural('m08:item-statistics'),
  indexes: ['scopeKind', 'scopeId', 'tingkatan'],
})

export const itemSummariesTable = defineTable<ItemSummaryRow>({
  name: 'm08.itemSummaries',
  ids: natural('m08:item-summaries'),
  indexes: ['schoolId'],
})

export const activityTable = defineTable<ActivityRow>({
  name: 'm08.activity',
  ids: floor({ start: ID_RANGES.questionsRuntimeFloor }),
})

export const M08_TABLES = {
  spRecords: spRecordsTable,
  riskProfiles: riskProfilesTable,
  timelinePosts: timelinePostsTable,
  rankingEntries: rankingEntriesTable,
  standings: standingsTable,
  spmHistory: spmHistoryTable,
  itemStatistics: itemStatisticsTable,
  itemSummaries: itemSummariesTable,
  activity: activityTable,
}
