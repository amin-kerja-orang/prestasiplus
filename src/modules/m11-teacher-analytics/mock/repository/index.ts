/**
 * The `monitoring` repository (owner **M11**; D12, overview §6.7): the only doorway to the M11 store
 * (DATA-M11-01 MonitoringFlag) and to the M11 read models. M11 owns no other data: every figure is
 * computed per request from the M01 / M02 / M03 / M04 / M05 / M10 contracts (`./segment.ts`).
 *
 * Repository methods are synchronous (overview §6.7.1).
 */

import { defineRepository } from '@/mock/repository'

import { MONITORING_SETTINGS } from '../data/settings'
import { monitoringFlagsTable, type MonitoringFlagRow } from '../tables/tables'
import { makeFlagReader } from './flags'
import { itemAnalysis } from './item-analysis'
import {
  monitoringExport,
  monitoringOverview,
  schoolDetail,
  teacherDetail,
  type MonitoringFilters,
  type MonitoringScope,
} from './monitoring'
import { teacherReport, type Viewer } from './report'
import { studentDetail } from './student'

export const monitoringRepo = defineRepository({
  owner: 'M11',
  name: 'monitoring',
  store: monitoringFlagsTable,
  methods: ({ store, transaction }) => {
    const flags = makeFlagReader(store)
    return {
      /** Seed / finalise phase: stores the flag rows (owner only). */
      seedFlags(rows: readonly MonitoringFlagRow[]): void {
        transaction(() => {
          for (const r of rows) store.insert(r)
        })
      },
      /** DATA-M11-02 constants. */
      settings: () => MONITORING_SETTINGS,
      /** DATA-M11-01 reads. */
      flagOf: (userId: number) => flags.level(userId),
      flags: () => flags.all(),
      flagCounts: () => flags.bySchool(),

      /** #3 S2 overview (a school admin passes `scopeSchoolId`). */
      overview: (filters: MonitoringFilters, scope: MonitoringScope) =>
        monitoringOverview(filters, scope),
      /** #7 export rows. */
      exportRows: (format: 'pdf' | 'csv', filters: MonitoringFilters, scope: MonitoringScope) =>
        monitoringExport(format, filters, scope),
      /** #4 S3; null when the school does not exist. */
      schoolDetail: (schoolId: number) => schoolDetail(flags, schoolId),
      /** #5 S4; null for an unknown school or a user who is not a T4/T5 pupil. */
      studentDetail: (schoolId: number, userId: number) => studentDetail(schoolId, userId),
      /** #6 S5; null for an unknown school or a user who is not a teacher. */
      teacherDetail: (schoolId: number, userId: number) => teacherDetail(schoolId, userId),
      /** #1 S1. */
      teacherReport: (
        viewer: Viewer,
        query: { range?: number; classroomId?: number },
        now: number,
      ) => teacherReport(viewer, query, now),
      /** #8 S6. */
      itemAnalysis: (viewer: Viewer, query: { subjectId?: number; classroomId?: number }) =>
        itemAnalysis(viewer, query),
    }
  },
})

export type { MonitoringFilters, MonitoringScope, Viewer }
