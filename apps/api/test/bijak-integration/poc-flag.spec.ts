/**
 * R1-B07: `BIJAK_POC_QUESTIONS` is a DEPRECATED NO-OP. Bijak serves the question bank only (`bank-sources.ts`), whatever the flag says:
 * a seeded PoC paper (reserved ids, in no table) is not startable (403, "not eligible"), Jana has no PoC pool (422 SHORTAGE), and a
 * paper of BE-09 questions works. Setting the flag to true only logs one warning at start. The PoC fixture survives as a TEST double
 * (`test/support/poc`, `bootIntegrationApp({ pocQuestions: true })`), which the last block exercises so the seeded PoC papers stay covered.
 */
import { Logger } from '@nestjs/common'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { BijakPaperSummarySchema } from '@pp/contract'

import { bootIntegrationApp, type Client, type IntegrationApp, loginAs, START, STUDENT } from './helpers'
import { serveSeededBlueprints } from '../support/serve-blueprints'

async function seededPocPaper(c: Client): Promise<string> {
  const res = await c.get('/api/bijak/papers')
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  const list = (res.body.data as unknown[]).map((p) => BijakPaperSummarySchema.parse(p))
  const p = list.find((x) => x.code === '1449/1' && x.kertas === 1)
  if (!p) throw new Error('seeded PoC paper 1449/1 not listed')
  return p.id
}

async function be09Paper(t: IntegrationApp): Promise<string> {
  const rows = await t.db.query<{ id: string }>(
    `select q.id::text as id from questions q
     join question_versions v on v.question_id = q.id and v.version_no = q.live_version_no
     where v.number_label in ('SEED-MCQ-MATH-T4', 'SEED-STR-ECF') order by v.number_label`,
  )
  expect(rows).toHaveLength(2)
  const subject = await t.db.prisma.subject.findFirstOrThrow({ where: { code: 'MATH' } })
  const paper = await t.db.prisma.paper.create({
    data: {
      kind: 'pilihan',
      title: 'Kertas bank soalan (bendera PoC)',
      subjectId: subject.id,
      kertas: 2,
      paperCode: '1449/2',
      printedDurationMin: 60,
      status: 'published',
      publishedAt: new Date(START),
      sections: {
        create: [
          {
            position: 1,
            label: 'Bahagian A',
            questionCount: rows.length,
            markBudget: 0,
            placements: { create: rows.map((r, j) => ({ questionId: BigInt(r.id), position: j + 1 })) },
          },
        ],
      },
    },
  })
  return paper.id.toString()
}

const start = (c: Client, paperId: string) => c.post('/api/bijak/attempts', { paperId, mode: 'exam' })

const WARNING = /BIJAK_POC_QUESTIONS is deprecated and ignored/

/** Boots the integration app with the flag in the environment; `plug` adds the test-only PoC double. */
async function boot(flag: string | undefined, plug: boolean): Promise<{ t: IntegrationApp; warnings: string[] }> {
  const warnings: string[] = []
  const spy = vi.spyOn(Logger.prototype, 'warn').mockImplementation((message: unknown) => {
    warnings.push(String(message))
  })
  if (flag === undefined) delete process.env.BIJAK_POC_QUESTIONS
  else process.env.BIJAK_POC_QUESTIONS = flag
  try {
    return { t: await bootIntegrationApp({ pocQuestions: plug }), warnings }
  } finally {
    spy.mockRestore()
  }
}

afterEach(() => {
  delete process.env.BIJAK_POC_QUESTIONS
})

for (const flag of ['true', '1', 'false', undefined]) {
  const on = flag === 'true' || flag === '1'
  describe(`BIJAK_POC_QUESTIONS=${flag ?? '(unset)'} (deprecated no-op, bank only)`, () => {
    let t: IntegrationApp
    let student: Client
    let warnings: string[]

    beforeAll(async () => {
      ;({ t, warnings } = await boot(flag, false))
      await serveSeededBlueprints(t.db)
      student = await loginAs(t, STUDENT)
    })
    afterAll(async () => {
      await t.close()
    })

    it(on ? 'logs the deprecation warning once at start' : 'logs nothing about the flag', () => {
      const hits = warnings.filter((w) => WARNING.test(w))
      expect(hits).toHaveLength(on ? 1 : 0)
    })

    it('a seeded PoC paper is not startable: 403 like any refused question', async () => {
      const res = await start(student, await seededPocPaper(student))
      expect(res.status, JSON.stringify(res.body)).toBe(403)
      expect(res.body.error.code).toBe('FORBIDDEN')
    })

    it('a paper of BE-09 questions starts', async () => {
      const res = await start(student, await be09Paper(t))
      expect(res.status, JSON.stringify(res.body)).toBeLessThan(300)
      expect((res.body as { data: { attemptId: string } }).data.attemptId).toBeTruthy()
    })

    it('Jana Kertas has no PoC pool: 422 SHORTAGE', async () => {
      const res = await student.post('/api/bijak/papers/generate', { subject: 'MAT', kertas: 1 })
      expect(res.status, JSON.stringify(res.body)).toBe(422)
      expect(res.body.error.code).toBe('SHORTAGE')
    })
  })
}

describe('test-only PoC double plugged (test/support/poc): the seeded PoC papers work', () => {
  let t: IntegrationApp
  let student: Client

  beforeAll(async () => {
    ;({ t } = await boot(undefined, true))
    await serveSeededBlueprints(t.db)
    student = await loginAs(t, STUDENT)
  })
  afterAll(async () => {
    await t.close()
  })

  it('a seeded PoC paper starts', async () => {
    const res = await start(student, await seededPocPaper(student))
    expect(res.status, JSON.stringify(res.body)).toBeLessThan(300)
  })

  it('a paper of BE-09 questions starts', async () => {
    const res = await start(student, await be09Paper(t))
    expect(res.status, JSON.stringify(res.body)).toBeLessThan(300)
  })

  it('Jana Kertas draws from the PoC pool', async () => {
    const res = await student.post('/api/bijak/papers/generate', { subject: 'MAT', kertas: 1 })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
  })
})
