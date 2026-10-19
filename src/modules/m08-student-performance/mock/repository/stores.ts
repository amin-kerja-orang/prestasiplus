/**
 * The M08 repositories (owner **M08**; D12, overview §6.7; SRS M08 v1.11 §6). Each store has one
 * repository, and only its methods write the store (ownership guard):
 *
 * - `schoolSpmHistory` (DATA-M08-09): `platform()`, `forSchool(schoolId)`, `all()`; read by M12 / M17.
 * - `itemStatistics` (DATA-M08-11): `forScope(kind, scopeId, tingkatan?)`, `scopeIds(kind)`,
 *   `catalogue()` (the critical questions M18 contributes to M04); read by M18 and by M08 S9.
 * - `spRecords` (DATA-M08-04) and `riskProfiles` (DATA-M08-05): the S7 / S8 read models.
 * - `timeline` (DATA-M08-06), `rankings` (DATA-M08-07), `standings` (DATA-M08-08 display rows),
 *   `activity` (DATA-M08-10 stored fields).
 *
 * Repository methods are synchronous; the seed methods are called from the M08 seed / finalise.
 */

import { defineRepository } from '@/mock/repository'

import {
  activityTable,
  itemStatisticsTable,
  itemSummariesTable,
  rankingEntriesTable,
  riskProfilesTable,
  spmHistoryTable,
  spRecordsTable,
  standingsTable,
  timelinePostsTable,
} from '../tables/tables'
import { CRITICAL_QUESTIONS } from '../data/item-statistics'
import { GPS_CHART } from '../data/observed'
import type {
  ActivityRow,
  ItemStatisticRow,
  ItemSummaryRow,
  RankingEntryRow,
  RiskProfileRow,
  SpmHistoryRow,
  SpRecordRow,
  StandingPeriod,
  StandingRow,
  TimelinePostRow,
} from './types'

export interface SubjectTrend {
  readonly years: readonly number[]
  readonly subjects: readonly {
    readonly name: string
    readonly color: string
    readonly data: readonly (number | null)[]
  }[]
}

export const schoolSpmHistoryRepo = defineRepository({
  owner: 'M08',
  name: 'schoolSpmHistory',
  store: spmHistoryTable,
  methods: ({ store, transaction }) => ({
    seed(rows: readonly SpmHistoryRow[]): void {
      transaction(() => rows.forEach((r) => store.insert(r)))
    },
    /** The platform rows (`schoolId` null), oldest year first (S1 trend). */
    platform(): SpmHistoryRow[] {
      return store
        .query({ where: { schoolId: { isNull: true } } })
        .rows.sort((a, b) => a.year - b.year)
    },
    /**
     * The platform per-subject GPS series of the S1 trend chart (observed, discovery §6.1; hard-coded as
     * live, DV-27): `years` (2022…2026) and one `{name, color, data}` per subject, `data[i]` = GPS of
     * `years[i]`, `null` = no data. There is no school-scoped series. Read-only: a deep frozen copy.
     */
    subjectTrend(): SubjectTrend {
      return Object.freeze({
        years: Object.freeze([...GPS_CHART.labels]),
        subjects: Object.freeze(
          GPS_CHART.subjects.map((x) =>
            Object.freeze({ name: x.name, color: x.color, data: Object.freeze([...x.data]) }),
          ),
        ),
      })
    },
    /** A school's rows (M12 / M17 / M18), oldest year first. */
    forSchool(schoolId: number): SpmHistoryRow[] {
      return store.query({ where: { schoolId } }).rows.sort((a, b) => a.year - b.year)
    },
    all(): SpmHistoryRow[] {
      return store.query({}).rows
    },
  }),
})

export type ItemScopeKind = ItemStatisticRow['scopeKind']

export const itemStatisticsRepo = defineRepository({
  owner: 'M08',
  name: 'itemStatistics',
  store: itemStatisticsTable,
  stores: { summaries: itemSummariesTable },
  methods: ({ store, stores, transaction }) => ({
    seed(rows: readonly ItemStatisticRow[], summaries: readonly ItemSummaryRow[] = []): void {
      transaction(() => {
        rows.forEach((r) => store.insert(r))
        summaries.forEach((r) => stores.summaries.insert(r))
      })
    },
    /** The observed S9 headline row of a school view (display constant), or undefined. */
    summary(schoolId: number, tingkatan: 'T4' | 'T5' | null = null): ItemSummaryRow | undefined {
      return stores.summaries.get(`${String(schoolId)}:${tingkatan ?? 'all'}`)
    },
    /**
     * The stored statistics of a scope in stored rank order (Q-M18-CRIT). A scope without a stored set
     * (2710 and every other school) reads as an empty list. `tingkatan` null = every level.
     */
    forScope(
      kind: ItemScopeKind,
      scopeId: string | number,
      tingkatan: 'T4' | 'T5' | null = null,
    ): ItemStatisticRow[] {
      return store
        .query({ where: { scopeKind: kind, scopeId, tingkatan: tingkatan ?? { isNull: true } } })
        .rows.sort((a, b) => a.rank - b.rank)
    },
    /** Scope ids that have a stored set of `kind`. */
    scopeIds(kind: ItemScopeKind): (string | number)[] {
      return [...new Set(store.query({ where: { scopeKind: kind } }).rows.map((r) => r.scopeId))]
    },
    /**
     * The 37 critical questions of the stored sets (stem, subject, topic, correct option letter and the
     * option texts the snapshot shows) with their M04 ids 701001+ (XL3-11). M18 contributes them to M04.
     */
    catalogue: () => CRITICAL_QUESTIONS,
  }),
})

export const spRecordsRepo = defineRepository({
  owner: 'M08',
  name: 'spRecords',
  store: spRecordsTable,
  stores: { riskProfiles: riskProfilesTable },
  methods: ({ store, stores, transaction }) => ({
    seed(rows: readonly SpRecordRow[], profiles: readonly RiskProfileRow[]): void {
      transaction(() => {
        rows.forEach((r) => store.insert(r))
        profiles.forEach((r) => stores.riskProfiles.insert(r))
      })
    },
    /** DATA-M08-04 records of a user in insertion order (`seq`), optionally of one origin. */
    forUser(userId: number, origin?: SpRecordRow['origin']): SpRecordRow[] {
      return store
        .query({ where: { userId } })
        .rows.filter((r) => origin === undefined || r.origin === origin)
        .sort((a, b) => a.seq - b.seq)
    },
    /** DATA-M08-05 profiles of a class (S8), optionally of one subject. */
    riskProfiles(classroomId: number, subjectId?: number): RiskProfileRow[] {
      return stores.riskProfiles
        .query({ where: { classroomId } })
        .rows.filter((r) => subjectId === undefined || r.subjectId === subjectId)
    },
    /** Every stored profile (tests). */
    allRiskProfiles(): RiskProfileRow[] {
      return stores.riskProfiles.query({}).rows
    },
  }),
})

export const timelineRepo = defineRepository({
  owner: 'M08',
  name: 'timeline',
  store: timelinePostsTable,
  methods: ({ store, transaction }) => ({
    seed(rows: readonly Omit<TimelinePostRow, 'id'>[]): void {
      transaction(() => rows.forEach((r, i) => store.insert({ ...r, id: i + 1 })))
    },
    /** A user's posts, newest first by event date, else creation date (FR-M08-99). */
    forUser(userId: number): TimelinePostRow[] {
      const key = (p: TimelinePostRow) => p.eventDate ?? p.createdAt.slice(0, 10)
      return store
        .query({ where: { userId } })
        .rows.sort((a, b) => key(b).localeCompare(key(a)) || b.id - a.id)
    },
    create(input: Omit<TimelinePostRow, 'id'>): TimelinePostRow {
      return transaction(() => store.insert(input))
    },
  }),
})

export const rankingsRepo = defineRepository({
  owner: 'M08',
  name: 'rankings',
  store: rankingEntriesTable,
  methods: ({ store, transaction }) => ({
    seed(rows: readonly Omit<RankingEntryRow, 'id'>[]): void {
      transaction(() => rows.forEach((r, i) => store.insert({ ...r, id: i + 1 })))
    },
    all(): RankingEntryRow[] {
      return store.query({}).rows
    },
  }),
})

export const standingsRepo = defineRepository({
  owner: 'M08',
  name: 'standings',
  store: standingsTable,
  methods: ({ store, transaction }) => ({
    seed(rows: readonly StandingRow[]): void {
      transaction(() => rows.forEach((r) => store.insert(r)))
    },
    /** The display rows of a period (observed and generated learners), insertion order. */
    forPeriod(period: StandingPeriod): StandingRow[] {
      return store.query({ where: { period } }).rows.sort((a, b) => a.seq - b.seq)
    },
  }),
})

export const activityRepo = defineRepository({
  owner: 'M08',
  name: 'activity',
  store: activityTable,
  methods: ({ store, transaction }) => ({
    seed(rows: readonly ActivityRow[]): void {
      transaction(() => rows.forEach((r) => store.insert(r)))
    },
    get(userId: number): ActivityRow | undefined {
      return store.get(userId)
    },
  }),
})

// Re-exported for the M08 seed: the row types stay in ./types.
export type { SpmHistoryRow } from './types'
