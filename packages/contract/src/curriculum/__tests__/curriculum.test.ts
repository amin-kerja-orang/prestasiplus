import { describe, expect, it } from 'vitest'

import { buildOpenApiDocument } from '../../openapi'
import { CURRICULUM_COMPONENT_SCHEMAS } from '../paths'
import {
  CURRICULUM_FLASH_MESSAGES,
  CURRICULUM_CONFLICT_MESSAGES,
  CURRICULUM_NOT_FOUND_MESSAGES,
  CurriculumChapterCreateSchema,
  CurriculumChapterDeletedSchema,
  CurriculumChapterSchema,
  CurriculumEducationLevelSchema,
  CurriculumEducationLevelWriteSchema,
  CurriculumLearningMapSchema,
  CurriculumNodeSchema,
  CurriculumSetActiveRequestSchema,
  CurriculumSubjectSchema,
  CurriculumSubjectWriteSchema,
  CurriculumSubtopicCreateSchema,
  CurriculumTopicCardSchema,
  CurriculumTopicCreateSchema,
  CurriculumTopicUpdateSchema,
  CurriculumTpSchema,
  CurriculumTreeQuerySchema,
  CurriculumTreeSchema,
  curriculumStatusEnvelopeOf,
} from '../schema'

const ts = '2026-10-16T09:30:00+08:00'
const level = {
  id: '11', code: 'D1', name: 'Darjah 1', nameEn: 'Year 1', stage: 'primary', curriculum: 'KSSR',
  order: 1, isActive: true, grade: 1, createdAt: ts, updatedAt: ts,
}
const subject = {
  id: '5', code: 'UJI', name: 'Subjek Ujian', nameEn: 'Test Subject', icon: null, color: '#4f46e5',
  isCore: true, order: 0, isActive: true, educationLevelIds: ['11'], createdAt: ts, updatedAt: ts,
}
const chapter = {
  id: '100', subjectId: '5', educationLevelId: '11', name: 'Bab Ujian', nameEn: null, chapterNumber: 1,
  description: null, strand: null, dskpCode: null, inTree: true, isActive: true, createdAt: ts, updatedAt: ts,
}
const topic = {
  id: '200', chapterId: '100', name: 'Topik Ujian', nameEn: null, topicNumber: '1.1', description: null,
  learningStandard: null, isActive: true, createdAt: ts, updatedAt: ts,
}
const subtopic = { id: '300', topicId: '200', name: 'Subtopik', nameEn: null, learningObjective: null, createdAt: ts, updatedAt: ts }

describe('curriculum contract: responses', () => {
  it('parses mock-shaped entities with string ids', () => {
    expect(CurriculumEducationLevelSchema.safeParse(level).success).toBe(true)
    expect(CurriculumSubjectSchema.safeParse(subject).success).toBe(true)
    expect(CurriculumChapterSchema.safeParse(chapter).success).toBe(true)
  })

  it('rejects numeric ids, bad stage, non-MYT timestamps and bad colour', () => {
    expect(CurriculumEducationLevelSchema.safeParse({ ...level, id: 11 }).success).toBe(false)
    expect(CurriculumEducationLevelSchema.safeParse({ ...level, stage: 'tertiary' }).success).toBe(false)
    expect(CurriculumEducationLevelSchema.safeParse({ ...level, grade: 12 }).success).toBe(false)
    expect(CurriculumEducationLevelSchema.safeParse({ ...level, createdAt: '2026-10-16T01:30:00Z' }).success).toBe(false)
    expect(CurriculumSubjectSchema.safeParse({ ...subject, color: 'blue' }).success).toBe(false)
  })

  it('parses the tree with nested topics and subtopics', () => {
    const tree = {
      subject: { id: '5', name: 'Subjek Ujian' },
      level: { id: '11', name: 'Darjah 1' },
      stats: { chapters: 1, topics: 1, subtopics: 1 },
      chapters: [{ ...chapter, topics: [{ ...topic, subtopics: [subtopic] }] }],
    }
    expect(CurriculumTreeSchema.safeParse(tree).success).toBe(true)
    expect(CurriculumTreeSchema.safeParse({ ...tree, stats: { chapters: 1 } }).success).toBe(false)
  })

  it('parses the status envelope and cascade counts', () => {
    const env = curriculumStatusEnvelopeOf(CurriculumChapterSchema)
    expect(env.safeParse({ data: chapter, status: CURRICULUM_FLASH_MESSAGES.chapter.created }).success).toBe(true)
    expect(env.safeParse({ data: chapter }).success).toBe(false)
    expect(CurriculumChapterDeletedSchema.safeParse({ deleted: { chapters: 1, topics: 3, subtopics: 7 } }).success).toBe(true)
    expect(CurriculumChapterDeletedSchema.safeParse({ deleted: 1 }).success).toBe(false)
  })

  it('parses learner shapes', () => {
    const card = {
      id: '1', gradeLevel: 'DARJAH_4', subject: 'MATEMATIK', subjectLabel: 'MATEMATIK', name: 'Nombor',
      description: null, subtopicCount: 4, subtopicsPreview: ['a', 'b', 'c'],
    }
    expect(CurriculumTopicCardSchema.safeParse(card).success).toBe(true)
    expect(CurriculumTopicCardSchema.safeParse({ ...card, gradeLevel: 'DARJAH_9' }).success).toBe(false)
    const map = {
      subject: 'MATEMATIK', subjectLabel: 'Matematik', grade: 'DARJAH_4', gradeOptions: ['DARJAH_4'],
      subjects: [{ code: 'MATEMATIK', label: 'Matematik', emoji: 'x', color: '#3B82F6' }],
      stats: { done: 0, total: 2, progress: 0 },
      topics: [
        { id: '1', name: 'A', icon: null, state: 'unlocked', progress: 0, sessions: 0, questionsAnswered: 0, practiceUrl: '/practice?topic_id=1' },
        { id: '2', name: 'B', icon: null, state: 'locked', progress: 0, sessions: 0, questionsAnswered: 0, practiceUrl: null },
      ],
    }
    expect(CurriculumLearningMapSchema.safeParse(map).success).toBe(true)
    expect(CurriculumLearningMapSchema.safeParse({ ...map, topics: [{ ...map.topics[0], state: 'open' }] }).success).toBe(false)
  })

  it('parses a DSKP node and bounds TP to 1..6', () => {
    const node = {
      id: '9', subjectId: '5', educationLevelId: '11', kind: 'sp', code: '1.1.3', title: 'Tajuk', titlePrinted: null,
      parentId: '8', order: 0, edition: 'Contoh 2018', isElective: false,
    }
    expect(CurriculumNodeSchema.safeParse(node).success).toBe(true)
    expect(CurriculumNodeSchema.safeParse({ ...node, kind: 'chapter' }).success).toBe(false)
    expect(CurriculumTpSchema.safeParse(6).success).toBe(true)
    expect(CurriculumTpSchema.safeParse(0).success).toBe(false)
    expect(CurriculumTpSchema.safeParse(7).success).toBe(false)
  })
})

describe('curriculum contract: requests', () => {
  it('level write: code max 10, stage enum, order >= 0', () => {
    const ok = { name: 'Darjah 1', nameEn: 'Year 1', code: 'D1', stage: 'primary', curriculum: 'KSSR' }
    expect(CurriculumEducationLevelWriteSchema.safeParse(ok).success).toBe(true)
    expect(CurriculumEducationLevelWriteSchema.safeParse({ ...ok, code: 'ABCDEFGHIJK' }).success).toBe(false)
    expect(CurriculumEducationLevelWriteSchema.safeParse({ ...ok, order: -1 }).success).toBe(false)
    expect(CurriculumEducationLevelWriteSchema.safeParse({ ...ok, name: '' }).success).toBe(false)
  })

  it('subject write: only name, nameEn, code required; colour #RRGGBB', () => {
    const ok = { name: 'Subjek', nameEn: 'Subject', code: 'UJI' }
    expect(CurriculumSubjectWriteSchema.safeParse(ok).success).toBe(true)
    expect(CurriculumSubjectWriteSchema.safeParse({ ...ok, icon: null, color: '#112233', educationLevelIds: ['1'] }).success).toBe(true)
    expect(CurriculumSubjectWriteSchema.safeParse({ ...ok, color: '#12' }).success).toBe(false)
    expect(CurriculumSubjectWriteSchema.safeParse({ ...ok, code: 'X'.repeat(21) }).success).toBe(false)
    expect(CurriculumSubjectWriteSchema.safeParse({ name: 'Subjek' }).success).toBe(false)
  })

  it('chapter, topic and active bodies', () => {
    expect(CurriculumChapterCreateSchema.safeParse({ subjectId: '5', educationLevelId: '11', name: 'Bab' }).success).toBe(true)
    expect(CurriculumChapterCreateSchema.safeParse({ subjectId: '5', educationLevelId: '11', name: 'Bab', chapterNumber: 0 }).success).toBe(false)
    expect(CurriculumChapterCreateSchema.safeParse({ subjectId: '5', name: 'Bab' }).success).toBe(false)
    expect(CurriculumTopicCreateSchema.safeParse({ chapterId: '100', name: 'Topik', topicNumber: '1.2' }).success).toBe(true)
    expect(CurriculumTopicCreateSchema.safeParse({ name: 'Topik' }).success).toBe(false)
    expect(CurriculumTopicUpdateSchema.safeParse({ name: 'Topik', topicNumber: 'x'.repeat(21) }).success).toBe(false)
    expect(CurriculumSetActiveRequestSchema.safeParse({ isActive: false }).success).toBe(true)
    expect(CurriculumSetActiveRequestSchema.safeParse({}).success).toBe(false)
    expect(CurriculumTreeQuerySchema.safeParse({ subjectId: '5' }).success).toBe(false)
  })

  it('keeps the exact BM copy of the mock', () => {
    expect(CURRICULUM_NOT_FOUND_MESSAGES.chapter).toBe('Bab tidak dijumpai.')
    expect(CURRICULUM_NOT_FOUND_MESSAGES.level).toBe('Tahap Pendidikan tidak dijumpai.')
    expect(CURRICULUM_FLASH_MESSAGES.level.deleted).toBe('Tahap Pendidikan berjaya dipadam.')
    expect(CURRICULUM_FLASH_MESSAGES.subtopic.created).toBe('Subtopik berjaya ditambah.')
  })
})

describe('curriculum contract: OpenAPI', () => {
  const doc = buildOpenApiDocument() as {
    paths: Record<string, Record<string, unknown>>
    components: { schemas: Record<string, unknown> }
  }
  const expected: [string, string][] = [
    ['get', '/education-levels'], ['get', '/subjects'], ['get', '/topics'], ['get', '/topics/{id}'], ['get', '/learning-map'],
    ['get', '/admin/education-levels'], ['get', '/admin/education-levels/{id}'], ['post', '/admin/education-levels'],
    ['put', '/admin/education-levels/{id}'], ['patch', '/admin/education-levels/{id}/active'], ['delete', '/admin/education-levels/{id}'],
    ['get', '/admin/subjects'], ['get', '/admin/subjects/{id}'], ['post', '/admin/subjects'],
    ['put', '/admin/subjects/{id}'], ['patch', '/admin/subjects/{id}/active'], ['delete', '/admin/subjects/{id}'],
    ['get', '/admin/curriculum'], ['get', '/admin/curriculum/chapters/{id}'], ['post', '/admin/curriculum/chapters'],
    ['put', '/admin/curriculum/chapters/{id}'], ['delete', '/admin/curriculum/chapters/{id}'],
    ['get', '/admin/curriculum/topics/{id}'], ['post', '/admin/curriculum/topics'], ['put', '/admin/curriculum/topics/{id}'],
    ['delete', '/admin/curriculum/topics/{id}'], ['post', '/admin/curriculum/subtopics'],
    ['put', '/admin/curriculum/subtopics/{id}'], ['delete', '/admin/curriculum/subtopics/{id}'],
  ]

  it('contains all 29 M03 operations', () => {
    expect(expected).toHaveLength(29)
    for (const [method, path] of expected) expect(doc.paths[path]?.[method], `${method} ${path}`).toBeDefined()
  })

  it('documents 409 on the four deletes that can have children and 429 with Retry-After on every admin write', () => {
    const responses = (method: string, path: string) =>
      (doc.paths[path]?.[method] as { responses: Record<string, { headers?: Record<string, unknown> }> }).responses
    const withChildren = ['/admin/education-levels/{id}', '/admin/subjects/{id}', '/admin/curriculum/chapters/{id}', '/admin/curriculum/topics/{id}']
    for (const path of withChildren) expect(responses('delete', path)['409'], path).toBeDefined()
    expect(responses('delete', '/admin/curriculum/subtopics/{id}')['409']).toBeUndefined()
    for (const [method, path] of expected) {
      const r = responses(method, path)
      if (method === 'get' || !path.startsWith('/admin')) {
        expect(r['429'], `${method} ${path}`).toBeUndefined()
      } else {
        expect(r['429'], `${method} ${path}`).toBeDefined()
        expect(r['429']?.headers?.['Retry-After'], `${method} ${path}`).toBeDefined()
      }
    }
    expect(CURRICULUM_CONFLICT_MESSAGES.chapter).toBe('Bab ini masih mempunyai topik.')
  })

  it('contains every curriculum component', () => {
    for (const name of Object.keys(CURRICULUM_COMPONENT_SCHEMAS)) expect(doc.components.schemas[name], name).toBeDefined()
  })

  it('never exposes legacy columns or createdSeq', () => {
    const text = JSON.stringify(doc)
    expect(text).not.toMatch(/legacy_(source|id)/)
    expect(JSON.stringify(doc.components.schemas.CurriculumChapter)).not.toContain('createdSeq')
  })
})

/** First message per top-level field, like the mock's `fields`. */
function fieldsOf(schema: { safeParse: (v: unknown) => { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } } }, input: unknown) {
  const r = schema.safeParse(input)
  const out: Record<string, string> = {}
  for (const i of r.error?.issues ?? []) {
    const k = String(i.path[0])
    if (!(k in out)) out[k] = i.message
  }
  return out
}

describe('curriculum contract: mock coercion and exact 422 copy', () => {
  it('trims strings, turns blanks into null and reads numbers as text', () => {
    const r = CurriculumTopicCreateSchema.parse({ chapterId: ' 7 ', name: '  Topik  ', nameEn: '   ', topicNumber: 1.2 })
    expect(r).toMatchObject({ chapterId: '7', name: 'Topik', nameEn: null, topicNumber: '1.2' })
  })

  it('accepts digit strings for integers and 1/0 for booleans', () => {
    const r = CurriculumSubjectWriteSchema.parse({
      name: 'S', nameEn: 'S', code: 'UJI', order: '3', isCore: '1', educationLevelIds: [1, '2'],
    })
    expect(r).toMatchObject({ order: 3, isCore: true, educationLevelIds: ['1', '2'] })
    expect(CurriculumSetActiveRequestSchema.parse({ isActive: 0 })).toEqual({ isActive: false })
    expect(CurriculumSetActiveRequestSchema.parse({ isActive: '1' })).toEqual({ isActive: true })
    expect(CurriculumChapterCreateSchema.parse({ subjectId: 5, educationLevelId: '11', name: 'B', chapterNumber: '2' })).toMatchObject({
      subjectId: '5', chapterNumber: 2,
    })
  })

  it('level: required, string, max, stage and integer copy', () => {
    expect(fieldsOf(CurriculumEducationLevelWriteSchema, {})).toEqual({
      name: 'The name field is required.',
      nameEn: 'The name en field is required.',
      code: 'The code field is required.',
      stage: 'The stage field is required.',
      curriculum: 'The curriculum field is required.',
    })
    const bad = { name: 5, nameEn: 'x'.repeat(256), code: 'ABCDEFGHIJK', stage: 'tertiary', curriculum: '  ', order: -1 }
    expect(fieldsOf(CurriculumEducationLevelWriteSchema, bad)).toEqual({
      name: 'The name field must be a string.',
      nameEn: 'The name en field must not be greater than 255 characters.',
      code: 'The code field must not be greater than 10 characters.',
      stage: 'The selected stage is invalid.',
      curriculum: 'The curriculum field is required.',
      order: 'The order field must be at least 0.',
    })
    expect(fieldsOf(CurriculumEducationLevelWriteSchema, { ...bad, order: 1.5 }).order).toBe('The order field must be an integer.')
  })

  it('subject: colour, boolean, array and invalid-level copy', () => {
    const ok = { name: 'S', nameEn: 'S', code: 'UJI' }
    expect(fieldsOf(CurriculumSubjectWriteSchema, { ...ok, color: 'blue', isCore: 'ya', educationLevelIds: 'x', icon: 3 })).toEqual({
      color: 'The color field format is invalid.',
      isCore: 'The is core field must be true or false.',
      educationLevelIds: 'The education level ids field must be an array.',
      icon: 'The icon field must be a string.',
    })
    expect(fieldsOf(CurriculumSubjectWriteSchema, { ...ok, educationLevelIds: [{}] }).educationLevelIds).toBe(
      'The selected education level ids is invalid.',
    )
  })

  it('active toggle, tree query, chapter, topic and subtopic copy', () => {
    expect(fieldsOf(CurriculumSetActiveRequestSchema, {})).toEqual({ isActive: 'The is active field is required.' })
    expect(fieldsOf(CurriculumSetActiveRequestSchema, { isActive: 'maybe' })).toEqual({
      isActive: 'The is active field must be true or false.',
    })
    expect(fieldsOf(CurriculumTreeQuerySchema, {})).toEqual({
      subjectId: 'The subject id field is required.',
      educationLevelId: 'The education level id field is required.',
    })
    expect(fieldsOf(CurriculumChapterCreateSchema, { chapterNumber: 0, description: 4 })).toEqual({
      subjectId: 'The subject id field is required.',
      educationLevelId: 'The education level id field is required.',
      name: 'The name field is required.',
      chapterNumber: 'The chapter number field must be at least 1.',
      description: 'The description field must be a string.',
    })
    expect(fieldsOf(CurriculumTopicCreateSchema, { topicNumber: 'x'.repeat(21) })).toEqual({
      chapterId: 'The chapter id field is required.',
      name: 'The name field is required.',
      topicNumber: 'The topic number field must not be greater than 20 characters.',
    })
    expect(fieldsOf(CurriculumSubtopicCreateSchema, {})).toEqual({
      topicId: 'The topic id field is required.',
      name: 'The name field is required.',
    })
    expect(fieldsOf(CurriculumTopicUpdateSchema, { name: 'T', isActive: 'x' })).toEqual({
      isActive: 'The is active field must be true or false.',
    })
  })
})
