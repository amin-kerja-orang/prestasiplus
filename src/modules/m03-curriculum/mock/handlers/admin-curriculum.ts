/**
 * SRS v1.10 §7 #13–#24: the admin curriculum tree (S1–S5). All `AD`: a guest gets 401, any other
 * role 403.
 *
 * | # | Route | Success |
 * |---|---|---|
 * | 13 | `GET /api/admin/curriculum?subjectId=&educationLevelId=` | 200 `{data: {subject, level, stats, chapters}}`; 422 missing/invalid param; 404 unknown subject/level |
 * | 14 | `GET /api/admin/curriculum/chapters/:id` | 200 `{data: Chapter + {subject, level}}`; 404 "Bab tidak dijumpai." |
 * | 15 | `POST /api/admin/curriculum/chapters` | 201 `{data: Chapter, status}`; 422 |
 * | 16 | `PUT /api/admin/curriculum/chapters/:id` | 200 `{data, status}`; 404; 422 |
 * | 17 | `DELETE /api/admin/curriculum/chapters/:id` | 200 `{data: {deleted: {chapters, topics, subtopics}}, status}`; 404 |
 * | 18 | `GET /api/admin/curriculum/topics/:id` | 200 `{data: Topic + {chapter: Chapter + {subject, level}}}`; 404 "Topik tidak dijumpai." |
 * | 19 | `POST /api/admin/curriculum/topics` | 201 `{data, status}`; 422 (incl. unknown chapter) |
 * | 20 | `PUT /api/admin/curriculum/topics/:id` | 200 `{data, status}`; 404; 422 |
 * | 21 | `DELETE /api/admin/curriculum/topics/:id` | 200 `{data: {deleted: {topics, subtopics}}, status}`; 404 |
 * | 22 | `POST /api/admin/curriculum/subtopics` | 201 `{data, status}`; 422 |
 * | 23 | `PUT /api/admin/curriculum/subtopics/:id` | 200 `{data, status}`; 404; 422 |
 * | 24 | `DELETE /api/admin/curriculum/subtopics/:id` | 200 `{data: {deleted: 1}, status}`; 404 |
 *
 * Counts come from the repository's own rows (BR-06: stats include inactive records). Question
 * counts do not appear on these screens.
 */

import {
  created,
  int,
  max,
  notFound,
  ok,
  queryString,
  required,
  route,
  rule,
  validationError,
  validationErrors,
  type RouteDef,
} from '@/mock/define'

import { curriculumRepo } from '../repository/curriculum'
import type { ChapterRow } from '../repository/types'
import {
  adminOnly,
  asBoolean,
  asInt,
  atLeast,
  CHAPTER_NOT_FOUND,
  FLASH,
  idParam,
  intOrNull,
  isBoolean,
  isInteger,
  isString,
  LEVEL_NOT_FOUND,
  normalise,
  SUBJECT_NOT_FOUND,
  SUBTOPIC_NOT_FOUND,
  TOPIC_NOT_FOUND,
  textOrNull,
} from './admin-common'

interface Ref {
  id: number
  name: string
}

function subjectRef(id: number): Ref {
  const s = curriculumRepo.subject(id)
  return { id, name: s?.name ?? '' }
}

function levelRef(id: number | null): Ref {
  const l = id === null ? undefined : curriculumRepo.level(id)
  return { id: id ?? 0, name: l?.name ?? '' }
}

function chapterWithContext(c: ChapterRow) {
  return { ...c, subject: subjectRef(c.subjectId), level: levelRef(c.educationLevelId) }
}

const subjectExists = () =>
  rule('exists', (v) =>
    asInt(v) !== undefined && curriculumRepo.subject(asInt(v) as number)
      ? null
      : 'The selected :attribute is invalid.',
  )
const levelExists = () =>
  rule('exists', (v) =>
    asInt(v) !== undefined && curriculumRepo.level(asInt(v) as number)
      ? null
      : 'The selected :attribute is invalid.',
  )
const chapterExists = () =>
  rule('exists', (v) =>
    asInt(v) !== undefined && curriculumRepo.chapter(asInt(v) as number)
      ? null
      : 'The selected :attribute is invalid.',
  )
const topicExists = () =>
  rule('exists', (v) =>
    asInt(v) !== undefined && curriculumRepo.topic(asInt(v) as number)
      ? null
      : 'The selected :attribute is invalid.',
  )

/** `topicNumber` is free text (BR-07): a JSON number is read as its text. */
function normaliseTopicBody(body: unknown): Record<string, unknown> {
  const out = normalise(body)
  if (typeof out.topicNumber === 'number') out.topicNumber = String(out.topicNumber)
  return out
}

const chapterFields = () => ({
  subjectId: [required(), isInteger(), subjectExists()],
  educationLevelId: [required(), isInteger(), levelExists()],
  name: [required(), isString(), max(255)],
  nameEn: [isString(), max(255)],
  chapterNumber: [isInteger(), atLeast(1)],
  description: [isString()],
})

const topicFields = () => ({
  name: [required(), isString(), max(255)],
  nameEn: [isString(), max(255)],
  topicNumber: [isString(), max(20)],
  description: [isString()],
  learningStandard: [isString()],
})

const subtopicFields = () => ({
  name: [required(), isString(), max(255)],
  nameEn: [isString(), max(255)],
  learningObjective: [isString()],
})

function chapterInput(body: Record<string, unknown>) {
  return {
    subjectId: asInt(body.subjectId) as number,
    educationLevelId: asInt(body.educationLevelId) as number,
    name: body.name as string,
    nameEn: textOrNull(body.nameEn),
    chapterNumber: intOrNull(body.chapterNumber),
    description: textOrNull(body.description),
  }
}

function topicInput(body: Record<string, unknown>) {
  return {
    name: body.name as string,
    nameEn: textOrNull(body.nameEn),
    topicNumber: textOrNull(body.topicNumber),
    description: textOrNull(body.description),
    learningStandard: textOrNull(body.learningStandard),
  }
}

function subtopicInput(body: Record<string, unknown>) {
  return {
    name: body.name as string,
    nameEn: textOrNull(body.nameEn),
    learningObjective: textOrNull(body.learningObjective),
  }
}

/** #13 query parameter: missing → required; present but not a number → integer error. */
function treeParam(raw: string | undefined, label: string): { value?: number; error?: string } {
  if (raw === undefined || raw.trim() === '') return { error: `The ${label} field is required.` }
  const n = asInt(raw)
  return n === undefined ? { error: `The ${label} field must be an integer.` } : { value: n }
}

export const adminCurriculumRoutes: RouteDef[] = [
  route('GET', '/api/admin/curriculum', [adminOnly], (req) => {
    const s = treeParam(queryString(req.query, 'subjectId'), 'subject id')
    const l = treeParam(queryString(req.query, 'educationLevelId'), 'education level id')
    if (s.error !== undefined || l.error !== undefined) {
      return validationError({
        ...(s.error === undefined ? {} : { subjectId: s.error }),
        ...(l.error === undefined ? {} : { educationLevelId: l.error }),
      })
    }
    const subject = curriculumRepo.subject(s.value as number)
    if (!subject) return notFound(SUBJECT_NOT_FOUND)
    const level = curriculumRepo.level(l.value as number)
    if (!level) return notFound(LEVEL_NOT_FOUND)
    const { stats, chapters } = curriculumRepo.tree(subject.id, level.id)
    return ok({
      subject: { id: subject.id, name: subject.name },
      level: { id: level.id, name: level.name },
      stats,
      chapters,
    })
  }),

  // --- chapters -----------------------------------------------------------------------------
  route(
    'GET',
    '/api/admin/curriculum/chapters/:id',
    [adminOnly],
    (req) => {
      const chapter = curriculumRepo.chapter(idParam(req))
      return chapter ? ok(chapterWithContext(chapter)) : notFound(CHAPTER_NOT_FOUND)
    },
    { params: { id: int() } },
  ),

  route('POST', '/api/admin/curriculum/chapters', [adminOnly], (req, ctx) => {
    const body = normalise(req.body)
    const fields = validationErrors(body, chapterFields())
    if (fields) return validationError(fields)
    const chapter = curriculumRepo.createChapter(chapterInput(body), ctx.clock.now())
    return created(chapter, { status: FLASH.chapter.created })
  }),

  route(
    'PUT',
    '/api/admin/curriculum/chapters/:id',
    [adminOnly],
    (req, ctx) => {
      const id = idParam(req)
      const current = curriculumRepo.chapter(id)
      if (!current) return notFound(CHAPTER_NOT_FOUND)
      const body = normalise(req.body)
      const fields = validationErrors(body, { ...chapterFields(), isActive: [isBoolean()] })
      if (fields) return validationError(fields)
      // INFERRED: an absent `isActive` keeps the stored value (the screen always sends it).
      const isActive = asBoolean(body.isActive) ?? current.isActive
      const chapter = curriculumRepo.updateChapter(
        id,
        { ...chapterInput(body), isActive },
        ctx.clock.now(),
      )
      return chapter ? ok(chapter, { status: FLASH.chapter.updated }) : notFound(CHAPTER_NOT_FOUND)
    },
    { params: { id: int() } },
  ),

  route(
    'DELETE',
    '/api/admin/curriculum/chapters/:id',
    [adminOnly],
    (req) => {
      const deleted = curriculumRepo.deleteChapter(idParam(req))
      return deleted
        ? ok({ deleted }, { status: FLASH.chapter.deleted })
        : notFound(CHAPTER_NOT_FOUND)
    },
    { params: { id: int() } },
  ),

  // --- topics -------------------------------------------------------------------------------
  route(
    'GET',
    '/api/admin/curriculum/topics/:id',
    [adminOnly],
    (req) => {
      const topic = curriculumRepo.topic(idParam(req))
      const chapter = topic ? curriculumRepo.chapter(topic.chapterId) : undefined
      if (!topic || !chapter) return notFound(TOPIC_NOT_FOUND)
      return ok({ ...topic, chapter: chapterWithContext(chapter) })
    },
    { params: { id: int() } },
  ),

  route('POST', '/api/admin/curriculum/topics', [adminOnly], (req, ctx) => {
    const body = normaliseTopicBody(req.body)
    const fields = validationErrors(body, {
      chapterId: [required(), isInteger(), chapterExists()],
      ...topicFields(),
    })
    if (fields) return validationError(fields)
    const topic = curriculumRepo.createTopic(
      { chapterId: asInt(body.chapterId) as number, ...topicInput(body) },
      ctx.clock.now(),
    )
    return created(topic, { status: FLASH.topic.created })
  }),

  route(
    'PUT',
    '/api/admin/curriculum/topics/:id',
    [adminOnly],
    (req, ctx) => {
      const id = idParam(req)
      const current = curriculumRepo.topic(id)
      if (!current) return notFound(TOPIC_NOT_FOUND)
      const body = normaliseTopicBody(req.body)
      const fields = validationErrors(body, { ...topicFields(), isActive: [isBoolean()] })
      if (fields) return validationError(fields)
      // `chapterId` is fixed after creation (BR-07) and ignored here.
      const isActive = asBoolean(body.isActive) ?? current.isActive
      const topic = curriculumRepo.updateTopic(
        id,
        { ...topicInput(body), isActive },
        ctx.clock.now(),
      )
      return topic ? ok(topic, { status: FLASH.topic.updated }) : notFound(TOPIC_NOT_FOUND)
    },
    { params: { id: int() } },
  ),

  route(
    'DELETE',
    '/api/admin/curriculum/topics/:id',
    [adminOnly],
    (req) => {
      const deleted = curriculumRepo.deleteTopic(idParam(req))
      return deleted ? ok({ deleted }, { status: FLASH.topic.deleted }) : notFound(TOPIC_NOT_FOUND)
    },
    { params: { id: int() } },
  ),

  // --- subtopics ----------------------------------------------------------------------------
  route('POST', '/api/admin/curriculum/subtopics', [adminOnly], (req, ctx) => {
    const body = normalise(req.body)
    const fields = validationErrors(body, {
      topicId: [required(), isInteger(), topicExists()],
      ...subtopicFields(),
    })
    if (fields) return validationError(fields)
    const subtopic = curriculumRepo.createSubtopic(
      { topicId: asInt(body.topicId) as number, ...subtopicInput(body) },
      ctx.clock.now(),
    )
    return created(subtopic, { status: FLASH.subtopic.created })
  }),

  route(
    'PUT',
    '/api/admin/curriculum/subtopics/:id',
    [adminOnly],
    (req, ctx) => {
      const id = idParam(req)
      if (!curriculumRepo.subtopic(id)) return notFound(SUBTOPIC_NOT_FOUND)
      const body = normalise(req.body)
      const fields = validationErrors(body, subtopicFields())
      if (fields) return validationError(fields)
      const subtopic = curriculumRepo.updateSubtopic(id, subtopicInput(body), ctx.clock.now())
      return subtopic
        ? ok(subtopic, { status: FLASH.subtopic.updated })
        : notFound(SUBTOPIC_NOT_FOUND)
    },
    { params: { id: int() } },
  ),

  route(
    'DELETE',
    '/api/admin/curriculum/subtopics/:id',
    [adminOnly],
    (req) => {
      if (!curriculumRepo.deleteSubtopic(idParam(req))) return notFound(SUBTOPIC_NOT_FOUND)
      return ok({ deleted: 1 }, { status: FLASH.subtopic.deleted })
    },
    { params: { id: int() } },
  ),
]
