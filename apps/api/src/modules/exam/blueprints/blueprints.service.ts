import { Inject, Injectable } from '@nestjs/common'
import {
  BIJAK_BUILDER_MESSAGES as MSG,
  BIJAK_STANDARDS_MESSAGES,
  BijakBlueprintAdminCreateSchema,
  BijakBlueprintAdminVersionInputSchema,
  BijakBlueprintListQuerySchema,
  BijakSectionReviewInputSchema,
  type BijakBlueprintAdminSectionInput,
  type BijakBlueprintView,
} from '@pp/contract'

import { AUDIT_ACTIONS, AuditService } from '../../../common/audit'
import { ApiError } from '../../../common/errors/api-error'
import { listMeta, ok, okList } from '../../../common/http/respond'
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe'
import { CLOCK, type Clock } from '../../../db/clock'
import type { Prisma } from '../../../db/generated/client'
import { idToString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'
import { bijakCodeOf, curriculumCodeOf } from '../../bijak/papers'
import { BIJAK_BUILDER_PAGE_SIZE } from '../builder/builder.constants'
import type { AuditActor } from './actor'
import type { BlueprintWithSections } from './blueprint-view'
import { profileToDoc, quotaToDoc, reviewedQuotaDoc, structureHashOf, toStandard, unitLevelsOf, unreviewedLines } from './blueprint-standard'
import { BlueprintViewsService } from './blueprint-views.service'
import { BlueprintsRepository, type NewBlueprint, type SubjectRef } from './blueprints.repository'
import { validateBlueprint, type StandardBlueprint } from './exam-core.adapter'

/** Largest kertas the `smallint` column holds. */
const KERTAS_MAX = 32767

const CODE_TAKEN_MESSAGE = 'Kod kertas ini sudah digunakan oleh kontrak lain.'
const INVALID_FIELD_MESSAGE = 'Medan ini tidak sah.'

/** The client may ask for Draf or Spec; the server decides about Disahkan (3.5 rule 2). */
type ClientSource = 'Draf' | 'Spec'

/** Body of a create or a new version (the create body adds `subject` and `kertas`). */
interface BlueprintBody {
  source?: ClientSource | undefined
  code: string
  durationMin: number
  totalMarks?: number | undefined
  notes?: string | null | undefined
  subPartRamp?: boolean | undefined
  autoMarkable?: boolean | null | undefined
  kbatMarks?: number | null | undefined
  levelShare?: { t4: number; t5: number } | null | undefined
  instructions?: string[] | undefined
  reference?: unknown[] | undefined
  sections: BijakBlueprintAdminSectionInput[]
}

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

/** The exam-core blueprint of a write body. Every quota line and KBAT value saved here is reviewed by this save (3.3a). */
function standardOfBody(subject: string, kertas: number, version: number, b: BlueprintBody): StandardBlueprint {
  return {
    subject,
    kertas,
    code: b.code,
    version,
    durationMin: b.durationMin,
    totalMarks: b.totalMarks ?? null,
    kbatMarks: b.kbatMarks ?? null,
    levelShare: b.levelShare ?? null,
    subPartRamp: b.subPartRamp ?? false,
    sections: b.sections.map((s, i) => ({
      position: i + 1,
      label: s.label,
      rule: s.rule,
      questionCount: s.questionCount,
      markBudget: s.markBudget,
      compulsory: s.compulsory ?? false,
      pool: s.pool ?? null,
      allowedModes: s.allowedModes ?? [],
      profile: s.profile ?? null,
      quota: s.quota ? { ...s.quota, lines: s.quota.lines.map((l) => ({ unit: l.unit, value: l.value, reviewed: true })) } : null,
      kbatMarks: s.kbatMarks ?? null,
      kbatReviewed: true,
    })),
  }
}

/**
 * Blueprint admin (BE-39, bijak-spm BJS-08). A blueprint is all rows of one (subject, kertas); every edit is a
 * new row (architecture 3.5). The `active` row is the head; `serves_students` marks the row students generate
 * from, which stays on the last Disahkan version while a Spec head is being edited (Q-B22). Only the verify
 * endpoint writes Disahkan (BlueprintVerificationService), except for a cosmetic-only edit of a Disahkan head,
 * which carries the verification and the serving flag to the new version. Every write and its audit row share
 * one transaction. Admin Pusat only (the controller).
 */
@Injectable()
export class BlueprintsService {
  constructor(
    @Inject(BlueprintsRepository) private readonly repo: BlueprintsRepository,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(BlueprintViewsService) private readonly views: BlueprintViewsService,
  ) {}

  /** Path (subject, kertas) -> curriculum subject and kertas, or the 404. */
  async resolve(subject: string, kertasText: string): Promise<{ subject: SubjectRef; kertas: number }> {
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
    return okList(await this.views.views(rows, subjects), listMeta(page, pageSize, total))
  }

  async get(subject: string, kertasText: string) {
    const { subject: s, kertas } = await this.resolve(subject, kertasText)
    const row = await this.repo.active(s.id, kertas)
    if (!row) throw ApiError.of('NOT_FOUND', { message: MSG.blueprintNotFound })
    return ok(await this.views.view(row, s))
  }

  /** Version history, newest first (architecture 6.3). 404 when the pair never had a row. */
  async history(subject: string, kertasText: string) {
    const { subject: s, kertas } = await this.resolve(subject, kertasText)
    const rows = await this.repo.versions(s.id, kertas)
    if (rows.length === 0) throw ApiError.of('NOT_FOUND', { message: MSG.blueprintNotFound })
    return ok(await this.views.history(rows, s))
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
        const bp = await this.validated(subject, body.kertas, version, body)
        const created = await this.repo.insertActive(
          this.input(subject.id, body.kertas, version, body, {
            source: body.source === 'Draf' ? 'draft' : 'spec',
            structureHash: structureHashOf(bp),
            referenceSheets: (body.reference ?? []) as Prisma.InputJsonValue,
          }),
          this.clock.now(),
        )
        await this.record(actor, AUDIT_ACTIONS.BIJAK_BLUEPRINT_CREATED, created.id, subject, body.kertas, {
          from: null,
          to: 'active',
          fromVersion: null,
          toVersion: version,
          source: created.source,
        })
        return created
      })
      return { data: await this.views.view(row, subject) }
    } catch (e) {
      if (isUnique(e, 'uq_blueprints_active_subject_id_kertas')) throw exists()
      if (isUnique(e, 'uq_blueprints_code_version')) throw ApiError.of('VALIDATION_ERROR', { fields: { code: CODE_TAKEN_MESSAGE } })
      throw e
    }
  }

  /**
   * Edit = new version (3.5). Rules: the new row becomes the head and the previous head is retired. The new row is
   * Draf if asked for; else Disahkan only when the previous head is Disahkan and the structural hash is unchanged
   * (a cosmetic edit: the verification, the evidence and the serving flag move to it); else Spec. A Spec head leaves
   * `serves_students` on the older Disahkan version. Evidence rows are copied to every new version.
   */
  async addVersion(actor: AuditActor, subjectText: string, kertasText: string, rawBody: unknown) {
    const { subject, kertas } = await this.resolve(subjectText, kertasText)
    const gone = () => ApiError.of('CONFLICT', { message: MSG.blueprintAlreadyRetired })
    if (!(await this.repo.hasRows(subject.id, kertas))) throw ApiError.of('NOT_FOUND', { message: MSG.blueprintNotFound })
    if (!(await this.repo.active(subject.id, kertas))) throw gone()
    const body = new ZodValidationPipe(BijakBlueprintAdminVersionInputSchema).transform(rawBody)
    assertRuleBounds(body.sections)
    const subjectCode = bijakCodeOf(subject.code)
    try {
      const row = await this.prisma.transaction(async () => {
        const current = await this.repo.lockActive(subject.id, kertas)
        if (!current) throw gone()
        const version = (await this.repo.maxVersion(subject.id, kertas)) + 1
        const bp = await this.validated(subject, kertas, version, body)
        const hash = structureHashOf(bp)
        // The stored hash of a legacy row came from the 0092 SQL backfill and differs from the canonical one:
        // compare against the hash recomputed from its content, and store that value (first-write re-hash).
        const previousHash = structureHashOf(toStandard(current, subjectCode))
        if (current.structureHash !== previousHash && current.source !== 'verified') await this.repo.rehash(current.id, previousHash)
        const carried = body.source !== 'Draf' && current.source === 'verified' && current.verificationId !== null && previousHash === hash
        const source = body.source === 'Draf' ? 'draft' : carried ? 'verified' : 'spec'
        const at = this.clock.now()
        await this.repo.retireRow(current.id, at, !carried)
        const created = await this.repo.insertActive(
          {
            ...this.input(subject.id, kertas, version, body, {
              source,
              structureHash: hash,
              referenceSheets: (body.reference ?? current.referenceSheets) as Prisma.InputJsonValue,
            }, current),
            ...(carried ? { verificationId: current.verificationId, servesStudents: true } : {}),
          },
          at,
        )
        await this.repo.copyEvidence(current.id, created.id)
        await this.record(actor, AUDIT_ACTIONS.BIJAK_BLUEPRINT_VERSION_CREATED, created.id, subject, kertas, {
          from: 'active',
          to: 'active',
          fromVersion: current.version,
          toVersion: version,
          source,
          carried,
        })
        return created
      })
      return { data: await this.views.view(row, subject) }
    } catch (e) {
      if (isUnique(e, 'uq_blueprints_active_subject_id_kertas')) throw gone()
      if (isUnique(e, 'uq_blueprints_code_version')) throw ApiError.of('VALIDATION_ERROR', { fields: { code: CODE_TAKEN_MESSAGE } })
      throw e
    }
  }

  /**
   * Review stamp (AC-39.9): marks every quota line and the KBAT value of one section of the HEAD as reviewed, in
   * place. It is not a content change: no new version, no hash change. 409 when the head is Disahkan (already fully
   * reviewed), 404 for an unknown blueprint or section.
   */
  async reviewSection(actor: AuditActor, subjectText: string, kertasText: string, positionText: string, rawBody: unknown) {
    const { subject, kertas } = await this.resolve(subjectText, kertasText)
    const notFound = () => ApiError.of('NOT_FOUND', { message: MSG.blueprintNotFound })
    const head = await this.repo.active(subject.id, kertas)
    if (!head) throw notFound()
    const position = /^[1-9]\d{0,3}$/.test(positionText) ? Number(positionText) : 0
    if (!head.sections.some((s) => s.position === position)) throw notFound()
    const locked409 = () => ApiError.of('CONFLICT', { message: BIJAK_STANDARDS_MESSAGES.evidenceLocked })
    if (head.source === 'verified') throw locked409()
    new ZodValidationPipe(BijakSectionReviewInputSchema).transform(rawBody ?? {})
    const row = await this.prisma.transaction(async () => {
      const current = await this.repo.lockActive(subject.id, kertas)
      if (!current) throw notFound()
      if (current.source === 'verified') throw locked409()
      const section = current.sections.find((s) => s.position === position)
      if (!section) throw notFound()
      await this.repo.stampSectionReviewed(current.id, position, reviewedQuotaDoc(section.quota), this.clock.now())
      await this.record(actor, AUDIT_ACTIONS.BIJAK_BLUEPRINT_SECTION_REVIEWED, current.id, subject, kertas, {
        version: current.version,
        sectionPosition: position,
      })
      return (await this.repo.byId(current.id)) as BlueprintWithSections
    })
    return ok(await this.views.view(row, subject))
  }

  /** Retires every version of the pair and clears the serving flag: the only way to stop serving (3.5 rule 6). */
  async retire(actor: AuditActor, subjectText: string, kertasText: string) {
    const { subject, kertas } = await this.resolve(subjectText, kertasText)
    const gone = () => ApiError.of('CONFLICT', { message: MSG.blueprintAlreadyRetired })
    if (!(await this.repo.hasRows(subject.id, kertas))) throw ApiError.of('NOT_FOUND', { message: MSG.blueprintNotFound })
    await this.prisma.transaction(async () => {
      const current = await this.repo.lockActive(subject.id, kertas)
      if (!current) throw gone()
      await this.repo.retireAll(subject.id, kertas, this.clock.now())
      await this.record(actor, AUDIT_ACTIONS.BIJAK_BLUEPRINT_RETIRED, current.id, subject, kertas, {
        from: 'active',
        to: 'retired',
        fromVersion: current.version,
        toVersion: current.version,
      })
    })
    return ok({ ok: true as const })
  }

  /**
   * Validates the body with exam-core (every problem at once) and returns the exam-core blueprint. The units of
   * the subject give QUOTA_UNIT and LEVEL_SHARE their data. 422 BLUEPRINT_INVALID lists problems and warnings.
   */
  private async validated(subject: SubjectRef, kertas: number, version: number, b: BlueprintBody): Promise<StandardBlueprint> {
    const bp = standardOfBody(bijakCodeOf(subject.code), kertas, version, b)
    const units = await this.repo.unitsOfSubject(subject.id)
    const { problems, warnings } = validateBlueprint(bp, { unitLevels: unitLevelsOf(units) })
    if (problems.length > 0) {
      throw new ApiError({
        code: 'BLUEPRINT_INVALID',
        status: 422,
        message: BIJAK_STANDARDS_MESSAGES.blueprintInvalid,
        details: { problems, ...(warnings.length > 0 ? { warnings } : {}) },
      })
    }
    return bp
  }

  private input(
    subjectId: bigint,
    kertas: number,
    version: number,
    b: BlueprintBody,
    extra: { source: string; structureHash: string; referenceSheets: Prisma.InputJsonValue },
    previous?: BlueprintWithSections,
  ): NewBlueprint {
    return {
      subjectId,
      kertas,
      version,
      source: extra.source,
      code: b.code,
      durationMin: b.durationMin,
      instructions: b.instructions ?? [],
      referenceSheets: extra.referenceSheets,
      totalMarks: b.sections.reduce((n, s) => n + s.markBudget, 0),
      notes: b.notes ?? null,
      subPartRamp: b.subPartRamp ?? false,
      autoMarkable: b.autoMarkable ?? null,
      kbatMarks: b.kbatMarks ?? null,
      levelShare: b.levelShare ?? null,
      structureHash: extra.structureHash,
      sections: b.sections.map((s, i) => {
        const before = previous?.sections.find((p) => p.position === i + 1)
        return {
        label: s.label,
        instruction: s.instruction ?? null,
        ruleType: s.rule.type,
        ruleN: s.rule.type === 'choose' ? s.rule.n : null,
        questionCount: s.questionCount,
        markBudget: s.markBudget,
        compulsory: s.compulsory ?? false,
        pool: s.pool ?? null,
        allowedModes: s.allowedModes ?? [],
        profile: profileToDoc(s.profile),
        quota: quotaToDoc(s.quota, before ? unreviewedLines(before.quota) : undefined),
        kbatMarks: s.kbatMarks ?? null,
        // A changed or added value is reviewed by the save; an unchanged one keeps its flag (AC-39.9).
        kbatReviewed: !before || s.kbatMarks == null || before.kbatMarks !== s.kbatMarks ? true : before.kbatReviewed,
        }
      }),
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

