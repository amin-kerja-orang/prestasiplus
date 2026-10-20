import { Inject, Injectable } from '@nestjs/common'
import {
  DSKP_MESSAGES,
  DskpBidangCreateRequestSchema,
  DskpSkCreateRequestSchema,
  DskpSpCreateRequestSchema,
  DskpBidangSchema,
  DskpSkSchema,
  DskpSpSchema,
} from '@pp/contract'
import type { z } from 'zod'


import { AuditService } from '../../../common/audit'
import { idFromString, isIdString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'
import { CurriculumRepository } from '../../curriculum'
import type { ClassActor } from '../actor'
import { QUESTION_SET_AUDIT } from './question-sets.constants'
import { QuestionSetsRepository } from './question-sets.repository'

type DskpBidang = z.infer<typeof DskpBidangSchema>
type DskpSk = z.infer<typeof DskpSkSchema>
type DskpSp = z.infer<typeof DskpSpSchema>

/** A refusal of an inline create: HTTP 200 with a bare `{ error }` (as live). */
export interface InlineRefusal {
  error: string
}
export const refusal = (error: string): InlineRefusal => ({ error })

const asObject = (raw: unknown): Record<string, unknown> =>
  typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}

/** The issues of a schema parse that sit on the given top-level keys. */
function failed(result: z.ZodSafeParseResult<unknown>, keys: readonly string[]): boolean {
  return !result.success && result.error.issues.some((i) => keys.includes(String(i.path[0])))
}

const idText = (v: unknown): string | null => {
  const text = typeof v === 'number' ? String(v) : typeof v === 'string' ? v.trim() : ''
  return isIdString(text) && text !== '0' ? text : null
}

const hasNul = (...values: unknown[]): boolean => values.some((v) => typeof v === 'string' && v.includes('\u0000'))

/**
 * The teacher inline creates of the DSKP picking list (S18): bidang, SK, SP. The mock's check order is kept:
 * the name / code / description check first, then the parent, then (bidang only) the code length. A refusal is
 * the bare `{ error }` the live site sends with HTTP 200.
 */
@Injectable()
export class DskpService {
  constructor(
    @Inject(QuestionSetsRepository) private readonly repo: QuestionSetsRepository,
    @Inject(CurriculumRepository) private readonly curriculum: CurriculumRepository,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async createBidang(actor: ClassActor, raw: unknown): Promise<DskpBidang | InlineRefusal> {
    const body = asObject(raw)
    const parsed = DskpBidangCreateRequestSchema.safeParse(body)
    if (failed(parsed, ['name']) || hasNul(body.name)) return refusal(DSKP_MESSAGES.bidangName)
    const subjectId = idText(body.subjectId)
    const levelId = idText(body.educationLevelId)
    if (
      failed(parsed, ['subjectId', 'educationLevelId']) ||
      subjectId === null ||
      levelId === null ||
      !(await this.curriculum.subject(idFromString(subjectId))) ||
      !(await this.curriculum.level(idFromString(levelId)))
    ) {
      return refusal(DSKP_MESSAGES.bidangParent)
    }
    if (failed(parsed, ['code']) || !parsed.success || hasNul(body.code)) return refusal(DSKP_MESSAGES.bidangName)
    const data = parsed.data
    const row = await this.prisma.transaction(async (tx) => {
      const created = await this.repo.createBidang({
        subjectId,
        educationLevelId: levelId,
        code: data.code && data.code !== '' ? data.code : null,
        name: data.name,
        createdById: actor.userId,
        isTest: actor.isTest,
      })
      await this.record(actor, QUESTION_SET_AUDIT.DSKP_BIDANG_CREATED, created.id, tx)
      return created
    })
    return { id: row.id, code: row.code, name: row.name as string }
  }

  async createSk(actor: ClassActor, raw: unknown): Promise<DskpSk | InlineRefusal> {
    const body = asObject(raw)
    const parsed = DskpSkCreateRequestSchema.safeParse(body)
    if (failed(parsed, ['code', 'description']) || hasNul(body.code, body.description)) return refusal(DSKP_MESSAGES.skFields)
    const bidangId = idText(body.bidangId)
    if (!parsed.success || bidangId === null || !(await this.repo.bidangExists(bidangId))) return refusal(DSKP_MESSAGES.skParent)
    const row = await this.prisma.transaction(async (tx) => {
      const created = await this.repo.createSk({
        bidangId,
        code: parsed.data.code,
        description: parsed.data.description,
        createdById: actor.userId,
        isTest: actor.isTest,
      })
      await this.record(actor, QUESTION_SET_AUDIT.DSKP_SK_CREATED, created.id, tx)
      return created
    })
    return { id: row.id, code: row.code as string, description: row.description as string }
  }

  async createSp(actor: ClassActor, raw: unknown): Promise<DskpSp | InlineRefusal> {
    const body = asObject(raw)
    const parsed = DskpSpCreateRequestSchema.safeParse(body)
    if (failed(parsed, ['code', 'description']) || hasNul(body.code, body.description)) return refusal(DSKP_MESSAGES.spFields)
    const skId = idText(body.skId)
    if (!parsed.success || skId === null || !(await this.repo.skExists(skId))) return refusal(DSKP_MESSAGES.spParent)
    const row = await this.prisma.transaction(async (tx) => {
      const created = await this.repo.createSp({
        skId,
        code: parsed.data.code,
        description: parsed.data.description,
        createdById: actor.userId,
        isTest: actor.isTest,
      })
      await this.record(actor, QUESTION_SET_AUDIT.DSKP_SP_CREATED, created.id, tx)
      return created
    })
    return { id: row.id, code: row.code as string, description: row.description as string }
  }

  private record(actor: ClassActor, action: string, targetId: string, tx: Parameters<Parameters<PrismaService['transaction']>[0]>[0]): Promise<void> {
    return this.audit.record({
      tx,
      action,
      actorUserId: actor.userId,
      actorRole: actor.role,
      sessionRowId: actor.auth.sessionRowId,
      targetType: action.replace('classes.', '').replace('.created', ''),
      targetId,
      scopeLevel: actor.auth.active.scope.level,
      requestId: actor.requestId,
      ip: actor.ip,
      isTest: actor.isTest,
    })
  }
}
