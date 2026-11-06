import { Inject, Injectable } from '@nestjs/common'
import {
  PERSONAL_QUESTION_MESSAGES as MSG,
  type PersonalQuestion,
  PersonalQuestionListQuerySchema,
  PersonalQuestionWriteSchema,
  personalDskpFields,
} from '@pp/contract'

import { AuditService } from '../../../common/audit'
import { ApiError } from '../../../common/errors/api-error'
import { toMytTimestamp } from '../../../common/time/myt'
import { CLOCK, type Clock, mytDay } from '../../../db/clock'
import type { TxClient } from '../../../db/client'
import { idToString, isIdString } from '../../../db/ids'
import { type PersonalQuestionWrite, type QuestionRecord, QuestionsService } from '../../questions'
import type { ClassActor } from '../actor'
import { invalid, parseStrict } from '../strict-body'
import { PersonalQuestionsRepository } from './personal-questions.repository'

export const PERSONAL_QUESTION_AUDIT = {
  CREATED: 'classes.personal_question.created',
  UPDATED: 'classes.personal_question.updated',
  DELETED: 'classes.personal_question.deleted',
} as const

const notFound = (): ApiError => ApiError.of('NOT_FOUND')

interface LeafShape {
  mode?: string
  cognitiveLevel?: string | null
  options?: { body?: { ms?: string } }[]
  key?: { kind?: string; correct?: string }
}

/** The wire shape of a stored personal question (60 section 2.17.2); `tp` is returned only for a DSKP-tagged question. */
export function toPersonalQuestion(record: QuestionRecord, subjectName: string): PersonalQuestion {
  const v = record.version
  const leaf = (v.parts as unknown as LeafShape[]).find((p) => p.mode === 'mcq') ?? {}
  const options = [0, 1, 2, 3].map((i) => ({ text: leaf.options?.[i]?.body?.ms ?? '' }))
  const correct = leaf.key?.kind === 'option' ? 'ABCD'.indexOf(leaf.key.correct ?? '') : -1
  const cognitive = leaf.cognitiveLevel ?? null
  return {
    id: record.id,
    subjectId: v.subjectId ?? '',
    subjectName,
    educationLevelId: v.educationLevelId ?? '',
    difficulty: v.difficultyLevel ?? Math.min(5, v.difficultyTp ?? 3),
    text: v.stemMs ?? '',
    chapterId: v.chapterId,
    spIds: v.spIds,
    tp: v.spIds.length > 0 ? v.difficultyTp : null,
    cognitiveLevel: cognitive as PersonalQuestion['cognitiveLevel'],
    options,
    correctIndex: correct < 0 ? 0 : correct,
    referenceUrl: v.referenceUrl ?? null,
    createdAt: toMytTimestamp(record.createdAt),
  }
}

/**
 * Soalan & Rujukan (R1-GUR-44a, API-GUR-24): a teacher's own personal MCQ with an optional reference link. Own rows only: another
 * teacher's id, a bank question's id and an unknown id are all 404. A saved question is approved and private (`owner_user_id` = the
 * caller, `created_by_id` NULL), served only by the owner's Misi Harian draw.
 */
@Injectable()
export class PersonalQuestionsService {
  constructor(
    @Inject(PersonalQuestionsRepository) private readonly repo: PersonalQuestionsRepository,
    @Inject(QuestionsService) private readonly questions: QuestionsService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async list(actor: ClassActor, rawQuery: unknown): Promise<{ rows: PersonalQuestion[]; page: number; pageSize: number; total: number }> {
    const q = PersonalQuestionListQuerySchema.safeParse(rawQuery ?? {})
    const query = q.success ? q.data : { page: 1, pageSize: 20, educationLevelId: undefined }
    const { ids, total } = await this.repo.page(actor.userId, query)
    return { rows: await this.present(ids), page: query.page, pageSize: query.pageSize, total }
  }

  async get(actor: ClassActor, id: string): Promise<PersonalQuestion> {
    if ((await this.repo.ownVersionNo(actor.userId, id)) === null) throw notFound()
    return this.one(id)
  }

  async create(actor: ClassActor, body: unknown): Promise<PersonalQuestion> {
    const write = await this.prepare(body)
    const id = await this.questions.createPersonal(write, actor.userId, { after: (tx, qid) => this.record(tx, actor, PERSONAL_QUESTION_AUDIT.CREATED, qid, write) })
    return this.one(id)
  }

  async update(actor: ClassActor, id: string, body: unknown): Promise<PersonalQuestion> {
    const versionNo = await this.repo.ownVersionNo(actor.userId, id)
    if (versionNo === null) throw notFound()
    const write = await this.prepare(body)
    await this.questions.rewritePersonal(id, versionNo, write, actor.userId, {
      guard: () => this.assertNotInUse(id),
      after: (tx, qid) => this.record(tx, actor, PERSONAL_QUESTION_AUDIT.UPDATED, qid, write),
    })
    return this.one(id)
  }

  /** 409 "Soalan sedang digunakan dalam misi." while an active Misi draws the question (ADD-21). */
  async remove(actor: ClassActor, id: string): Promise<{ deleted: 1 }> {
    if ((await this.repo.ownVersionNo(actor.userId, id)) === null) throw notFound()
    // The guard, the Ulang Kaji clean-up and the audit run INSIDE the delete transaction, after the question row lock (no gap between check and delete).
    const removed = await this.questions.removePersonal(id, {
      guard: () => this.assertNotInUse(id),
      cleanup: () => this.repo.dropRevisionRows(id),
      after: (tx, qid) => this.record(tx, actor, PERSONAL_QUESTION_AUDIT.DELETED, qid, null),
    })
    if (!removed) throw notFound()
    return { deleted: 1 }
  }

  // --- internals --------------------------------------------------------------------------------------

  /**
   * ADD-21 + edit lock: 409 "Soalan sedang digunakan dalam misi." when an active Misi draws the question (mission date today or later AND a session
   * of it holds the question) OR any open practice session holds it. Used by DELETE and PUT.
   */
  private async assertNotInUse(id: string): Promise<void> {
    if ((await this.repo.usedByActiveMission(id, mytDay(this.clock.now()))) || (await this.repo.heldByOpenSession(id))) {
      throw ApiError.of('CONFLICT', { message: MSG.inUse })
    }
  }

  private async one(id: string): Promise<PersonalQuestion> {
    const rows = await this.present([id])
    const row = rows[0]
    if (!row) throw notFound()
    return row
  }

  private async present(ids: readonly string[]): Promise<PersonalQuestion[]> {
    const records = await this.repo.records(ids)
    const names = await this.repo.subjectNames(records.flatMap((r) => (r.version.subjectId === null ? [] : [r.version.subjectId])))
    return records.map((r) => toPersonalQuestion(r, names.get(r.version.subjectId ?? '') ?? ''))
  }

  /** Strict schema (unknown key = 422), then the curriculum rules of the form: Tingkatan, Subjek, the conditional DSKP fields (D112). */
  private async prepare(raw: unknown): Promise<PersonalQuestionWrite> {
    const body = parseStrict(PersonalQuestionWriteSchema, raw)
    const fields: Record<string, string> = {}
    const subject = await this.repo.activeSubject(body.subjectId)
    const level = await this.repo.activeTingkatan(body.educationLevelId)
    if (!subject) fields.subjectId = MSG.subject
    if (!level) fields.educationLevelId = MSG.level

    const spWanted = [...new Set(body.spIds ?? [])]
    let chapterId: string | null = null
    if (subject && level) {
      Object.assign(fields, personalDskpFields({ chapterId: body.chapterId, spIds: spWanted, tp: body.tp, cognitiveLevel: body.cognitiveLevel }, await this.repo.dskpFacts(subject.id, level.id)))
      if (body.chapterId !== undefined && body.chapterId !== null && body.chapterId !== '') {
        const chapter = await this.repo.chapter(body.chapterId)
        if (!chapter) fields.chapterId = MSG.chapterInvalid
        else if (chapter.subjectId !== subject.id || chapter.educationLevelId !== level.id) fields.chapterId = MSG.chapterMismatch
        else chapterId = idToString(chapter.id)
      }
      if (spWanted.length > 0 && fields.spIds === undefined) {
        const ok = spWanted.every(isIdString) && (await this.repo.countSpNodes(spWanted.map((s) => BigInt(s)), subject.id, level.id)) === spWanted.length
        if (!ok) fields.spIds = MSG.spInvalid
      }
    }
    if (Object.keys(fields).length > 0) throw invalid(fields)

    const link = body.referenceUrl?.trim() ?? ''
    return {
      subjectId: body.subjectId,
      educationLevelId: body.educationLevelId,
      chapterId,
      spIds: spWanted,
      tp: body.tp ?? null,
      cognitiveLevel: body.cognitiveLevel ?? null,
      difficulty: body.difficulty,
      text: body.text,
      options: body.options.map((o) => ({ text: o.text.trim() })),
      correctIndex: body.correctIndex,
      // The scheme is stored in lower case (the table check is case sensitive); the rest of the address is kept as typed.
      referenceUrl: link === '' ? null : link.replace(/^https?/i, (s) => s.toLowerCase()),
    }
  }

  /** The audit row, written in the write transaction (`tx`); details follow the class audits: the Subjek and Tingkatan ids, never the text. */
  private record(tx: TxClient, actor: ClassActor, action: string, questionId: string, write: PersonalQuestionWrite | null): Promise<unknown> {
    return this.audit.record({
      tx,
      action,
      actorUserId: actor.userId,
      actorRole: actor.role,
      sessionRowId: actor.auth.sessionRowId,
      targetType: 'question',
      targetId: questionId,
      schoolId: actor.schoolId,
      scopeLevel: actor.auth.active.scope.level,
      requestId: actor.requestId,
      ip: actor.ip,
      details: write === null ? {} : { subjectId: write.subjectId, educationLevelId: write.educationLevelId },
    })
  }
}
