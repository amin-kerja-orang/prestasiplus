import { describe, expect, it } from 'vitest'

import { buildOpenApiDocument } from '../../../openapi'
import { MISSIONS_COMPONENT_SCHEMAS } from '../paths'
import {
  MISSION_TYPE_LABELS,
  MISSION_GOAL_KINDS,
  MissionTodayResponseSchema,
  MissionTodaySchema,
  REMEDIAL_MESSAGES,
  RemedialCancelRequestSchema,
  RemedialCancelResponseSchema,
  RemedialGenerateFieldErrorSchema,
  RemedialGenerateRefusedSchema,
  RemedialGenerateRequestSchema,
  RemedialGenerateResponseSchema,
  RemedialMineResponseSchema,
  RemedialNotYourStudentSchema,
  RemedialPreviewSchema,
  RemedialProgressSchema,
  RemedialScanSchema,
  RemedialTestNotActiveSchema,
  RemedialTestNotFoundSchema,
  MISSION_MESSAGES,
  TeacherMissionCreateSchema,
  TeacherMissionListResponseSchema,
} from '../schema'

const meta = (n: number) => ({
  page: 1,
  pageSize: Math.max(1, n),
  totalItems: n,
  totalPages: 1,
  from: n > 0 ? 1 : null,
  to: n > 0 ? n : null,
})
const at = '2026-10-19T08:00:00+08:00'

/** Messages per field of a failed parse, first issue per field (as the mock reports). */
function fieldMessages(result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) {
  const out: Record<string, string> = {}
  for (const i of result.error?.issues ?? []) {
    const key = String(i.path[0])
    out[key] ??= i.message
  }
  return out
}

describe('missions today (student read)', () => {
  const row = {
    id: '7001',
    title: 'Misi Harian 19/10/2026',
    typeLabel: MISSION_TYPE_LABELS.latih_tubi,
    subjectName: 'Kimia',
    questionCount: 10,
    coinsPerCorrect: 3,
    resourceTitle: null,
    resourceUrl: null,
    resourceNote: null,
    status: 'new',
  }

  it('parses the mock shape and carries no answer key or question list', () => {
    const body = { data: [row, { ...row, id: '7002', status: 'in_progress', resourceUrl: 'https://contoh.example/a' }], meta: meta(2) }
    expect(MissionTodayResponseSchema.safeParse(body).success).toBe(true)
    expect(Object.keys(MISSIONS_COMPONENT_SCHEMAS.MissionToday.shape).filter((k) => /^(correct|answer|questionIds|questions$)/i.test(k))).toEqual([])
  })

  it('accepts an empty list and rejects an unknown status', () => {
    expect(MissionTodayResponseSchema.safeParse({ data: [], meta: meta(0) }).success).toBe(true)
    expect(MissionTodayResponseSchema.safeParse({ data: [{ ...row, status: 'done' }], meta: meta(1) }).success).toBe(false)
  })

  it('has the three observed type labels', () => {
    expect(MISSION_TYPE_LABELS).toEqual({ latih_tubi: 'Latih Tubi SPM', tracking_a: 'Tracking A', youtube: 'Soalan & Rujukan', harian: 'Misi Harian' })
  })
})

describe('remedial student reads', () => {
  it('mine: active and completed only, with teacherName and totalQuestions', () => {
    const item = { id: '7601', subjectName: 'Kimia', totalQuestions: 10, status: 'active', createdAt: at, teacherName: 'Cikgu Contoh' }
    expect(RemedialMineResponseSchema.safeParse({ data: [item], meta: meta(1) }).success).toBe(true)
    expect(RemedialMineResponseSchema.safeParse({ data: [{ ...item, status: 'cancelled' }], meta: meta(1) }).success).toBe(false)
    expect(RemedialMineResponseSchema.safeParse({ data: [{ ...item, createdAt: '2026-10-19T00:00:00Z' }], meta: meta(1) }).success).toBe(false)
  })

  it('preview (owner teacher or admin only) carries the answer key by design', () => {
    const preview = {
      id: '7601',
      subjectName: 'Kimia',
      status: 'active',
      totalQuestions: 1,
      createdAt: at,
      teacherName: 'Cikgu Contoh',
      studentName: 'Murid Contoh',
      questions: [
        {
          id: '501',
          questionText: 'Soalan contoh?',
          textDirection: 'ltr',
          scriptType: 'rumi',
          options: [
            { id: 0, label: 'A', text: 'Satu' },
            { id: 1, label: 'B', text: 'Dua' },
          ],
          correctOptionId: 1,
        },
      ],
    }
    expect(RemedialPreviewSchema.safeParse(preview).success).toBe(true)
    // documented security note: the key is present only in the teacher/admin preview
    const doc = buildOpenApiDocument() as { paths: Record<string, { get: { description: string } }> }
    expect(doc.paths['/remedial-tests/{id}']?.get.description).toMatch(/SECURITY/)
    expect(doc.paths['/remedial-tests/mine']?.get.description).not.toMatch(/correct/)
  })
})

describe('remedial progress and scan (bare bodies)', () => {
  it('progress parses rows with a null afterAccuracy and a negative improvement', () => {
    const body = {
      stats: { total: 2, completed: 1, students: 2, avgImprovement: -5 },
      rows: [
        { id: '7601', studentName: 'Murid Contoh', subjectName: 'Kimia', status: 'completed', beforeAccuracy: 40.5, afterAccuracy: 35.5 },
        { id: '7602', studentName: 'Murid Lain', subjectName: 'Fizik', status: 'cancelled', beforeAccuracy: 30, afterAccuracy: null },
      ],
    }
    expect(RemedialProgressSchema.safeParse(body).success).toBe(true)
    expect(RemedialProgressSchema.safeParse({ data: body }).success).toBe(false)
  })

  it('scan parses weak students and existing tests', () => {
    const body = {
      weakStudents: [
        { studentId: '3008', name: 'Murid Contoh', weakTopics: [{ subject: 'Kimia', topicName: 'Asid dan Bes', accuracy: 33.3 }], weakestAccuracy: 33.3 },
      ],
      existingRemedials: [{ id: '7601', studentId: '3008', status: 'completed', totalQuestions: 10, afterAccuracy: 60 }],
    }
    expect(RemedialScanSchema.safeParse(body).success).toBe(true)
    expect(RemedialScanSchema.safeParse({ ...body, existingRemedials: [{ ...body.existingRemedials[0], status: 'cancelled' }] }).success).toBe(false)
  })
})

describe('remedial generate and cancel: request copy per field', () => {
  it('accepts numbers, digit strings and opaque ids for studentId; subject is trimmed', () => {
    for (const studentId of [3008, '3008', ' 3008 ', 'stu-9f2c']) {
      const r = RemedialGenerateRequestSchema.safeParse({ studentId, subject: '  Kimia ' })
      expect(r.success).toBe(true)
    }
    expect(RemedialGenerateRequestSchema.parse({ studentId: 1, subject: '  Kimia ' }).subject).toBe('Kimia')
  })

  it('wires the exact message of each failing field and reports both together', () => {
    for (const studentId of [undefined, null, 0, -4, '', '   ', true]) {
      const r = RemedialGenerateRequestSchema.safeParse({ studentId, subject: 'CHEM' })
      expect(fieldMessages(r)).toEqual({ studentId: REMEDIAL_MESSAGES.studentId })
    }
    for (const subject of [undefined, '', '   ', 7]) {
      const r = RemedialGenerateRequestSchema.safeParse({ studentId: 1, subject })
      expect(fieldMessages(r)).toEqual({ subject: REMEDIAL_MESSAGES.subject })
    }
    expect(fieldMessages(RemedialGenerateRequestSchema.safeParse({}))).toEqual({
      studentId: 'ID pelajar tidak sah.',
      subject: 'Sila pilih subjek.',
    })
  })

  it('cancel: quizId message', () => {
    expect(RemedialCancelRequestSchema.safeParse({ quizId: 7601 }).success).toBe(true)
    expect(RemedialCancelRequestSchema.safeParse({ quizId: '7601' }).success).toBe(true)
    for (const quizId of [undefined, 0, '', ' ']) {
      expect(fieldMessages(RemedialCancelRequestSchema.safeParse({ quizId }))).toEqual({ quizId: 'ID ujian tidak sah.' })
    }
  })

  it('exports the mock copy verbatim', () => {
    expect(REMEDIAL_MESSAGES).toEqual({
      noQuestions: 'Tiada soalan untuk topik lemah',
      noSubject: 'Subjek tidak sah.',
      alreadyOpen: 'Ujian remedial aktif sudah wujud untuk pelajar ini. Batalkan dahulu.',
      notYourStudent: 'Pelajar ini bukan murid anda.',
      testNotFound: 'Ujian remedial tidak dijumpai.',
      testNotActive: 'Ujian remedial ini tidak aktif.',
      studentId: 'ID pelajar tidak sah.',
      subject: 'Sila pilih subjek.',
      quizId: 'ID ujian tidak sah.',
    })
  })
})

describe('remedial generate and cancel: responses and typed refusals', () => {
  const err = (code: string, message: string, fields?: Record<string, string>) => ({ error: { code, message, ...(fields ? { fields } : {}) } })

  it('success bodies are bare', () => {
    expect(RemedialGenerateResponseSchema.safeParse({ quizId: '7610', totalQuestions: 10 }).success).toBe(true)
    expect(RemedialCancelResponseSchema.safeParse({ success: true }).success).toBe(true)
    expect(RemedialCancelResponseSchema.safeParse({ success: false }).success).toBe(false)
  })

  it('pins code, message and field of each state-dependent refusal', () => {
    // 422 with fields (unknown subject), and the two without fields
    expect(RemedialGenerateFieldErrorSchema.safeParse(err('VALIDATION_ERROR', 'Subjek tidak sah.', { subject: 'Subjek tidak sah.' })).success).toBe(true)
    expect(RemedialGenerateFieldErrorSchema.safeParse(err('VALIDATION_ERROR', 'x', { subject: 'Lain.' })).success).toBe(false)
    expect(RemedialGenerateRefusedSchema.safeParse(err('VALIDATION_ERROR', REMEDIAL_MESSAGES.alreadyOpen)).success).toBe(true)
    expect(RemedialGenerateRefusedSchema.safeParse(err('VALIDATION_ERROR', REMEDIAL_MESSAGES.noQuestions)).success).toBe(true)
    expect(RemedialGenerateRefusedSchema.safeParse(err('VALIDATION_ERROR', 'Tiada soalan.')).success).toBe(false)
    // 403, 404, 409
    expect(RemedialNotYourStudentSchema.safeParse(err('FORBIDDEN', 'Pelajar ini bukan murid anda.')).success).toBe(true)
    expect(RemedialNotYourStudentSchema.safeParse(err('FORBIDDEN', 'Lain.')).success).toBe(false)
    expect(RemedialTestNotFoundSchema.safeParse(err('NOT_FOUND', 'Ujian remedial tidak dijumpai.')).success).toBe(true)
    expect(RemedialTestNotFoundSchema.safeParse(err('CONFLICT', 'Ujian remedial tidak dijumpai.')).success).toBe(false)
    expect(RemedialTestNotActiveSchema.safeParse(err('CONFLICT', 'Ujian remedial ini tidak aktif.')).success).toBe(true)
  })
})

describe('OpenAPI registration', () => {
  const doc = buildOpenApiDocument() as {
    paths: Record<string, Record<string, { responses: Record<string, unknown> }>>
    components: { schemas: Record<string, unknown> }
  }

  it('contains the BE-18 missions and remedial paths with the mock status codes', () => {
    expect(Object.keys(doc.paths['/missions/today'] ?? {})).toEqual(['get'])
    expect(Object.keys(doc.paths['/remedial-tests/mine'] ?? {})).toEqual(['get'])
    expect(Object.keys(doc.paths['/remedial-tests/{id}'] ?? {})).toEqual(['get'])
    expect(Object.keys(doc.paths['/guru/remedial-progress'] ?? {})).toEqual(['get'])
    expect(Object.keys(doc.paths['/guru/command-center/remedial/scan'] ?? {})).toEqual(['get'])
    const generate = doc.paths['/guru/command-center/remedial/generate']?.post
    expect(Object.keys(generate?.responses ?? {}).sort()).toEqual(['201', '401', '403', '422', '429'])
    const cancel = doc.paths['/guru/command-center/remedial/cancel']?.post
    expect(Object.keys(cancel?.responses ?? {}).sort()).toEqual(['200', '401', '403', '404', '409', '422', '429'])
  })

  it('registers every component and no legacy column', () => {
    for (const name of Object.keys(MISSIONS_COMPONENT_SCHEMAS)) expect(doc.components.schemas[name]).toBeDefined()
    expect(JSON.stringify(doc)).not.toMatch(/legacy_/)
  })
})

describe('D57 rate limit and removed provisional routes', () => {
  const doc = buildOpenApiDocument() as { paths: Record<string, Record<string, { responses: Record<string, { headers?: Record<string, unknown> }> }>> }
  it('declares 429 with a Retry-After header on remedial writes', () => {
    for (const p of ['generate', 'cancel']) {
      const r = doc.paths[`/guru/command-center/remedial/${p}`]?.post?.responses['429']
      expect(r?.headers?.['Retry-After']).toBeDefined()
    }
  })
  it('registers the teacher missions routes (API-GUR-11)', () => {
    expect(Object.keys(doc.paths['/guru/missions'] ?? {}).sort()).toEqual(['get', 'post'])
    expect(Object.keys(doc.paths['/guru/missions/{id}'] ?? {})).toEqual(['delete'])
    expect(Object.keys(MISSIONS_COMPONENT_SCHEMAS)).toContain('TeacherMission')
  })
})

describe('teacher mission create (API-GUR-11)', () => {
  const ok = { title: ' Jawab 10 ', targetQuestions: 10, rewardCoins: 10, date: '2026-11-06', subjectId: '12' }
  it('parses, trims and applies defaults', () => {
    const r = TeacherMissionCreateSchema.parse({ title: ' Jawab 10 ', date: '2026-11-06', subjectId: '12' })
    expect(r).toMatchObject({ title: 'Jawab 10', targetQuestions: 10, rewardCoins: 10 })
    expect(TeacherMissionCreateSchema.safeParse({ ...ok, classroomId: null }).success).toBe(true)
  })
  it('gives the exact BM messages', () => {
    const m = (b: object) => fieldMessages(TeacherMissionCreateSchema.safeParse(b))
    expect(m({ ...ok, title: '  ' }).title).toBe(MISSION_MESSAGES.titleRequired)
    expect(m({ ...ok, title: 'a'.repeat(256) }).title).toBe('Tajuk misi tidak boleh melebihi 255 aksara.')
    expect(m({ ...ok, description: 'a'.repeat(501) }).description).toBe('Keterangan tidak boleh melebihi 500 aksara.')
    expect(m({ ...ok, targetQuestions: 0 }).targetQuestions).toBe('Sasaran soalan mesti antara 1 dan 1000.')
    expect(m({ ...ok, targetQuestions: 1001 }).targetQuestions).toBe('Sasaran soalan mesti antara 1 dan 1000.')
    expect(m({ ...ok, rewardCoins: 101 }).rewardCoins).toBe('Ganjaran syiling mesti antara 0 dan 100.')
    expect(m({ ...ok, rewardCoins: -1 }).rewardCoins).toBe('Ganjaran syiling mesti antara 0 dan 100.')
    expect(m({ ...ok, subjectId: undefined }).subjectId).toBe('Sila pilih subjek.')
    expect(m({ ...ok, subjectId: '' }).subjectId).toBe('Sila pilih subjek.')
    expect(m({ ...ok, date: '2026-02-30' }).date).toBeDefined()
  })
  it('list response parses', () => {
    const row = { id: '1', title: 'T', description: null, targetQuestions: 3, rewardCoins: 15, date: '2026-11-05', classroomId: null, subjectId: null, subjectName: null, global: true, goalKind: 'sessions_per_day', completedCount: 0 }
    expect(TeacherMissionListResponseSchema.safeParse({ data: [row] }).success).toBe(true)
    expect(TeacherMissionListResponseSchema.safeParse({ data: [{ ...row, global: false, goalKind: null }] }).success).toBe(true)
    expect(TeacherMissionListResponseSchema.safeParse({ data: [{ ...row, goalKind: 'nope' }] }).success).toBe(false)
    expect(TeacherMissionListResponseSchema.safeParse({ data: [{ ...row, goalKind: undefined }] }).success).toBe(false)
  })
  it('the goal kinds are the seven of the PO decision and a Global goal row of /missions/today parses with its optional fields', () => {
    expect(MISSION_GOAL_KINDS).toEqual(['sessions_per_day', 'correct_per_day', 'correct_in_session', 'accuracy_in_session', 'minutes_per_day', 'topics_per_day', 'streak_days'])
    const today = { id: '1', title: 'T', typeLabel: 'Misi Harian', subjectName: '', questionCount: 3, coinsPerCorrect: 3, resourceTitle: null, resourceUrl: null, resourceNote: null, status: 'new', global: true, goalKind: 'sessions_per_day', target: 3, progress: 1, completed: false }
    expect(MissionTodayResponseSchema.safeParse({ data: [today], meta: meta(1) }).success).toBe(true)
    expect(MissionTodaySchema.safeParse({ ...today, goalKind: 'x' }).success).toBe(false)
    expect(MissionTodaySchema.safeParse(MissionTodaySchema.omit({ global: true, goalKind: true, target: true, progress: true, completed: true }).parse(today)).success).toBe(true)
  })
})
