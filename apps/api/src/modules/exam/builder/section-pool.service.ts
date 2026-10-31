import { Inject, Injectable } from '@nestjs/common'
import {
  BIJAK_BUILDER_MESSAGES as MESSAGES,
  BijakSectionPoolsRequestSchema,
  type BijakSectionPoolOption,
  type BijakSectionPools,
} from '@pp/contract'

import { AUDIT_ACTIONS, AuditService } from '../../../common/audit'
import { ApiError } from '../../../common/errors/api-error'
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe'
import { Prisma } from '../../../db/generated/client'
import { idFromString, idToString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'
import { bijakCodeOf } from '../../bijak/papers/subject-codes'
import { NOT_PKSK_SQL, NOT_PRIMARY_LEVEL_SQL } from '../../questions/learner-visibility'
import type { AuditActor } from './actor'

/**
 * Tags that name a blueprint section pool: upper case, a dash, for example `MAT2-A`. The legacy QLOAD tag (`spm`, lower case) and the
 * PKSK tags are never listed or changed by this service.
 */
const POOL_CODE = /^[A-Z][A-Z0-9]*-[A-Z0-9]+$/

const notFound = () => ApiError.of('NOT_FOUND', { message: MESSAGES.poolQuestionNotFound })

/**
 * R1-T34 (G3): the admin writes the section pool tag of a question (`question_tags.kind = 'pool'`, code of a section of an active
 * blueprint, for example MAT2-A) so a built paper stops reporting "bukan dalam kolam bahagian ini". It reads the question's subject
 * and writes only its pool tags, the same narrow doorway the builder question source already uses on BE-09 tables.
 * One transaction, one audit row (ids and codes only).
 */
@Injectable()
export class SectionPoolService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  private get db() {
    return this.prisma.client
  }

  /** Subject (id, Bijak code) of the question's latest version, or null when the bank does not serve it (unknown, PKSK, Darjah). */
  private async subjectOf(questionId: bigint): Promise<{ subjectId: bigint; subject: string } | null> {
    const rows = await this.db.$queryRaw<{ subject_id: bigint; code: string }[]>(Prisma.sql`
      SELECT v.subject_id, s.code
        FROM questions q
        JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.latest_version_no
        JOIN subjects s ON s.id = v.subject_id
       WHERE q.id = ${questionId} AND ${NOT_PKSK_SQL} AND ${NOT_PRIMARY_LEVEL_SQL}`)
    const row = rows[0]
    return row ? { subjectId: row.subject_id, subject: bijakCodeOf(row.code) } : null
  }

  /** Every pool of an ACTIVE blueprint of the subject, with its kertas and Bahagian label. */
  private async optionsOf(subjectId: bigint): Promise<BijakSectionPoolOption[]> {
    const sections = await this.db.blueprintSection.findMany({
      where: { pool: { not: null }, blueprint: { subjectId, status: 'active' } },
      include: { blueprint: { select: { kertas: true, code: true } } },
      orderBy: [{ blueprint: { kertas: 'asc' } }, { position: 'asc' }],
    })
    const seen = new Set<string>()
    const out: BijakSectionPoolOption[] = []
    for (const s of sections) {
      if (s.pool === null || seen.has(s.pool)) continue
      seen.add(s.pool)
      out.push({ pool: s.pool, kertas: s.blueprint.kertas, sectionLabel: s.label, blueprintCode: s.blueprint.code })
    }
    return out
  }

  private async view(questionId: bigint, subject: { subjectId: bigint; subject: string }): Promise<BijakSectionPools> {
    const tags = await this.db.questionTag.findMany({ where: { questionId, kind: 'pool' }, orderBy: { code: 'asc' }, select: { code: true } })
    return {
      questionId: idToString(questionId),
      subject: subject.subject,
      pools: tags.map((t) => t.code).filter((c) => POOL_CODE.test(c)),
      options: await this.optionsOf(subject.subjectId),
    }
  }

  private parseQuestion(raw: string): bigint {
    try {
      return idFromString(raw)
    } catch {
      throw notFound()
    }
  }

  async get(rawQuestionId: string): Promise<BijakSectionPools> {
    const id = this.parseQuestion(rawQuestionId)
    const subject = await this.subjectOf(id)
    if (!subject) throw notFound()
    return this.view(id, subject)
  }

  async set(actor: AuditActor, rawQuestionId: string, rawBody: unknown): Promise<BijakSectionPools> {
    const id = this.parseQuestion(rawQuestionId)
    const subject = await this.subjectOf(id)
    if (!subject) throw notFound()
    const body = new ZodValidationPipe(BijakSectionPoolsRequestSchema).transform(rawBody)
    const wanted = [...new Set(body.pools)]
    const allowed = new Set((await this.optionsOf(subject.subjectId)).map((o) => o.pool))
    if (wanted.some((p) => !allowed.has(p))) {
      throw ApiError.of('VALIDATION_ERROR', { message: MESSAGES.poolInvalid, fields: { pools: MESSAGES.poolInvalid } })
    }
    await this.prisma.transaction(async () => {
      // Only blueprint pool tags are replaced; `spm`, PKSK and any other tag stay as they are.
      const current = await this.db.questionTag.findMany({ where: { questionId: id, kind: 'pool' }, select: { code: true } })
      const drop = current.map((t) => t.code).filter((c) => POOL_CODE.test(c) && !wanted.includes(c))
      if (drop.length > 0) await this.db.questionTag.deleteMany({ where: { questionId: id, kind: 'pool', code: { in: drop } } })
      if (wanted.length > 0) await this.db.questionTag.createMany({ data: wanted.map((code) => ({ questionId: id, kind: 'pool', code })), skipDuplicates: true })
      await this.audit.record({
        action: AUDIT_ACTIONS.BIJAK_QUESTION_POOL_UPDATED,
        actorUserId: actor.userId,
        actorRole: actor.role,
        targetType: 'question',
        targetId: idToString(id),
        requestId: actor.requestId,
        ip: actor.ip,
        isTest: actor.isTest,
        details: { pools: wanted, removed: drop },
      })
    })
    return this.view(id, subject)
  }
}
