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
  reasons: string[]
  comment: string | null
  source: string
  quizSessionRef: string | null
  roomCode: string | null
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
   * One report per reporter, question and version (unique index): a second report of the same user
   * on the same version refreshes that row and re-opens it, so it is accepted like the first. A
   * single `INSERT ... ON CONFLICT` keeps concurrent first reports from failing on the index (a
   * unique violation would also abort the surrounding transaction, so a retry is not possible).
   */
  async upsert(n: NewReport): Promise<void> {
    await this.prisma.client.$executeRaw`
      INSERT INTO question_reports
        (question_id, question_version_no, question_type, reporter_id, reasons, comment, source, quiz_session_ref, room_code, is_test, created_at, updated_at)
      VALUES
        (${n.questionId}, ${n.questionVersionNo}, ${n.questionType}, ${n.reporterId}, ${n.reasons}::text[], ${n.comment}, ${n.source},
         ${n.quizSessionRef}, ${n.roomCode}, ${n.isTest}, ${n.now}, ${n.now})
      ON CONFLICT (reporter_id, question_id, question_version_no) DO UPDATE SET
        question_type = EXCLUDED.question_type, reasons = EXCLUDED.reasons, comment = EXCLUDED.comment, source = EXCLUDED.source,
        quiz_session_ref = EXCLUDED.quiz_session_ref, room_code = EXCLUDED.room_code, status = 'pending',
        resolved_by_id = NULL, resolved_at = NULL, fixed_in_version_no = NULL, updated_at = EXCLUDED.updated_at`
  }

  countOpenStructured(questionId: bigint): Promise<number> {
    return this.prisma.client.questionReport.count({
      where: { questionId, questionType: 'structured', status: { in: ['pending', 'reviewed'] } },
    })
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
