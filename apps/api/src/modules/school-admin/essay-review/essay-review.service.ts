import { Inject, Injectable } from '@nestjs/common'
import { ESSAY_REVIEW_COPY, EssayReviewConfirmRequestSchema, type EssayReviewConfirmResult, type EssayReviewListResponse, type EssayReviewRow } from '@pp/contract'

import { AuditService } from '../../../common/audit/audit.service'
import { ApiError } from '../../../common/errors/api-error'
import { listMeta } from '../../../common/http/respond'
import { CLOCK, type Clock } from '../../../db/clock'
import { idFromString, idToString, isIdString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'
import { isOverloadError } from '../../auth/auth.errors'
import { WRITE_TX } from '../school-admin.constants'

export const ESSAY_REVIEW_PAGE_SIZE = 20
export const ESSAY_REVIEW_AUDIT = { CONFIRMED: 'essay_review.confirmed' } as const

/** Who asks. `schoolId` is the school of a school admin (from the session) or null for Admin Pusat (every school). */
export interface EssayReviewActor {
  userId: string
  role: string
  schoolId: string | null
  sessionRowId: string
  scopeLevel: string
  isTest: boolean
  requestId: string | null
  ip: string | null
}

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map((x) => x.trim()) : [])
const pointsOf = (v: unknown): EssayReviewRow['points'] =>
  Array.isArray(v)
    ? v
        .filter((p): p is Record<string, unknown> => typeof p === 'object' && p !== null)
        .map((p) => ({
          ...(typeof p.id === 'number' ? { id: p.id } : {}),
          ...(typeof p.covered === 'boolean' ? { covered: p.covered } : {}),
          ...(typeof p.awarded === 'number' ? { awarded: p.awarded } : {}),
        }))
    : []

/**
 * Tanda Karangan (V2 `EssayReviewController`). The queue is the proposals still `pending`; confirm writes the FINAL mark. The scope
 * is applied in the query itself (before paging, so page 2 can reach no further than page 1): a school admin sees only the pupils'
 * work of the school of the session, Admin Pusat sees all. The essay is child data and is never logged.
 */
@Injectable()
export class EssayReviewService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async list(actor: EssayReviewActor, rawPage: unknown): Promise<EssayReviewListResponse> {
    const n = typeof rawPage === 'string' && /^\d{1,6}$/.test(rawPage) ? Number(rawPage) : 1
    const page = Math.max(1, n)
    const where = { status: 'pending', ...(actor.schoolId !== null ? { schoolId: idFromString(actor.schoolId) } : {}) }
    const client = this.prisma.client
    const [total, rows] = await this.guard(() =>
      Promise.all([
        client.essayReviewProposal.count({ where }),
        client.essayReviewProposal.findMany({ where, orderBy: { id: 'desc' }, skip: (page - 1) * ESSAY_REVIEW_PAGE_SIZE, take: ESSAY_REVIEW_PAGE_SIZE }),
      ]),
    )
    const names = await this.guard(() => client.user.findMany({ where: { id: { in: rows.map((r) => r.studentId) } }, select: { id: true, name: true } }))
    const nameOf = new Map(names.map((u) => [u.id, u.name]))
    const data: EssayReviewRow[] = rows.map((r) => ({
      id: idToString(r.id),
      student: nameOf.get(r.studentId) ?? '—',
      questionNo: r.questionLabel,
      stem: r.stem,
      marks: r.maxMarks,
      proposed: r.proposedMarks,
      rationale: r.rationale,
      points: pointsOf(r.points),
      scheme: strings(r.scheme),
      essay: r.essayText,
    }))
    return { data, meta: listMeta(page, ESSAY_REVIEW_PAGE_SIZE, total) }
  }

  /**
   * The ONLY place that writes a final mark. The scope check comes before the input check (V2): a proposal outside the scope is the
   * same 404 as an unknown id. The mark is clamped to the part maximum.
   */
  async confirm(actor: EssayReviewActor, id: string, body: unknown): Promise<EssayReviewConfirmResult> {
    if (!isIdString(id)) throw ApiError.of('NOT_FOUND')
    const proposalId = idFromString(id)
    const row = await this.guard(() => this.prisma.client.essayReviewProposal.findUnique({ where: { id: proposalId }, select: { schoolId: true, maxMarks: true } }))
    if (!row || (actor.schoolId !== null && idToString(row.schoolId) !== actor.schoolId)) throw ApiError.of('NOT_FOUND')

    const parsed = EssayReviewConfirmRequestSchema.safeParse(body)
    if (!parsed.success) {
      const message = 'Markah diperlukan dan mestilah nombor bulat antara 0 dan 65535.'
      throw ApiError.of('VALIDATION_ERROR', { message, fields: { marks: message } })
    }
    const finalMarks = Math.min(parsed.data.marks, row.maxMarks)
    const now = this.clock.now()
    try {
      await this.prisma.transaction(async (tx) => {
        await tx.essayReviewProposal.update({ where: { id: proposalId }, data: { status: 'confirmed', finalMarks, confirmedBy: idFromString(actor.userId), confirmedAt: now } })
        await this.audit.record({
          tx,
          action: ESSAY_REVIEW_AUDIT.CONFIRMED,
          actorUserId: actor.userId,
          actorRole: actor.role,
          sessionRowId: actor.sessionRowId,
          scopeLevel: actor.scopeLevel,
          schoolId: idToString(row.schoolId),
          requestId: actor.requestId,
          ip: actor.ip,
          isTest: actor.isTest,
          targetType: 'essay_review_proposal',
          targetId: id,
          details: { proposalId: id, finalMarks },
        })
      }, WRITE_TX)
    } catch (err) {
      if (isOverloadError(err)) throw ApiError.of('RATE_LIMITED', { retryAfter: 5 })
      throw err
    }
    return { data: { id, finalMarks }, status: ESSAY_REVIEW_COPY.confirmed }
  }

  private async guard<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn()
    } catch (err) {
      if (isOverloadError(err)) throw ApiError.of('RATE_LIMITED', { retryAfter: 5 })
      throw err
    }
  }
}
