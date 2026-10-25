import { Inject, Injectable } from '@nestjs/common'
import { KIRKPATRICK_MESSAGES, kirkpatrickIsCalendarDay } from '@pp/contract'

import { AUDIT_ACTIONS } from '../../../../common/audit/audit-actions'
import { AuditService } from '../../../../common/audit'
import { ApiError } from '../../../../common/errors/api-error'
import { toMytTimestamp } from '../../../../common/time/myt'
import { CLOCK, type Clock } from '../../../../db/clock'
import { isIdString } from '../../../../db/ids'
import { PrismaService } from '../../../../db/prisma.service'
import { ClassesRepository } from '../../../classes'
import { isT4T5Grade, round1, statusOfIntervention } from '../domain/rules'
import { type InterventionRecord, type InterventionScope, KirkpatrickRepository } from '../kirkpatrick.repository'
import type { KirkpatrickInterventionCreateRequest, KirkpatrickInterventionList, KirkpatrickInterventionRow } from '../types'
import type { Ctx } from './scope'

/** Request facts the audit row needs; none of them is read from the body. */
export interface WriteCtx extends Ctx {
  requestId: string | null
  ip: string | null
  sessionRowId: string
  scopeLevel: string
}

const refuse = (field: string, message: string): ApiError => ApiError.of('VALIDATION_ERROR', { message, fields: { [field]: message } })

const toRow = (r: InterventionRecord): KirkpatrickInterventionRow => ({
  id: r.id,
  studentId: r.studentId,
  alertType: r.alertType,
  actionDate: r.actionDate,
  alertDescription: r.alertDescription,
  actionTaken: r.actionTaken,
  beforeAccuracy: r.beforeAccuracy,
  afterAccuracy: r.afterAccuracy,
  beforeMood: r.beforeMood,
  afterMood: r.afterMood,
  createdBy: r.createdBy,
  createdAt: toMytTimestamp(r.createdAt),
  updatedAt: toMytTimestamp(r.updatedAt),
  status: statusOfIntervention(r),
  studentName: r.studentName,
})

/** An accuracy as number or numeric text, stored with one decimal; null, undefined and '' mean "not set". */
function accuracyOf(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  return round1(typeof v === 'number' ? v : Number((v as string).trim()))
}

const moodOf = (v: unknown): InterventionRecord['beforeMood'] =>
  v === null || v === undefined || v === '' ? null : (v as NonNullable<InterventionRecord['beforeMood']>)

/**
 * The intervention log (M12 level 3). The free texts are sensitive personal data of minors: they are never
 * logged and never put in an audit row; only staff in scope read or write them.
 */
@Injectable()
export class InterventionsService {
  constructor(
    @Inject(KirkpatrickRepository) private readonly repo: KirkpatrickRepository,
    @Inject(ClassesRepository) private readonly classes: ClassesRepository,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** admin: all; school_admin: the pupils of the own school; teacher: the pupils of the own classes. */
  private async scopeOf(ctx: Ctx): Promise<InterventionScope> {
    if (ctx.role === 'admin') return { kind: 'all' }
    if (ctx.role === 'school_admin') return ctx.schoolId === null ? { kind: 'students', ids: [] } : { kind: 'school', schoolId: ctx.schoolId }
    return { kind: 'students', ids: await this.classes.teacherStudentIds(ctx.userId) }
  }

  async list(ctx: Ctx): Promise<KirkpatrickInterventionList> {
    const rows = (await this.repo.interventions(await this.scopeOf(ctx))).map(toRow)
    return {
      kpi: {
        total: rows.length,
        pending: rows.filter((r) => r.status === 'Menunggu Semakan').length,
        up: rows.filter((r) => r.status === 'Meningkat').length,
        down: rows.filter((r) => r.status === 'Menurun').length,
      },
      rows,
    }
  }

  /** The pupil must be a T4/T5 student (FN-M12-8.2.4) in the caller's scope; otherwise the same refusal as an unknown id. */
  private async inScope(ctx: Ctx, rawId: string | number): Promise<string | null> {
    const id = String(typeof rawId === 'string' ? rawId.trim() : rawId)
    if (!isIdString(id)) return null
    const pupil = await this.repo.pupil(id)
    if (!pupil?.isStudent || !isT4T5Grade(pupil.grade)) return null
    if (ctx.role === 'admin') return id
    if (ctx.role === 'school_admin') return ctx.schoolId !== null && pupil.schoolId === ctx.schoolId ? id : null
    return (await this.classes.teacherStudentIds(ctx.userId)).includes(id) ? id : null
  }

  /** Stage order of the mock: field checks (the schema pipe), then the pupil, then the calendar date. */
  async create(ctx: WriteCtx, body: KirkpatrickInterventionCreateRequest): Promise<KirkpatrickInterventionRow> {
    // Mod Pelajar writes test data, but an intervention is a real, sensitive record: never create one.
    if (ctx.isTest) throw ApiError.of('FORBIDDEN')
    const studentId = await this.inScope(ctx, body.studentId)
    if (studentId === null) throw refuse('studentId', KIRKPATRICK_MESSAGES.studentNotFound)
    if (!kirkpatrickIsCalendarDay(body.actionDate)) throw refuse('actionDate', KIRKPATRICK_MESSAGES.invalidDate)

    const now = this.clock.now()
    const record = await this.prisma.transaction(async (tx) => {
      const created = await this.repo.insertIntervention(
        {
          studentId,
          alertType: body.alertType,
          actionDate: body.actionDate,
          alertDescription: body.alertDescription,
          actionTaken: body.actionTaken,
          beforeAccuracy: accuracyOf(body.beforeAccuracy),
          afterAccuracy: accuracyOf(body.afterAccuracy),
          beforeMood: moodOf(body.beforeMood),
          afterMood: moodOf(body.afterMood),
          createdBy: ctx.userId,
        },
        now,
      )
      await this.audit.record({
        tx,
        action: AUDIT_ACTIONS.KIRKPATRICK_INTERVENTION_CREATED,
        actorUserId: ctx.userId,
        actorRole: ctx.role,
        sessionRowId: ctx.sessionRowId,
        targetType: 'intervention',
        targetId: created.id,
        schoolId: ctx.schoolId,
        scopeLevel: ctx.scopeLevel,
        requestId: ctx.requestId,
        ip: ctx.ip,
        isTest: ctx.isTest,
        // Never the notes: only the pupil and the alert type.
        details: { studentId, alertType: body.alertType },
      })
      return created
    })
    return toRow(record)
  }
}
