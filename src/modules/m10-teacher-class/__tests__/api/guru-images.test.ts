import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createHttpTransport, installTransport, isApiError } from '@/api'

import { createContributedQuestion, updateContributedQuestion } from '../../api/guru'
import type { CreateQuestionRequest } from '../../api/types'

/**
 * Teacher create / edit with images in http mode: each image is uploaded first
 * (`POST /api/files?purpose=question_image`), then the JSON carries the returned tokens.
 */

interface Call {
  method: string
  url: string
  body: unknown
}
let calls: Call[] = []
let uploadStatus = 201
let uploadCount = 0

const png = (name: string) => new File([new Uint8Array([1])], name, { type: 'image/png' })
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

beforeEach(() => {
  calls = []
  uploadStatus = 201
  uploadCount = 0
  vi.stubEnv('VITE_API_MODE', 'http')
  installTransport(
    createHttpTransport({
      fetch: (input, init) => {
        const url = input as string
        const raw = init?.body
        if (url.startsWith('/api/files')) {
          uploadCount += 1
          calls.push({
            method: init?.method ?? 'GET',
            url,
            body: raw instanceof FormData ? (raw.get('file') as File).name : raw,
          })
          return Promise.resolve(
            uploadStatus === 201
              ? json(201, { data: { id: `TOKEN${String(uploadCount)}`, url: '/api/files/x' } })
              : json(422, {
                  error: { code: 'VALIDATION_ERROR', message: 'x', fields: { file: 'Jenis fail tidak dibenarkan.' } },
                }),
          )
        }
        calls.push({
          method: init?.method ?? 'GET',
          url,
          body: typeof raw === 'string' ? JSON.parse(raw) : raw,
        })
        return Promise.resolve(json(201, { data: { id: '9' } }))
      },
    }),
  )
})
afterEach(() => {
  vi.unstubAllEnvs()
})

const base: CreateQuestionRequest = {
  educationLevelId: 4,
  subjectId: 3,
  questionType: 'mcq',
  difficultyLevel: 'easy',
  questionText: 'Soalan ujian?',
  options: ['a', 'b', 'c', 'd'],
  correctAnswer: 1,
}

describe('teacher images in http mode', () => {
  it('create: uploads the stem and option images first, then posts JSON with the tokens', async () => {
    await createContributedQuestion(base, {
      questionImage: png('stem.png'),
      optionImages: [null, png('b.png'), null, null],
    })
    expect(calls.map((c) => c.url)).toEqual([
      '/api/files?purpose=question_image',
      '/api/files?purpose=question_image',
      '/api/guru/questions',
    ])
    expect(calls[0]?.body).toBe('stem.png')
    expect(calls[2]?.body).toMatchObject({
      questionImageFileId: 'TOKEN1',
      optionImageFileIds: [null, 'TOKEN2'],
      subjectId: '3',
    })
  })

  it('create without images: no upload', async () => {
    await createContributedQuestion(base)
    expect(calls.map((c) => c.url)).toEqual(['/api/guru/questions'])
  })

  it('create: a refused upload maps onto the image field and the question is not sent', async () => {
    uploadStatus = 422
    const err = await createContributedQuestion(base, { questionImage: png('a.pdf') }).catch(
      (e: unknown) => e,
    )
    expect(isApiError(err) && err.fields).toEqual({ questionImage: 'Jenis fail tidak dibenarkan.' })
    expect(calls.some((c) => c.url === '/api/guru/questions')).toBe(false)
  })

  it('create: a refused option upload is keyed optionImages.<i>', async () => {
    uploadStatus = 422
    const err = await createContributedQuestion(base, {
      optionImages: [null, null, png('c.png'), null],
    }).catch((e: unknown) => e)
    expect(isApiError(err) && err.fields).toEqual({
      'optionImages.2': 'Jenis fail tidak dibenarkan.',
    })
  })

  it('update: uploads the image, then PUTs JSON with questionImageFileId', async () => {
    await updateContributedQuestion(5, { questionText: 'Soalan?' }, png('n.png'))
    expect(calls[0]?.url).toBe('/api/files?purpose=question_image')
    expect(calls[1]).toMatchObject({
      method: 'PUT',
      url: '/api/guru/questions/5',
      body: { questionText: 'Soalan?', questionImageFileId: 'TOKEN1' },
    })
  })

  it('mock mode: still multipart, nothing uploaded', async () => {
    vi.stubEnv('VITE_API_MODE', 'mock')
    await createContributedQuestion(base, { questionImage: png('stem.png') }).catch(() => undefined)
    expect(calls.some((c) => c.url.startsWith('/api/files'))).toBe(false)
  })
})
