import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ http: false, post: vi.fn(), put: vi.fn(), upload: vi.fn() }))
vi.mock('@/api', async () => {
  const errors = await vi.importActual<typeof import('../../../../api/errors')>('../../../../api/errors')
  return { ...errors, api: { post: h.post, put: h.put },
    isHttpMode: () => h.http,
    uploadQuestionImage: h.upload,
  }
})

import { API_ERROR_CODES, ApiError } from '../../../../api/errors'
import {
  createQuestion,
  updateQuestion,
  type QuestionDetail,
  type QuestionInputBody,
} from '../../api/questions'
import { buildBody, emptyValues, formErrors, valuesFromQuestion } from '../../lib/question-form'

const base = {
  subjectId: '3',
  educationLevelId: '11',
  difficultyLevel: '2',
  questionText: 'Teks soalan yang cukup panjang',
  dskpSpId: '',
  explanation: '',
  language: 'bm' as const,
  pointsValue: '1',
}
const bodyOf = (fn: { mock: { calls: unknown[][] } }): Record<string, unknown> =>
  (fn.mock.calls[0]?.[1] as { body: Record<string, unknown> }).body
const png = () => new File([new Uint8Array([1])], 'a.png', { type: 'image/png' })

beforeEach(() => {
  h.post.mockReset().mockResolvedValue({ data: {}, status: 'ok' })
  h.put.mockReset().mockResolvedValue({ data: {}, status: 'ok' })
  h.upload.mockReset()
  h.http = true
})

describe('http mode sends JSON per the contract', () => {
  it('create MCQ: options array, numeric answer, only the MCQ fields', async () => {
    await createQuestion({
      ...base,
      questionType: 'mcq',
      options: ['a', 'b', 'c', 'd'],
      optionImages: [null, null, null, null],
      correctAnswer: '2',
      tfAnswer: null,
      correctAnswerText: '',
      altAnswers: '',
      modelAnswer: '',
    })
    const body = bodyOf(h.post)
    expect(body).toEqual({
      subjectId: '3',
      educationLevelId: '11',
      difficultyLevel: 2,
      questionText: 'Teks soalan yang cukup panjang',
      questionType: 'mcq',
      dskpSpId: null,
      language: 'bm',
      pointsValue: 1,
      explanation: null,
      options: ['a', 'b', 'c', 'd'],
      correctAnswer: 2,
    })
    expect(body).not.toBeInstanceOf(FormData)
  })

  it('create true_false: boolean or null tfAnswer, no options', async () => {
    await createQuestion({ ...base, questionType: 'true_false', options: ['', '', '', ''], tfAnswer: true })
    const body = bodyOf(h.post)
    expect(body.tfAnswer).toBe(true)
    expect(body).not.toHaveProperty('options')
    expect(body).not.toHaveProperty('correctAnswer')
    await createQuestion({ ...base, questionType: 'true_false', tfAnswer: null })
    expect((h.post.mock.calls[1]?.[1] as { body: Record<string, unknown> }).body.tfAnswer).toBeNull()
  })

  it('create short_answer: answer text and alt answers as an array', async () => {
    await createQuestion({
      ...base,
      questionType: 'short_answer',
      options: ['', '', '', ''],
      correctAnswerText: 'Kuala Lumpur',
      altAnswers: 'KL, Kuala Lumpur ,',
    })
    const body = bodyOf(h.post)
    expect(body.correctAnswerText).toBe('Kuala Lumpur')
    expect(body.altAnswers).toEqual(['KL', 'Kuala Lumpur'])
    expect(body).not.toHaveProperty('options')
  })

  it('update: PUT patch with required fields, no type, clear dskp, remove flags sent', async () => {
    const input: QuestionInputBody = {
      ...base,
      removeQuestionImage: true,
      options: ['a', 'b', 'c', 'd'],
      optionImages: [null, null, null, null],
      correctAnswer: '1',
      removeOptionImage: [false, true, false, false],
    }
    await updateQuestion(9, input)
    expect(h.put.mock.calls[0]?.[0]).toBe('/api/questions/9')
    const body = bodyOf(h.put)
    expect(body).toMatchObject({
      subjectId: '3',
      educationLevelId: '11',
      difficultyLevel: 2,
      dskpSpId: null,
      removeQuestionImage: true,
      removeOptionImage: [false, true, false, false],
      correctAnswer: 1,
    })
    expect(body).not.toHaveProperty('questionType')
  })

  it('update true_false keeps only the saved type fields', async () => {
    await updateQuestion(9, { ...base, tfAnswer: false })
    const body = bodyOf(h.put)
    expect(body.tfAnswer).toBe(false)
    expect(body).not.toHaveProperty('options')
  })
})

describe('http mode uploads new images first', () => {
  it('create: stem and option images are uploaded, then the JSON carries their tokens', async () => {
    h.upload.mockResolvedValueOnce('TOK-STEM').mockResolvedValueOnce('TOK-C')
    await createQuestion({
      ...base,
      questionType: 'mcq',
      options: ['a', 'b', 'c', 'd'],
      correctAnswer: '0',
      questionImage: png(),
      optionImages: [null, null, png(), null],
    })
    expect(h.upload.mock.calls.map((c) => c[1])).toEqual(['questionImage', 'optionImages.2'])
    const body = bodyOf(h.post)
    expect(body.questionImageFileId).toBe('TOK-STEM')
    expect(body.optionImageFileIds).toEqual([null, null, 'TOK-C'])
  })

  it('update: an untouched option before a new one keeps its saved token', async () => {
    h.upload.mockResolvedValueOnce('TOK-B')
    await updateQuestion(9, {
      ...base,
      options: ['a', 'b', 'c', 'd'],
      optionImages: [null, png(), null, null],
      savedOptionImages: ['SAVED-A-0000000000000', null, null, null],
      removeQuestionImage: true,
    })
    const body = bodyOf(h.put)
    expect(body.optionImageFileIds).toEqual(['SAVED-A-0000000000000', 'TOK-B'])
    expect(body.removeQuestionImage).toBe(true)
    expect(body).not.toHaveProperty('questionImageFileId')
  })

  it('no new image: nothing is uploaded and no id fields are sent', async () => {
    await createQuestion({ ...base, questionType: 'true_false', tfAnswer: true })
    expect(h.upload).not.toHaveBeenCalled()
    expect(bodyOf(h.post)).not.toHaveProperty('questionImageFileId')
    expect(bodyOf(h.post)).not.toHaveProperty('optionImageFileIds')
  })

  it('a refused upload maps onto its field and the question is not sent', async () => {
    h.upload.mockRejectedValueOnce(
      new ApiError({
        status: 422,
        code: API_ERROR_CODES.VALIDATION_ERROR,
        message: 'Jenis fail tidak dibenarkan.',
        fields: { questionImage: 'Jenis fail tidak dibenarkan.' },
      }),
    )
    const err = await createQuestion({ ...base, questionType: 'mcq', questionImage: png() }).catch(
      (e: unknown) => e,
    )
    expect(h.post).not.toHaveBeenCalled()
    expect(formErrors(err).fields).toEqual({ questionImage: 'Jenis fail tidak dibenarkan.' })
  })
})

describe('cognitiveLevel (T33 "Aras pemikiran")', () => {
  it('create sends the chosen level; none leaves it out; edit sends null to clear', async () => {
    await createQuestion({ ...base, questionType: 'true_false', tfAnswer: true, cognitiveLevel: 'memahami' })
    expect(bodyOf(h.post).cognitiveLevel).toBe('memahami')
    h.post.mockClear()
    await createQuestion({ ...base, questionType: 'true_false', tfAnswer: true })
    expect(bodyOf(h.post)).not.toHaveProperty('cognitiveLevel')
    await updateQuestion(9, { ...base, cognitiveLevel: '' })
    expect(bodyOf(h.put).cognitiveLevel).toBeNull()
  })
})

describe('kertas', () => {
  it('create sends the chosen kertas; none leaves it out', async () => {
    await createQuestion({ ...base, questionType: 'true_false', tfAnswer: true, kertas: '2' })
    expect(bodyOf(h.post).kertas).toBe('2')
    h.post.mockClear()
    await createQuestion({ ...base, questionType: 'true_false', tfAnswer: true })
    expect(bodyOf(h.post)).not.toHaveProperty('kertas')
  })

  it('edit sends null to clear and the value to set', async () => {
    await updateQuestion(9, { ...base, kertas: '' })
    expect(bodyOf(h.put).kertas).toBeNull()
    h.put.mockClear()
    await updateQuestion(9, { ...base, kertas: '3' })
    expect(bodyOf(h.put).kertas).toBe('3')
  })

  it('the form body: kertas value on create when set, always on edit; prefilled from the question', () => {
    const v = { ...emptyValues(), kertas: '1' as const }
    expect(buildBody(v, '', 'create').kertas).toBe('1')
    expect(buildBody(emptyValues(), '', 'create')).not.toHaveProperty('kertas')
    expect(buildBody(emptyValues(), '', 'edit').kertas).toBe('')
    const q = { questionType: 'mcq', kertas: '2', options: null, optionImages: [], altAnswers: [], difficultyLevel: 1, pointsValue: 1, language: 'bm', tfAnswer: null, correctAnswer: null, subjectId: 1, educationLevelId: 1, questionText: 'x' }
    expect(valuesFromQuestion(q as unknown as QuestionDetail).kertas).toBe('2')
    expect(valuesFromQuestion({ ...q, kertas: null } as unknown as QuestionDetail).kertas).toBe('')
  })
})

describe('mock mode', () => {
  it('still sends multipart FormData', async () => {
    h.http = false
    await createQuestion({ ...base, questionType: 'mcq', options: ['a', 'b', 'c', 'd'], questionImage: png() })
    const body = bodyOf(h.post)
    expect(body).toBeInstanceOf(FormData)
    expect([...(body as unknown as FormData).keys()]).toContain('options[0]')
    await updateQuestion(9, base)
    expect(bodyOf(h.put)).toBeInstanceOf(FormData)
  })
})
