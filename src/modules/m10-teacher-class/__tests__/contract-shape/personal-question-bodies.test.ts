import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createHttpTransport, installTransport } from '@/api'

import {
  createPersonalQuestion,
  deletePersonalQuestion,
  fetchPersonalQuestions,
  updatePersonalQuestion,
} from '../../api/personal-questions'
import { buildBody, emptyValues } from '../../components/soalan-rujukan/form'
import { PersonalQuestionRequestSchema } from './personal-question-shapes'

/**
 * Contract-shape test (API-GUR-24): the bodies the FE really builds (`buildBody` + the api functions in http mode) are
 * validated with the schema mirrored from PRD-60 2.17.2, so a drifted field name, a numeric id or a wrong option shape
 * fails here, not as a 422 in the field.
 */
interface Sent {
  method: string
  url: string
  body: unknown
}
let sent: Sent[] = []

beforeEach(() => {
  sent = []
  vi.stubEnv('VITE_API_MODE', 'http')
  installTransport(
    createHttpTransport({
      fetch: (input, init) => {
        const raw = init?.body
        sent.push({
          method: init?.method ?? 'GET',
          url: input as string,
          body: typeof raw === 'string' ? (JSON.parse(raw) as unknown) : raw,
        })
        return Promise.resolve(
          new Response(JSON.stringify({ data: { id: '9', deleted: 1 } }), {
            status: 201,
            headers: { 'content-type': 'application/json' },
          }),
        )
      },
    }),
  )
})
afterEach(() => vi.unstubAllEnvs())

const filled = () => ({
  ...emptyValues(),
  subjectId: '3',
  levelId: '10',
  chapterId: '7',
  spId: '111',
  tp: '4',
  cognitiveLevel: 'menilai',
  difficulty: '4',
  text: 'Apakah 2 + 2?',
  referenceUrl: 'https://example.org/rujukan',
  options: ['3', '4', '5', '6'],
  correct: 1,
})

describe('API-GUR-24 request bodies', () => {
  it('the create body passes PersonalQuestionRequestSchema with string ids', async () => {
    await createPersonalQuestion(buildBody(filled()))
    expect(sent[0]).toMatchObject({ method: 'POST', url: '/api/guru/personal-questions' })
    const parsed = PersonalQuestionRequestSchema.safeParse(sent[0]?.body)
    expect(parsed.error?.issues).toBeUndefined()
    expect(sent[0]?.body).toMatchObject({
      subjectId: '3',
      educationLevelId: '10',
      chapterId: '7',
      spIds: ['111'],
      tp: 4,
      difficulty: 4,
      correctIndex: 1,
      referenceUrl: 'https://example.org/rujukan',
      options: [{ text: '3' }, { text: '4' }, { text: '5' }, { text: '6' }],
    })
  })

  it('the minimal create body (no DSKP, no link) passes too', async () => {
    await createPersonalQuestion(
      buildBody({
        ...emptyValues(),
        subjectId: '3',
        levelId: '10',
        difficulty: '2',
        text: 'x',
        options: ['a', 'b', 'c', 'd'],
        correct: 0,
      }),
    )
    expect(PersonalQuestionRequestSchema.safeParse(sent[0]?.body).error?.issues).toBeUndefined()
    expect(sent[0]?.body).not.toHaveProperty('referenceUrl')
  })

  it('the update body is the same body on PUT /:id', async () => {
    await updatePersonalQuestion(8, buildBody(filled()))
    expect(sent[0]).toMatchObject({ method: 'PUT', url: '/api/guru/personal-questions/8' })
    expect(PersonalQuestionRequestSchema.safeParse(sent[0]?.body).error?.issues).toBeUndefined()
  })

  it('the schema refuses a javascript: link, a numeric id and one option', async () => {
    await createPersonalQuestion(buildBody(filled()))
    const body = sent[0]?.body as Record<string, unknown>
    const parse = (over: Record<string, unknown>) =>
      PersonalQuestionRequestSchema.safeParse({ ...body, ...over }).success
    expect(parse({})).toBe(true)
    expect(parse({ referenceUrl: 'javascript:alert(1)' })).toBe(false)
    expect(parse({ subjectId: 3 })).toBe(false)
    expect(parse({ options: [{ text: 'a' }] })).toBe(false)
  })

  it('list and delete use the documented paths and query', async () => {
    await fetchPersonalQuestions({ educationLevelId: 10, page: 2 })
    await deletePersonalQuestion(8)
    expect(sent[0]).toMatchObject({ method: 'GET' })
    expect(sent[0]?.url).toContain('/api/guru/personal-questions')
    expect(sent[0]?.url).toContain('educationLevelId=10')
    expect(sent[0]?.url).toContain('page=2')
    expect(sent[1]).toMatchObject({ method: 'DELETE', url: '/api/guru/personal-questions/8' })
  })
})
