import { Inject, Injectable } from '@nestjs/common'
import { DIAGRAM_AUDIT_MESSAGES as MSG } from '@pp/contract'

import { AUDIT_ACTIONS } from '../../../common/audit'
import { AuditService } from '../../../common/audit/audit.service'
import { ApiError } from '../../../common/errors/api-error'
import type { TxClient } from '../../../db/client'
import { Prisma } from '../../../db/generated/client'
import { idFromString, idToString, isIdString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'
import { FilesService } from '../../files'
import { INTAKE_AUDIT } from '../workflow/workflow.constants'
import {
  DIAGRAM_OPEN_STATES,
  DIAGRAM_STIMULUS_LABEL,
  diagramPayloadOf,
  diagramStimulusRef,
  pendingQuestionIds,
  pickGroupStimulus,
  type DiagramTarget,
} from './guru-diagram'
import { GURU_PAPER_TYPE_QUESTION, GURU_QUESTION_SOURCE_TEXT } from './guru-submissions'
import type { GuruActor } from './guru-submissions.service'

const SUBJECT_TEXT_MAX = 100

export interface DiagramSubmission {
  kind: 'mcq' | 'structured'
  questionId: string
  /** BM subject name of the question (batch subject and item tag); null when unknown. */
  subjectName: string | null
  bytes: Buffer
}

/**
 * S6-T18 part 2 (API-Q-21): a teacher's image for a question that needs a diagram. The question is NOT changed: the image is
 * stored as the caller's own `question_image`, and ONE `source = 'guru'` batch with ONE diagram stimulus (`ref = group:<groupId>`) and ONE item
 * (`payload.target`, `question_id` preset) waits for the admin (`IntakeReviewService.accept` sets the asset on the group stimulus).
 * One open image per stimulus group (409). No existing `uploadImage` call, no new table.
 */
@Injectable()
export class GuruDiagramService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(FilesService) private readonly files: FilesService,
  ) {}

  /** Submits the image. 404 unknown question, 409 no group or an open image already, 422 not an image (`fields.image`). */
  async submit(actor: GuruActor, input: DiagramSubmission): Promise<void> {
    if (!isIdString(input.questionId)) throw ApiError.of('NOT_FOUND')
    const question = await this.prisma.client.question.findUnique({ where: { id: idFromString(input.questionId) }, select: { id: true, groupId: true } })
    if (!question) throw ApiError.of('NOT_FOUND')
    if (question.groupId === null) throw ApiError.of('CONFLICT', { message: MSG.noStimulusGroup })
    const links = await this.prisma.client.stimulusGroupStimulus.findMany({
      where: { groupId: question.groupId },
      select: { stimulusId: true, position: true, stimulus: { select: { kind: true, assetFileId: true } } },
    })
    const stimulus = pickGroupStimulus(links.map((l) => ({ id: l.stimulusId, kind: l.stimulus.kind, position: l.position, assetFileId: l.stimulus.assetFileId })))
    if (!stimulus) throw ApiError.of('CONFLICT', { message: MSG.noStimulusGroup })

    // Cheap pre-check (the locked one below decides) so a refused call stores no file.
    const groupId = idToString(question.groupId)
    if ((await this.openForGroup(this.prisma.client, groupId)) > 0) throw ApiError.of('CONFLICT', { message: MSG.alreadyPending })

    let stored: { id: string; publicId: string }
    try {
      stored = await this.files.storeManaged({ ownerUserId: actor.userId, purpose: 'question_image', bytes: input.bytes, isTest: actor.isTest })
    } catch (err) {
      if (err instanceof ApiError && err.code === 'VALIDATION_ERROR') throw ApiError.of('VALIDATION_ERROR', { fields: { image: MSG.fileType } })
      throw err
    }
    const target: DiagramTarget = {
      kind: input.kind,
      questionId: input.questionId,
      groupId,
      stimulusId: idToString(stimulus.id),
      imageFileId: stored.id,
    }
    try {
      await this.prisma.transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`diagram:group:${groupId}`}, 0))`
        if ((await this.openForGroup(tx, groupId)) > 0) throw ApiError.of('CONFLICT', { message: MSG.alreadyPending })
        const owner = idFromString(actor.userId)
        const batch = await tx.intakeBatch.create({
          data: {
            ownerUserId: owner,
            source: 'guru',
            status: 'ready_for_review',
            paperType: GURU_PAPER_TYPE_QUESTION,
            subject: (input.subjectName ?? '').slice(0, SUBJECT_TEXT_MAX),
            kertas: null,
            year: null,
            sourceText: GURU_QUESTION_SOURCE_TEXT,
            rightsStatus: 'own',
            note: null,
            isTest: actor.isTest,
          },
          select: { id: true },
        })
        const batchStimulus = await tx.intakeStimulus.create({
          data: { batchId: batch.id, ref: diagramStimulusRef(groupId), kind: 'diagram', label: DIAGRAM_STIMULUS_LABEL, altText: DIAGRAM_STIMULUS_LABEL },
          select: { id: true },
        })
        const item = await tx.intakeItem.create({
          data: {
            batchId: batch.id,
            position: 1,
            sourceType: 'manual',
            numberLabel: `#${input.questionId}`.slice(0, 32),
            itemType: 'short',
            stimulusId: batchStimulus.id,
            questionId: question.id,
            payload: diagramPayloadOf(target, input.subjectName) as Prisma.InputJsonValue,
            pageNo: 1,
            reviewState: 'needs_review',
          },
          select: { id: true },
        })
        await tx.intakeItemEvent.create({ data: { itemId: item.id, event: 'added', toState: 'needs_review', actorUserId: owner, actorRole: actor.roleCode } })
        await this.record(AUDIT_ACTIONS.INTAKE_BATCH_CREATED, actor, 'intake_batch', batch.id, { source: 'guru', kind: 'diagram', items: 1 }, tx)
        await this.record(INTAKE_AUDIT.itemAdded, actor, 'intake_item', item.id, { kind: 'diagram', questionId: input.questionId, groupId }, tx)
      })
    } catch (err) {
      await this.files.discard(stored.publicId, 'question_image')
      throw err
    }
  }

  /** Open diagram items that target the stimulus group (the "one image per group" fact). */
  private async openForGroup(db: Pick<TxClient, '$queryRaw'>, groupId: string): Promise<number> {
    const rows = await db.$queryRaw<{ n: bigint }[]>`
      SELECT count(*) AS n FROM intake_items i JOIN intake_stimuli s ON s.id = i.stimulus_id
      WHERE i.review_state = ANY(${[...DIAGRAM_OPEN_STATES]}::text[]) AND s.ref = ${diagramStimulusRef(groupId)} AND i.payload -> 'target' IS NOT NULL`
    return Number(rows[0]?.n ?? 0)
  }

  /** Which of these questions have "Menunggu Semakan": an open item for the question, or for its stimulus group. */
  async pendingFor(ids: readonly string[]): Promise<Set<string>> {
    const keys = ids.filter(isIdString)
    if (keys.length === 0) return new Set()
    const questions = await this.prisma.client.question.findMany({ where: { id: { in: keys.map(idFromString) } }, select: { id: true, groupId: true } })
    const asked = questions.map((q) => ({ id: idToString(q.id), groupId: q.groupId === null ? null : idToString(q.groupId) }))
    const groupIds = asked.flatMap((q) => (q.groupId === null ? [] : [q.groupId]))
    // The question by its indexed `question_id`, the group by the batch stimulus ref `group:<id>` (one per batch, unique with the batch).
    const refs = groupIds.map(diagramStimulusRef)
    const open = await this.prisma.client.$queryRaw<{ question_id: string; group_id: string }[]>`
      SELECT i.payload -> 'target' ->> 'questionId' AS question_id, i.payload -> 'target' ->> 'groupId' AS group_id
      FROM intake_items i JOIN intake_stimuli s ON s.id = i.stimulus_id
      WHERE i.review_state = ANY(${[...DIAGRAM_OPEN_STATES]}::text[]) AND i.payload -> 'target' IS NOT NULL
        AND (i.question_id = ANY(${keys.map(idFromString)}::bigint[]) OR s.ref = ANY(${refs}::text[]))`
    return pendingQuestionIds(asked, open.map((o) => ({ questionId: o.question_id, groupId: o.group_id })))
  }

  private async record(action: string, actor: GuruActor, targetType: string, targetId: bigint, details: Record<string, unknown>, tx: TxClient): Promise<void> {
    await this.audit.record({
      action,
      actorUserId: actor.userId,
      actorRole: actor.roleCode,
      scopeLevel: actor.scopeLevel ?? null,
      targetType,
      targetId: idToString(targetId),
      requestId: actor.requestId,
      ip: actor.ip,
      isTest: actor.isTest,
      details,
      tx,
    })
  }
}
