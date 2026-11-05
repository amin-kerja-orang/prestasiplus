import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createHttpTransport, installTransport } from '@/api'

import {
  createContributedQuestion,
  importQuestions,
  submitQuestionPaper,
  updateContributedQuestion,
} from '../../api/guru'
import { buildBody, emptyValues } from '../../components/soalan/form'
import {
  PAPER_TYPES,
  QuestionGuruCreateRequestSchema,
  QuestionGuruUpdateRequestSchema,
  QuestionSetPaperFieldsSchema,
} from './shapes'

/**
 * Contract-shape test: the bodies the FE really builds (`buildBody` + the api functions in http mode) are validated with
 * the server schemas, so a drifted field name, a numeric id or a wrong option shape fails here, not as a 422 in the field.
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
          new Response(JSON.stringify({ data: { id: '9', batchId: '9' } }), {
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
  levelId: '11',
  subjectId: '10',
  chapterId: '7',
  spId: '111',
  tp: '4',
  cognitiveLevel: 'menilai',
  difficulty: '4',
  questionText: 'Apakah hasil di anod?',
  options: ['Klorin', 'Hidrogen', 'Oksigen', 'Natrium'],
  correct: 0,
  explanation: 'Ion klorida dinyahcas.',
  scriptType: 'jawi' as const,
})

describe('API-GUR-18 request bodies', () => {
  it('the create body built by the form passes QuestionGuruCreateRequestSchema', async () => {
    await createContributedQuestion(buildBody(filled()))
    expect(sent[0]).toMatchObject({ method: 'POST', url: '/api/guru/questions' })
    const parsed = QuestionGuruCreateRequestSchema.safeParse(sent[0]?.body)
    expect(parsed.error?.issues).toBeUndefined()
    expect(sent[0]?.body).toMatchObject({
      subjectId: '10',
      educationLevelId: '11',
      chapterId: '7',
      spIds: ['111'],
      tp: 4,
      difficultyLevel: 4,
      options: ['Klorin', 'Hidrogen', 'Oksigen', 'Natrium'],
      correctAnswer: 0,
    })
  })

  it('the edit (PUT) body is the same full form and passes QuestionGuruUpdateRequestSchema', async () => {
    await updateContributedQuestion(522425, buildBody(filled()))
    expect(sent[0]).toMatchObject({ method: 'PUT', url: '/api/guru/questions/522425' })
    const parsed = QuestionGuruUpdateRequestSchema.safeParse(sent[0]?.body)
    expect(parsed.error?.issues).toBeUndefined()
    expect(sent[0]?.body).not.toHaveProperty('correctOptionId')
  })

  it('a form without DSKP values (none exist for the pair) still passes', async () => {
    await createContributedQuestion(
      buildBody({ ...filled(), chapterId: '', spId: '', tp: '', cognitiveLevel: '' }),
    )
    expect(QuestionGuruCreateRequestSchema.safeParse(sent[0]?.body).success).toBe(true)
  })

  it('the schema rejects the old shapes the FE used to send (guards the test itself)', () => {
    const body = { ...buildBody(filled()), educationLevelId: '11', subjectId: '10' }
    const strictBad = [
      { ...body, difficultyLevel: 'easy' },
      { ...body, dskpSpId: 7 },
      { ...body, scriptType: 'rumi' },
      { ...body, educationLevelId: 11 },
      { ...body, options: [{ id: 0, optionText: 'a' }] },
    ]
    for (const bad of strictBad) {
      expect(QuestionGuruCreateRequestSchema.safeParse(bad).success).toBe(false)
    }
  })
})

describe('API-GUR-17 paper request', () => {
  it('sends the multipart fields of QuestionSetPaperFieldsSchema and the files under the key `files`', async () => {
    await submitQuestionPaper(
      {
        paperType: 'trial',
        subject: 'Kimia',
        levelId: 4,
        year: 2024,
        preparedBy: 'Guru',
        note: 'Dengan skema',
        answerSchemeConfirmed: true,
      },
      [new File(['x'], 'kertas.pdf'), new File(['y'], 'skema.docx')],
    )
    const form = sent[0]?.body as FormData
    expect(sent[0]).toMatchObject({ method: 'POST', url: '/api/guru/question-papers' })
    const text: Record<string, string> = {}
    for (const [k, v] of form.entries()) if (typeof v === 'string') text[k] = v
    const parsed = QuestionSetPaperFieldsSchema.safeParse(text)
    expect(parsed.error?.issues).toBeUndefined()
    expect(form.getAll('files').map((f) => (f as File).name)).toEqual(['kertas.pdf', 'skema.docx'])
    expect(form.has('files[]')).toBe(false)
  })

  it('every paper type the select offers is a slug the server accepts', async () => {
    const { PAPER_TYPES: offered } = await import('../../components/soalan/paper-rules')
    expect(offered.map((t) => t.value)).toEqual([...PAPER_TYPES])
  })
})

describe('API-GUR-19 CSV request', () => {
  it('posts the file as the multipart part `csvFile`', async () => {
    await importQuestions(new File(['a,b\n1,2\n'], 'soalan.csv'))
    expect(sent[0]).toMatchObject({ method: 'POST', url: '/api/guru/questions/import' })
    const form = sent[0]?.body as FormData
    expect([...form.keys()]).toEqual(['csvFile'])
    expect((form.get('csvFile') as File).name).toBe('soalan.csv')
  })
})
