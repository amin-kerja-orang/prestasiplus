import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createHttpTransport, installTransport, isApiError } from '@/api'

import { createContributedQuestion, updateContributedQuestion } from '../../api/guru'
import type { CreateQuestionRequest } from '../../api/types'

/**
 * SW12-01-A (v2 option A): in http mode the Guru question images are uploaded first with
 * `POST /api/files?purpose=question_image` (part `file`) and the create / edit request is JSON that
 * carries the returned ids. Mock mode keeps the multipart request.
 */

interface Call {
  method: string
  url: string
  body: unknown
}

let calls: Call[] = []
let uploads = 0
/** Per upload (0-based): a status other than 201 answers that error instead of a file. */
let uploadFailures: Record<number, { status: number; body: unknown }> = {}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

beforeEach(() => {
  calls = []
  uploads = 0
  uploadFailures = {}
  installTransport(
    createHttpTransport({
      fetch: (input, init) => {
        const url = input as string
        const raw = init?.body
        calls.push({
          method: init?.method ?? 'GET',
          url,
          body: typeof raw === 'string' ? JSON.parse(raw) : raw,
        })
        if (url.startsWith('/api/files')) {
          const n = uploads++
          const failure = uploadFailures[n]
          if (failure) return Promise.resolve(json(failure.status, failure.body))
          const id = `tok${String(n)}`
          return Promise.resolve(
            json(201, {
              data: {
                id,
                url: `/api/files/${id}`,
                mime: 'image/png',
                size: 4,
                purpose: 'question_image',
              },
            }),
          )
        }
        return Promise.resolve(json(200, { data: { id: '9' } }))
      },
    }),
  )
})
afterEach(() => {
  vi.unstubAllEnvs()
})

const png = (name: string) => new File(['abcd'], name, { type: 'image/png' })

const base: CreateQuestionRequest = {
  educationLevelId: 4,
  subjectId: 3,
  questionType: 'mcq',
  difficultyLevel: 'easy',
  questionText: 'Soalan contoh',
  options: ['a', 'b', 'c', 'd'],
  correctAnswer: 1,
}

const questionCalls = () => calls.filter((c) => c.url === '/api/guru/questions')
const uploadCalls = () => calls.filter((c) => c.url.startsWith('/api/files'))

describe('createContributedQuestion images, http mode', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_MODE', 'http')
  })

  it('uploads each picked file first (purpose question_image, part file) and sends JSON with the ids', async () => {
    await createContributedQuestion(base, {
      questionImage: png('stem.png'),
      optionImages: [null, png('b.png'), undefined, png('d.png')],
    })
    expect(uploadCalls().map((c) => [c.method, c.url])).toEqual([
      ['POST', '/api/files?purpose=question_image'],
      ['POST', '/api/files?purpose=question_image'],
      ['POST', '/api/files?purpose=question_image'],
    ])
    const part = uploadCalls()[0]?.body as FormData
    expect(part).toBeInstanceOf(FormData)
    expect((part.get('file') as File).name).toBe('stem.png')
    expect([...part.keys()]).toEqual(['file'])

    expect(calls.at(-1)?.url).toBe('/api/guru/questions')
    expect(questionCalls()).toHaveLength(1)
    const body = questionCalls()[0]?.body as Record<string, unknown>
    expect(body).not.toBeInstanceOf(FormData)
    expect(body).toMatchObject({
      educationLevelId: '4',
      subjectId: '3',
      questionImage: 'tok0',
      optionImages: [null, 'tok1', null, 'tok2'],
    })
  })

  it('sends no image keys and uploads nothing when no file is picked', async () => {
    await createContributedQuestion(base, {
      questionImage: null,
      optionImages: [null, null, null, null],
    })
    expect(uploadCalls()).toHaveLength(0)
    const body = questionCalls()[0]?.body as Record<string, unknown>
    expect('questionImage' in body).toBe(false)
    expect('optionImages' in body).toBe(false)
  })

  it('passes an already stored image (id or URL string) through without uploading', async () => {
    await createContributedQuestion(base, {
      questionImage: '/api/files/Zk3Qx9vB2mLw7TnRa1YpUg',
      optionImages: ['abc', null, null, null],
    })
    expect(uploadCalls()).toHaveLength(0)
    expect(questionCalls()[0]?.body).toMatchObject({
      questionImage: '/api/files/Zk3Qx9vB2mLw7TnRa1YpUg',
      optionImages: ['abc', null, null, null],
    })
  })

  it('uploads the option images of an MCQ only', async () => {
    await createContributedQuestion(
      { ...base, questionType: 'true_false', tfAnswer: true },
      { questionImage: png('stem.png'), optionImages: [png('a.png'), null, null, null] },
    )
    expect(uploadCalls()).toHaveLength(1)
    const body = questionCalls()[0]?.body as Record<string, unknown>
    expect(body.questionImage).toBe('tok0')
    expect('optionImages' in body).toBe(false)
  })

  it('a single Blob is the question image (earlier signature)', async () => {
    await createContributedQuestion(base, png('stem.png'))
    expect((questionCalls()[0]?.body as Record<string, unknown>).questionImage).toBe('tok0')
  })

  it('a refused option upload is reported on optionImages.<i>; the question is not sent', async () => {
    uploadFailures[1] = {
      status: 422,
      body: {
        error: { code: 'VALIDATION_ERROR', message: 'x', fields: { file: 'Fail terlalu besar.' } },
      },
    }
    const err = await createContributedQuestion(base, {
      questionImage: png('stem.png'),
      optionImages: [null, png('b.png'), null, null],
    }).catch((e: unknown) => e)
    expect(isApiError(err, 'VALIDATION_ERROR')).toBe(true)
    if (!isApiError(err)) throw new Error('expected an ApiError')
    expect(err.fields).toEqual({ 'optionImages.1': 'Fail terlalu besar.' })
    expect(err.message).toBe('Fail terlalu besar.')
    expect(questionCalls()).toHaveLength(0)
  })

  it('reports every refused upload on its own key (stem and option), using the error message without fields', async () => {
    uploadFailures[0] = {
      status: 422,
      body: {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'x',
          fields: { file: 'Jenis fail tidak sah.' },
        },
      },
    }
    uploadFailures[1] = {
      status: 403,
      body: { error: { code: 'FORBIDDEN', message: 'Akses ditolak.' } },
    }
    const err = await createContributedQuestion(base, {
      questionImage: png('stem.png'),
      optionImages: [png('a.png'), null, null, null],
    }).catch((e: unknown) => e)
    if (!isApiError(err)) throw new Error('expected an ApiError')
    expect(err.fields).toEqual({
      questionImage: 'Jenis fail tidak sah.',
      'optionImages.0': 'Akses ditolak.',
    })
    expect(questionCalls()).toHaveLength(0)
  })

  it('a session loss (401) on an upload is not turned into a field error', async () => {
    uploadFailures[0] = {
      status: 401,
      body: { error: { code: 'UNAUTHORIZED', message: 'Sesi tamat.' } },
    }
    const err = await createContributedQuestion(base, { questionImage: png('s.png') }).catch(
      (e: unknown) => e,
    )
    if (!isApiError(err)) throw new Error('expected an ApiError')
    expect(err.status).toBe(401)
    expect(err.fields).toBeUndefined()
  })

  it('maps the JSON 422 image keys as they come (questionImage, optionImages.<i>)', async () => {
    installTransport(
      createHttpTransport({
        fetch: () =>
          Promise.resolve(
            json(422, {
              error: {
                code: 'VALIDATION_ERROR',
                message: 'x',
                fields: {
                  questionImage: 'Imej tidak sah.',
                  'optionImages.2': 'Imej tidak sah.',
                  optionImages: 'Satu soalan boleh mempunyai paling banyak 4 gambar pilihan.',
                },
              },
            }),
          ),
      }),
    )
    const err = await createContributedQuestion(base, { questionImage: 'nope' }).catch(
      (e: unknown) => e,
    )
    if (!isApiError(err)) throw new Error('expected an ApiError')
    expect(Object.keys(err.fields ?? {})).toEqual([
      'questionImage',
      'optionImages.2',
      'optionImages',
    ])
  })
})

describe('updateContributedQuestion image, http mode', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_MODE', 'http')
  })
  const body = { questionText: 'Soalan contoh', explanation: '' }

  it('uploads a picked file first, then a JSON PUT with questionImage set to the id', async () => {
    await updateContributedQuestion(7, body, png('stem.png'))
    expect(calls.map((c) => [c.method, c.url])).toEqual([
      ['POST', '/api/files?purpose=question_image'],
      ['PUT', '/api/guru/questions/7'],
    ])
    expect(calls[1]?.body).toEqual({ ...body, questionImage: 'tok0' })
  })

  it('without an image sends the body untouched, so the saved image is kept', async () => {
    await updateContributedQuestion(7, body, null)
    await updateContributedQuestion(7, body)
    expect(uploadCalls()).toHaveLength(0)
    expect(calls.map((c) => c.body)).toEqual([body, body])
  })

  it('sends an untouched image back as it was read (the URL), uploading nothing', async () => {
    await updateContributedQuestion(7, body, '/api/files/Zk3Qx9vB2mLw7TnRa1YpUg')
    expect(uploadCalls()).toHaveLength(0)
    expect(calls[0]?.body).toEqual({ ...body, questionImage: '/api/files/Zk3Qx9vB2mLw7TnRa1YpUg' })
  })

  it('a refused upload is reported on questionImage; the PUT is not sent', async () => {
    uploadFailures[0] = {
      status: 422,
      body: {
        error: { code: 'VALIDATION_ERROR', message: 'x', fields: { file: 'Fail terlalu besar.' } },
      },
    }
    const err = await updateContributedQuestion(7, body, png('s.png')).catch((e: unknown) => e)
    if (!isApiError(err)) throw new Error('expected an ApiError')
    expect(err.fields).toEqual({ questionImage: 'Fail terlalu besar.' })
    expect(calls.filter((c) => c.method === 'PUT')).toHaveLength(0)
  })
})

describe('question images, mock mode is unchanged (multipart)', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_MODE', 'mock')
  })

  it('create: one multipart POST with questionImage and optionImages[i]', async () => {
    await createContributedQuestion(base, {
      questionImage: png('stem.png'),
      optionImages: [null, png('b.png')],
    })
    expect(calls).toHaveLength(1)
    expect(calls[0]?.url).toBe('/api/guru/questions')
    const form = calls[0]?.body as FormData
    expect(form).toBeInstanceOf(FormData)
    expect((form.get('questionImage') as File).name).toBe('stem.png')
    expect((form.get('optionImages[1]') as File).name).toBe('b.png')
    expect(form.get('educationLevelId')).toBe('4')
  })

  it('create: no image is a JSON POST with the numeric ids', async () => {
    await createContributedQuestion(base, { questionImage: null })
    expect(calls[0]?.body).toEqual(base)
  })

  it('update: an image is one multipart PUT, none is JSON', async () => {
    const body = { questionText: 'Soalan contoh' }
    await updateContributedQuestion(7, body, png('stem.png'))
    await updateContributedQuestion(7, body)
    expect(calls.map((c) => c.method)).toEqual(['PUT', 'PUT'])
    expect(calls[0]?.body).toBeInstanceOf(FormData)
    expect((calls[0]?.body as FormData).get('questionImage')).toBeInstanceOf(File)
    expect(calls[1]?.body).toEqual(body)
  })
})
