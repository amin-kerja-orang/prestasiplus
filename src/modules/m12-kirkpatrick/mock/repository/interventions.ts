/**
 * The `kirkpatrickInterventions` repository (owner **M12**; D12; XL3-33: distinct from M18's own
 * AmaranIntervention; SRS M12 v1.6 §6.3 DATA-M12-02, BR-M12-26, BR-M12-27, §7 #8-#9). The live list is empty (0 rows).
 * The status is derived on read, never stored; there is no edit or delete.
 */

import { defineNamedQueries } from '@/mock/dataset'
import { defineRepository } from '@/mock/repository'
import { users } from '@/modules/m01-authentication/mock'

import type {
  InterventionInput,
  InterventionList,
  InterventionRow,
  InterventionStatus,
} from '../../api/types'
import { ALERT_TYPES, MOODS } from '../data/rules-data'
import { interventionsTable } from '../tables/tables'
import type { InterventionRowStored } from '../types'
import { M12Error, nowIso, round1 } from './common'

export const interventionQueries = defineNamedQueries(interventionsTable, {
  'Q-M12-INT': { where: {}, expected: 0, source: 'M12 §6.5 (S7 all KPIs 0, empty list)' },
})

/** PROPOSED COPY (SRS M12 §8.2). */
export const NOT_A_STUDENT = 'Pelajar tidak dijumpai.'

/** BR-M12-26. */
export function statusOf(row: {
  beforeAccuracy: number | null
  afterAccuracy: number | null
}): InterventionStatus {
  if (row.afterAccuracy === null) return 'Menunggu Semakan'
  if (row.beforeAccuracy === null) return null
  if (row.afterAccuracy > row.beforeAccuracy) return 'Meningkat'
  if (row.afterAccuracy < row.beforeAccuracy) return 'Menurun'
  return null
}

const isDay = (v: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  const d = new Date(`${v}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v
}

function accuracyOrNull(value: number | null | undefined, field: string): number | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) {
    throw new M12Error('VALIDATION_ERROR', 'Ketepatan mesti antara 0 dan 100.', field)
  }
  return round1(value)
}

function moodOrNull(
  value: string | null | undefined,
  field: string,
): InterventionRowStored['beforeMood'] {
  if (value === null || value === undefined || value === '') return null
  if (!(MOODS as readonly string[]).includes(value)) {
    throw new M12Error('VALIDATION_ERROR', 'Mood tidak sah.', field)
  }
  return value as InterventionRowStored['beforeMood']
}

export const interventionsRepo = defineRepository({
  owner: 'M12',
  name: 'kirkpatrickInterventions',
  store: interventionsTable,
  queries: interventionQueries,
  methods: ({ store, transaction }) => {
    const shape = (r: InterventionRowStored): InterventionRow => ({
      ...r,
      status: statusOf(r),
      studentName: users.get(r.studentId)?.name ?? null,
    })

    return {
      get(id: number): InterventionRowStored | undefined {
        return store.get(id)
      },

      /** The S7 read model: KPIs over the whole store, rows newest first (BR-M12-26). */
      list(): InterventionList {
        const rows = store
          .query({
            sort: [
              { field: 'createdAt', dir: 'desc' },
              { field: 'id', dir: 'desc' },
            ],
          })
          .rows.map(shape)
        return {
          kpi: {
            total: rows.length,
            pending: rows.filter((r) => r.status === 'Menunggu Semakan').length,
            up: rows.filter((r) => r.status === 'Meningkat').length,
            down: rows.filter((r) => r.status === 'Menurun').length,
          },
          rows,
        }
      },

      /**
       * BR-M12-27: stores one intervention. The student must be a user with role `student`
       * (`VALIDATION_ERROR` on `studentId`, "Pelajar tidak dijumpai."); accuracies are 0-100 (stored with one
       * decimal); `createdBy` is the recording user. Throws `M12Error`; nothing is written on a refusal.
       */
      create(input: InterventionInput, createdBy: number): InterventionRow {
        const student = Number.isInteger(input.studentId) ? users.get(input.studentId) : undefined
        if (!student || student.role !== 'student') {
          throw new M12Error('VALIDATION_ERROR', NOT_A_STUDENT, 'studentId')
        }
        if (!(ALERT_TYPES as readonly string[]).includes(input.alertType)) {
          throw new M12Error('VALIDATION_ERROR', 'Jenis amaran tidak sah.', 'alertType')
        }
        if (typeof input.actionDate !== 'string' || !isDay(input.actionDate)) {
          throw new M12Error('VALIDATION_ERROR', 'Tarikh tidak sah.', 'actionDate')
        }
        const before = accuracyOrNull(input.beforeAccuracy, 'beforeAccuracy')
        const after = accuracyOrNull(input.afterAccuracy, 'afterAccuracy')
        const beforeMood = moodOrNull(input.beforeMood, 'beforeMood')
        const afterMood = moodOrNull(input.afterMood, 'afterMood')
        const at = nowIso()
        return transaction(() =>
          shape(
            store.insert({
              studentId: input.studentId,
              alertType: input.alertType,
              actionDate: input.actionDate,
              alertDescription: input.alertDescription,
              actionTaken: input.actionTaken,
              beforeAccuracy: before,
              afterAccuracy: after,
              beforeMood,
              afterMood,
              createdBy,
              createdAt: at,
              updatedAt: at,
            }),
          ),
        )
      },
    }
  },
})
