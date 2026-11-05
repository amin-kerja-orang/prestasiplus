import { describe, expect, it } from 'vitest'

import { buildOpenApiDocument } from '../../../openapi'
import { QUESTION_MESSAGES } from '../../../questions/schema'
import {
  GURU_SET_MESSAGES,
  GuruSetBankQuerySchema,
  GuruSetBankResponseSchema,
  GuruSetCopyRequestSchema,
  GuruSetListResponseSchema,
  GuruSetResultsResponseSchema,
  GuruSetUpsertRequestSchema,
  QuestionSetSchema,
} from '../schema'

const fieldsOf = (r: { error?: { issues: { path: PropertyKey[]; message: string }[] } }) =>
  Object.fromEntries((r.error?.issues ?? []).map((i) => [String(i.path[0]), i.message]))

const ok = { title: ' Ujian 1 ', subjectId: '3', questionIds: ['1'], classroomIds: [], status: 'draft' }
const ids = (n: number) => Array.from({ length: n }, (_, i) => String(i + 1))
const meta = { page: 1, pageSize: 20, totalItems: 0, totalPages: 1, from: null, to: null }

describe('GuruSetUpsertRequest', () => {
  it('accepts a draft without classes and trims the title', () => {
    expect(GuruSetUpsertRequestSchema.parse(ok).title).toBe('Ujian 1')
    expect(GuruSetUpsertRequestSchema.parse({ ...ok, classroomIds: undefined }).classroomIds).toEqual([])
    expect(GuruSetUpsertRequestSchema.safeParse({ ...ok, educationLevelId: null, status: 'published', questionIds: ids(100) }).success).toBe(true)
  })
  it('refuses 101 questions, none, an empty title and a long title', () => {
    expect(fieldsOf(GuruSetUpsertRequestSchema.safeParse({ ...ok, questionIds: ids(101) }))).toEqual({ questionIds: GURU_SET_MESSAGES.questionsTooMany })
    expect(fieldsOf(GuruSetUpsertRequestSchema.safeParse({ ...ok, questionIds: [] }))).toEqual({ questionIds: GURU_SET_MESSAGES.questionsRequired })
    expect(fieldsOf(GuruSetUpsertRequestSchema.safeParse({ ...ok, title: '   ' }))).toEqual({ title: GURU_SET_MESSAGES.titleRequired })
    expect(fieldsOf(GuruSetUpsertRequestSchema.safeParse({ ...ok, title: 'a'.repeat(151) }))).toEqual({ title: GURU_SET_MESSAGES.titleTooLong })
    expect(GuruSetUpsertRequestSchema.safeParse({ ...ok, title: 'a'.repeat(150) }).success).toBe(true)
  })
  it('refuses a missing subject and a bad status', () => {
    expect(fieldsOf(GuruSetUpsertRequestSchema.safeParse({ ...ok, subjectId: '' }))).toEqual({ subjectId: GURU_SET_MESSAGES.subjectRequired })
    expect(GuruSetUpsertRequestSchema.safeParse({ ...ok, status: 'scheduled' }).success).toBe(false)
  })
})

describe('copy, bank query, messages', () => {
  it('copy needs at least one class', () => {
    expect(fieldsOf(GuruSetCopyRequestSchema.safeParse({ classroomIds: [] }))).toEqual({ classroomIds: 'Sila pilih kelas sasaran.' })
    expect(GuruSetCopyRequestSchema.safeParse({ classroomIds: ['5'] }).success).toBe(true)
  })
  it('bank q needs 2 characters', () => {
    expect(fieldsOf(GuruSetBankQuerySchema.safeParse({ q: 'a' }))).toEqual({ q: 'Taip sekurang-kurangnya 2 aksara.' })
    expect(GuruSetBankQuerySchema.safeParse({ q: 'ab', subjectId: '1', cursor: 'x' }).success).toBe(true)
    expect(GuruSetBankQuerySchema.safeParse({}).success).toBe(true)
  })
  it('reuses groupSplit and keeps the PRD copy', () => {
    expect(GURU_SET_MESSAGES.groupSplit).toBe(QUESTION_MESSAGES.groupSplit)
    expect(GURU_SET_MESSAGES.copySuffix).toBe(' (Salinan)')
    expect(GURU_SET_MESSAGES.locked).toBe('Soalan tidak boleh diubah kerana pelajar telah menjawab set ini.')
  })
})

describe('responses', () => {
  const set = {
    id: '9', title: 'T', status: 'published', subjectId: '3', educationLevelId: null, questionIds: ['1'], classroomIds: ['5'],
    locked: false, createdAt: '2026-11-05T09:00:00+08:00', updatedAt: '2026-11-05T09:00:00+08:00',
  }
  it('parses detail, list, results and bank', () => {
    expect(QuestionSetSchema.safeParse(set).success).toBe(true)
    expect(GuruSetListResponseSchema.safeParse({ data: { rows: [], counters: { published: 0, draft: 0, participation: 0 }, summary: { total: 0, siap: 0 } }, meta }).success).toBe(true)
    expect(GuruSetResultsResponseSchema.safeParse({
      data: { summary: { penyertaan: 1, skorPurata: 80, jumlahPercubaan: 1 }, rows: [{ pupil: { id: '2', name: 'Murid Contoh' }, correct: 4, total: 5, accuracy: 80, attemptedAt: '2026-11-05T09:00:00+08:00' }] },
      meta,
    }).success).toBe(true)
    expect(GuruSetResultsResponseSchema.safeParse({ data: { summary: { penyertaan: 0, skorPurata: null, jumlahPercubaan: 0 }, rows: [] }, meta }).success).toBe(true)
    expect(GuruSetBankResponseSchema.safeParse({
      data: { units: [{ kind: 'question', id: '1', questionIds: ['1'], preview: 'Soalan...', subject: 'Sains', level: 'Tingkatan 4', difficulty: 2, stimulus: null }], nextCursor: null },
    }).success).toBe(true)
    expect(GuruSetBankResponseSchema.safeParse({
      data: { units: [{ kind: 'question', id: '1', questionIds: ['1'], preview: 'x', subject: 'S', level: 'L', difficulty: 6, stimulus: null }], nextCursor: null },
    }).success).toBe(false)
  })
})

describe('OpenAPI registration', () => {
  it('lists the 9 teacher set operations and PUT /guru/classes/{id}', () => {
    const doc = buildOpenApiDocument() as { paths: Record<string, Record<string, unknown>> }
    expect(Object.keys(doc.paths['/guru/question-sets'] ?? {}).sort()).toEqual(['get', 'post'])
    expect(Object.keys(doc.paths['/guru/question-sets/{id}'] ?? {}).sort()).toEqual(['delete', 'get', 'put'])
    expect(doc.paths['/guru/question-sets/bank']?.get).toBeDefined()
    expect(doc.paths['/guru/question-sets/{id}/status']?.post).toBeDefined()
    expect(doc.paths['/guru/question-sets/{id}/copy']?.post).toBeDefined()
    expect(doc.paths['/guru/question-sets/{id}/results']?.get).toBeDefined()
    expect(doc.paths['/guru/classes/{id}']?.put).toBeDefined()
  })
})
