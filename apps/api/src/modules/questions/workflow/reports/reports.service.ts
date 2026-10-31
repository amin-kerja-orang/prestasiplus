import { Inject, Injectable } from '@nestjs/common'
import {
  QUESTION_REPORT_DISPLAY_LABELS,
  QUESTION_REPORT_FILTERS,
  QUESTION_REPORT_MESSAGES as M,
  type QuestionReportMineView,
  type QuestionReportView,
} from '@pp/contract'

import { ApiError } from '../../../../common/errors/api-error'
import { listMeta } from '../../../../common/http/respond'
import { toMytTimestamp } from '../../../../common/time/myt'
import { CLOCK, type Clock } from '../../../../db/clock'
import { idFromString, idToString } from '../../../../db/ids'
import { PrismaService } from '../../../../db/prisma.service'
import { NotificationsService } from '../../../notifications'
import type { WorkflowActor } from '../actor'
import { QuestionWorkflowPorts, type QuestionBankPort, type QuestionBrief, type QuestionStatusInfo } from '../ports'
import { REPORT_NOTIFICATION_TYPE, STRUCTURED_DEACTIVATE_AT, reasonLabel, reportCategory } from './reports.constants'
import { ReportsRepository, type ReportRow } from './reports.repository'
import { validateCreate, validateUpdate } from './reports.validation'

type Status = 'pending' | 'reviewed' | 'fixed' | 'dismissed'
type Counts = Record<Status | 'all', number>
type Display = QuestionReportView['displayStatus']

const countsOf = (by: Record<string, number>): Counts => {
  const c: Counts = { pending: by.pending ?? 0, reviewed: by.reviewed ?? 0, fixed: by.fixed ?? 0, dismissed: by.dismissed ?? 0, all: 0 }
  c.all = c.pending + c.reviewed + c.fixed + c.dismissed
  return c
}

const typeOf = (r: ReportRow): 'mcq' | 'structured' => (r.questionType === 'structured' ? 'structured' : 'mcq')

/** Facts about the questions of a set of reports, read once through the question bank port. */
interface QuestionFacts {
  brief: ReadonlyMap<string, QuestionBrief>
  status: ReadonlyMap<string, QuestionStatusInfo>
}

/**
 * Student question reports (mock `handlers/reports.ts`, SRS BR-M04-11 to 16, BE-10 AC 3, 4, 9, 11).
 * Question data and deactivation go through the question bank port; the reports live in
 * `question_reports`.
 */
@Injectable()
export class QuestionReportsService {
  constructor(
    @Inject(ReportsRepository) private readonly repo: ReportsRepository,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(QuestionWorkflowPorts) private readonly ports: QuestionWorkflowPorts,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  private get bank(): QuestionBankPort {
    return this.ports.questionBank
  }

  /** POST /question-reports: the report and its deactivation commit together (BR-M04-11/12). */
  async create(actor: WorkflowActor, body: unknown): Promise<{ success: true; message: string }> {
    const first = validateCreate(body) // shape first: a bad body is 422 before the question is looked up
    const raw = body as { questionType?: unknown }
    const id = idToString(first.questionId)
    return this.prisma.transaction(async () => {
      const info = await this.bank.getStatus(id)
      // Only a question served to learners (live version, active) can be reported; else as unknown.
      if (!info || info.liveVersionNo === null || !info.isActive) throw ApiError.of('NOT_FOUND')
      // The stored type decides the reason set and the deactivation threshold, never the client.
      const stored: 'mcq' | 'structured' = (await this.bank.describe([id])).get(id)?.type === 'structured' ? 'structured' : 'mcq'
      if (raw.questionType !== undefined && raw.questionType !== stored) {
        throw ApiError.of('VALIDATION_ERROR', { fields: { questionType: M.type } })
      }
      const v = validateCreate({ ...(body as object), questionType: stored })
      const context = await this.contextOf(v.context, actor, id)
      await this.repo.upsert({
        questionId: v.questionId,
        questionVersionNo: info.liveVersionNo,
        questionType: v.questionType,
        reporterId: idFromString(actor.userId),
        reasons: v.reasons,
        comment: v.comment,
        source: v.source,
        quizSessionRef: v.quizSessionRef,
        roomCode: v.roomCode,
        context,
        isTest: actor.isTest,
        now: this.clock.now(),
      })
      // MCQ: inactive at the first report; structured: at the third open report (mock rule, OQ 1).
      if (v.questionType === 'mcq' || (await this.repo.countOpenStructured(v.questionId)) >= STRUCTURED_DEACTIVATE_AT) {
        await this.bank.deactivate(id)
      }
      return { success: true as const, message: M.created }
    })
  }

  /**
   * R1-T42: the attempt a report is filed from is trusted only after it is read back: it must be the reporter's own and hold the question
   * (an unknown id and someone else's attempt answer alike, so the id is not an oracle). The paper is taken from the attempt; a
   * `paperId` sent by the client is only compared with it.
   */
  private async contextOf(given: { attemptId: string; paperId: string | null } | null, actor: WorkflowActor, questionId: string) {
    if (given === null) return null
    const a = await this.repo.attemptFacts(given.attemptId)
    if (!a || a.userId !== idFromString(actor.userId)) throw ApiError.of('VALIDATION_ERROR', { fields: { attemptId: M.attempt } })
    if (!a.questionIds.has(questionId)) throw ApiError.of('VALIDATION_ERROR', { fields: { attemptId: M.attemptQuestion } })
    if (given.paperId !== null && (a.paperId === null || idToString(a.paperId) !== given.paperId)) {
      throw ApiError.of('VALIDATION_ERROR', { fields: { paperId: M.paper } })
    }
    return { attemptId: given.attemptId, paperId: a.paperId, paperLabel: a.label.slice(0, 200) }
  }

  /** GET /question-reports (admin): not paged, newest first. */
  async list(statusQuery: unknown) {
    const given = typeof statusQuery === 'string' ? statusQuery : undefined
    const filter = given === undefined || given === '' ? 'pending' : given
    const known = (QUESTION_REPORT_FILTERS as readonly string[]).includes(filter)
    const [rows, by] = await Promise.all([
      known ? this.repo.list(filter === 'all' ? {} : { status: filter }) : Promise.resolve([]),
      this.repo.statusCounts({}),
    ])
    const data = await this.adminViews(rows)
    return {
      data,
      meta: { ...listMeta(1, Math.max(1, data.length), data.length), activeTab: known ? (filter as (typeof QUESTION_REPORT_FILTERS)[number]) : null, counts: countsOf(by) },
    }
  }

  /** GET /question-reports/mine: only the caller's rows, no question content. */
  async mine(actor: WorkflowActor) {
    const reporter = idFromString(actor.userId)
    const [rows, by] = await Promise.all([this.repo.list({ reporterId: reporter }), this.repo.statusCounts({ reporterId: reporter })])
    const facts = await this.factsOf(rows)
    const names = await this.repo.userNames([reporter])
    const data: QuestionReportMineView[] = rows.map((r) => {
      const qid = idToString(r.questionId)
      const exists = facts.status.has(qid)
      return { ...this.baseView(r, exists, facts, names), question: { exists, type: typeOf(r), id: qid } }
    })
    return { data, meta: { ...listMeta(1, Math.max(1, data.length), data.length), counts: countsOf(by) } }
  }

  /** PATCH /question-reports/:id (admin). */
  async update(actor: WorkflowActor, id: string, body: unknown, archive?: (questionId: string) => Promise<void>) {
    const row = await this.repo.get(id)
    if (!row) throw ApiError.of('NOT_FOUND')
    const v = validateUpdate(body)
    const qid = idToString(row.questionId)
    const updated = await this.prisma.transaction(async () => {
      const next = await this.repo.update(row.id, {
        status: v.status,
        ...(v.adminNotes !== undefined ? { adminNotes: v.adminNotes } : {}),
        resolvedById: idFromString(actor.userId),
        now: this.clock.now(),
      })
      if (v.reactivate) await this.bank.reactivate(qid)
      if (v.forceDeactivate) await this.bank.deactivate(qid)
      // R1-B17: "Arkib" on the report row is the real lifecycle archive (status event included), not a deactivation.
      if (v.archive) {
        if (!archive) throw new Error('reports: the archive action is not wired')
        await archive(qid)
      }
      if (row.reporterId !== null && row.status !== v.status) await this.notify(next, await this.displayOf(next))
      return next
    })
    return { data: { id: idToString(updated.id), status: updated.status as Status, adminNotes: updated.adminNotes, updatedAt: toMytTimestamp(updated.updatedAt) }, status: M.updated }
  }

  /**
   * Called by the lifecycle when `versionNo` of `questionId` is published (BE-FR-36): every open
   * (pending or reviewed) report filed against an older version becomes `fixed`, records the fixing
   * version and its reporter is notified. Joins the caller's transaction. Returns how many changed.
   */
  async markFixedFor(questionId: string, versionNo: number): Promise<number> {
    const open = await this.repo.openBefore(idFromString(questionId), versionNo)
    for (const r of open) {
      const next = await this.repo.markFixed(r.id, versionNo, this.clock.now())
      if (next.reporterId !== null) await this.notify(next, 'fixed')
    }
    return open.length
  }

  private async displayOf(r: ReportRow): Promise<Display> {
    const info = await this.bank.getStatus(idToString(r.questionId))
    return r.status === 'fixed' && info !== null && (!info.isActive || info.status === 'archived') ? 'removed' : (r.status as Display)
  }

  private async notify(r: ReportRow, display: Display): Promise<void> {
    if (r.reporterId === null) return
    const label = QUESTION_REPORT_DISPLAY_LABELS[display]
    await this.notifications.push(idToString(r.reporterId), {
      type: REPORT_NOTIFICATION_TYPE,
      category: 'system',
      title: `Laporan soalan: ${label}`,
      body: `Laporan anda tentang soalan ${idToString(r.questionId)} kini berstatus ${label}.`,
    })
  }

  private async factsOf(rows: readonly ReportRow[]): Promise<QuestionFacts> {
    const ids = [...new Set(rows.map((r) => idToString(r.questionId)))]
    const [brief, infos] = await Promise.all([this.bank.describe(ids), Promise.all(ids.map((i) => this.bank.getStatus(i)))])
    const status = new Map<string, QuestionStatusInfo>()
    ids.forEach((i, n) => {
      const info = infos[n]
      if (info) status.set(i, info)
    })
    return { brief, status }
  }

  private baseView(r: ReportRow, exists: boolean, facts: QuestionFacts, names: ReadonlyMap<string, string>) {
    const qid = idToString(r.questionId)
    const type = typeOf(r)
    const info = facts.status.get(qid)
    const gone = !(info?.isActive ?? false) || info?.status === 'archived'
    const display: Display = r.status === 'fixed' && exists && gone ? 'removed' : (r.status as Display)
    return {
      id: idToString(r.id),
      questionType: type,
      questionId: qid,
      questionVersion: r.questionVersionNo,
      reasons: [...r.reasons],
      reasonLabels: r.reasons.map((x) => reasonLabel(type, x)),
      category: reportCategory(r.reasons),
      comment: r.comment,
      source: r.source as QuestionReportView['source'],
      quizSessionId: r.quizSessionRef,
      roomCode: r.roomCode,
      sourceSet: r.sourceSet,
      paper: r.paperLabel === null && r.paperId === null ? null : { id: r.paperId === null ? null : idToString(r.paperId), label: r.paperLabel ?? '', attemptId: r.attemptId },
      status: r.status as Status,
      displayStatus: display,
      adminNotes: r.adminNotes,
      createdAt: toMytTimestamp(r.createdAt),
      updatedAt: toMytTimestamp(r.updatedAt),
      reporter: { id: r.reporterId === null ? '' : idToString(r.reporterId), name: r.reporterId === null ? null : (names.get(idToString(r.reporterId)) ?? null) },
    }
  }

  private async adminViews(rows: readonly ReportRow[]): Promise<QuestionReportView[]> {
    if (rows.length === 0) return []
    const facts = await this.factsOf(rows)
    const reporters = [...new Set(rows.flatMap((r) => (r.reporterId === null ? [] : [r.reporterId])))]
    const subjects = [...facts.brief.values()].flatMap((b) => (b.subjectId === null ? [] : [BigInt(b.subjectId)]))
    const [names, codes] = await Promise.all([this.repo.userNames(reporters), this.repo.subjectCodes(subjects)])
    const out: QuestionReportView[] = []
    for (const r of rows) {
      const qid = idToString(r.questionId)
      const type = typeOf(r)
      const brief = facts.brief.get(qid)
      const info = facts.status.get(qid)
      const exists = info !== undefined
      let question: QuestionReportView['question'] = { exists, type, id: qid }
      if (exists) {
        const code = brief?.subjectId != null ? codes.get(brief.subjectId) : undefined
        const source = type === 'mcq' ? await this.bank.getExplanationSource(qid) : null
        const correct = source?.options?.findIndex((o) => o.isCorrect) ?? -1
        question = {
          ...question,
          ...(brief ? { text: brief.stemText } : {}),
          ...(source?.options ? { options: source.options.map((o) => o.text), correctAnswer: correct >= 0 && correct <= 3 ? correct : null } : {}),
          subjectName: brief?.subjectName ?? null,
          levelName: brief?.levelName ?? null,
          isActive: info.isActive,
          practiceUrl:
            type === 'structured' ? `/latihan-berstruktur/${qid}/jawab?scope=spm` : code ? `/spm/latih-tubi/${code}/quiz?question_id=${qid}&count=1` : null,
        }
      }
      out.push({ ...this.baseView(r, exists, facts, names), question })
    }
    return out
  }
}
