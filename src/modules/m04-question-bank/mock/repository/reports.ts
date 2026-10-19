/**
 * The `reports` repository (owner M04; SRS v1.10 §6.3, BR-M04-11…15, §7 #14–#17): question reports
 * from the S14 modal (M05/M06 hosts) and the M10 teacher databank, and the admin triage.
 *
 * `reports.create` writes the report **and** its effect in one transaction (overview §6.8):
 * an MCQ report deactivates the question at once; a structured question becomes inactive when it
 * has ≥ 3 reports in `pending` or `reviewed` (BR-M04-12).
 */

import { toIsoMyt } from '@/lib/time'
import { defineNamedQueries } from '@/mock/dataset'
import { defineTable, maxPlusOne, type Where } from '@/mock/define'
import { defineRepository, RepositoryError } from '@/mock/repository'

import { compact } from './queries'
import { questionsRepo } from './questions'
import { MCQ_REASONS, REPORT_SOURCES, REPORT_SUCCESS_MESSAGE, STRUCTURED_REASONS } from './rules'
import { structuredRepo } from './structured'
import type { QuestionReport, ReportQuestionType, ReportSource, ReportStatus } from './types'

export const reportsTable = defineTable<QuestionReport>({
  name: 'questionReports',
  ids: maxPlusOne(),
  indexes: ['questionId', 'reporterId', 'status'],
})

/** Named counts of the S7 tabs and S13 counters (BR-M04-14: stored status). */
export const reportQueries = defineNamedQueries(reportsTable, {
  'R-STATUS': {
    where: (status?: ReportStatus): Where<QuestionReport> => compact({ status }),
    source: 'M04 §7 #14 meta.counts',
  },
  'R-MINE': {
    where: (reporterId: number, status?: ReportStatus): Where<QuestionReport> =>
      compact({ reporterId, status }),
    source: 'M04 §7 #17 meta.counts',
  },
})

export interface ReportInput {
  questionId: number
  questionType?: ReportQuestionType
  reasons: readonly string[]
  comment?: string | null
  source: ReportSource
  quizSessionId?: string | null
  roomCode?: string | null
}

export interface ReportUpdate {
  status: Exclude<ReportStatus, 'pending'>
  adminNotes?: string | null
  reactivate?: boolean
  forceDeactivate?: boolean
}

function contract(message: string): never {
  throw new RepositoryError('CONTRACT', `reports: ${message}`)
}

const newestFirst = (a: QuestionReport, b: QuestionReport) =>
  b.createdAt.localeCompare(a.createdAt) || b.id - a.id

export const reportsRepo = defineRepository({
  name: 'reports',
  owner: 'M04',
  store: reportsTable,
  queries: reportQueries,
  methods: ({ store, transaction }) => {
    const openReports = (questionId: number) =>
      store
        .query({ where: { questionId, questionType: 'structured' } })
        .rows.filter((r) => r.status === 'pending' || r.status === 'reviewed').length

    const setQuestionActive = (
      type: ReportQuestionType,
      id: number,
      active: boolean,
      now: number,
    ) => {
      if (type === 'mcq') {
        if (!questionsRepo.exists(id)) return
        if (active) questionsRepo.reactivate(id, now)
        else questionsRepo.deactivate(id, now)
      } else {
        structuredRepo.setActive(id, active, now)
      }
    }

    return {
      get: (id: number): QuestionReport | null => store.get(id) ?? null,
      /** S7 (#14): one tab (`undefined` = all), newest first, no paging (BR-M04-29). */
      list: (status?: ReportStatus): QuestionReport[] =>
        store.query({ where: compact({ status }) }).rows.sort(newestFirst),
      /** S13 (#17): the caller's reports, newest first. */
      mine: (reporterId: number): QuestionReport[] =>
        store.query({ where: { reporterId } }).rows.sort(newestFirst),
      /**
       * #15 (BR-M04-11/12): `pending` report + deactivation, in one transaction. Returns the live
       * response `{ success, message }` plus the new id.
       */
      create: (input: ReportInput, reporterId: number, now: number) => {
        const type = input.questionType ?? 'mcq'
        const allowed: readonly string[] = type === 'mcq' ? MCQ_REASONS : STRUCTURED_REASONS
        if (input.reasons.length === 0) contract('at least one reason is required')
        const bad = input.reasons.filter((r) => !allowed.includes(r))
        if (bad.length > 0) contract(`reason(s) ${bad.join(', ')} not in the ${type} set`)
        if (!(REPORT_SOURCES as readonly string[]).includes(input.source)) {
          contract(`source '${input.source}' is not allowed`)
        }
        if ((input.comment ?? '').length > 500) contract('comment is at most 500 characters')
        return transaction(() => {
          const iso = toIsoMyt(now)
          const row = store.insert({
            questionType: type,
            questionId: input.questionId,
            reporterId,
            reasons: [...input.reasons],
            comment: input.comment ?? null,
            source: input.source,
            quizSessionId: input.quizSessionId ?? null,
            roomCode: input.roomCode ?? null,
            sourceSet: null,
            status: 'pending',
            adminNotes: null,
            createdAt: iso,
            updatedAt: iso,
          })
          if (type === 'mcq') setQuestionActive('mcq', input.questionId, false, now)
          else if (openReports(input.questionId) >= 3) {
            setQuestionActive('structured', input.questionId, false, now)
          }
          return { success: true as const, message: REPORT_SUCCESS_MESSAGE, id: row.id }
        })
      },
      /** #16 (BR-M04-13). */
      update: (id: number, patch: ReportUpdate, now: number): QuestionReport | null => {
        const current = store.get(id)
        if (!current) return null
        return transaction(() => {
          const row = store.update(id, {
            status: patch.status,
            ...(patch.adminNotes !== undefined ? { adminNotes: patch.adminNotes } : {}),
            updatedAt: toIsoMyt(now),
          })
          if (patch.reactivate === true)
            setQuestionActive(current.questionType, current.questionId, true, now)
          if (patch.forceDeactivate === true) {
            setQuestionActive(current.questionType, current.questionId, false, now)
          }
          return row
        })
      },
      /** Seed rows (SRS §6.11 "Reports"); seed phase, through the repository (rule 3a). */
      seedRows: (rows: readonly QuestionReport[]): void => {
        for (const r of rows) store.insert(r)
      },
    }
  },
})
