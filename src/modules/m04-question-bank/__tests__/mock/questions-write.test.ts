/**
 * M04-T1 (mutating): create / edit / delete / bulk / AI explanation handlers (SRS v1.16 §7 #3, #5–#8).
 * Boots once; tests on rows they create assert deltas against the counts taken at their start, and
 * only tests that edit observed rows set \, which resets the mock afterwards.
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import type { MockRuntime } from '@/mock/index'

import type { Question, QuestionDetail, QuestionMutation, QuestionRow } from '../../api/questions'
import { AI_FAIL_KEY, AI_LATENCY_KEY } from '../../mock/handlers/ai-explanation'
import { questions } from '../../mock'
import { showPrimaryLevels } from '../../mock/repository/visible-levels'
import { ADMIN, bootM04, callAs, form, type ErrorBody, type ListBody } from './helpers-questions'

let runtime: MockRuntime
let call: ReturnType<typeof callAs>
/** Set by a test that edits an observed row: the mock is reset after it. */
let dirty = false
let all0 = 0
let approved0 = 0
let archived0 = 0

beforeAll(async () => {
  // The documented counts include the Darjah questions; the hiding (D72) is in secondary-only.test.ts.
  showPrimaryLevels()
  runtime = await bootM04()
  call = callAs(runtime)
}, 180_000)

beforeEach(() => {
  all0 = questions.count('Q-ALL')
  approved0 = questions.count('Q-APPROVED')
  archived0 = questions.count('Q-ARCHIVED')
})

afterEach(async () => {
  runtime.config.set(AI_LATENCY_KEY, 0)
  runtime.config.set(AI_FAIL_KEY, undefined)
  if (dirty) await runtime.reset()
  dirty = false
}, 180_000)

const list = (query = '', as: number | null = ADMIN) =>
  call<ListBody<QuestionRow>>('GET', `/api/questions${query}`, as)

const png = (name = 'a.png', bytes = 16, type = 'image/png') =>
  new File([new Uint8Array(bytes)], name, { type })

const MCQ = {
  subjectId: 3,
  educationLevelId: 11,
  difficultyLevel: 2,
  questionType: 'mcq',
  questionText: 'Berapakah hasil tambah 12 dan 15 dalam soalan ini?',
  'options[0]': '25',
  'options[1]': '27',
  'options[2]': '29',
  'options[3]': '31',
  correctAnswer: 1,
  explanation: 'Dua belas campur lima belas ialah dua puluh tujuh.',
  language: 'bm',
  pointsValue: 2,
} as const

async function createMcq(extra: Record<string, string | number | boolean | Blob | undefined> = {}) {
  return call<QuestionMutation<Question>>(
    'POST',
    '/api/questions',
    ADMIN,
    form({ ...MCQ, ...extra }),
  )
}

describe('#3 POST /api/questions', () => {
  it('creates an approved, active, unscored question with a runtime id (BR-M04-09)', async () => {
    const res = await createMcq()
    expect(res.status).toBe(201)
    expect(res.body.status).toBe('Soalan berjaya ditambah.')
    const q = res.body.data
    expect(q.id).toBeGreaterThanOrEqual(9_000_001)
    expect(q).toMatchObject({
      subjectId: 3,
      educationLevelId: 11,
      difficultyLevel: 2,
      questionType: 'mcq',
      options: ['25', '27', '29', '31'],
      correctAnswer: 1,
      language: 'bm',
      pointsValue: 2,
      status: 'approved',
      isActive: true,
      complianceStatus: 'draft',
      sourceType: null,
      aiVerified: false,
      needsDiagram: false,
      qualityScore: null,
      dskpSpId: null,
      spmPool: true,
      createdBy: ADMIN,
      createdAt: '2026-09-25T15:40:00+08:00',
    })
  })

  it('shows first on S1 and moves the counts by one', async () => {
    const before = questions.count('Q-ALL', 3)
    const approved3 = questions.count('Q-APPROVED', 3)
    const res = await createMcq()
    const listed = await list()
    // Rows created at the same clock instant tie on createdAt, so earlier creates come first (id asc).
    expect(listed.body.data.map((r) => r.id)).toContain(res.body.data.id)
    expect(listed.body.meta.totalItems).toBe(all0 + 1)
    expect(questions.count('Q-ALL', 3)).toBe(before + 1)
    expect(questions.count('Q-APPROVED', 3)).toBe(approved3 + 1)
  })

  it('accepts a JSON body as well as multipart', async () => {
    const res = await call<QuestionMutation<Question>>('POST', '/api/questions', ADMIN, {
      subjectId: 3,
      educationLevelId: 3,
      difficultyLevel: 1,
      questionType: 'mcq',
      questionText: 'Pilih jawapan yang betul bagi soalan ini.',
      options: ['a', 'b', 'c', 'd'],
      correctAnswer: 3,
    })
    expect(res.status).toBe(201)
    expect(res.body.data.correctAnswer).toBe(3)
    expect(res.body.data.pointsValue).toBe(1)
    expect(res.body.data.language).toBe('bm')
  })

  it('stores "Aras pemikiran" (REQ-B-027): one of the six levels, cleared by an empty value, refused otherwise', async () => {
    const body = {
      subjectId: 3,
      educationLevelId: 11,
      difficultyLevel: 1,
      questionType: 'mcq',
      questionText: 'Pilih jawapan yang betul bagi soalan ini.',
      options: ['a', 'b', 'c', 'd'],
      correctAnswer: 0,
    }
    const made = await call<QuestionMutation<Question>>('POST', '/api/questions', ADMIN, { ...body, cognitiveLevel: 'menganalisis' })
    expect(made.status).toBe(201)
    expect((made.body.data as unknown as { cognitiveLevel: string | null }).cognitiveLevel).toBe('menganalisis')
    const id = made.body.data.id
    const cleared = await call<QuestionMutation<Question>>('PUT', `/api/questions/${String(id)}`, ADMIN, { ...body, cognitiveLevel: '' })
    expect((cleared.body.data as unknown as { cognitiveLevel: string | null }).cognitiveLevel).toBeNull()
    const bad = await call<ErrorBody>('POST', '/api/questions', ADMIN, { ...body, cognitiveLevel: 'hebat' })
    expect(bad.status).toBe(422)
    expect(bad.body.error.fields).toHaveProperty('cognitiveLevel')
  })

  it('stores only the fields of the chosen type (BR-M04-08)', async () => {
    const base = {
      subjectId: 1,
      educationLevelId: 9,
      difficultyLevel: 3,
      questionText: 'Soalan contoh untuk jenis lain selain aneka pilihan.',
      'options[0]': 'x',
      'options[1]': 'y',
      correctAnswer: 2,
      tfAnswer: true,
      correctAnswerText: '12',
      altAnswers: ' dua belas, ,12.0 ',
      modelAnswer: 'Jawapan contoh esei.',
    }
    const tf = await call<QuestionMutation<Question>>(
      'POST',
      '/api/questions',
      ADMIN,
      form({ ...base, questionType: 'true_false' }),
    )
    expect(tf.status).toBe(201)
    expect(tf.body.data).toMatchObject({
      questionType: 'true_false',
      tfAnswer: true,
      options: null,
      correctAnswer: null,
      correctAnswerText: null,
      modelAnswer: null,
    })
    const fill = await call<QuestionMutation<Question>>(
      'POST',
      '/api/questions',
      ADMIN,
      form({ ...base, questionType: 'fill_blank' }),
    )
    expect(fill.body.data).toMatchObject({
      questionType: 'fill_blank',
      correctAnswerText: '12',
      altAnswers: ['dua belas', '12.0'],
      tfAnswer: null,
      options: null,
    })
    const short = await call<QuestionMutation<Question>>(
      'POST',
      '/api/questions',
      ADMIN,
      form({ ...base, questionType: 'short_answer' }),
    )
    expect(short.body.data.questionType).toBe('short_answer')
    const essay = await call<QuestionMutation<Question>>(
      'POST',
      '/api/questions',
      ADMIN,
      form({ ...base, questionType: 'essay' }),
    )
    expect(essay.body.data).toMatchObject({
      questionType: 'essay',
      modelAnswer: 'Jawapan contoh esei.',
      correctAnswerText: null,
      altAnswers: [],
    })
    // A true/false question without an answer is valid (as live).
    const none = await call<QuestionMutation<Question>>(
      'POST',
      '/api/questions',
      ADMIN,
      form({ ...base, questionType: 'true_false', tfAnswer: undefined }),
    )
    expect(none.body.data.tfAnswer).toBeNull()
  })

  it('keeps uploaded images as in-memory URLs', async () => {
    const res = await createMcq({
      questionImage: png('q.png'),
      'optionImages[2]': png('c.webp', 8, 'image/webp'),
    })
    expect(res.status).toBe(201)
    expect(res.body.data.questionImage).toMatch(/^blob:/)
    expect(res.body.data.optionImages).toHaveLength(4)
    expect(res.body.data.optionImages[2]).toMatch(/^blob:/)
    expect(res.body.data.optionImages[0]).toBeNull()
  })

  it('an empty post lists every required field in one 422 (an unknown type is checked as MCQ)', async () => {
    const res = await call<ErrorBody>('POST', '/api/questions', ADMIN, {})
    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(res.body.error.fields).toEqual({
      subjectId: 'Sila pilih subjek.',
      educationLevelId: 'Sila pilih tahap pendidikan.',
      difficultyLevel: 'Sila pilih tahap kesukaran.',
      questionType: 'Jenis soalan tidak sah.',
      questionText: 'Teks soalan mesti sekurang-kurangnya 10 aksara.',
      options: 'Sila isi semua pilihan jawapan.',
      correctAnswer: 'Sila pilih jawapan betul.',
    })
    expect(res.body.error.message).toBe('Sila pilih subjek. (and 6 more errors)')
  })

  it.each([
    ['subject not in M03', { subjectId: 999 }, 'subjectId', 'Sila pilih subjek.'],
    [
      'level not in M03',
      { educationLevelId: 99 },
      'educationLevelId',
      'Sila pilih tahap pendidikan.',
    ],
    ['difficulty 0', { difficultyLevel: 0 }, 'difficultyLevel', 'Sila pilih tahap kesukaran.'],
    ['difficulty 6', { difficultyLevel: 6 }, 'difficultyLevel', 'Sila pilih tahap kesukaran.'],
    ['unknown type', { questionType: 'matching' }, 'questionType', 'Jenis soalan tidak sah.'],
    [
      'text of 9 characters',
      { questionText: '123456789' },
      'questionText',
      'Teks soalan mesti sekurang-kurangnya 10 aksara.',
    ],
    ['a blank option', { 'options[3]': '  ' }, 'options', 'Sila isi semua pilihan jawapan.'],
    ['correct answer 4', { correctAnswer: 4 }, 'correctAnswer', 'Sila pilih jawapan betul.'],
    ['points 0', { pointsValue: 0 }, 'pointsValue', 'Nilai mata mesti sekurang-kurangnya 1.'],
    ['language fr', { language: 'fr' }, 'language', 'Bahasa tidak sah.'],
    ['unknown DSKP SP', { dskpSpId: 123456 }, 'dskpSpId', 'SP DSKP tidak sah.'],
  ])('%s → 422 on that field', async (_name, extra, field, message) => {
    const res = await createMcq(extra)
    expect(res.status).toBe(422)
    expect((res.body as unknown as ErrorBody).error.fields).toEqual({ [field]: message })
  })

  it('short answer needs correctAnswerText', async () => {
    const res = await call<ErrorBody>(
      'POST',
      '/api/questions',
      ADMIN,
      form({ ...MCQ, questionType: 'short_answer', correctAnswerText: '  ' }),
    )
    expect(res.status).toBe(422)
    expect(res.body.error.fields).toEqual({ correctAnswerText: 'Sila masukkan jawapan betul.' })
  })

  it('rejects an image of another type or over 2 MB, per field', async () => {
    const res = await call<ErrorBody>(
      'POST',
      '/api/questions',
      ADMIN,
      form({
        ...MCQ,
        questionImage: png('a.gif', 8, 'image/gif'),
        'optionImages[1]': png('big.png', 2 * 1024 * 1024 + 1),
        'optionImages[0]': png('ok.jpg', 8, 'image/jpeg'),
      }),
    )
    expect(res.status).toBe(422)
    const message = 'Gambar mesti jenis JPG, PNG atau WebP dan tidak melebihi 2MB.'
    expect(res.body.error.fields).toEqual({ questionImage: message, 'optionImages.1': message })
    expect(questions.count('Q-ALL')).toBe(all0)
  })

  it('tags a DSKP SP of the M10 store', async () => {
    const res = await createMcq({ subjectId: 4, educationLevelId: 11, dskpSpId: 6191 })
    expect(res.status).toBe(201)
    expect(res.body.data.dskpSpId).toBe(6191)
    const detail = await call<{ data: QuestionDetail }>(
      'GET',
      `/api/questions/${String(res.body.data.id)}`,
      ADMIN,
    )
    expect(detail.body.data.dskp?.sp.code).toBe('T5SN.B9.1')
    expect(
      (await list('?dskpFilter=tagged&subjectId=4&educationLevelId=11')).body.data.map((r) => r.id),
    ).toContain(res.body.data.id)
  })
})

describe('#5 PUT /api/questions/:id', () => {
  it('updates the fields, keeps the type and status, and returns the flash', async () => {
    const created = await createMcq()
    const id = created.body.data.id
    const res = await call<QuestionMutation<Question>>(
      'PUT',
      `/api/questions/${String(id)}`,
      ADMIN,
      form({
        ...MCQ,
        questionType: 'essay', // ignored: a saved question keeps its type
        difficultyLevel: 4,
        questionText: 'Teks soalan yang telah dikemaskini oleh admin.',
        'options[0]': '26',
        correctAnswer: 0,
        pointsValue: 3,
        language: 'en',
      }),
    )
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('Soalan berjaya dikemaskini.')
    expect(res.body.data).toMatchObject({
      id,
      questionType: 'mcq',
      difficultyLevel: 4,
      questionText: 'Teks soalan yang telah dikemaskini oleh admin.',
      options: ['26', '27', '29', '31'],
      correctAnswer: 0,
      pointsValue: 3,
      language: 'en',
      status: 'approved',
      createdBy: ADMIN,
    })
    const again = await call<{ data: QuestionDetail }>('GET', `/api/questions/${String(id)}`, ADMIN)
    expect(again.body.data.questionText).toBe('Teks soalan yang telah dikemaskini oleh admin.')
  })

  it('an edit of an observed question moves it between count cells', async () => {
    dirty = true
    const before = questions.count('Q-ALL', 4)
    const res = await call<QuestionMutation<Question>>(
      'PUT',
      '/api/questions/564159',
      ADMIN,
      form({
        subjectId: 3,
        educationLevelId: 11,
        difficultyLevel: 3,
        questionText: 'Topup Sains T5 dipindahkan ke subjek Matematik.',
        'options[0]': 'a',
        'options[1]': 'b',
        'options[2]': 'c',
        'options[3]': 'd',
        correctAnswer: 0,
      }),
    )
    expect(res.status).toBe(200)
    expect(questions.count('Q-ALL', 4)).toBe(before - 1)
    expect(questions.count('Q-ALL')).toBe(all0)
    expect(res.body.data.subjectId).toBe(3)
  })

  it('images: a new file replaces, the remove flag clears, an absent field keeps', async () => {
    const created = await createMcq({
      questionImage: png('q.png'),
      'optionImages[0]': png('o.png'),
    })
    const id = created.body.data.id
    const keep = await call<QuestionMutation<Question>>(
      'PUT',
      `/api/questions/${String(id)}`,
      ADMIN,
      form({ ...MCQ }),
    )
    expect(keep.body.data.questionImage).toBe(created.body.data.questionImage)
    expect(keep.body.data.optionImages[0]).toBe(created.body.data.optionImages[0])
    const swap = await call<QuestionMutation<Question>>(
      'PUT',
      `/api/questions/${String(id)}`,
      ADMIN,
      form({ ...MCQ, questionImage: png('n.png'), 'removeOptionImage[0]': 1 }),
    )
    expect(swap.body.data.questionImage).toMatch(/^blob:/)
    expect(swap.body.data.questionImage).not.toBe(created.body.data.questionImage)
    expect(swap.body.data.optionImages[0]).toBeNull()
    const cleared = await call<QuestionMutation<Question>>(
      'PUT',
      `/api/questions/${String(id)}`,
      ADMIN,
      form({ ...MCQ, removeQuestionImage: 1 }),
    )
    expect(cleared.body.data.questionImage).toBeNull()
  })

  it('DSKP: an absent dskpSpId keeps the saved SP, an empty one clears it (Buang tag DSKP)', async () => {
    const created = await createMcq({ subjectId: 4, dskpSpId: 6191 })
    const id = created.body.data.id
    const keep = await call<QuestionMutation<Question>>(
      'PUT',
      `/api/questions/${String(id)}`,
      ADMIN,
      form({ ...MCQ, subjectId: 4 }),
    )
    expect(keep.body.data.dskpSpId).toBe(6191)
    const cleared = await call<QuestionMutation<Question>>(
      'PUT',
      `/api/questions/${String(id)}`,
      ADMIN,
      form({ ...MCQ, subjectId: 4, dskpSpId: '' }),
    )
    expect(cleared.body.data.dskpSpId).toBeNull()
    const detail = await call<{ data: QuestionDetail }>(
      'GET',
      `/api/questions/${String(id)}`,
      ADMIN,
    )
    expect(detail.body.data.dskp).toBeNull()
  })

  it('validates like a create (MCQ options and answer are hard required) and changes nothing on 422', async () => {
    const created = await createMcq()
    const id = created.body.data.id
    const res = await call<ErrorBody>(
      'PUT',
      `/api/questions/${String(id)}`,
      ADMIN,
      form({ subjectId: 3, educationLevelId: 11, difficultyLevel: 2, questionText: 'kurang' }),
    )
    expect(res.status).toBe(422)
    expect(res.body.error.fields).toEqual({
      questionText: 'Teks soalan mesti sekurang-kurangnya 10 aksara.',
      options: 'Sila isi semua pilihan jawapan.',
      correctAnswer: 'Sila pilih jawapan betul.',
    })
    expect(questions.get(id)?.questionText).toBe(MCQ.questionText)
  })

  it('an unknown id and a PKSK row are 404', async () => {
    for (const id of [999_999_999, 177_698]) {
      const res = await call<ErrorBody>(
        'PUT',
        `/api/questions/${String(id)}`,
        ADMIN,
        form({ ...MCQ }),
      )
      expect(res.status).toBe(404)
      expect(res.body.error.code).toBe('NOT_FOUND')
    }
  })
})

describe('#6 DELETE /api/questions/:id', () => {
  it('deletes permanently and answers the flash; the second call is 404', async () => {
    const created = await createMcq()
    const id = created.body.data.id
    const res = await call<QuestionMutation<{ deleted: number }>>(
      'DELETE',
      `/api/questions/${String(id)}`,
      ADMIN,
    )
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ data: { deleted: 1 }, status: 'Soalan berjaya dipadam.' })
    expect(questions.get(id)).toBeNull()
    expect((await list()).body.meta.totalItems).toBe(all0)
    const again = await call<ErrorBody>('DELETE', `/api/questions/${String(id)}`, ADMIN)
    expect(again.status).toBe(404)
  })

  it('deletes an observed question and moves the counts', async () => {
    dirty = true
    const res = await call('DELETE', '/api/questions/129114', ADMIN)
    expect(res.status).toBe(200)
    expect(questions.count('Q-ALL')).toBe(all0 - 1)
    expect((await call('GET', '/api/questions/129114', ADMIN)).status).toBe(404)
  })

  it('an unknown id and a PKSK row are 404 and nothing is removed', async () => {
    for (const id of [999_999_999, 177_698]) {
      expect((await call('DELETE', `/api/questions/${String(id)}`, ADMIN)).status).toBe(404)
    }
    expect(questions.get(177_698)).not.toBeNull()
  })
})

describe('#7 POST /api/questions/bulk-action', () => {
  const bulk = (body: unknown) =>
    call<QuestionMutation<{ affected: number }> & ErrorBody>(
      'POST',
      '/api/questions/bulk-action',
      ADMIN,
      body,
    )

  it('approve, reject, archive and pending_review set the status of the given ids', async () => {
    const a = (await createMcq()).body.data.id
    const b = (await createMcq()).body.data.id
    for (const [action, status] of [
      ['reject', 'rejected'],
      ['archive', 'archived'],
      ['pending_review', 'pending_review'],
      ['approve', 'approved'],
    ] as const) {
      const res = await bulk({ action, ids: [a, b] })
      expect(res.status).toBe(200)
      expect(res.body.data).toEqual({ affected: 2 })
      expect(res.body.status).toBe('2 soalan berjaya dikemaskini.')
      expect(questions.get(a)?.status).toBe(status)
      expect(questions.get(b)?.status).toBe(status)
    }
  })

  it('moves the approved count of the tile', async () => {
    dirty = true
    const before = questions.count('Q-APPROVED', 4)
    const res = await bulk({ action: 'archive', ids: [564159, 564160] })
    expect(res.body.data.affected).toBe(2)
    expect(questions.count('Q-APPROVED', 4)).toBe(before - 2)
    expect(questions.count('Q-ARCHIVED')).toBe(archived0 + 2)
  })

  it('delete removes the rows; unknown ids and PKSK ids are not counted', async () => {
    const a = (await createMcq()).body.data.id
    const res = await bulk({ action: 'delete', ids: [a, 999_999_999, 177_698, a] })
    expect(res.status).toBe(200)
    expect(res.body.data.affected).toBe(1)
    expect(res.body.status).toBe('1 soalan berjaya dikemaskini.')
    expect(questions.get(a)).toBeNull()
    expect(questions.get(177_698)).not.toBeNull()
  })

  it('422 without an action, without ids, with a bad action or bad ids', async () => {
    const noAction = await bulk({ ids: [1] })
    expect(noAction.status).toBe(422)
    expect(noAction.body.error.fields).toEqual({ action: 'Sila pilih tindakan terlebih dahulu.' })
    const noIds = await bulk({ action: 'approve', ids: [] })
    expect(noIds.body.error.fields).toEqual({ ids: 'Sila pilih sekurang-kurangnya satu soalan.' })
    const empty = await bulk({})
    expect(Object.keys(empty.body.error.fields ?? {})).toEqual(['action', 'ids'])
    const badAction = await bulk({ action: 'explode', ids: [1] })
    expect(badAction.body.error.fields).toEqual({ action: 'Tindakan tidak sah.' })
    const badIds = await bulk({ action: 'approve', ids: ['x', 2] })
    expect(badIds.body.error.fields).toEqual({ ids: 'Senarai soalan tidak sah.' })
    expect(questions.count('Q-APPROVED')).toBe(approved0)
  })
})

describe('#8 POST /api/questions/:id/ai-explanation', () => {
  const generate = (id: number, force = false) =>
    call<{ ok?: boolean; message?: string }>(
      'POST',
      `/api/questions/${String(id)}/ai-explanation${force ? '?force=1' : ''}`,
      ADMIN,
    )

  it('stores a canned explanation and answers 200 {ok: true, message}', async () => {
    dirty = true
    expect(questions.get(564159)?.aiExplanation).toBeNull()
    const res = await generate(564159)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true, message: 'Penjelasan AI berjaya dijana.' })
    const stored = questions.get(564159)?.aiExplanation
    expect(stored?.generatedAt).toBe('2026-09-25T15:40:00+08:00')
    const md = stored?.markdown ?? ''
    expect(md.startsWith('## Penjelasan\n')).toBe(true)
    expect(md).toContain('**Jawapan betul:** A.')
    expect(md).toContain('| Pilihan | Ulasan |')
    expect(md).toMatch(/^- /m)
    const detail = await call<{ data: QuestionDetail }>('GET', '/api/questions/564159', ADMIN)
    expect(detail.body.data.aiExplanation?.markdown).toBe(md)
  })

  it('without force an existing explanation is unchanged; force replaces it with the next canned text', async () => {
    dirty = true
    await generate(570023)
    const first = questions.get(570023)?.aiExplanation?.markdown
    expect(first).toBeDefined()
    const kept = await generate(570023)
    expect(kept.body).toEqual({ ok: true, message: 'Penjelasan AI sudah wujud.' })
    expect(questions.get(570023)?.aiExplanation?.markdown).toBe(first)
    const forced = await generate(570023, true)
    expect(forced.body.ok).toBe(true)
    const second = questions.get(570023)?.aiExplanation?.markdown
    expect(second).not.toBe(first)
    expect(second?.startsWith('## Penjelasan')).toBe(true)
  })

  it('builds the text for the other types', async () => {
    const tf = await call<QuestionMutation<Question>>(
      'POST',
      '/api/questions',
      ADMIN,
      form({ ...MCQ, questionType: 'true_false', tfAnswer: false }),
    )
    await generate(tf.body.data.id)
    const md = questions.get(tf.body.data.id)?.aiExplanation?.markdown ?? ''
    expect(md).toContain('**Jawapan betul:** Salah')
    expect(md).toContain('| Perkara | Butiran |')
  })

  it('failure branches (FR-M04-46): message, no message, ok:false, non-JSON; nothing is stored', async () => {
    const cases = [
      ['message', 500, { ok: false, message: 'Perkhidmatan AI tidak tersedia buat masa ini.' }],
      ['no-message', 500, { ok: false }],
      ['ok-false', 200, { ok: false }],
    ] as const
    for (const [mode, status, body] of cases) {
      runtime.config.set(AI_FAIL_KEY, mode)
      const res = await generate(564159)
      expect(res.status).toBe(status)
      expect(res.body).toEqual(body)
    }
    runtime.config.set(AI_FAIL_KEY, 'non-json')
    const html = await call<string>('POST', '/api/questions/564159/ai-explanation', ADMIN)
    expect(html.status).toBe(500)
    expect(typeof html.body).toBe('string')
    expect(html.body).toContain('<!DOCTYPE html>')
    expect(questions.get(564159)?.aiExplanation).toBeNull()
    // One-shot: the next call succeeds.
    dirty = true
    expect((await generate(564159)).body.ok).toBe(true)
  })

  it('a network failure (fault injector) never reaches the handler', async () => {
    runtime.faults.networkErrorNext('POST /api/questions/:id/ai-explanation')
    await expect(generate(564159)).rejects.toThrow()
    expect(questions.get(564159)?.aiExplanation).toBeNull()
  })

  it('an unknown id and a PKSK row are 404; the handler waits m04.aiLatencyMs', async () => {
    expect((await generate(999_999_999)).status).toBe(404)
    expect((await generate(177_698)).status).toBe(404)
    dirty = true
    runtime.config.set(AI_LATENCY_KEY, 60)
    const t0 = Date.now()
    await generate(564160)
    expect(Date.now() - t0).toBeGreaterThanOrEqual(50)
  })
})
