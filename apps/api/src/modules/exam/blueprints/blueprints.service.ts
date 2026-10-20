import { Inject, Injectable } from '@nestjs/common'
import {
  BIJAK_BUILDER_MESSAGES as MSG,
  BijakBlueprintAdminCreateSchema,
  BijakBlueprintAdminVersionInputSchema,
  BijakBlueprintListQuerySchema,
  type BijakBlueprintAdminSectionInput,
  type BijakBlueprintSource,
  type BijakBlueprintView,
} from '@pp/contract'

import { AUDIT_ACTIONS, AuditService } from '../../../common/audit'
import { ApiError } from '../../../common/errors/api-error'
import { listMeta, ok, okList } from '../../../common/http/respond'
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe'
import type { Prisma } from '../../../db/generated/client'
import { idToString } from '../../../db/ids'
import { CLOCK, type Clock } from '../../../db/clock'
import { PrismaService } from '../../../db/prisma.service'
import { curriculumCodeOf } from '../../bijak/papers/subject-codes'
import { BIJAK_BUILDER_PAGE_SIZE } from '../builder/builder.constants'
import type { AuditActor } from './actor'
import { blueprintView, type BlueprintWithSections } from './blueprint-view'
import { BlueprintsRepository, type NewBlueprint, type SubjectRef } from './blueprints.repository'

/** Largest kertas the `smallint` column holds. */
const KERTAS_MAX = 32767

const CODE_TAKEN_MESSAGE = 'Kod kertas ini sudah digunakan oleh kontrak lain.'
const INVALID_FIELD_MESSAGE = 'Medan ini tidak sah.'

const SOURCE_TO_DB: Readonly<Record<BijakBlueprintSource, string>> = { Disahkan: 'verified', Spec: 'spec', Draf: 'draft' }

/** A choose rule cannot ask for more answers than the section holds (also keeps `n` inside smallint). */
function assertRuleBounds(sections: BijakBlueprintAdminSectionInput[]): void {
  const fields: Record<string, string> = {}
  sections.forEach((s, i) => {
    if (s.rule.type === 'choose' && s.rule.n > s.questionCount) fields[`sections.${String(i)}.rule.n`] = INVALID_FIELD_MESSAGE
  })
  if (Object.keys(fields).length > 0) throw ApiError.of('VALIDATION_ERROR', { fields })
}

const errorCodeOf = (e: unknown): string | undefined =>
  typeof e === 'object' && e !== null && typeof (e as { code?: unknown }).code === 'string' ? (e as { code: string }).code : undefined

/** True when a unique violation (Prisma P2002 or pg 23505) names this index. */
function isUnique(e: unknown, index: string): boolean {
  const code = errorCodeOf(e)
  const text = `${e instanceof Error ? e.message : ''} ${JSON.stringify((e as { meta?: unknown } | null)?.meta ?? {}, (_k, v: unknown) => (typeof v === 'bigint' ? v.toString() : v))}`
  return (code === 'P2002' || code === '23505') && text.includes(index)
}

/**
 * Blueprint admin (BE-39). A blueprint is all rows of one (subject, kertas); the `active` row is the
 * current version. A new version retires the active row (its content stays) and inserts n+1; retire
 * retires the active row. Every write and its audit row share one transaction.
 */
@Injectable()
export class BlueprintsService {
  constructor(
    @Inject(BlueprintsRepository) private readonly repo: BlueprintsRepository,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  private view(row: BlueprintWithSections, subject: SubjectRef): BijakBlueprintView {
    return blueprintView(row, subject)
  }

  /** Path (subject, kertas) -> curriculum subject and kertas, or the 404. */
  private async resolve(subject: string, kertasText: string): Promise<{ subject: SubjectRef; kertas: number }> {
    const notFound = () => ApiError.of('NOT_FOUND', { message: MSG.blueprintNotFound })
    if (subject.length < 1 || subject.length > 32 || !/^[1-9]\d{0,8}$/.test(kertasText)) throw notFound()
    const kertas = Number(kertasText)
    if (kertas > KERTAS_MAX) throw notFound()
    const row = await this.repo.subjectByCode(curriculumCodeOf(subject))
    if (!row) throw notFound()
    return { subject: row, kertas }
  }

  async list(rawQuery: unknown) {
    const q = new ZodValidationPipe(BijakBlueprintListQuerySchema).transform(rawQuery)
    const page = q.page ?? 1
    const pageSize = q.pageSize ?? BIJAK_BUILDER_PAGE_SIZE
    let subjectId: bigint | undefined
    if (q.subject !== undefined && q.subject !== '') {
      const s = await this.repo.subjectByCode(curriculumCodeOf(q.subject))
      if (!s) return okList<BijakBlueprintView>([], listMeta(page, pageSize, 0))
      subjectId = s.id
    }
    if (q.kertas !== undefined && q.kertas > KERTAS_MAX) return okList<BijakBlueprintView>([], listMeta(page, pageSize, 0))
    const { rows, total } = await this.repo.listActive({
      ...(subjectId !== undefined ? { subjectId } : {}),
      ...(q.kertas !== undefined ? { kertas: q.kertas } : {}),
      skip: (page - 1) * pageSize,
      take: pageSize,
    })
    const subjects = new Map((await this.repo.subjectsByIds([...new Set(rows.map((r) => r.subjectId))])).map((s) => [s.id, s]))
    const data = rows.map((r) => this.view(r, subjects.get(r.subjectId) as SubjectRef))
    return okList(data, listMeta(page, pageSize, total))
  }

  async get(subject: string, kertasText: string) {
    const { subject: s, kertas } = await this.resolve(subject, kertasText)
    const row = await this.repo.active(s.id, kertas)
    if (!row) throw ApiError.of('NOT_FOUND', { message: MSG.blueprintNotFound })
    return ok(this.view(row, s))
  }

  async create(actor: AuditActor, rawBody: unknown) {
    const body = new ZodValidationPipe(BijakBlueprintAdminCreateSchema).transform(rawBody)
    assertRuleBounds(body.sections)
    const subject = await this.repo.subjectByCode(curriculumCodeOf(body.subject))
    if (!subject) throw ApiError.of('VALIDATION_ERROR', { fields: { subject: INVALID_FIELD_MESSAGE } })
    if (body.kertas > KERTAS_MAX) throw ApiError.of('VALIDATION_ERROR', { fields: { kertas: INVALID_FIELD_MESSAGE } })
    const exists = () => ApiError.of('CONFLICT', { message: MSG.blueprintExists })
    try {
      const row = await this.prisma.transaction(async () => {
        if (await this.repo.active(subject.id, body.kertas)) throw exists()
        const version = (await this.repo.maxVersion(subject.id, body.kertas)) + 1
        const created = await this.repo.insertActive(this.input(subject.id, body.kertas, version, body), this.clock.now())
        await this.record(actor, AUDIT_ACTIONS.BIJAK_BLUEPRINT_CREATED, created.id, subject, body.kertas, {
          from: null,
          to: 'active',
          fromVersion: null,
          toVersion: version,
        })
        return created
      })
      return { data: this.view(row, subject) }
    } catch (e) {
      if (isUnique(e, 'uq_blueprints_active_subject_id_kertas')) throw exists()
      if (isUnique(e, 'uq_blueprints_code_version')) throw ApiError.of('VALIDATION_ERROR', { fields: { code: CODE_TAKEN_MESSAGE } })
      throw e
    }
  }

  async addVersion(actor: AuditActor, subjectText: string, kertasText: string, rawBody: unknown) {
    const { subject, kertas } = await this.resolve(subjectText, kertasText)
    const gone = () => ApiError.of('CONFLICT', { message: MSG.blueprintAlreadyRetired })
    if (!(await this.repo.hasRows(subject.id, kertas))) throw ApiError.of('NOT_FOUND', { message: MSG.blueprintNotFound })
    if (!(await this.repo.active(subject.id, kertas))) throw gone()
    const body = new ZodValidationPipe(BijakBlueprintAdminVersionInputSchema).transform(rawBody)
    assertRuleBounds(body.sections)
    try {
      const row = await this.prisma.transaction(async () => {
        const current = await this.lockActive(subject.id, kertas)
        if (!current) throw gone()
        const version = (await this.repo.maxVersion(subject.id, kertas)) + 1
        const at = this.clock.now()
        await this.repo.setStatus(current.id, 'retired', at)
        const created = await this.repo.insertActive(this.input(subject.id, kertas, version, body), at)
        await this.record(actor, AUDIT_ACTIONS.BIJAK_BLUEPRINT_VERSION_CREATED, created.id, subject, kertas, {
          from: 'active',
          to: 'active',
          fromVersion: current.version,
          toVersion: version,
        })
        return created
      })
      return { data: this.view(row, subject) }
    } catch (e) {
      if (isUnique(e, 'uq_blueprints_active_subject_id_kertas')) throw gone()
      if (isUnique(e, 'uq_blueprints_code_version')) throw ApiError.of('VALIDATION_ERROR', { fields: { code: CODE_TAKEN_MESSAGE } })
      throw e
    }
  }

  async retire(actor: AuditActor, subjectText: string, kertasText: string) {
    const { subject, kertas } = await this.resolve(subjectText, kertasText)
    const gone = () => ApiError.of('CONFLICT', { message: MSG.blueprintAlreadyRetired })
    if (!(await this.repo.hasRows(subject.id, kertas))) throw ApiError.of('NOT_FOUND', { message: MSG.blueprintNotFound })
    await this.prisma.transaction(async () => {
      const current = await this.lockActive(subject.id, kertas)
      if (!current) throw gone()
      await this.repo.setStatus(current.id, 'retired', this.clock.now())
      await this.record(actor, AUDIT_ACTIONS.BIJAK_BLUEPRINT_RETIRED, current.id, subject, kertas, {
        from: 'active',
        to: 'retired',
        fromVersion: current.version,
        toVersion: current.version,
      })
    })
    return ok({ ok: true as const })
  }

  /** Locks the active row of the pair and re-reads it; null when none is active any more. Inside a transaction. */
  private async lockActive(subjectId: bigint, kertas: number): Promise<BlueprintWithSections | null> {
    const seen = await this.repo.active(subjectId, kertas)
    if (!seen) return null
    if (!(await this.repo.lock(seen.id))) return null
    const fresh = await this.repo.byId(seen.id)
    return fresh && fresh.status === 'active' ? fresh : null
  }

  private input(
    subjectId: bigint,
    kertas: number,
    version: number,
    b: {
      source: BijakBlueprintSource
      code: string
      durationMin: number
      instructions?: string[] | undefined
      reference?: unknown[] | undefined
      sections: BijakBlueprintAdminSectionInput[]
    },
  ): NewBlueprint {
    return {
      subjectId,
      kertas,
      version,
      source: SOURCE_TO_DB[b.source],
      code: b.code,
      durationMin: b.durationMin,
      instructions: b.instructions ?? [],
      referenceSheets: (b.reference ?? []) as Prisma.InputJsonValue,
      totalMarks: b.sections.reduce((n, s) => n + s.markBudget, 0),
      sections: b.sections.map((s) => ({
        label: s.label,
        instruction: s.instruction ?? null,
        ruleType: s.rule.type,
        ruleN: s.rule.type === 'choose' ? s.rule.n : null,
        questionCount: s.questionCount,
        markBudget: s.markBudget,
        compulsory: s.compulsory ?? false,
        pool: s.pool,
      })),
    }
  }

  private record(
    actor: AuditActor,
    action: string,
    targetId: bigint,
    subject: SubjectRef,
    kertas: number,
    details: Record<string, unknown>,
  ) {
    return this.audit.record({
      action,
      actorUserId: actor.userId,
      actorRole: actor.role,
      targetType: 'bijak_blueprint',
      targetId: idToString(targetId),
      requestId: actor.requestId,
      ip: actor.ip,
      isTest: actor.isTest,
      details: { ...details, subject: subject.code, kertas },
    })
  }
}
