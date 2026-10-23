import { describe, expect, it } from 'vitest'

import { buildOpenApiDocument } from '../../openapi'
import { ErrorBodySchema } from '../../common/error'
import { CLASSES_COMPONENT_SCHEMAS } from '../paths'
import {
  CLASS_MESSAGES,
  ClassCreateRequestSchema,
  ClassJoinRequestSchema,
  ClassJoinResponseSchema,
  ClassQrDataSchema,
  ClassStudentAddRequestSchema,
  ClassStudentRemoveQuerySchema,
  TeacherChapterCreateRequestSchema,
  TeacherChaptersQuerySchema,
  TeacherStudentsQuerySchema,
  TeacherTopicsQuerySchema,
  TeacherClassSchema,
  TeacherContributionsSchema,
  TeacherDashboardSchema,
  TeacherGallerySchema,
  TeacherStudentSchema,
  TeacherTopicCreateRequestSchema,
  classJoinedText,
} from '../schema'

const klass = {
  id: '501',
  kind: 'classroom',
  teacherId: '7',
  schoolId: '3',
  name: 'Kelas Contoh 4A',
  subjectId: '12',
  subjectName: 'Matematik',
  educationLevel: 'tingkatan-4',
  levelId: '10',
  levelLabel: 'Ting. 4',
  academicYear: 2026,
  description: null,
  joinCode: 'ABC123',
  isActive: true,
  createdAt: '2026-10-16T09:30:00+08:00',
  studentCount: 2,
}

const fieldsOf = (r: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) =>
  Object.fromEntries((r.error?.issues ?? []).map((i) => [String(i.path[0]), i.message]))

describe('TeacherClass', () => {
  it('parses a mock-shaped class and rejects numeric ids, UTC time and a bad slug', () => {
    expect(TeacherClassSchema.safeParse(klass).success).toBe(true)
    expect(TeacherClassSchema.safeParse({ ...klass, id: 501 }).success).toBe(false)
    expect(TeacherClassSchema.safeParse({ ...klass, createdAt: '2026-10-16T01:30:00Z' }).success).toBe(false)
    expect(TeacherClassSchema.safeParse({ ...klass, educationLevel: 'tingkatan-6' }).success).toBe(false)
  })
})

describe('ClassCreateRequest', () => {
  it('accepts the minimal body and trims the name', () => {
    const r = ClassCreateRequestSchema.parse({ name: '  Kelas Contoh  ', subjectId: '12', educationLevel: 'tahun-4' })
    expect(r.name).toBe('Kelas Contoh')
  })
  it('gives the exact BM field messages of the mock', () => {
    expect(fieldsOf(ClassCreateRequestSchema.safeParse({ name: '  ', educationLevel: 'x' }))).toEqual({
      name: CLASS_MESSAGES.className,
      subjectId: CLASS_MESSAGES.subject,
      educationLevel: CLASS_MESSAGES.level,
    })
    expect(
      fieldsOf(
        ClassCreateRequestSchema.safeParse({ name: 'a'.repeat(256), subjectId: '1', educationLevel: 'tahun-1', description: 'x'.repeat(2001) }),
      ),
    ).toEqual({ name: CLASS_MESSAGES.invalid, description: CLASS_MESSAGES.invalid })
  })
})

describe('roster', () => {
  it('parses a student row and the add/remove inputs', () => {
    expect(TeacherStudentSchema.safeParse({ id: '9', name: 'Murid Ujian', levelName: null, classNames: ['Kelas Contoh 4A'] }).success).toBe(true)
    expect(ClassStudentAddRequestSchema.safeParse({ classroomId: '501' }).success).toBe(true)
    expect(fieldsOf(ClassStudentAddRequestSchema.safeParse({}))).toEqual({ classroomId: CLASS_MESSAGES.classroom })
    expect(fieldsOf(ClassStudentRemoveQuerySchema.safeParse({ classroomId: '' }))).toEqual({ classroomId: CLASS_MESSAGES.classroom })
  })
})

describe('dashboard, contributions, qr, gallery', () => {
  it('parses the dashboard and keeps assignments at 0', () => {
    const d = {
      checklist: { hasClass: true, hasStudents: false, hasMission: false },
      stats: { activeClasses: 1, totalClasses: 2, students: 0, questions: 5, questionsApproved: 3, assignments: 0 },
      today: { students: [], topics: [], actions: [] },
      peerTutor: [],
      classes: [{ id: '501', name: 'Kelas Contoh 4A', studentCount: 0 }],
      submissions: [],
    }
    expect(TeacherDashboardSchema.safeParse(d).success).toBe(true)
    expect(TeacherDashboardSchema.safeParse({ ...d, stats: { ...d.stats, assignments: 1 } }).success).toBe(false)
  })
  it('parses contributions with and without a next tier', () => {
    const c = {
      stats: { total: 12, approved: 8, pending: 4, used: 1 },
      tiers: [{ name: 'Penyumbang Baru', threshold: 10, icon: 'fa-seedling', reached: true }],
      nextTier: { name: 'Penyumbang Aktif', threshold: 100 },
      breakdown: [{ label: 'Matematik', count: 12 }],
    }
    expect(TeacherContributionsSchema.safeParse(c).success).toBe(true)
    expect(TeacherContributionsSchema.safeParse({ ...c, nextTier: null }).success).toBe(true)
    expect(TeacherContributionsSchema.safeParse({ ...c, nextTier: undefined }).success).toBe(false)
  })
  it('parses qr data (url required) and both gallery forms', () => {
    expect(ClassQrDataSchema.safeParse({ name: 'K', school: null, joinUrl: 'https://example.test/kelas-saya?kod=ABC123' }).success).toBe(true)
    expect(ClassQrDataSchema.safeParse({ name: 'K', school: null, joinUrl: 'kod' }).success).toBe(false)
    expect(TeacherGallerySchema.safeParse({ folders: [] }).success).toBe(true)
    expect(TeacherGallerySchema.safeParse({ images: [] }).success).toBe(true)
    expect(TeacherGallerySchema.safeParse({}).success).toBe(false)
  })
})

describe('chapters and topics', () => {
  it('validates chapter creation with the mock messages', () => {
    expect(TeacherChapterCreateRequestSchema.safeParse({ name: 'Bab Contoh', chapterNumber: 3, subjectId: '1', educationLevelId: '10' }).success).toBe(true)
    expect(fieldsOf(TeacherChapterCreateRequestSchema.safeParse({ name: '', chapterNumber: 100 }))).toEqual({
      name: CLASS_MESSAGES.chapterName,
      chapterNumber: CLASS_MESSAGES.chapterNumber,
      subjectId: CLASS_MESSAGES.chapterParent,
      educationLevelId: CLASS_MESSAGES.chapterParent,
    })
  })
  it('validates topic creation', () => {
    expect(TeacherTopicCreateRequestSchema.safeParse({ name: 'Topik Contoh', chapterId: '4' }).success).toBe(true)
    expect(fieldsOf(TeacherTopicCreateRequestSchema.safeParse({ name: ' ' }))).toEqual({
      name: CLASS_MESSAGES.topicName,
      chapterId: CLASS_MESSAGES.topicParent,
    })
  })
})

describe('join', () => {
  it('trims the code and rejects a blank one with the mock message', () => {
    expect(ClassJoinRequestSchema.parse({ classCode: ' abc123 ' }).classCode).toBe('abc123')
    expect(fieldsOf(ClassJoinRequestSchema.safeParse({ classCode: '   ' }))).toEqual({ classCode: CLASS_MESSAGES.classCode })
    expect(fieldsOf(ClassJoinRequestSchema.safeParse({}))).toEqual({ classCode: CLASS_MESSAGES.classCode })
  })
  it('parses the 201 body with its message', () => {
    const body = { data: { classroomId: '501' }, message: classJoinedText('Kelas Contoh 4A') }
    expect(ClassJoinResponseSchema.parse(body).message).toBe('Berjaya menyertai kelas Kelas Contoh 4A.')
    expect(ClassJoinResponseSchema.safeParse({ data: { classroomId: '501' } }).success).toBe(false)
  })
  it('parses the 422 error body shape', () => {
    const e = { error: { code: 'VALIDATION_ERROR', message: CLASS_MESSAGES.classCode, fields: { classCode: CLASS_MESSAGES.classCode } } }
    expect(ErrorBodySchema.safeParse(e).success).toBe(true)
  })
})

describe('OpenAPI document', () => {
  const doc = buildOpenApiDocument() as {
    paths: Record<string, Record<string, unknown>>
    components: { schemas: Record<string, unknown> }
  }
  it('contains every BE-17 path and method', () => {
    const expected: [string, string][] = [
      ['/guru/classes', 'get'],
      ['/guru/classes', 'post'],
      ['/guru/classes/{id}/qr-data', 'get'],
      ['/guru/students', 'get'],
      ['/guru/students/{id}', 'put'],
      ['/guru/students/{id}', 'delete'],
      ['/guru/dashboard', 'get'],
      ['/guru/chapters', 'get'],
      ['/guru/chapters', 'post'],
      ['/guru/topics', 'get'],
      ['/guru/topics', 'post'],
      ['/guru/contributions', 'get'],
      ['/guru/galeri-rajah', 'get'],
      ['/kelas-saya', 'get'],
      ['/kelas-saya/join', 'post'],
    ]
    for (const [path, method] of expected) expect(doc.paths[path]?.[method], `${method} ${path}`).toBeDefined()
  })
  it('contains every BE-17 component', () => {
    for (const name of Object.keys(CLASSES_COMPONENT_SCHEMAS)) expect(doc.components.schemas[name], name).toBeDefined()
  })
})

describe('contract is no stricter than the mock', () => {
  it('accepts any tab and any query id string (the mock falls back / answers [])', () => {
    expect(TeacherStudentsQuerySchema.safeParse({ tab: 'whatever', search: 'x' }).success).toBe(true)
    expect(TeacherChaptersQuerySchema.safeParse({ subjectId: 'abc' }).success).toBe(true)
    expect(TeacherTopicsQuerySchema.safeParse({ chapterId: '' }).success).toBe(true)
  })
  it('accepts an empty or null schoolId and a numeric-string chapterNumber', () => {
    const base = { name: 'K', subjectId: '1', educationLevel: 'tahun-1' }
    expect(ClassCreateRequestSchema.safeParse({ ...base, schoolId: '' }).success).toBe(true)
    expect(ClassCreateRequestSchema.safeParse({ ...base, schoolId: null, description: null }).success).toBe(true)
    const ch = { name: 'Bab', subjectId: '1', educationLevelId: '2' }
    expect(TeacherChapterCreateRequestSchema.parse({ ...ch, chapterNumber: '5' }).chapterNumber).toBe(5)
  })
  it('wires the BM message for every other field the mock refuses', () => {
    const base = { name: 'K', subjectId: '1', educationLevel: 'tahun-1' }
    expect(fieldsOf(ClassCreateRequestSchema.safeParse({ ...base, schoolId: 5 }))).toEqual({ schoolId: CLASS_MESSAGES.school })
    expect(fieldsOf(ClassCreateRequestSchema.safeParse({ ...base, description: 5 }))).toEqual({ description: CLASS_MESSAGES.invalid })
    expect(fieldsOf(ClassCreateRequestSchema.safeParse({ ...base, subjectId: '' }))).toEqual({ subjectId: CLASS_MESSAGES.subject })
    const ch = { subjectId: '1', educationLevelId: '2' }
    expect(fieldsOf(TeacherChapterCreateRequestSchema.safeParse({ ...ch, name: 'x'.repeat(256), chapterNumber: 1 }))).toEqual({ name: CLASS_MESSAGES.chapterName })
    expect(fieldsOf(TeacherChapterCreateRequestSchema.safeParse({ ...ch, name: 'Bab' }))).toEqual({ chapterNumber: CLASS_MESSAGES.chapterNumber })
    expect(fieldsOf(TeacherChapterCreateRequestSchema.safeParse({ ...ch, name: 'Bab', chapterNumber: 0 }))).toEqual({ chapterNumber: CLASS_MESSAGES.chapterNumber })
    expect(fieldsOf(TeacherChapterCreateRequestSchema.safeParse({ ...ch, name: 'Bab', chapterNumber: 1.5 }))).toEqual({ chapterNumber: CLASS_MESSAGES.chapterNumber })
    expect(fieldsOf(TeacherTopicCreateRequestSchema.safeParse({ name: 'x'.repeat(256), chapterId: '1' }))).toEqual({ name: CLASS_MESSAGES.topicName })
  })
})
