/**
 * The `feedback` repository (owner **M12**; D12; SRS M12 v1.6 §6.2 DATA-M12-01, BR-M12-32, §7 #12-#13). One
 * response per user per calendar month (Asia/Kuala_Lumpur); NPS an integer 0-10, satisfaction an integer 1-5.
 * T1 figures (S1 card, S2, S6, and M17's dashboard through Q-M12-T1) are the aggregates below.
 */

import { defineNamedQueries } from '@/mock/dataset'
import { defineRepository } from '@/mock/repository'

import { feedbackTable } from '../tables/tables'
import type { FeedbackRow } from '../types'
import { M12Error, mean1, monthKeyOf, nowIso } from './common'

export const FEEDBACK_TOTAL = 336

export const feedbackQueries = defineNamedQueries(feedbackTable, {
  /**
   * (schoolId?): the responses, all of them or those of one school's respondents (XR-M17-21, M17 SRS v1.13: the
   * school filter of the existing `school` parameter pattern; INFERRED, UNVERIFIED). A school without
   * respondents counts 0; the platform figure is unchanged.
   */
  'Q-M12-T1': {
    where: (schoolId?: number) => (schoolId === undefined ? {} : { schoolId }),
    expected: [{ args: [], value: FEEDBACK_TOTAL }],
    source: 'M12 §6.6 (S1 "336 respon", S6 "Responden 336"); XR-M17-21 school filter',
  },
  /** (role): responses by role; the split is designed (`observed: false`), only the means are observed. */
  'Q-M12-T1-ROLE': {
    where: (role: string) => ({ role }),
    expected: [
      { args: ['student'], value: 311 },
      { args: ['teacher'], value: 20 },
      { args: ['admin'], value: 5 },
    ],
    source: 'M12 §6.6 designed split',
  },
})

export interface FeedbackAggregates {
  responses: number
  /** Mean satisfaction of all responses, 1 decimal. */
  satisfaction: number
  /** Mean NPS by role (1 decimal) and of all responses. */
  npsStudent: number
  npsTeacher: number
  npsAdmin: number
  nps: number
}

const isInt = (v: unknown, lo: number, hi: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi

export const feedbackRepo = defineRepository({
  owner: 'M12',
  name: 'feedback',
  store: feedbackTable,
  queries: feedbackQueries,
  methods: ({ store, transaction }) => {
    const answered = (userId: number, month: string): boolean => store.count({ userId, month }) > 0

    return {
      /** Seed / finalise: the 336 baseline responses (ids kept). */
      seed(rows: readonly FeedbackRow[]): void {
        transaction(() => {
          for (const row of rows) store.insert({ ...row })
        })
      },

      /** `true` when the user already has a response in `month` (`YYYY-MM`). */
      hasResponse: answered,

      /** The user's responses, oldest first. */
      forUser(userId: number): FeedbackRow[] {
        return store.query({ where: { userId }, sort: [{ field: 'id' }] }).rows
      },

      /**
       * Stores one response for `now`'s month. Throws `M12Error`: `VALIDATION_ERROR` (range) or `CONFLICT`
       * (a second response in the month, BR-M12-32).
       */
      submit(
        user: { id: number; role: string; schoolId: number | null },
        input: { nps: number; satisfaction: number },
        now: number,
      ): FeedbackRow {
        if (!isInt(input.nps, 0, 10)) {
          throw new M12Error('VALIDATION_ERROR', 'NPS mesti nombor bulat antara 0 dan 10.', 'nps')
        }
        if (!isInt(input.satisfaction, 1, 5)) {
          throw new M12Error(
            'VALIDATION_ERROR',
            'Kepuasan mesti nombor bulat antara 1 dan 5.',
            'satisfaction',
          )
        }
        const month = monthKeyOf(now)
        return transaction(() => {
          if (answered(user.id, month)) {
            throw new M12Error('CONFLICT', 'Anda sudah mengisi maklum balas untuk bulan ini.')
          }
          return store.insert({
            userId: user.id,
            role: user.role,
            schoolId: user.schoolId,
            month,
            nps: input.nps,
            satisfaction: input.satisfaction,
            createdAt: nowIso(),
          })
        })
      },

      /**
       * Q-M12-T1 aggregates over all responses (all-time, INFERRED, BR-M12-32), or, with `schoolId`, over the
       * responses of that school's respondents (XR-M17-21); a school without respondents gives `responses: 0`
       * and every mean 0.
       */
      aggregates(schoolId?: number): FeedbackAggregates {
        let npsSum = 0
        let satSum = 0
        let count = 0
        const by = {
          student: [0, 0],
          teacher: [0, 0],
          admin: [0, 0],
        } as const satisfies Record<string, [number, number]>
        const where = schoolId === undefined ? {} : { schoolId }
        for (const r of store.query({ where }).rows) {
          npsSum += r.nps
          satSum += r.satisfaction
          count++
          const bucket =
            r.role === 'student'
              ? by.student
              : r.role === 'teacher'
                ? by.teacher
                : r.role === 'admin'
                  ? by.admin
                  : null
          if (bucket) {
            bucket[0] += r.nps
            bucket[1]++
          }
        }
        return {
          responses: count,
          satisfaction: mean1(satSum, count),
          npsStudent: mean1(by.student[0], by.student[1]),
          npsTeacher: mean1(by.teacher[0], by.teacher[1]),
          npsAdmin: mean1(by.admin[0], by.admin[1]),
          nps: mean1(npsSum, count),
        }
      },
    }
  },
})
