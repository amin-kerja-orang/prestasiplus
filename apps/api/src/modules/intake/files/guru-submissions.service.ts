import { Inject, Injectable } from '@nestjs/common'
import {
  GURU_QUESTION_MESSAGES as MSG,
  GURU_STRUCTURED_MESSAGES as SMSG,
  QUESTION_COGNITIVE_LEVELS,
  type GuruStructuredCreateRequest,
  type GuruStructuredDetailSchema,
  type GuruStructuredRowSchema,
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
import { FilesService } from '../../files'
import { ApiError } from '../../../common/errors/api-error'
import { toMytTimestamp } from '../../../common/time/myt'
import type { TxClient } from '../../../db/client'
import { idFromString, idToString } from '../../../db/ids'
import { Prisma } from '../../../db/generated/client'
import { PrismaService } from '../../../db/prisma.service'
import { difficultyLabelOf } from '../../questions/projection'
import { INTAKE_AUDIT } from '../workflow/workflow.constants'
import {
  GURU_EDITABLE_STATES,
  GURU_PAPER_TYPE_QUESTION,
  GURU_QUESTION_SOURCE_TEXT,
  GURU_STIMULUS_LABEL,
  GURU_STIMULUS_REF,
  GURU_STRUCTURED_ITEM,
  GURU_SUBMISSION_ITEM,
  guruLowFields,
  guruStimulusImageOf,
  guruPayloadOf,
  guruStructuredPayloadOf,
  guruStructuredTotal,
  readGuruStructured,
  type GuruStructuredInput,
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

/** Which of the teacher's own submissions a call works on: the single MCQ (`/guru/questions`) or the structured question (`/guru/intake/structured`). */
export type GuruItemKind = 'mcq' | 'structured'

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
const IMAGE_MIMES: readonly string[] = ['image/jpeg', 'image/png', 'image/webp']
const IMAGE_MAX_BYTES = 2 * 1024 * 1024
/** Wire id of an own structured submission in API-GUR-26: `g{itemId}`; never collides with a (numeric) question id. */
export const STRUCTURED_ID_PREFIX = 'g'
/** The intake item id of a wire id (`g123`; a bare `123` is tolerated on the write routes); anything else is not an id (404 downstream). */
export const structuredItemId = (wireId: string): string => (wireId.startsWith(STRUCTURED_ID_PREFIX) ? wireId.slice(STRUCTURED_ID_PREFIX.length) : wireId)
/** The own-submission row and detail in the API-GUR-26 shape (the row has no `number`: the union numbers it). */
export interface StructuredOwnView {
  row: Omit<z.output<typeof GuruStructuredRowSchema>, 'number'>
  detail: z.output<typeof GuruStructuredDetailSchema>
}
const MIXED_SUBJECTS = 'Pelbagai subjek'
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
/** Which own rows a list wants: `status` filter, the own question ids the approved side lists, and those with a live version. */
export interface OwnStructuredScope {
  status: 'all' | 'review' | 'approved'
  served: readonly string[]
  published: readonly string[]
}

/** The subject and level filter of the own structured list. */
export interface OwnStructuredFilter {
  subjectId?: string | undefined
  educationLevelId?: string | undefined
}

@Injectable()
export class GuruSubmissionsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(FilesService) private readonly files: FilesService,
  ) {}

  // ---- validation ------------------------------------------------------------------------------

  /** The `has chapters` and `has DSKP nodes` facts of a Subjek + Tingkatan (the same two lookups as the approve gate). */
  async dskpFacts(subjectId: bigint, levelId: bigint): Promise<{ hasChapters: boolean; hasDskpNodes: boolean }> {
    const rows = await this.prisma.client.$queryRaw<{ has_dskp: boolean; has_chapters: boolean }[]>`
      SELECT EXISTS (SELECT 1 FROM curriculum_nodes WHERE subject_id = ${subjectId} AND education_level_id = ${levelId}) AS has_dskp,
             EXISTS (SELECT 1 FROM chapters WHERE subject_id = ${subjectId} AND education_level_id = ${levelId} AND is_active AND in_tree) AS has_chapters`
    return { hasDskpNodes: rows[0]?.has_dskp === true, hasChapters: rows[0]?.has_chapters === true }
  }

  /**
   * Validates the curriculum part of a form body (Subjek, Tingkatan, Bab, SP, TP, Aras; the conditional DSKP rule of D112 included) and resolves
   * it to rows; throws 422 with `fields` (plus any `extra` field errors the caller found). Shared by the MCQ and the structured form.
   */
  async resolveTags(
    body: { subjectId: string; educationLevelId: string; chapterId?: string | null | undefined; spIds?: readonly string[] | null | undefined; tp?: number | null | undefined; cognitiveLevel?: string | null | undefined },
    extra: Record<string, string> = {},
  ) {
    const fields: Record<string, string> = { ...extra }
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
    return { subject, level, chapterKey, spKeys, spCodes }
  }

  /** Validates a form body against the curriculum; throws 422 with `fields`. */
  async prepare(body: QuestionGuruCreateRequest): Promise<GuruRowInput> {
    const { subject, level, chapterKey, spKeys, spCodes } = await this.resolveTags(body)
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
            lowFields: guruLowFields(r.input),
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

  private ownWhere(owner: bigint, kind: GuruItemKind = 'mcq') {
    return { batch: { ownerUserId: owner, source: 'guru' }, ...(kind === 'mcq' ? GURU_SUBMISSION_ITEM : GURU_STRUCTURED_ITEM) } satisfies Prisma.IntakeItemWhereInput
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

  private async ownItem(userId: string, itemId: string, db: Pick<TxClient, 'intakeItem'> = this.prisma.client, kind: GuruItemKind = 'mcq') {
    const owner = parse(userId)
    const id = parse(itemId)
    if (owner === null || id === null) throw ApiError.of('NOT_FOUND')
    const item = await db.intakeItem.findFirst({ where: { id, ...this.ownWhere(owner, kind) } })
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
        : db.question.findMany({ where: { id: { in: questionIds } }, select: { id: true, liveVersionNo: true, latestVersionNo: true } }),
    ])
    // Only the LATEST version of each linked question is read (its status and rejection reason).
    const latestOf = new Map(
      (questions.length === 0
        ? []
        : await db.questionVersion.findMany({
            where: { OR: questions.map((q) => ({ questionId: q.id, versionNo: q.latestVersionNo })) },
            select: { questionId: true, status: true, rejectionReason: true },
          })
      ).map((v) => [v.questionId, v]),
    )
    const subjectName = new Map(subjects.map((s) => [s.id, s.name]))
    const levelName = new Map(levels.map((l) => [l.id, l.name]))
    const questionById = new Map(questions.map((q) => [q.id, q]))
    const out: { summary: GuruSummary; detail: GuruDetail }[] = []
    for (const { item, sub } of stored) {
      if (!sub) continue
      const q = item.questionId === null ? undefined : questionById.get(item.questionId)
      const latest = q === undefined ? undefined : latestOf.get(q.id)
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
        difficultyLabel: difficultyLabelOf(g.difficultyLevel),
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

  // ---- structured question (S6-T17, API-GUR-17 structured variant, ADD-13) ------------------------

  /** The uploaded stimulus image: a `question_image` file of the caller, jpg, png or webp, at most 2 MB; the 422 text otherwise. */
  private async checkImage(userId: string, token: string | null | undefined): Promise<string | null> {
    if (token === undefined || token === null) return null
    const owner = parse(userId)
    const file = owner === null ? null : await this.prisma.client.file.findFirst({ where: { publicId: token, purpose: 'question_image', ownerUserId: owner }, select: { mime: true, sizeBytes: true } })
    if (!file || !IMAGE_MIMES.includes(file.mime)) throw invalid({ stimulusImageId: SMSG.imageType })
    if (file.sizeBytes > IMAGE_MAX_BYTES) throw invalid({ stimulusImageId: SMSG.imageSize })
    return token
  }

  /** Validates a structured form against the curriculum and the image; throws 422 with `fields`. */
  async prepareStructured(userId: string, body: GuruStructuredCreateRequest): Promise<{ input: GuruStructuredInput; codes: GuruTagCodes; subjectName: string }> {
    const extra: Record<string, string> = {}
    let image: string | null = null
    try {
      image = await this.checkImage(userId, body.stimulusImageId)
    } catch (e) {
      if (!(e instanceof ApiError)) throw e
      Object.assign(extra, e.fields ?? {})
    }
    const { subject, level, chapterKey, spKeys, spCodes } = await this.resolveTags(body, extra)
    const stimulus = body.stimulus?.trim() ?? ''
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
        stimulusImageId: image,
        stimulus,
        parts: body.parts.map((p) => ({ text: p.text, marks: p.marks, scheme: p.scheme, cognitiveLevel: p.cognitiveLevel ?? null })),
      },
    }
  }

  /** POST: ONE guru batch (paper type `umum`) with ONE structured item, "Menunggu Semakan"; no question row. Returns the detail. */
  async submitStructured(actor: GuruActor, body: GuruStructuredCreateRequest): Promise<StructuredOwnView['detail']> {
    const row = await this.prepareStructured(actor.userId, body)
    const owner = idFromString(actor.userId)
    const itemId = await this.prisma.transaction(async (tx) => {
      const batch = await tx.intakeBatch.create({
        data: {
          ownerUserId: owner,
          source: 'guru',
          status: 'ready_for_review',
          paperType: GURU_PAPER_TYPE_QUESTION,
          subject: row.subjectName.slice(0, SUBJECT_TEXT_MAX),
          kertas: null,
          year: null,
          sourceText: GURU_QUESTION_SOURCE_TEXT,
          rightsStatus: 'own',
          note: null,
          isTest: actor.isTest,
        },
        select: { id: true },
      })
      const stimulusId = await this.syncStimulus(tx, batch.id, null, row.input)
      const item = await tx.intakeItem.create({
        data: {
          batchId: batch.id,
          position: 1,
          sourceType: 'manual',
          numberLabel: '1',
          itemType: 'structured',
          stimulusId,
          payload: guruStructuredPayloadOf(row.input, row.codes, { label: '1', page: 1 }) as Prisma.InputJsonValue,
          pageNo: 1,
          lowFields: guruLowFields(row.input),
          reviewState: 'needs_review',
        },
        select: { id: true },
      })
      await tx.intakeItemEvent.create({ data: { itemId: item.id, event: 'added', toState: 'needs_review', actorUserId: owner, actorRole: actor.roleCode } })
      await this.record(AUDIT_ACTIONS.INTAKE_BATCH_CREATED, actor, 'intake_batch', batch.id, { source: 'guru', kind: 'structured', items: 1 }, tx)
      return item.id
    })
    return this.getStructured(actor.userId, STRUCTURED_ID_PREFIX + idToString(itemId))
  }

  /** PUT: the same form again, only while the item is still the teacher's (a returned one goes back to "Menunggu Semakan"). */
  async updateStructured(actor: GuruActor, wireId: string, body: GuruStructuredCreateRequest): Promise<StructuredOwnView['detail']> {
    const itemId = structuredItemId(wireId)
    const first = await this.ownItem(actor.userId, itemId, this.prisma.client, 'structured')
    // 409 (not editable any more) before 422 (the body).
    this.assertOpen(first)
    const row = await this.prepareStructured(actor.userId, body)
    const replaced: { token: string | null } = { token: null }
    await this.prisma.transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM intake_items WHERE id = ${first.id} FOR UPDATE`
      const item = await this.ownItem(actor.userId, itemId, tx, 'structured')
      this.assertOpen(item)
      const stored = item.payload as { origin?: { label: string; page: number } } | null
      const oldImage = guruStimulusImageOf(item.payload)
      const stimulusId = await this.syncStimulus(tx, item.batchId, item.stimulusId, row.input)
      await tx.intakeItem.update({
        where: { id: item.id },
        data: {
          stimulusId,
          payload: guruStructuredPayloadOf(row.input, row.codes, stored?.origin) as Prisma.InputJsonValue,
          reviewState: 'needs_review',
          rejectReason: null,
          decidedById: null,
          decidedAt: null,
          humanEdited: [],
          confirmedFields: [],
          lowFields: guruLowFields(row.input),
        },
      })
      await tx.intakeItemEvent.create({
        data: { itemId: item.id, event: 'edited', fromState: item.reviewState, toState: 'needs_review', actorUserId: idFromString(actor.userId), actorRole: actor.roleCode },
      })
      await tx.intakeBatch.update({ where: { id: item.batchId }, data: { subject: row.subjectName.slice(0, SUBJECT_TEXT_MAX) } })
      await this.record(INTAKE_AUDIT.itemEdited, actor, 'intake_item', item.id, { from: item.reviewState, to: 'needs_review' }, tx)
      // Counted inside the transaction (after the update), so a concurrent edit cannot make the file look unused while it is not.
      if (oldImage !== null && oldImage !== row.input.stimulusImageId) replaced.token = await this.unusedImage(tx, oldImage)
    })
    await this.discardImage(replaced.token)
    return this.getStructured(actor.userId, wireId)
  }

  /** DELETE: removes an own structured item (and its batch). */
  async removeStructured(actor: GuruActor, wireId: string): Promise<void> {
    await this.discardImage(await this.remove(actor, structuredItemId(wireId), 'structured'))
  }

  /** 409 when an own structured item is no longer open to the teacher (404 first when it is not theirs). */
  async assertStructuredOpen(userId: string, wireId: string): Promise<void> {
    this.assertOpen(await this.ownItem(userId, structuredItemId(wireId), this.prisma.client, 'structured'))
  }

  /** The token when no intake item names the image any more (called inside the transaction that dropped the reference), else null. */
  private async unusedImage(tx: TxClient, token: string): Promise<string | null> {
    return (await tx.intakeItem.count({ where: { payload: { path: ['guru', 'stimulusImageId'], equals: token } } })) === 0 ? token : null
  }

  /** Removes a stimulus image found unused by `unusedImage`, after the transaction committed. Never throws. */
  private async discardImage(token: string | null): Promise<void> {
    if (token !== null) await this.files.discard(token, 'question_image')
  }

  /**
   * The batch stimulus of a structured submission: ONE `IntakeStimulus` (kind passage, never an image kind, so the gate needs no figure) with the
   * text; the picture travels as `payload.guru.stimulusImageId` and is copied to the bank on accept. No text and no picture means no stimulus.
   * Returns the id the item links to.
   */
  private async syncStimulus(tx: TxClient, batchId: bigint, current: bigint | null, input: GuruStructuredInput): Promise<bigint | null> {
    const has = input.stimulus.trim() !== '' || input.stimulusImageId !== null
    if (!has) {
      if (current !== null) await tx.intakeStimulus.deleteMany({ where: { id: current, batchId } })
      return null
    }
    const data = { kind: 'passage', label: GURU_STIMULUS_LABEL, altText: GURU_STIMULUS_LABEL, body: input.stimulus.trim() === '' ? null : input.stimulus }
    if (current !== null) {
      await tx.intakeStimulus.update({ where: { id: current }, data })
      return current
    }
    return (await tx.intakeStimulus.create({ data: { batchId, ref: GURU_STIMULUS_REF, ...data }, select: { id: true } })).id
  }

  /** One own structured submission; 404 for an unknown id or another teacher's item. */
  async getStructured(userId: string, wireId: string): Promise<StructuredOwnView['detail']> {
    const item = await this.ownItem(userId, structuredItemId(wireId), this.prisma.client, 'structured')
    const [view] = await this.structuredViews([item])
    if (!view) throw ApiError.of('NOT_FOUND')
    return view.detail
  }

  private structuredWhere(owner: bigint, filter: OwnStructuredFilter, scope: OwnStructuredScope): Prisma.IntakeItemWhereInput {
    const and: Prisma.IntakeItemWhereInput[] = [this.ownWhere(owner, 'structured')]
    if (filter.subjectId !== undefined) and.push({ payload: { path: ['guru', 'subjectId'], equals: filter.subjectId } })
    if (filter.educationLevelId !== undefined) and.push({ payload: { path: ['guru', 'educationLevelId'], equals: filter.educationLevelId } })
    // An own item never vanishes, and each row sits under its real status. `served` = own questions the approved side lists (they show
    // there, once, so they leave this side); `published` = own questions with a live version. Published but not served (inactive, needs a
    // diagram) is `approved` here; every other own row (pending, returned, accepted but unpublished) is `review`.
    const ids = (list: readonly string[]) =>
      list.flatMap((id) => {
        const key = parse(id)
        return key === null ? [] : [key]
      })
    const served = ids(scope.served)
    const published = ids(scope.published)
    const hidden = published.filter((id) => !served.includes(id))
    if (scope.status === 'review') and.push({ NOT: { questionId: { in: published } } })
    else if (scope.status === 'approved') and.push({ questionId: { in: hidden } })
    else and.push({ NOT: { questionId: { in: served } } })
    return { AND: and }
  }

  /** The question ids of the caller's own accepted structured items, and which of them have a live version (the caller asks which are served). */
  async ownAcceptedQuestions(userId: string): Promise<{ all: string[]; published: string[] }> {
    const owner = parse(userId)
    if (owner === null) return { all: [], published: [] }
    const rows = await this.prisma.client.intakeItem.findMany({ where: { AND: [this.ownWhere(owner, 'structured'), { reviewState: 'accepted', questionId: { not: null } }] }, select: { questionId: true } })
    const all = rows.flatMap((r) => (r.questionId === null ? [] : [r.questionId]))
    const live = all.length === 0 ? [] : await this.prisma.client.question.findMany({ where: { id: { in: all }, liveVersionNo: { not: null } }, select: { id: true } })
    return { all: all.map(idToString), published: live.map((q) => idToString(q.id)) }
  }

  /** How many own submissions match the scope (the union total adds this to the approved count). */
  async countOwnStructured(userId: string, filter: OwnStructuredFilter, scope: OwnStructuredScope): Promise<number> {
    const owner = parse(userId)
    return owner === null ? 0 : this.prisma.client.intakeItem.count({ where: this.structuredWhere(owner, filter, scope) })
  }

  /** A slice of the caller's own review submissions, newest first (rows without `number`; the caller numbers the union). */
  async listOwnStructured(userId: string, filter: OwnStructuredFilter, offset: number, limit: number, scope: OwnStructuredScope): Promise<StructuredOwnView['row'][]> {
    const owner = parse(userId)
    if (owner === null || limit <= 0) return []
    const items = await this.prisma.client.intakeItem.findMany({ where: this.structuredWhere(owner, filter, scope), orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: offset, take: limit })
    return (await this.structuredViews(items)).map((v) => v.row)
  }

  private async structuredViews(items: readonly Prisma.IntakeItemGetPayload<Record<string, never>>[]): Promise<StructuredOwnView[]> {
    const db = this.prisma.client
    const stimulusIds = items.flatMap((i) => (i.stimulusId === null ? [] : [i.stimulusId]))
    const stimulusBody = new Map(
      (stimulusIds.length === 0 ? [] : await db.intakeStimulus.findMany({ where: { id: { in: stimulusIds } }, select: { id: true, body: true } })).map((x) => [x.id, x.body]),
    )
    const stored = items.flatMap((item) => {
      const sub = readGuruStructured(item.payload, item.stimulusId === null ? null : (stimulusBody.get(item.stimulusId) ?? null))
      return sub ? [{ item, sub }] : []
    })
    // The real state, as for the single MCQ (`guruStatusOf`): an accepted item whose question is published is `approved`; a returned or
    // pending one is `review` (a returned one with its reason). An accepted item is not editable.
    const questionIds = items.flatMap((i) => (i.questionId === null ? [] : [i.questionId]))
    const questions = questionIds.length === 0 ? [] : await db.question.findMany({ where: { id: { in: questionIds } }, select: { id: true, liveVersionNo: true, latestVersionNo: true } })
    const latest = new Map(
      (questions.length === 0
        ? []
        : await db.questionVersion.findMany({ where: { OR: questions.map((q) => ({ questionId: q.id, versionNo: q.latestVersionNo })) }, select: { questionId: true, status: true, rejectionReason: true } })
      ).map((v) => [v.questionId, v]),
    )
    const questionById = new Map(questions.map((q) => [q.id, q]))
    const ids = (pick: (g: { subjectId: string; educationLevelId: string }) => string) => [...new Set(stored.map((s) => parse(pick(s.sub.guru))).filter((k): k is bigint => k !== null))]
    const [subjects, levels] = await Promise.all([
      db.subject.findMany({ where: { id: { in: ids((g) => g.subjectId) } }, select: { id: true, name: true } }),
      db.educationLevel.findMany({ where: { id: { in: ids((g) => g.educationLevelId) } }, select: { id: true, name: true } }),
    ])
    const subjectName = new Map(subjects.map((x) => [idToString(x.id), x.name]))
    const levelName = new Map(levels.map((x) => [idToString(x.id), x.name]))
    return stored.map(({ item, sub }) => {
      const g = sub.guru
      const total = guruStructuredTotal(sub.parts)
      const level = QUESTION_COGNITIVE_LEVELS.indexOf(g.cognitiveLevel as (typeof QUESTION_COGNITIVE_LEVELS)[number]) + 1
      const kbat = g.cognitiveLevel === null ? '' : level <= 2 ? `LOTS ${String(level)}` : level === 3 ? 'MOTS 3' : `HOTS ${String(level)}`
      const wireId = STRUCTURED_ID_PREFIX + idToString(item.id)
      const subject = { id: g.subjectId, name: subjectName.get(g.subjectId) ?? '' }
      const lvl = { id: g.educationLevelId, name: levelName.get(g.educationLevelId) ?? '' }
      const excerptSource = sub.stimulus.trim() === '' ? (sub.parts[0]?.text ?? '') : sub.stimulus
      const editable = GURU_EDITABLE_STATES.includes(item.reviewState) && item.questionId === null
      const q = item.questionId === null ? undefined : questionById.get(item.questionId)
      const lv = q === undefined ? undefined : latest.get(q.id)
      const state = guruStatusOf({
        reviewState: item.reviewState,
        rejectReason: item.rejectReason,
        question: q ? { liveVersionNo: q.liveVersionNo, latestStatus: lv?.status ?? null, latestRejectionReason: lv?.rejectionReason ?? null } : null,
      })
      const status = state.status === 'approved' ? ('approved' as const) : ('review' as const)
      return {
        row: {
          id: wireId,
          textExcerpt: excerptSource.length <= 120 ? excerptSource : `${excerptSource.slice(0, 120).trimEnd()}...`,
          level: lvl,
          subject,
          kbat,
          subCount: sub.parts.length,
          marks: total,
          status,
          source: 'submission' as const,
          editable,
        },
        detail: {
          id: wireId,
          subject,
          level: lvl,
          kbat,
          status,
          stimulus: sub.stimulus,
          stimulusImage: g.stimulusImageId === null ? null : `/api/files/${g.stimulusImageId}`,
          totalMarks: total,
          subCount: sub.parts.length,
          subQuestions: sub.parts.map((p, i) => ({
            partLabel: `(${'abcdefghij'[i] as string})`,
            questionText: p.text,
            marks: p.marks,
            cognitiveLevel: p.cognitiveLevel,
            modelAnswer: p.scheme,
            depth: 0,
          })),
          createdAt: toMytTimestamp(item.createdAt),
          source: 'submission' as const,
          editable,
          form: {
            subjectId: g.subjectId,
            educationLevelId: g.educationLevelId,
            chapterId: g.chapterId,
            spIds: g.spIds,
            tp: g.tp,
            cognitiveLevel: g.cognitiveLevel,
            difficultyLevel: g.difficultyLevel,
            stimulusImageId: g.stimulusImageId,
            rejectionReason: state.status === 'rejected' ? state.reason : null,
          },
        },
      }
    })
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
          lowFields: guruLowFields(row.input),
        },
      })
      await tx.intakeItemEvent.create({
        data: { itemId: item.id, event: 'edited', fromState: item.reviewState, toState: 'needs_review', actorUserId: idFromString(actor.userId), actorRole: actor.roleCode },
      })
      // A batch of one item keeps the subject text of its item; a CSV batch keeps its own.
      if ((await tx.intakeItem.count({ where: { batchId: item.batchId } })) === 1) {
        await tx.intakeBatch.update({ where: { id: item.batchId }, data: { subject: row.subjectName.slice(0, SUBJECT_TEXT_MAX) } })
      }
      await this.record(INTAKE_AUDIT.itemEdited, actor, 'intake_item', item.id, { from: item.reviewState, to: 'needs_review' }, tx)
    })
    return this.get(actor.userId, itemId)
  }

  /** DELETE: removes the item (and its batch when that leaves the batch empty). */
  async remove(actor: GuruActor, itemId: string, kind: GuruItemKind = 'mcq'): Promise<string | null> {
    const first = await this.ownItem(actor.userId, itemId, this.prisma.client, kind)
    return this.prisma.transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM intake_items WHERE id = ${first.id} FOR UPDATE`
      const item = await this.ownItem(actor.userId, itemId, tx, kind)
      this.assertOpen(item)
      await tx.intakeItem.delete({ where: { id: item.id } })
      if ((await tx.intakeItem.count({ where: { batchId: item.batchId } })) === 0 && (await tx.intakeFile.count({ where: { batchId: item.batchId } })) === 0) {
        await tx.intakeBatch.deleteMany({ where: { id: item.batchId, source: 'guru' } })
      }
      await this.record(INTAKE_AUDIT.itemDeleted, actor, 'intake_item', item.id, { from: item.reviewState }, tx)
      // The stimulus image of a deleted structured item, when no other submission names it any more (counted in this transaction).
      const image = guruStimulusImageOf(item.payload)
      return image === null ? null : this.unusedImage(tx, image)
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
