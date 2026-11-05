import { Inject, Injectable } from '@nestjs/common'
import {
  GURU_QUESTION_MESSAGES as MSG,
  guruDskpFields,
  guruKeyIndex,
  guruOptionTexts,
  type GuruSubmissionStatus,
  type QuestionGuruCreateRequest,
  type QuestionGuruDetailSchema,
  type QuestionGuruSummarySchema,
} from '@pp/contract'
import type { z } from 'zod'

import { AUDIT_ACTIONS } from '../../../common/audit'
import { AuditService } from '../../../common/audit/audit.service'
import { ApiError } from '../../../common/errors/api-error'
import { toMytTimestamp } from '../../../common/time/myt'
import type { TxClient } from '../../../db/client'
import { idFromString, idToString } from '../../../db/ids'
import { Prisma } from '../../../db/generated/client'
import { PrismaService } from '../../../db/prisma.service'
import {
  GURU_EDITABLE_STATES,
  GURU_PAPER_TYPE_QUESTION,
  GURU_QUESTION_SOURCE_TEXT,
  GURU_SUBMISSION_ITEM,
  guruPayloadOf,
  guruStatusOf,
  readGuruSubmission,
  type GuruSubmissionInput,
  type GuruTagCodes,
} from './guru-submissions'

/** Who submits: what the batch owner, the status events and the audit rows record. */
export interface GuruActor {
  userId: string
  /** The ACTIVE role code of the session (`teacher`, or `admin` using the same screen). */
  roleCode: string
  scopeLevel?: string | null
  requestId: string | null
  ip: string | null
  isTest: boolean
}

export type GuruSummary = z.output<typeof QuestionGuruSummarySchema>
export type GuruDetail = z.output<typeof QuestionGuruDetailSchema>

/** A row of the CSV import after its curriculum references were resolved to ids. */
export interface GuruRowInput {
  input: GuruSubmissionInput
  codes: GuruTagCodes
  /** BM subject name of the row (the batch subject text). */
  subjectName: string
}

const SUBJECT_TEXT_MAX = 100
const MIXED_SUBJECTS = 'Pelbagai subjek'
const AUDIT_ITEM_EDITED = 'intake.item_edited'
const AUDIT_ITEM_DELETED = 'intake.item_deleted'
/** One teacher batch holds at most this many items (the CSV cap). */
export const GURU_BATCH_MAX_ITEMS = 500

const parse = (text: string): bigint | null => {
  try {
    return idFromString(text)
  } catch {
    return null
  }
}

const invalid = (fields: Record<string, string>): ApiError => ApiError.of('VALIDATION_ERROR', { fields })

/**
 * The teacher's question submissions (S6-T06 part be-s1, API-GUR-18): every submission is an intake item with `payload.guru` in an
 * `intake_batches` row with `source = 'guru'` (D113, L-6). No question row exists before the admin's "Terima" (S2-T02). The list, the detail,
 * the edit and the delete work on the teacher's OWN items only (another teacher's id is 404, never 403).
 */
@Injectable()
export class GuruSubmissionsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  // ---- validation ------------------------------------------------------------------------------

  /** The `has chapters` and `has DSKP nodes` facts of a Subjek + Tingkatan (the same two lookups as the approve gate). */
  async dskpFacts(subjectId: bigint, levelId: bigint): Promise<{ hasChapters: boolean; hasDskpNodes: boolean }> {
    const rows = await this.prisma.client.$queryRaw<{ has_dskp: boolean; has_chapters: boolean }[]>`
      SELECT EXISTS (SELECT 1 FROM curriculum_nodes WHERE subject_id = ${subjectId} AND education_level_id = ${levelId}) AS has_dskp,
             EXISTS (SELECT 1 FROM chapters WHERE subject_id = ${subjectId} AND education_level_id = ${levelId} AND is_active AND in_tree) AS has_chapters`
    return { hasDskpNodes: rows[0]?.has_dskp === true, hasChapters: rows[0]?.has_chapters === true }
  }

  /** Validates a form body against the curriculum (the conditional DSKP rule of D112 included); throws 422 with `fields`. */
  async prepare(body: QuestionGuruCreateRequest): Promise<GuruRowInput> {
    const fields: Record<string, string> = {}
    const db = this.prisma.client
    const subjectKey = parse(body.subjectId)
    const levelKey = parse(body.educationLevelId)
    const subject = subjectKey === null ? null : await db.subject.findUnique({ where: { id: subjectKey } })
    const level = levelKey === null ? null : await db.educationLevel.findUnique({ where: { id: levelKey } })
    if (!subject || !subject.isActive) fields.subjectId = MSG.subject
    // Tingkatan 1 to 5 only (secondary-only, D72): a Darjah (primary stage) level is refused like an unknown one.
    if (!level || !level.isActive || level.stage === 'primary') fields.educationLevelId = MSG.level

    const spWanted = [...new Set(body.spIds ?? [])]
    let chapterKey: bigint | null = null
    let spKeys: bigint[] = []
    if (subject && level && !fields.subjectId && !fields.educationLevelId) {
      Object.assign(fields, guruDskpFields({ chapterId: body.chapterId, spIds: spWanted, tp: body.tp, cognitiveLevel: body.cognitiveLevel }, await this.dskpFacts(subject.id, level.id)))
      if (body.chapterId !== undefined && body.chapterId !== null && body.chapterId !== '') {
        const key = parse(body.chapterId)
        const chapter = key === null ? null : await db.chapter.findUnique({ where: { id: key } })
        if (!chapter || !chapter.inTree) fields.chapterId = MSG.chapterInvalid
        else if (chapter.subjectId !== subject.id || chapter.educationLevelId !== level.id) fields.chapterId = MSG.chapterMismatch
        else chapterKey = chapter.id
      }
      if (spWanted.length > 0 && fields.spIds === undefined) {
        const keys = spWanted.map(parse)
        const nodes = keys.every((k): k is bigint => k !== null)
          ? await db.curriculumNode.findMany({ where: { id: { in: keys }, kind: 'sp', subjectId: subject.id, educationLevelId: level.id }, select: { id: true } })
          : []
        if (nodes.length !== spWanted.length) fields.spIds = MSG.spInvalid
        else spKeys = keys as bigint[]
      }
    } else if (spWanted.length > 0 && spWanted.some((s) => parse(s) === null)) fields.spIds = MSG.spInvalid
    if (Object.keys(fields).length > 0 || !subject || !level) throw invalid(fields)

    const spCodes =
      spKeys.length === 0 ? [] : (await db.curriculumNode.findMany({ where: { id: { in: spKeys } }, select: { id: true, code: true } })).sort((a, b) => spKeys.indexOf(a.id) - spKeys.indexOf(b.id)).map((n) => n.code)
    const explanation = body.explanation?.trim() ?? ''
    return {
      subjectName: subject.name,
      codes: { subjectCode: subject.code, levelCode: level.code, spCodes },
      input: {
        subjectId: idToString(subject.id),
        educationLevelId: idToString(level.id),
        chapterId: chapterKey === null ? null : idToString(chapterKey),
        spIds: spKeys.map(idToString),
        tp: body.tp ?? null,
        cognitiveLevel: body.cognitiveLevel ?? null,
        difficultyLevel: body.difficultyLevel,
        correctIndex: guruKeyIndex(body.correctAnswer ?? body.correctOptionId) as number,
        explanation: explanation === '' ? null : explanation,
        questionText: body.questionText,
        options: guruOptionTexts(body.options),
      },
    }
  }

  // ---- create ----------------------------------------------------------------------------------

  /** POST: ONE guru batch with ONE item, "Menunggu Semakan". Returns the detail of the new item. */
  async submit(actor: GuruActor, body: QuestionGuruCreateRequest): Promise<GuruDetail> {
    const row = await this.prepare(body)
    const { itemIds } = await this.createBatch(actor, [row])
    return this.get(actor.userId, idToString(itemIds[0] as bigint))
  }

  /**
   * ONE `source = 'guru'` batch holding one item per row (the single form is a batch of one; the CSV import a batch of up to 500, L-6).
   * There is no active-batch quota here: the item count is the limit and the paper quota counts batches with files only.
   */
  async createBatch(actor: GuruActor, rows: readonly GuruRowInput[]): Promise<{ batchId: bigint; itemIds: bigint[] }> {
    if (rows.length === 0 || rows.length > GURU_BATCH_MAX_ITEMS) throw ApiError.of('VALIDATION_ERROR', { fields: { csvFile: 'Fail melebihi 500 baris.' } })
    const owner = idFromString(actor.userId)
    const names = [...new Set(rows.map((r) => r.subjectName))]
    const subject = (names.length === 1 ? (names[0] as string) : MIXED_SUBJECTS).slice(0, SUBJECT_TEXT_MAX)
    return this.prisma.transaction(async (tx) => {
      const batch = await tx.intakeBatch.create({
        data: {
          ownerUserId: owner,
          source: 'guru',
          status: 'ready_for_review',
          paperType: GURU_PAPER_TYPE_QUESTION,
          subject,
          kertas: null,
          year: null,
          sourceText: GURU_QUESTION_SOURCE_TEXT,
          rightsStatus: 'own',
          note: null,
          isTest: actor.isTest,
        },
        select: { id: true },
      })
      const itemIds: bigint[] = []
      let position = 0
      for (const r of rows) {
        position += 1
        const label = String(position)
        const item = await tx.intakeItem.create({
          data: {
            batchId: batch.id,
            position,
            sourceType: 'manual',
            numberLabel: label,
            itemType: 'mcq',
            payload: guruPayloadOf(r.input, r.codes, { label, page: 1 }) as Prisma.InputJsonValue,
            pageNo: 1,
            reviewState: 'needs_review',
          },
          select: { id: true },
        })
        itemIds.push(item.id)
      }
      await tx.intakeItemEvent.createMany({
        data: itemIds.map((itemId) => ({ itemId, event: 'added', toState: 'needs_review', actorUserId: owner, actorRole: actor.roleCode })),
      })
      await this.record(AUDIT_ACTIONS.INTAKE_BATCH_CREATED, actor, 'intake_batch', batch.id, { source: 'guru', kind: 'question', items: rows.length }, tx)
      return { batchId: batch.id, itemIds }
    })
  }

  // ---- read ------------------------------------------------------------------------------------

  private ownWhere(owner: bigint) {
    return { batch: { ownerUserId: owner, source: 'guru' }, ...GURU_SUBMISSION_ITEM } satisfies Prisma.IntakeItemWhereInput
  }

  /** The teacher's own submissions, newest first. */
  async list(userId: string, page: number, pageSize: number): Promise<{ rows: GuruSummary[]; total: number; page: number; pageSize: number }> {
    const owner = parse(userId)
    if (owner === null) return { rows: [], total: 0, page, pageSize }
    const where = this.ownWhere(owner)
    const db = this.prisma.client
    const [total, items] = await Promise.all([
      db.intakeItem.count({ where }),
      db.intakeItem.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * pageSize, take: pageSize }),
    ])
    const views = await this.views(items)
    return { rows: views.map(({ summary }) => summary), total, page, pageSize }
  }

  /** One own submission with the stored DSKP fields; 404 for an unknown id or another teacher's item. */
  async get(userId: string, itemId: string): Promise<GuruDetail> {
    const item = await this.ownItem(userId, itemId)
    const [view] = await this.views([item])
    return (view as { detail: GuruDetail }).detail
  }

  private async ownItem(userId: string, itemId: string, db: Pick<TxClient, 'intakeItem'> = this.prisma.client) {
    const owner = parse(userId)
    const id = parse(itemId)
    if (owner === null || id === null) throw ApiError.of('NOT_FOUND')
    const item = await db.intakeItem.findFirst({ where: { id, ...this.ownWhere(owner) } })
    if (!item) throw ApiError.of('NOT_FOUND')
    return item
  }

  private async views(items: readonly Prisma.IntakeItemGetPayload<Record<string, never>>[]): Promise<{ summary: GuruSummary; detail: GuruDetail }[]> {
    const db = this.prisma.client
    const stored = items.map((i) => ({ item: i, sub: readGuruSubmission(i.payload) }))
    const subjectIds = [...new Set(stored.flatMap((s) => (s.sub ? [parse(s.sub.guru.subjectId)] : [])).filter((k): k is bigint => k !== null))]
    const levelIds = [...new Set(stored.flatMap((s) => (s.sub ? [parse(s.sub.guru.educationLevelId)] : [])).filter((k): k is bigint => k !== null))]
    const questionIds = items.flatMap((i) => (i.questionId === null ? [] : [i.questionId]))
    const [subjects, levels, questions] = await Promise.all([
      subjectIds.length === 0 ? [] : db.subject.findMany({ where: { id: { in: subjectIds } }, select: { id: true, name: true } }),
      levelIds.length === 0 ? [] : db.educationLevel.findMany({ where: { id: { in: levelIds } }, select: { id: true, name: true } }),
      questionIds.length === 0
        ? []
        : db.question.findMany({
            where: { id: { in: questionIds } },
            select: { id: true, liveVersionNo: true, latestVersionNo: true, versions: { select: { versionNo: true, status: true, rejectionReason: true } } },
          }),
    ])
    const subjectName = new Map(subjects.map((s) => [s.id, s.name]))
    const levelName = new Map(levels.map((l) => [l.id, l.name]))
    const questionById = new Map(questions.map((q) => [q.id, q]))
    const out: { summary: GuruSummary; detail: GuruDetail }[] = []
    for (const { item, sub } of stored) {
      if (!sub) continue
      const q = item.questionId === null ? undefined : questionById.get(item.questionId)
      const latest = q?.versions.find((v) => v.versionNo === q.latestVersionNo)
      const { status, label, reason } = guruStatusOf({
        reviewState: item.reviewState,
        rejectReason: item.rejectReason,
        question: q ? { liveVersionNo: q.liveVersionNo, latestStatus: latest?.status ?? null, latestRejectionReason: latest?.rejectionReason ?? null } : null,
      })
      const g = sub.guru
      const summary: GuruSummary = {
        id: idToString(item.id),
        questionType: 'mcq',
        questionText: sub.stem,
        subjectId: g.subjectId,
        subjectName: subjectName.get(parse(g.subjectId) as bigint) ?? '',
        educationLevelId: g.educationLevelId,
        levelName: levelName.get(parse(g.educationLevelId) as bigint) ?? '',
        difficultyLevel: g.difficultyLevel,
        difficultyLabel: g.difficultyLevel <= 2 ? 'Mudah' : g.difficultyLevel === 3 ? 'Sederhana' : 'Sukar',
        dskpTagged: g.spIds.length > 0,
        status: status satisfies GuruSubmissionStatus,
        statusLabel: label,
        rejectionReason: status === 'rejected' ? reason : null,
        editable: GURU_EDITABLE_STATES.includes(item.reviewState) && item.questionId === null,
        options: sub.options,
        correctAnswer: sub.correctIndex,
        explanation: sub.explanation,
        createdAt: toMytTimestamp(item.createdAt),
      }
      out.push({ summary, detail: { ...summary, chapterId: g.chapterId, spIds: g.spIds, tp: g.tp, cognitiveLevel: g.cognitiveLevel } })
    }
    return out
  }

  // ---- edit and delete (only while the item is still the teacher's) -----------------------------

  /** PUT: the same form again. A pending or returned (`rejected`) item only; a returned one goes back to "Menunggu Semakan". */
  async update(actor: GuruActor, itemId: string, body: QuestionGuruCreateRequest): Promise<GuruDetail> {
    const first = await this.ownItem(actor.userId, itemId)
    const row = await this.prepare(body)
    await this.prisma.transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM intake_items WHERE id = ${first.id} FOR UPDATE`
      const item = await this.ownItem(actor.userId, itemId, tx)
      this.assertOpen(item)
      const stored = item.payload as { origin?: { label: string; page: number } } | null
      await tx.intakeItem.update({
        where: { id: item.id },
        data: {
          payload: guruPayloadOf(row.input, row.codes, stored?.origin) as Prisma.InputJsonValue,
          reviewState: 'needs_review',
          rejectReason: null,
          decidedById: null,
          decidedAt: null,
          humanEdited: [],
          confirmedFields: [],
          lowFields: [],
        },
      })
      await tx.intakeItemEvent.create({
        data: { itemId: item.id, event: 'edited', fromState: item.reviewState, toState: 'needs_review', actorUserId: idFromString(actor.userId), actorRole: actor.roleCode },
      })
      // A batch of one item keeps the subject text of its item; a CSV batch keeps its own.
      if ((await tx.intakeItem.count({ where: { batchId: item.batchId } })) === 1) {
        await tx.intakeBatch.update({ where: { id: item.batchId }, data: { subject: row.subjectName.slice(0, SUBJECT_TEXT_MAX) } })
      }
      await this.record(AUDIT_ITEM_EDITED, actor, 'intake_item', item.id, { from: item.reviewState, to: 'needs_review' }, tx)
    })
    return this.get(actor.userId, itemId)
  }

  /** DELETE: removes the item (and its batch when that leaves the batch empty). */
  async remove(actor: GuruActor, itemId: string): Promise<void> {
    const first = await this.ownItem(actor.userId, itemId)
    await this.prisma.transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM intake_items WHERE id = ${first.id} FOR UPDATE`
      const item = await this.ownItem(actor.userId, itemId, tx)
      this.assertOpen(item)
      await tx.intakeItem.delete({ where: { id: item.id } })
      if ((await tx.intakeItem.count({ where: { batchId: item.batchId } })) === 0 && (await tx.intakeFile.count({ where: { batchId: item.batchId } })) === 0) {
        await tx.intakeBatch.deleteMany({ where: { id: item.batchId, source: 'guru' } })
      }
      await this.record(AUDIT_ITEM_DELETED, actor, 'intake_item', item.id, { from: item.reviewState }, tx)
    })
  }

  /** 409: the admin already accepted the item (a Draf question exists) or it is otherwise out of the teacher's hands. */
  private assertOpen(item: { reviewState: string; questionId: bigint | null }): void {
    if (!GURU_EDITABLE_STATES.includes(item.reviewState) || item.questionId !== null) throw ApiError.of('CONFLICT', { message: MSG.locked })
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
