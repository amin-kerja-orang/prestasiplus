import { Inject, Injectable } from '@nestjs/common'

import type { Prisma } from '../../../../db/generated/client'
import { idFromString } from '../../../../db/ids'
import { PrismaService } from '../../../../db/prisma.service'

export type ReportRow = Prisma.QuestionReportGetPayload<object>

export interface NewReport {
  questionId: bigint
  questionVersionNo: number
  questionType: 'mcq' | 'structured'
  reporterId: bigint
  /** DM-82: from the session role, never from the client. */
  reporterRole: 'murid' | 'guru'
  reasons: string[]
  comment: string | null
  source: string
  quizSessionRef: string | null
  roomCode: string | null
  /** R1-T42: the verified attempt context (paper and label always come from the attempt). */
  context: { attemptId: string; paperId: bigint | null; paperLabel: string } | null
  isTest: boolean
  now: Date
}

export interface ReportPatch {
  status: 'reviewed' | 'fixed' | 'dismissed'
  /** `undefined` keeps the note. */
  adminNotes?: string | null
  resolvedById: bigint
  now: Date
}

/** A published Kertas Pilihan that places a question (H-A13). */
export interface PlacingPaper {
  id: bigint
  title: string
}

/** The only doorway to `question_reports` (uses the ambient transaction through `prisma.client`). */
@Injectable()
export class ReportsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * One report per reporter, question and version (unique index; FR-MUR-54-6/10). The service checks `exists` under the reporter lock
   * and answers 409; `ON CONFLICT DO NOTHING` is the last guard (a unique violation would abort the surrounding transaction), so a
   * `false` result means the row was already there and the caller answers 409 too. A filed report is never rewritten here.
   */
  async insert(n: NewReport): Promise<boolean> {
    const rows = await this.prisma.client.$executeRaw`
      INSERT INTO question_reports
        (question_id, question_version_no, question_type, reporter_id, reporter_role, reasons, comment, source, quiz_session_ref, room_code,
         attempt_id, paper_id, paper_label, is_test, created_at, updated_at)
      VALUES
        (${n.questionId}, ${n.questionVersionNo}, ${n.questionType}, ${n.reporterId}, ${n.reporterRole}, ${n.reasons}::text[], ${n.comment}, ${n.source},
         ${n.quizSessionRef}, ${n.roomCode}, ${n.context?.attemptId ?? null}::uuid, ${n.context?.paperId ?? null}, ${n.context?.paperLabel ?? null},
         ${n.isTest}, ${n.now}, ${n.now})
      ON CONFLICT (reporter_id, question_id, question_version_no) DO NOTHING`
    return rows === 1
  }

  /** The facts the report context check needs about one attempt (R1-T42): the owner, the paper, its snapshot title and the placed question ids. */
  async attemptFacts(attemptId: string): Promise<{ userId: bigint; paperId: bigint | null; label: string; questionIds: Set<string> } | null> {
    const a = await this.prisma.client.examAttempt.findUnique({ where: { id: attemptId }, select: { userId: true, paperId: true, title: true, paperCode: true, composition: true } })
    if (!a) return null
    const ids = new Set<string>()
    if (Array.isArray(a.composition)) {
      for (const section of a.composition as unknown[]) {
        const list = typeof section === 'object' && section !== null ? (section as { questionIds?: unknown }).questionIds : undefined
        if (Array.isArray(list)) for (const q of list) if (typeof q === 'string' || typeof q === 'number') ids.add(String(q))
      }
    }
    return { userId: a.userId, paperId: a.paperId, label: a.paperCode ? `${a.title} (${a.paperCode})` : a.title, questionIds: ids }
  }

  /** REP-L1: serializes one reporter's filings (transaction-scoped advisory lock) so the cap count and the insert cannot interleave. */
  async lockReporter(reporterId: bigint): Promise<void> {
    await this.prisma.client.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`question-report-cap:${reporterId}`}, 0))`
  }

  /** REQ-B-031: how many reports this user created since `since` (the cap counts new rows, never refreshes). */
  countCreatedSince(reporterId: bigint, since: Date): Promise<number> {
    return this.prisma.client.questionReport.count({ where: { reporterId, createdAt: { gte: since } } })
  }

  /** REQ-B-031: the practice session (uuid) with the owner and whether it served `questionId`; null when unknown, `'malformed'` when it is not a uuid. */
  async sessionFacts(sessionId: string, questionId: bigint): Promise<{ userId: bigint; holds: boolean } | 'malformed' | null> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId)) return 'malformed'
    const s = await this.prisma.client.practiceSession.findUnique({
      where: { id: sessionId.toLowerCase() },
      select: { userId: true, questions: { where: { questionId }, select: { id: true }, take: 1 } },
    })
    return s ? { userId: s.userId, holds: s.questions.length > 0 } : null
  }

  /** FR-MUR-54-10: this reporter already has a report row for this question version (a repeat is 409). */
  async exists(reporterId: bigint, questionId: bigint, versionNo: number): Promise<boolean> {
    return (await this.prisma.client.questionReport.count({ where: { reporterId, questionId, questionVersionNo: versionNo } })) > 0
  }

  get(id: string): Promise<ReportRow | null> {
    let key: bigint
    try {
      key = idFromString(id)
    } catch {
      return Promise.resolve(null)
    }
    return this.prisma.client.questionReport.findUnique({ where: { id: key } })
  }

  list(where: Prisma.QuestionReportWhereInput): Promise<ReportRow[]> {
    return this.prisma.client.questionReport.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] })
  }

  async statusCounts(where: Prisma.QuestionReportWhereInput): Promise<Record<string, number>> {
    const groups = await this.prisma.client.questionReport.groupBy({ by: ['status'], where, _count: { _all: true } })
    return Object.fromEntries(groups.map((g) => [g.status, g._count._all]))
  }

  update(id: bigint, p: ReportPatch): Promise<ReportRow> {
    return this.prisma.client.questionReport.update({
      where: { id },
      data: {
        status: p.status,
        ...(p.adminNotes !== undefined ? { adminNotes: p.adminNotes } : {}),
        resolvedById: p.status === 'reviewed' ? null : p.resolvedById,
        resolvedAt: p.status === 'reviewed' ? null : p.now,
        updatedAt: p.now,
      },
    })
  }

  /** Open reports on `questionId` filed against an older version than the one just published. */
  openBefore(questionId: bigint, versionNo: number): Promise<ReportRow[]> {
    return this.prisma.client.questionReport.findMany({
      where: { questionId, status: { in: ['pending', 'reviewed'] }, questionVersionNo: { lt: versionNo } },
      orderBy: { id: 'asc' },
    })
  }

  markFixed(id: bigint, versionNo: number, now: Date): Promise<ReportRow> {
    return this.prisma.client.questionReport.update({
      where: { id },
      data: { status: 'fixed', fixedInVersionNo: versionNo, resolvedAt: now, updatedAt: now },
    })
  }

  async userNames(ids: readonly bigint[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map()
    const rows = await this.prisma.client.user.findMany({ where: { id: { in: [...ids] } }, select: { id: true, name: true } })
    return new Map(rows.map((r) => [r.id.toString(), r.name]))
  }

  async subjectCodes(ids: readonly bigint[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map()
    const rows = await this.prisma.client.subject.findMany({ where: { id: { in: [...ids] } }, select: { id: true, code: true } })
    return new Map(rows.map((r) => [r.id.toString(), r.code]))
  }

  /** The published curated papers (Kertas Pilihan) that place this question, oldest first (read-only; the papers tables are M28's). */
  async publishedPapersPlacing(questionId: bigint): Promise<PlacingPaper[]> {
    return this.prisma.client.paper.findMany({
      where: { kind: 'pilihan', status: 'published', sections: { some: { placements: { some: { questionId } } } } },
      select: { id: true, title: true },
      orderBy: { id: 'asc' },
    })
  }
}
