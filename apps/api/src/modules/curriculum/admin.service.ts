import { Inject, Injectable } from '@nestjs/common'
import {
  CURRICULUM_FLASH_MESSAGES as FLASH,
  CurriculumChapterCreateSchema,
  CurriculumChapterUpdateSchema,
  CurriculumEducationLevelWriteSchema,
  CurriculumSetActiveRequestSchema,
  CurriculumSubjectWriteSchema,
  CurriculumSubtopicCreateSchema,
  CurriculumSubtopicUpdateSchema,
  CurriculumTopicCreateSchema,
  CurriculumTopicUpdateSchema,
} from '@pp/contract'

import { AUDIT_ACTIONS, AuditService } from '../../common/audit'
import { ApiError } from '../../common/errors/api-error'
import { CLOCK, type Clock } from '../../db/clock'
import { idToString } from '../../db/ids'
import { PrismaService } from '../../db/prisma.service'
import { CurriculumRepository, type Chapter, type EducationLevel, type SubjectWithLevels } from './curriculum.repository'
import type { AuditActor } from './actor'
import {
  type DbErrorMap,
  chapterNotFound,
  hasChildren,
  levelNotFound,
  subjectNotFound,
  subtopicNotFound,
  topicNotFound,
  translateDbError,
} from './errors'
import type { ChapterDetail, TopicDetail } from './types'
import { CurriculumPorts } from './providers'
import {
  INT_BOUNDS,
  LIMITS,
  LONG_TEXT_BOUNDS,
  asRecord,
  existsMessage,
  integerMessage,
  parseId,
  requiredMessage,
  uniqueMessage,
  validateBody,
} from './validation'
import { chapterView, levelView, subjectView, subtopicView, topicView } from './views'

const CHAPTER_BOUNDS = { ...LONG_TEXT_BOUNDS, maxValue: INT_BOUNDS }

export const DEFAULT_SUBJECT_COLOR = '#4f46e5'
export const DEFAULT_SUBJECT_ICON = 'fas fa-book'

const asId = (v: unknown): bigint | null => parseId(v)

/**
 * The contract's field builders type a required field as optional (they are `z.preprocess`), but the
 * parse has already rejected a missing one; this narrows the type and fails loudly if that ever breaks.
 */
function must<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error('curriculum: required field missing after validation')
  return value
}

/**
 * Admin writes and reads of the curriculum (M03 #1 to #24). Order of checks follows the mock: a
 * missing record is 404 before the body is validated (422). Every write runs in one transaction.
 */
@Injectable()
export class CurriculumAdminService {
  constructor(
    @Inject(CurriculumRepository) private readonly repo: CurriculumRepository,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(CurriculumPorts) private readonly ports: CurriculumPorts,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  private get counts() {
    return this.ports.questionCounts
  }

  /**
   * One admin write: the change and its audit row (actor, target type and id, request id; no request
   * content) commit together or not at all (`AuditService` joins the open transaction). Races between
   * the pre-checks and the write map to the card's 404 or 422 copy (`translateDbError`).
   */
  private async write<T>(
    actor: AuditActor,
    spec: { action: string; targetType: string; targetId: (result: T) => bigint },
    map: DbErrorMap,
    fn: () => Promise<T>,
  ): Promise<T> {
    try {
      return await this.prisma.transaction(async () => {
        const result = await fn()
        await this.audit.record({
          action: spec.action,
          actorUserId: actor.userId,
          actorRole: actor.role,
          targetType: spec.targetType,
          targetId: idToString(spec.targetId(result)),
          requestId: actor.requestId,
          ip: actor.ip,
          isTest: actor.isTest,
        })
        return result
      })
    } catch (e) {
      return translateDbError(e, map)
    }
  }

  // --- education levels --------------------------------------------------------------------------

  private async requireLevel(rawId: string): Promise<EducationLevel> {
    const id = parseId(rawId)
    const row = id === null ? null : await this.repo.level(id)
    if (!row) throw levelNotFound()
    return row
  }

  async listLevels() {
    const [rows, questionCounts, subjectCounts] = await Promise.all([
      this.repo.levels(),
      this.counts.activeByLevel(),
      this.repo.levelSubjectCounts(),
    ])
    return rows.map((l) => ({
      ...levelView(l),
      questionCount: questionCounts.get(idToString(l.id)) ?? 0,
      subjectCount: subjectCounts.get(l.id) ?? 0,
    }))
  }

  async getLevel(rawId: string) {
    return levelView(await this.requireLevel(rawId))
  }

  private async levelInput(body: unknown, ignoreId: bigint | null) {
    const input = await validateBody(CurriculumEducationLevelWriteSchema, body, [
      {
        field: 'code',
        message: uniqueMessage('code'),
        ok: async (value) => {
          const hit = await this.repo.levelByCode(String(value))
          return !hit || hit.id === ignoreId
        },
      },
    ], { maxValue: INT_BOUNDS })
    return {
      name: must(input.name),
      nameEn: must(input.nameEn),
      code: must(input.code),
      stage: input.stage,
      curriculum: must(input.curriculum),
      sortOrder: input.order ?? 0,
    }
  }

  async createLevel(actor: AuditActor, body: unknown) {
    const input = await this.levelInput(body, null)
    const row = await this.write(
      actor,
      { action: AUDIT_ACTIONS.CURRICULUM_LEVEL_CREATED, targetType: 'education_level', targetId: (r) => r.id },
      { uniqueField: 'code' },
      () => this.repo.createLevel(input, this.clock.now()),
    )
    return { data: levelView(row), status: FLASH.level.created }
  }

  async updateLevel(actor: AuditActor, rawId: string, body: unknown) {
    const current = await this.requireLevel(rawId)
    const input = await this.levelInput(body, current.id)
    const row = await this.write(
      actor,
      { action: AUDIT_ACTIONS.CURRICULUM_LEVEL_UPDATED, targetType: 'education_level', targetId: (r) => r.id },
      { notFound: levelNotFound, uniqueField: 'code' },
      () => this.repo.updateLevel(current.id, input, this.clock.now()),
    )
    return { data: levelView(row), status: FLASH.level.updated }
  }

  async setLevelActive(actor: AuditActor, rawId: string, body: unknown) {
    const current = await this.requireLevel(rawId)
    const isActive = must((await validateBody(CurriculumSetActiveRequestSchema, body)).isActive)
    await this.write(
      actor,
      { action: AUDIT_ACTIONS.CURRICULUM_LEVEL_ACTIVE_CHANGED, targetType: 'education_level', targetId: () => current.id },
      { notFound: levelNotFound },
      () => this.repo.setLevelActive(current.id, isActive, this.clock.now()),
    )
    return { id: idToString(current.id), isActive }
  }

  async deleteLevel(actor: AuditActor, rawId: string) {
    const current = await this.requireLevel(rawId)
    await this.write(
      actor,
      { action: AUDIT_ACTIONS.CURRICULUM_LEVEL_DELETED, targetType: 'education_level', targetId: () => current.id },
      { notFound: levelNotFound },
      async () => {
        // Lock the row, then look for children: a concurrent child insert waits on the lock (FK key-share).
        if (!(await this.repo.lockLevel(current.id))) throw levelNotFound()
        if (await this.repo.levelHasChildren(current.id)) throw hasChildren('level')
        await this.repo.deleteLevel(current.id)
      },
    )
    return { data: { deleted: 1 as const }, status: FLASH.level.deleted }
  }

  // --- subjects ----------------------------------------------------------------------------------

  private async requireSubject(rawId: string): Promise<SubjectWithLevels> {
    const id = parseId(rawId)
    const row = id === null ? null : await this.repo.subject(id)
    if (!row) throw subjectNotFound()
    return row
  }

  async listSubjects() {
    const [rows, levels, questionCounts] = await Promise.all([
      this.repo.subjects(),
      this.repo.levels(),
      this.counts.activeBySubject(),
    ])
    const levelName = new Map(levels.map((l) => [l.id, l.name]))
    return rows.map((s) => ({
      ...subjectView(s),
      questionCount: questionCounts.get(idToString(s.id)) ?? 0,
      levels: s.educationLevelIds.flatMap((id) => {
        const name = levelName.get(id)
        return name === undefined ? [] : [{ id: idToString(id), name }]
      }),
    }))
  }

  async getSubject(rawId: string) {
    return subjectView(await this.requireSubject(rawId))
  }

  /**
   * POST: absent fields take the BR-02 defaults. PUT (`current` given): an absent key keeps the stored
   * value. An empty `icon` is stored as null (no glyph, BR-05).
   */
  private async subjectInput(body: unknown, current: SubjectWithLevels | null) {
    const input = await validateBody(CurriculumSubjectWriteSchema, body, [
      {
        field: 'code',
        message: uniqueMessage('code'),
        ok: async (value) => {
          const hit = await this.repo.subjectByCode(String(value))
          return !hit || hit.id === current?.id
        },
      },
      {
        field: 'educationLevelIds',
        message: existsMessage('educationLevelIds'),
        ok: async (value) => {
          const ids = (value as string[]).map(asId)
          if (ids.some((id) => id === null)) return false
          const known = new Set((await this.repo.levels()).map((l) => l.id))
          return ids.every((id) => known.has(id as bigint))
        },
      },
    ], { maxItems: { educationLevelIds: LIMITS.idList }, maxValue: INT_BOUNDS })
    return {
      name: must(input.name),
      nameEn: must(input.nameEn),
      code: must(input.code),
      icon: input.icon === undefined ? (current ? current.icon : DEFAULT_SUBJECT_ICON) : input.icon,
      color: input.color ?? current?.color ?? DEFAULT_SUBJECT_COLOR,
      isCore: input.isCore ?? current?.isCore ?? false,
      sortOrder: input.order ?? current?.sortOrder ?? 0,
      educationLevelIds: input.educationLevelIds
        ? [...new Set(input.educationLevelIds)].map((id) => asId(id) as bigint)
        : (current?.educationLevelIds ?? []),
    }
  }

  async createSubject(actor: AuditActor, body: unknown) {
    const input = await this.subjectInput(body, null)
    const row = await this.write(
      actor,
      { action: AUDIT_ACTIONS.CURRICULUM_SUBJECT_CREATED, targetType: 'subject', targetId: (r) => r.id },
      { uniqueField: 'code', fkField: 'educationLevelIds' },
      () => this.repo.createSubject(input, this.clock.now()),
    )
    return { data: subjectView(row), status: FLASH.subject.created }
  }

  async updateSubject(actor: AuditActor, rawId: string, body: unknown) {
    const current = await this.requireSubject(rawId)
    const input = await this.subjectInput(body, current)
    const row = await this.write(
      actor,
      { action: AUDIT_ACTIONS.CURRICULUM_SUBJECT_UPDATED, targetType: 'subject', targetId: (r) => r.id },
      { notFound: subjectNotFound, uniqueField: 'code', fkField: 'educationLevelIds' },
      () => this.repo.updateSubject(current.id, input, this.clock.now()),
    )
    return { data: subjectView(row), status: FLASH.subject.updated }
  }

  async setSubjectActive(actor: AuditActor, rawId: string, body: unknown) {
    const current = await this.requireSubject(rawId)
    const isActive = must((await validateBody(CurriculumSetActiveRequestSchema, body)).isActive)
    await this.write(
      actor,
      { action: AUDIT_ACTIONS.CURRICULUM_SUBJECT_ACTIVE_CHANGED, targetType: 'subject', targetId: () => current.id },
      { notFound: subjectNotFound },
      () => this.repo.setSubjectActive(current.id, isActive, this.clock.now()),
    )
    return { id: idToString(current.id), isActive }
  }

  async deleteSubject(actor: AuditActor, rawId: string) {
    const current = await this.requireSubject(rawId)
    await this.write(
      actor,
      { action: AUDIT_ACTIONS.CURRICULUM_SUBJECT_DELETED, targetType: 'subject', targetId: () => current.id },
      { notFound: subjectNotFound },
      async () => {
        if (!(await this.repo.lockSubject(current.id))) throw subjectNotFound()
        if (await this.repo.subjectHasChildren(current.id)) throw hasChildren('subject')
        await this.repo.deleteSubject(current.id)
      },
    )
    return { data: { deleted: 1 as const }, status: FLASH.subject.deleted }
  }

  // --- curriculum tree ---------------------------------------------------------------------------

  /** `GET /admin/curriculum` query: missing is required (422), not a number is an integer error (422). */
  private treeParam(query: Record<string, unknown>, field: string): { value?: bigint; error?: string } {
    const raw = query[field]
    const text = typeof raw === 'string' ? raw.trim() : raw === undefined ? '' : null
    if (text === '') return { error: requiredMessage(field) }
    if (text === null) return { error: integerMessage(field) }
    const id = parseId(text)
    return id === null ? { error: integerMessage(field) } : { value: id }
  }

  async tree(rawQuery: unknown) {
    const query = asRecord(rawQuery)
    const s = this.treeParam(query, 'subjectId')
    const l = this.treeParam(query, 'educationLevelId')
    if (s.error !== undefined || l.error !== undefined) {
      throw ApiError.of('VALIDATION_ERROR', {
        fields: {
          ...(s.error === undefined ? {} : { subjectId: s.error }),
          ...(l.error === undefined ? {} : { educationLevelId: l.error }),
        },
      })
    }
    const subject = await this.repo.subject(s.value as bigint)
    if (!subject) throw subjectNotFound()
    const level = await this.repo.level(l.value as bigint)
    if (!level) throw levelNotFound()
    const chapters = await this.repo.tree(subject.id, level.id)
    const topicCount = chapters.reduce((n, c) => n + c.topics.length, 0)
    const subtopicCount = chapters.reduce((n, c) => n + c.topics.reduce((m, t) => m + t.subtopics.length, 0), 0)
    return {
      subject: { id: idToString(subject.id), name: subject.name },
      level: { id: idToString(level.id), name: level.name },
      stats: { chapters: chapters.length, topics: topicCount, subtopics: subtopicCount },
      chapters: chapters.map((c) => ({
        ...chapterView(c),
        topics: c.topics.map((t) => ({ ...topicView(t), subtopics: t.subtopics.map(subtopicView) })),
      })),
    }
  }

  private async requireChapter(rawId: string): Promise<Chapter> {
    const id = parseId(rawId)
    const row = id === null ? null : await this.repo.chapter(id)
    if (!row) throw chapterNotFound()
    return row
  }

  private async chapterWithContext(c: Chapter): Promise<ChapterDetail> {
    const [subject, level] = await Promise.all([
      this.repo.subject(c.subjectId),
      c.educationLevelId === null ? null : this.repo.level(c.educationLevelId),
    ])
    return {
      ...chapterView(c),
      subject: { id: idToString(c.subjectId), name: subject?.name ?? '' },
      level: { id: idToString(c.educationLevelId as bigint), name: level?.name ?? '' },
    }
  }

  async getChapter(rawId: string) {
    return this.chapterWithContext(await this.requireChapter(rawId))
  }

  private chapterChecks() {
    return [
      {
        field: 'subjectId',
        message: existsMessage('subjectId'),
        ok: async (value: unknown) => {
          const id = asId(value)
          return id !== null && (await this.repo.subject(id)) !== null
        },
      },
      {
        field: 'educationLevelId',
        message: existsMessage('educationLevelId'),
        ok: async (value: unknown) => {
          const id = asId(value)
          return id !== null && (await this.repo.level(id)) !== null
        },
      },
    ]
  }

  /** Which reference of a chapter write vanished: the level or the subject (constraint name). */
  private chapterFkField = (e: unknown): string => {
    const text = `${(e as { message?: unknown }).message ?? ''} ${JSON.stringify((e as { meta?: unknown }).meta ?? {})}`
    return /education_level/i.test(text) ? 'educationLevelId' : 'subjectId'
  }

  async createChapter(actor: AuditActor, body: unknown) {
    const input = await validateBody(CurriculumChapterCreateSchema, body, this.chapterChecks(), CHAPTER_BOUNDS)
    const row = await this.write(
      actor,
      { action: AUDIT_ACTIONS.CURRICULUM_CHAPTER_CREATED, targetType: 'chapter', targetId: (r) => r.id },
      { fkField: this.chapterFkField },
      () =>
        this.repo.createChapter(
          {
            subjectId: asId(input.subjectId) as bigint,
            educationLevelId: asId(input.educationLevelId) as bigint,
            name: must(input.name),
            nameEn: input.nameEn ?? null,
            chapterNumber: input.chapterNumber ?? null,
            description: input.description ?? null,
          },
          this.clock.now(),
        ),
    )
    return { data: chapterView(row), status: FLASH.chapter.created }
  }

  async updateChapter(actor: AuditActor, rawId: string, body: unknown) {
    const current = await this.requireChapter(rawId)
    const input = await validateBody(CurriculumChapterUpdateSchema, body, this.chapterChecks(), CHAPTER_BOUNDS)
    const row = await this.write(
      actor,
      { action: AUDIT_ACTIONS.CURRICULUM_CHAPTER_UPDATED, targetType: 'chapter', targetId: (r) => r.id },
      { notFound: chapterNotFound, fkField: this.chapterFkField },
      () =>
        this.repo.updateChapter(
          current.id,
          {
            subjectId: asId(input.subjectId) as bigint,
            educationLevelId: asId(input.educationLevelId) as bigint,
            name: must(input.name),
            nameEn: input.nameEn ?? null,
            chapterNumber: input.chapterNumber ?? null,
            description: input.description ?? null,
            isActive: input.isActive ?? current.isActive,
          },
          this.clock.now(),
        ),
    )
    return { data: chapterView(row), status: FLASH.chapter.updated }
  }

  async deleteChapter(actor: AuditActor, rawId: string) {
    const current = await this.requireChapter(rawId)
    const deleted = await this.write(
      actor,
      { action: AUDIT_ACTIONS.CURRICULUM_CHAPTER_DELETED, targetType: 'chapter', targetId: () => current.id },
      { notFound: chapterNotFound },
      async () => {
        if (!(await this.repo.lockChapter(current.id))) throw chapterNotFound()
        if (await this.repo.chapterHasTopics(current.id)) throw hasChildren('chapter')
        await this.repo.deleteChapter(current.id)
        // Only an empty chapter is deleted, so no topic or subtopic goes with it.
        return { chapters: 1 as const, topics: 0, subtopics: 0 }
      },
    )
    return { data: { deleted }, status: FLASH.chapter.deleted }
  }

  // --- topics ------------------------------------------------------------------------------------

  private async requireTopic(rawId: string) {
    const id = parseId(rawId)
    const row = id === null ? null : await this.repo.topic(id)
    if (!row) throw topicNotFound()
    return row
  }

  async getTopic(rawId: string): Promise<TopicDetail> {
    const topic = await this.requireTopic(rawId)
    const chapter = await this.repo.chapter(topic.chapterId)
    if (!chapter) throw topicNotFound()
    return { ...topicView(topic), chapter: await this.chapterWithContext(chapter) }
  }

  /** `topicNumber` is free text: a JSON number is read as its text (done by the contract field). */
  async createTopic(actor: AuditActor, body: unknown) {
    const input = await validateBody(
      CurriculumTopicCreateSchema,
      body,
      [
        {
          field: 'chapterId',
          message: existsMessage('chapterId'),
          ok: async (value) => {
            const id = asId(value)
            return id !== null && (await this.repo.chapter(id)) !== null
          },
        },
      ],
      LONG_TEXT_BOUNDS,
    )
    const row = await this.write(
      actor,
      { action: AUDIT_ACTIONS.CURRICULUM_TOPIC_CREATED, targetType: 'topic', targetId: (r) => r.id },
      { fkField: 'chapterId' },
      () =>
        this.repo.createTopic(
          asId(input.chapterId) as bigint,
          {
            name: must(input.name),
            nameEn: input.nameEn ?? null,
            topicNumber: input.topicNumber ?? null,
            description: input.description ?? null,
            learningStandard: input.learningStandard ?? null,
          },
          this.clock.now(),
        ),
    )
    return { data: topicView(row), status: FLASH.topic.created }
  }

  /**
   * The chapter is fixed after creation (BR-07): the mock reads the PUT body without `chapterId`, so
   * a `chapterId` that is sent is accepted and ignored (the only unknown-key exception of M03). Any
   * other key the schema does not know is a 422 like on every write.
   */
  async updateTopic(actor: AuditActor, rawId: string, body: unknown) {
    const current = await this.requireTopic(rawId)
    const input = await validateBody(CurriculumTopicUpdateSchema, body, [], { ...LONG_TEXT_BOUNDS, allow: ['chapterId'] })
    const row = await this.write(
      actor,
      { action: AUDIT_ACTIONS.CURRICULUM_TOPIC_UPDATED, targetType: 'topic', targetId: (r) => r.id },
      { notFound: topicNotFound },
      () =>
        this.repo.updateTopic(
          current.id,
          {
            name: must(input.name),
            nameEn: input.nameEn ?? null,
            topicNumber: input.topicNumber ?? null,
            description: input.description ?? null,
            learningStandard: input.learningStandard ?? null,
            isActive: input.isActive ?? current.isActive,
          },
          this.clock.now(),
        ),
    )
    return { data: topicView(row), status: FLASH.topic.updated }
  }

  async deleteTopic(actor: AuditActor, rawId: string) {
    const current = await this.requireTopic(rawId)
    const deleted = await this.write(
      actor,
      { action: AUDIT_ACTIONS.CURRICULUM_TOPIC_DELETED, targetType: 'topic', targetId: () => current.id },
      { notFound: topicNotFound },
      async () => {
        if (!(await this.repo.lockTopic(current.id))) throw topicNotFound()
        if (await this.repo.topicHasSubtopics(current.id)) throw hasChildren('topic')
        await this.repo.deleteTopic(current.id)
        return { topics: 1 as const, subtopics: 0 }
      },
    )
    return { data: { deleted }, status: FLASH.topic.deleted }
  }

  // --- subtopics ---------------------------------------------------------------------------------

  private async requireSubtopic(rawId: string) {
    const id = parseId(rawId)
    const row = id === null ? null : await this.repo.subtopic(id)
    if (!row) throw subtopicNotFound()
    return row
  }

  async createSubtopic(actor: AuditActor, body: unknown) {
    const input = await validateBody(
      CurriculumSubtopicCreateSchema,
      body,
      [
        {
          field: 'topicId',
          message: existsMessage('topicId'),
          ok: async (value) => {
            const id = asId(value)
            return id !== null && (await this.repo.topic(id)) !== null
          },
        },
      ],
      LONG_TEXT_BOUNDS,
    )
    const row = await this.write(
      actor,
      { action: AUDIT_ACTIONS.CURRICULUM_SUBTOPIC_CREATED, targetType: 'subtopic', targetId: (r) => r.id },
      { fkField: 'topicId' },
      () =>
        this.repo.createSubtopic(
          asId(input.topicId) as bigint,
          { name: must(input.name), nameEn: input.nameEn ?? null, learningObjective: input.learningObjective ?? null },
          this.clock.now(),
        ),
    )
    return { data: subtopicView(row), status: FLASH.subtopic.created }
  }

  async updateSubtopic(actor: AuditActor, rawId: string, body: unknown) {
    const current = await this.requireSubtopic(rawId)
    const input = await validateBody(CurriculumSubtopicUpdateSchema, body, [], LONG_TEXT_BOUNDS)
    const row = await this.write(
      actor,
      { action: AUDIT_ACTIONS.CURRICULUM_SUBTOPIC_UPDATED, targetType: 'subtopic', targetId: (r) => r.id },
      { notFound: subtopicNotFound },
      () =>
        this.repo.updateSubtopic(
          current.id,
          { name: must(input.name), nameEn: input.nameEn ?? null, learningObjective: input.learningObjective ?? null },
          this.clock.now(),
        ),
    )
    return { data: subtopicView(row), status: FLASH.subtopic.updated }
  }

  async deleteSubtopic(actor: AuditActor, rawId: string) {
    const current = await this.requireSubtopic(rawId)
    await this.write(
      actor,
      { action: AUDIT_ACTIONS.CURRICULUM_SUBTOPIC_DELETED, targetType: 'subtopic', targetId: () => current.id },
      { notFound: subtopicNotFound },
      () => this.repo.deleteSubtopic(current.id),
    )
    return { data: { deleted: 1 as const }, status: FLASH.subtopic.deleted }
  }
}
