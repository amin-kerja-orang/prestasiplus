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

import { ApiError } from '../../common/errors/api-error'
import { CLOCK, type Clock } from '../../db/clock'
import { idToString } from '../../db/ids'
import { PrismaService } from '../../db/prisma.service'
import { CurriculumRepository, type Chapter, type EducationLevel, type SubjectWithLevels } from './curriculum.repository'
import {
  chapterNotFound,
  levelNotFound,
  subjectNotFound,
  subtopicNotFound,
  topicNotFound,
  uniqueViolationAs422,
} from './errors'
import type { ChapterDetail, TopicDetail } from './types'
import { QUESTION_COUNT_PROVIDER, type QuestionCountProvider } from './providers'
import { asRecord, existsMessage, integerMessage, parseId, requiredMessage, uniqueMessage, validateBody } from './validation'
import { chapterView, levelView, subjectView, subtopicView, topicView } from './views'

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
    @Inject(QUESTION_COUNT_PROVIDER) private readonly counts: QuestionCountProvider,
  ) {}

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
    ])
    return {
      name: must(input.name),
      nameEn: must(input.nameEn),
      code: must(input.code),
      stage: input.stage,
      curriculum: must(input.curriculum),
      sortOrder: input.order ?? 0,
    }
  }

  async createLevel(body: unknown) {
    const input = await this.levelInput(body, null)
    try {
      const row = await this.repo.createLevel(input, this.clock.now())
      return { data: levelView(row), status: FLASH.level.created }
    } catch (e) {
      return uniqueViolationAs422(e, 'code')
    }
  }

  async updateLevel(rawId: string, body: unknown) {
    const current = await this.requireLevel(rawId)
    const input = await this.levelInput(body, current.id)
    try {
      const row = await this.repo.updateLevel(current.id, input, this.clock.now())
      return { data: levelView(row), status: FLASH.level.updated }
    } catch (e) {
      return uniqueViolationAs422(e, 'code')
    }
  }

  async setLevelActive(rawId: string, body: unknown) {
    const current = await this.requireLevel(rawId)
    const isActive = must((await validateBody(CurriculumSetActiveRequestSchema, body)).isActive)
    await this.repo.setLevelActive(current.id, isActive, this.clock.now())
    return { id: idToString(current.id), isActive }
  }

  async deleteLevel(rawId: string) {
    const current = await this.requireLevel(rawId)
    await this.repo.deleteLevel(current.id)
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
    ])
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

  async createSubject(body: unknown) {
    const input = await this.subjectInput(body, null)
    try {
      const row = await this.prisma.transaction(() => this.repo.createSubject(input, this.clock.now()))
      return { data: subjectView(row), status: FLASH.subject.created }
    } catch (e) {
      return uniqueViolationAs422(e, 'code')
    }
  }

  async updateSubject(rawId: string, body: unknown) {
    const current = await this.requireSubject(rawId)
    const input = await this.subjectInput(body, current)
    try {
      const row = await this.prisma.transaction(() => this.repo.updateSubject(current.id, input, this.clock.now()))
      return { data: subjectView(row), status: FLASH.subject.updated }
    } catch (e) {
      return uniqueViolationAs422(e, 'code')
    }
  }

  async setSubjectActive(rawId: string, body: unknown) {
    const current = await this.requireSubject(rawId)
    const isActive = must((await validateBody(CurriculumSetActiveRequestSchema, body)).isActive)
    await this.repo.setSubjectActive(current.id, isActive, this.clock.now())
    return { id: idToString(current.id), isActive }
  }

  async deleteSubject(rawId: string) {
    const current = await this.requireSubject(rawId)
    await this.repo.deleteSubject(current.id)
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

  async createChapter(body: unknown) {
    const input = await validateBody(CurriculumChapterCreateSchema, body, this.chapterChecks())
    const row = await this.repo.createChapter(
      {
        subjectId: asId(input.subjectId) as bigint,
        educationLevelId: asId(input.educationLevelId) as bigint,
        name: must(input.name),
        nameEn: input.nameEn ?? null,
        chapterNumber: input.chapterNumber ?? null,
        description: input.description ?? null,
      },
      this.clock.now(),
    )
    return { data: chapterView(row), status: FLASH.chapter.created }
  }

  async updateChapter(rawId: string, body: unknown) {
    const current = await this.requireChapter(rawId)
    const input = await validateBody(CurriculumChapterUpdateSchema, body, this.chapterChecks())
    const row = await this.repo.updateChapter(
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
    )
    return { data: chapterView(row), status: FLASH.chapter.updated }
  }

  async deleteChapter(rawId: string) {
    const current = await this.requireChapter(rawId)
    const deleted = await this.prisma.transaction(async () => {
      const counts = await this.repo.countTopicsOfChapter(current.id)
      await this.repo.deleteChapter(current.id)
      return { chapters: 1 as const, ...counts }
    })
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
  async createTopic(body: unknown) {
    const input = await validateBody(CurriculumTopicCreateSchema, body, [
      {
        field: 'chapterId',
        message: existsMessage('chapterId'),
        ok: async (value) => {
          const id = asId(value)
          return id !== null && (await this.repo.chapter(id)) !== null
        },
      },
    ])
    const row = await this.repo.createTopic(
      asId(input.chapterId) as bigint,
      {
        name: must(input.name),
        nameEn: input.nameEn ?? null,
        topicNumber: input.topicNumber ?? null,
        description: input.description ?? null,
        learningStandard: input.learningStandard ?? null,
      },
      this.clock.now(),
    )
    return { data: topicView(row), status: FLASH.topic.created }
  }

  /** The chapter is fixed after creation (BR-07): a `chapterId` in the body is ignored. */
  async updateTopic(rawId: string, body: unknown) {
    const current = await this.requireTopic(rawId)
    const input = await validateBody(CurriculumTopicUpdateSchema, body)
    const row = await this.repo.updateTopic(
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
    )
    return { data: topicView(row), status: FLASH.topic.updated }
  }

  async deleteTopic(rawId: string) {
    const current = await this.requireTopic(rawId)
    const deleted = await this.prisma.transaction(async () => {
      const subtopics = await this.repo.countSubtopicsOfTopic(current.id)
      await this.repo.deleteTopic(current.id)
      return { topics: 1 as const, subtopics }
    })
    return { data: { deleted }, status: FLASH.topic.deleted }
  }

  // --- subtopics ---------------------------------------------------------------------------------

  private async requireSubtopic(rawId: string) {
    const id = parseId(rawId)
    const row = id === null ? null : await this.repo.subtopic(id)
    if (!row) throw subtopicNotFound()
    return row
  }

  async createSubtopic(body: unknown) {
    const input = await validateBody(CurriculumSubtopicCreateSchema, body, [
      {
        field: 'topicId',
        message: existsMessage('topicId'),
        ok: async (value) => {
          const id = asId(value)
          return id !== null && (await this.repo.topic(id)) !== null
        },
      },
    ])
    const row = await this.repo.createSubtopic(
      asId(input.topicId) as bigint,
      { name: must(input.name), nameEn: input.nameEn ?? null, learningObjective: input.learningObjective ?? null },
      this.clock.now(),
    )
    return { data: subtopicView(row), status: FLASH.subtopic.created }
  }

  async updateSubtopic(rawId: string, body: unknown) {
    const current = await this.requireSubtopic(rawId)
    const input = await validateBody(CurriculumSubtopicUpdateSchema, body)
    const row = await this.repo.updateSubtopic(
      current.id,
      { name: must(input.name), nameEn: input.nameEn ?? null, learningObjective: input.learningObjective ?? null },
      this.clock.now(),
    )
    return { data: subtopicView(row), status: FLASH.subtopic.updated }
  }

  async deleteSubtopic(rawId: string) {
    const current = await this.requireSubtopic(rawId)
    await this.repo.deleteSubtopic(current.id)
    return { data: { deleted: 1 as const }, status: FLASH.subtopic.deleted }
  }
}
