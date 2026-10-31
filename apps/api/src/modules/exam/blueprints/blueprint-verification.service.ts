import { Inject, Injectable } from '@nestjs/common'
import {
  BIJAK_BUILDER_MESSAGES as MSG,
  BIJAK_STANDARDS_MESSAGES,
  BijakEvidenceInputSchema,
  BijakEvidenceValuesSchema,
  BijakVerifyInputSchema,
  type BijakEvidenceItem,
  type BijakVerificationCheck,
  type BijakVerificationRecord,
  type BijakVerificationState,
} from '@pp/contract'

import { AUDIT_ACTIONS, AuditService } from '../../../common/audit'
import { ApiError } from '../../../common/errors/api-error'
import { ok } from '../../../common/http/respond'
import { toMytTimestamp } from '../../../common/time/myt'
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe'
import { CLOCK, type Clock } from '../../../db/clock'
import type { BlueprintEvidence, Prisma } from '../../../db/generated/client'
import { idFromString, idToString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'
import { bijakCodeOf } from '../../bijak/papers'
import type { AuditActor } from './actor'
import { structureHashOf, toStandard, unitLevelsOf, type UnitInfo } from './blueprint-standard'
import type { BlueprintWithSections } from './blueprint-view'
import { BlueprintViewsService, enrichUnit } from './blueprint-views.service'
import { BlueprintsRepository, type SubjectRef } from './blueprints.repository'
import { BlueprintsService } from './blueprints.service'
import { checkEvidence, validateForVerification, type EvidenceItem } from './exam-core.adapter'

/** Evidence row to its wire item (the stored `values` document is re-parsed on read, like `reference_sheets`). */
function evidenceItem(r: BlueprintEvidence): BijakEvidenceItem {
  return {
    id: idToString(r.id),
    kind: r.kind as BijakEvidenceItem['kind'],
    body: r.body,
    year: r.year,
    paperCode: r.paperCode,
    setLabel: r.setLabel,
    sourceRef: r.sourceRef,
    values: BijakEvidenceValuesSchema.parse(r.values),
    origin: r.origin as BijakEvidenceItem['origin'],
    note: r.note,
    createdAt: toMytTimestamp(r.createdAt),
  }
}

/** Plain JSON for a jsonb column (drops `undefined`, which Prisma does not accept inside a document). */
const jsonOf = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue

/**
 * Evidence and verification of a blueprint (bijak-spm BJS-09, architecture 3.4, 6.3, 6.6, 7.2). All of it works
 * on the HEAD (the active row). Evidence is locked once the head is Disahkan (AC-39.4: edit through a new
 * version, which becomes Spec). Verify is the only writer of Disahkan: it runs the AC-39.1 list and the AC-39.7
 * comparison, records an insert-only verification row, and flips `source`, `verification_id` and
 * `serves_students` of the head in one statement. Admin Pusat only (the controller).
 */
@Injectable()
export class BlueprintVerificationService {
  constructor(
    @Inject(BlueprintsRepository) private readonly repo: BlueprintsRepository,
    @Inject(BlueprintsService) private readonly blueprints: BlueprintsService,
    @Inject(BlueprintViewsService) private readonly views: BlueprintViewsService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  private notFound() {
    return ApiError.of('NOT_FOUND', { message: MSG.blueprintNotFound })
  }

  private async head(subjectText: string, kertasText: string): Promise<{ subject: SubjectRef; kertas: number; head: BlueprintWithSections }> {
    const { subject, kertas } = await this.blueprints.resolve(subjectText, kertasText)
    const head = await this.repo.active(subject.id, kertas)
    if (!head) throw this.notFound()
    return { subject, kertas, head }
  }

  /* ------------------------------------------------------------------------------- evidence */

  async evidence(subjectText: string, kertasText: string) {
    const { head } = await this.head(subjectText, kertasText)
    return ok((await this.repo.evidenceOf(head.id)).map(evidenceItem))
  }

  async addEvidence(actor: AuditActor, subjectText: string, kertasText: string, rawBody: unknown) {
    const { subject, kertas, head } = await this.head(subjectText, kertasText)
    this.assertEditable(head)
    const input = new ZodValidationPipe(BijakEvidenceInputSchema).transform(rawBody)
    const created = await this.prisma.transaction(async () => {
      const locked = await this.repo.lockActive(subject.id, kertas)
      if (!locked) throw this.notFound()
      this.assertEditable(locked)
      const at = this.clock.now()
      const row = await this.repo.addEvidence(
        {
          blueprintId: locked.id,
          kind: input.kind,
          body: input.body,
          year: input.year,
          paperCode: input.paperCode,
          setLabel: input.setLabel ?? null,
          sourceRef: input.sourceRef ?? null,
          values: jsonOf(input.values),
          origin: 'admin',
          note: input.note ?? null,
          createdById: idFromString(actor.userId),
        },
        at,
      )
      await this.record(actor, AUDIT_ACTIONS.BIJAK_BLUEPRINT_EVIDENCE_ADDED, locked, subject, kertas, {
        evidenceId: idToString(row.id),
        kind: row.kind,
        body: row.body,
      })
      return row
    })
    return { data: evidenceItem(created) }
  }

  async removeEvidence(actor: AuditActor, subjectText: string, kertasText: string, evidenceIdText: string) {
    const { subject, kertas, head } = await this.head(subjectText, kertasText)
    const gone = () => ApiError.of('NOT_FOUND', { message: BIJAK_STANDARDS_MESSAGES.evidenceNotFound })
    let evidenceId: bigint
    try {
      evidenceId = idFromString(evidenceIdText)
    } catch {
      throw gone()
    }
    if (!(await this.repo.evidenceById(head.id, evidenceId))) throw gone()
    this.assertEditable(head)
    await this.prisma.transaction(async () => {
      const locked = await this.repo.lockActive(subject.id, kertas)
      if (!locked) throw this.notFound()
      this.assertEditable(locked)
      const row = await this.repo.evidenceById(locked.id, evidenceId)
      if (!row || !(await this.repo.deleteEvidence(locked.id, evidenceId))) throw gone()
      await this.record(actor, AUDIT_ACTIONS.BIJAK_BLUEPRINT_EVIDENCE_REMOVED, locked, subject, kertas, {
        evidenceId: idToString(row.id),
        kind: row.kind,
        body: row.body,
      })
    })
    return ok({ ok: true as const })
  }

  /** 409 when the head is Disahkan: its evidence is immutable (the snapshot is the audit copy). */
  private assertEditable(head: BlueprintWithSections): void {
    if (head.source === 'verified') throw ApiError.of('CONFLICT', { message: BIJAK_STANDARDS_MESSAGES.evidenceLocked })
  }

  /* ---------------------------------------------------------------------------- verification */

  /** The recorded verification of the head (if it is Disahkan) and the live check of the head. */
  async state(subjectText: string, kertasText: string) {
    const { subject, head } = await this.head(subjectText, kertasText)
    const evidence = await this.repo.evidenceOf(head.id)
    const check = await this.check(head, subject, evidence)
    let record: BijakVerificationRecord | null = null
    if (head.verificationId !== null) {
      const [verification] = await this.repo.verificationsByIds([head.verificationId])
      const summaries = await this.views.summaries([head.verificationId])
      const summary = summaries.get(head.verificationId)
      if (verification && summary) {
        const snapshot = (Array.isArray(verification.evidenceSnapshot) ? verification.evidenceSnapshot : []) as BijakEvidenceItem[]
        const frozen = verification.checkResult as { lines?: BijakVerificationCheck['lines'] } | null
        record = { ...summary, evidence: snapshot, lines: frozen?.lines ?? [] }
      }
    }
    const data: BijakVerificationState = { record, check }
    return ok(data)
  }

  /**
   * Spec (or Draf) -> Disahkan. Everything is decided inside one transaction on the locked head, so a concurrent
   * evidence edit or version cannot slip between the check and the write.
   */
  async verify(actor: AuditActor, subjectText: string, kertasText: string, rawBody: unknown) {
    const { subject, kertas, head } = await this.head(subjectText, kertasText)
    const already = () => ApiError.of('CONFLICT', { message: BIJAK_STANDARDS_MESSAGES.alreadyVerified })
    if (head.source === 'verified') throw already()
    const body = new ZodValidationPipe(BijakVerifyInputSchema).transform(rawBody)
    const verified = await this.prisma.transaction(async () => {
      const locked = await this.repo.lockActive(subject.id, kertas)
      if (!locked) throw this.notFound()
      if (locked.source === 'verified') throw already()
      const evidenceRows = await this.repo.evidenceOf(locked.id)
      const check = await this.check(locked, subject, evidenceRows)
      if (!check.passes) {
        throw new ApiError({
          code: 'VERIFICATION_FAILED',
          status: 422,
          message: BIJAK_STANDARDS_MESSAGES.verificationFailed,
          details: { check },
        })
      }
      const at = this.clock.now()
      const hash = structureHashOf(toStandard(locked, bijakCodeOf(subject.code)))
      const snapshot = evidenceRows.map(evidenceItem)
      const verification = await this.repo.insertVerification({
        blueprintId: locked.id,
        verifiedById: idFromString(actor.userId),
        note: body.note || null,
        structureHash: hash,
        checkResult: jsonOf(check),
        evidenceSnapshot: jsonOf(snapshot),
        verifiedAt: at,
      })
      // The flag moves to the head: clear it on the older Disahkan version first (one serving row per pair).
      await this.repo.clearServing(subject.id, kertas, locked.id, at)
      const row = await this.repo.markVerified(locked.id, verification.id, hash, at)
      await this.record(actor, AUDIT_ACTIONS.BIJAK_BLUEPRINT_VERIFIED, locked, subject, kertas, {
        from: locked.source,
        to: 'verified',
        version: locked.version,
        verificationId: idToString(verification.id),
        evidenceCount: snapshot.length,
        bodies: [...new Set(snapshot.map((e) => e.body))].sort(),
      })
      return row
    })
    return { data: await this.views.view(verified, subject) }
  }

  /** The live gate of AC-39.1 (blueprint part, exam-core) and AC-39.7 (evidence part), every failure at once. */
  private async check(head: BlueprintWithSections, subject: SubjectRef, evidenceRows: BlueprintEvidence[]): Promise<BijakVerificationCheck> {
    const units = await this.repo.unitsOfSubject(subject.id)
    const unitMap: ReadonlyMap<string, UnitInfo> = new Map(units.map((u) => [u.nodeId, u]))
    const bp = toStandard(head, bijakCodeOf(subject.code))
    const gate = validateForVerification(bp, {
      unitLevels: unitLevelsOf(units),
      subjectHasBothLevels: units.some((u) => u.level === 'T4') && units.some((u) => u.level === 'T5'),
    })
    // AC-39.2 (G2, design D-5): rows seeded from the study (`origin = 'study'`) do not count until the verifier replaces them with
    // evidence entered by hand; only `admin` rows reach the body rule and the comparison. The record still lists every row.
    const items: EvidenceItem[] = evidenceRows.filter((r) => r.origin === 'admin').map((r) => ({
      id: idToString(r.id),
      kind: r.kind as EvidenceItem['kind'],
      body: r.body,
      values: BijakEvidenceValuesSchema.parse(r.values),
    }))
    const evidence = checkEvidence(bp, items)
    const blueprintProblems = gate.problems.map(({ unit, ...p }) => ({ ...p, ...(unit ? { unit: enrichUnit(unit, unitMap) } : {}) }))
    const completeness = [
      ...gate.completeness.map(({ unit, ...c }) => ({ ...c, ...(unit ? { unit: enrichUnit(unit, unitMap) } : {}) })),
      ...evidence.completeness,
    ]
    return {
      passes: blueprintProblems.length === 0 && completeness.length === 0 && evidence.passes,
      blueprintProblems: blueprintProblems as BijakVerificationCheck['blueprintProblems'],
      completeness: completeness as BijakVerificationCheck['completeness'],
      lines: evidence.lines as BijakVerificationCheck['lines'],
    }
  }

  private record(
    actor: AuditActor,
    action: string,
    head: BlueprintWithSections,
    subject: SubjectRef,
    kertas: number,
    details: Record<string, unknown>,
  ) {
    return this.audit.record({
      action,
      actorUserId: actor.userId,
      actorRole: actor.role,
      targetType: 'bijak_blueprint',
      targetId: idToString(head.id),
      requestId: actor.requestId,
      ip: actor.ip,
      isTest: actor.isTest,
      details: { ...details, subject: subject.code, kertas },
    })
  }
}
