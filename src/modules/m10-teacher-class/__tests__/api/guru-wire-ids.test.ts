import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createHttpTransport, installTransport } from '@/api'

import {
  addStudentToClass,
  createChapter,
  createContributedQuestion,
  createGuruClass,
  createTopic,
} from '../../api/guru'
import type { CreateQuestionRequest } from '../../api/types'

/**
 * DEMO-FIX-1 D-01: `POST /api/guru/classes` sends `subjectId` / `schoolId` as string ids on the wire
 * (`ClassCreateRequestSchema`); a number was 422 "Sila pilih subjek.". Mock mode keeps the value.
 */

let sent: { url: string; body: unknown }[] = []

beforeEach(() => {
  sent = []
  installTransport(
    createHttpTransport({
      fetch: (input, init) => {
        sent.push({
          url: input as string,
          body: JSON.parse((init?.body as string | undefined) ?? 'null'),
        })
        return Promise.resolve(
          new Response(JSON.stringify({ data: { id: '9' } }), {
            status: 201,
            headers: { 'content-type': 'application/json' },
          }),
        )
      },
    }),
  )
})
afterEach(() => {
  vi.unstubAllEnvs()
})

describe('createGuruClass wire ids', () => {
  it('http mode: subjectId and schoolId go out as strings', async () => {
    vi.stubEnv('VITE_API_MODE', 'http')
    await createGuruClass({
      schoolId: 12,
      name: '5 Bestari',
      subjectId: 3,
      educationLevel: 'tingkatan-5',
      description: null,
    })
    expect(sent).toHaveLength(1)
    expect(sent[0]?.url).toBe('/api/guru/classes')
    expect(sent[0]?.body).toEqual({
      schoolId: '12',
      name: '5 Bestari',
      subjectId: '3',
      educationLevel: 'tingkatan-5',
      description: null,
    })
  })

  it('http mode: a select value string is sent as is; no schoolId key when absent', async () => {
    vi.stubEnv('VITE_API_MODE', 'http')
    await createGuruClass({ name: 'K', subjectId: '3', educationLevel: 'tahun-1' })
    expect(sent[0]?.body).toEqual({ name: 'K', subjectId: '3', educationLevel: 'tahun-1' })
    expect(typeof (sent[0]?.body as { subjectId: unknown }).subjectId).toBe('string')
  })

  it('http mode: a null schoolId stays null', async () => {
    vi.stubEnv('VITE_API_MODE', 'http')
    await createGuruClass({ schoolId: null, name: 'K', subjectId: 3, educationLevel: 'tahun-1' })
    expect(sent[0]?.body).toMatchObject({ schoolId: null, subjectId: '3' })
  })

  it('mock mode: the values are unchanged', async () => {
    vi.stubEnv('VITE_API_MODE', 'mock')
    await createGuruClass({ schoolId: 12, name: 'K', subjectId: 3, educationLevel: 'tahun-1' })
    expect(sent[0]?.body).toEqual({
      schoolId: 12,
      name: 'K',
      subjectId: 3,
      educationLevel: 'tahun-1',
    })
  })
})

/**
 * SW5-01: `PUT /api/guru/students/:id` sends `classroomId` as a string id on the wire
 * (`ClassStudentAddRequestSchema`); a number was 422 "Kelas tidak sah.". Mock mode keeps the value.
 */
describe('addStudentToClass wire ids', () => {
  it('http mode: classroomId goes out as a string (number or string input)', async () => {
    vi.stubEnv('VITE_API_MODE', 'http')
    await addStudentToClass(3001, { classroomId: 15 })
    await addStudentToClass(3001, { classroomId: '15' })
    expect(sent).toHaveLength(2)
    expect(sent[0]?.url).toBe('/api/guru/students/3001')
    expect(sent[0]?.body).toEqual({ classroomId: '15' })
    expect(sent[1]?.body).toEqual({ classroomId: '15' })
  })

  it('http mode: an id beyond Number.MAX_SAFE_INTEGER is sent exactly as given (opaque id)', async () => {
    vi.stubEnv('VITE_API_MODE', 'http')
    await addStudentToClass(3001, { classroomId: '9007199254740993' })
    expect(sent[0]?.body).toEqual({ classroomId: '9007199254740993' })
  })

  it('mock mode: the number is unchanged', async () => {
    vi.stubEnv('VITE_API_MODE', 'mock')
    await addStudentToClass(3001, { classroomId: 15 })
    expect(sent[0]?.body).toEqual({ classroomId: 15 })
  })
})

describe('createChapter / createTopic wire ids', () => {
  it('http mode: subjectId, educationLevelId and chapterId go out as strings', async () => {
    vi.stubEnv('VITE_API_MODE', 'http')
    await createChapter({ subjectId: 3, educationLevelId: 4, name: 'Bab Baru', chapterNumber: 9 })
    await createTopic({ chapterId: 12, name: 'Topik Baru' })
    expect(sent[0]?.url).toBe('/api/guru/chapters')
    expect(sent[0]?.body).toEqual({
      subjectId: '3',
      educationLevelId: '4',
      name: 'Bab Baru',
      chapterNumber: 9,
    })
    expect(sent[1]?.url).toBe('/api/guru/topics')
    expect(sent[1]?.body).toEqual({ chapterId: '12', name: 'Topik Baru' })
  })

  it('mock mode: the numbers are unchanged', async () => {
    vi.stubEnv('VITE_API_MODE', 'mock')
    await createChapter({ subjectId: 3, educationLevelId: 4, name: 'Bab Baru', chapterNumber: 9 })
    await createTopic({ chapterId: 12, name: 'Topik Baru' })
    expect(sent[0]?.body).toEqual({
      subjectId: 3,
      educationLevelId: 4,
      name: 'Bab Baru',
      chapterNumber: 9,
    })
    expect(sent[1]?.body).toEqual({ chapterId: 12, name: 'Topik Baru' })
  })
})

/**
 * SW7-08: `POST /api/guru/questions` (the JSON path, no image) sends `educationLevelId`, `subjectId`
 * and the optional chapter / topic / SP ids as string ids (`QuestionGuruCreateRequestSchema`); a
 * number was 422 "Sila pilih tahap pendidikan." / "Sila pilih subjek." / "Bab tidak sah.".
 */
describe('createContributedQuestion wire ids', () => {
  const base: CreateQuestionRequest = {
    educationLevelId: 4,
    subjectId: 3,
    questionType: 'mcq',
    difficultyLevel: 'easy',
    questionText: 'Soalan ujian?',
    options: ['a', 'b', 'c', 'd'],
    correctAnswer: 1,
    scriptType: 'rumi',
    dskpSpId: 7,
    curriculumChapterId: 12,
    curriculumTopicId: 21,
  }

  it('http mode: the five ids go out as strings; other fields are untouched', async () => {
    vi.stubEnv('VITE_API_MODE', 'http')
    await createContributedQuestion(base)
    expect(sent).toHaveLength(1)
    expect(sent[0]?.url).toBe('/api/guru/questions')
    expect(sent[0]?.body).toEqual({
      ...base,
      educationLevelId: '4',
      subjectId: '3',
      dskpSpId: '7',
      curriculumChapterId: '12',
      curriculumTopicId: '21',
    })
  })

  it('http mode: null ids stay null and absent ids stay absent', async () => {
    vi.stubEnv('VITE_API_MODE', 'http')
    await createContributedQuestion({
      ...base,
      dskpSpId: null,
      curriculumChapterId: null,
      curriculumTopicId: null,
    })
    const nulls = sent[0]?.body as Record<string, unknown>
    expect(nulls).toMatchObject({
      educationLevelId: '4',
      subjectId: '3',
      dskpSpId: null,
      curriculumChapterId: null,
      curriculumTopicId: null,
    })

    const bare: CreateQuestionRequest = { ...base }
    delete bare.dskpSpId
    delete bare.curriculumChapterId
    delete bare.curriculumTopicId
    await createContributedQuestion(bare)
    const absent = sent[1]?.body as Record<string, unknown>
    expect(absent).toMatchObject({ educationLevelId: '4', subjectId: '3' })
    expect('dskpSpId' in absent).toBe(false)
    expect('curriculumChapterId' in absent).toBe(false)
    expect('curriculumTopicId' in absent).toBe(false)
  })

  it('mock mode: the values are unchanged (numbers and nulls)', async () => {
    vi.stubEnv('VITE_API_MODE', 'mock')
    await createContributedQuestion(base)
    await createContributedQuestion({ ...base, dskpSpId: null, curriculumChapterId: null })
    expect(sent[0]?.body).toEqual(base)
    expect(sent[1]?.body).toMatchObject({
      educationLevelId: 4,
      subjectId: 3,
      dskpSpId: null,
      curriculumChapterId: null,
      curriculumTopicId: 21,
    })
  })
})
