/**
 * PoC questions are STAGING ONLY (LEAD decision 2026-10-20 16:00). `BIJAK_POC_QUESTIONS` off (the production
 * default): a seeded PoC paper is not startable (403, "not eligible") and Jana has no pool (422 SHORTAGE), while
 * a paper of BE-09 questions works. On (staging, the demo seed): both work.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { BijakPaperSummarySchema } from '@pp/contract'

import { bootIntegrationApp, type Client, type IntegrationApp, loginAs, START, STUDENT } from './helpers'
import { serveSeededBlueprints } from '../support/serve-blueprints'

async function seededPocPaper(c: Client, t: IntegrationApp, listed: boolean): Promise<string> {
  const res = await c.get('/api/bijak/papers')
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  const list = (res.body.data as unknown[]).map((p) => BijakPaperSummarySchema.parse(p))
  const p = list.find((x) => x.code === '1449/1' && x.kertas === 1)
  if (listed) {
    if (!p) throw new Error('seeded PoC paper 1449/1 not listed')
    return p.id
  }
  // H-A13: with the PoC questions off the paper places questions the bank does not serve, so Kertas Pilihan does not offer it.
  expect(p).toBeUndefined()
  const row = await t.db.query<{ id: string }>(`select id::text id from papers where paper_code = '1449/1' and kind = 'pilihan' and status = 'published' order by id limit 1`)
  return row[0]!.id
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

for (const on of [false, true]) {
  describe(`BIJAK_POC_QUESTIONS=${on} (${on ? 'staging' : 'production default'})`, () => {
    let t: IntegrationApp
    let student: Client

    beforeAll(async () => {
      t = await bootIntegrationApp({ pocQuestions: on })
      await serveSeededBlueprints(t.db)
      student = await loginAs(t, STUDENT)
    })
    afterAll(async () => {
      await t.close()
    })

    it(on ? 'a seeded PoC paper starts' : 'a seeded PoC paper is not startable: 403 like any refused question', async () => {
      const res = await start(student, await seededPocPaper(student, t, on))
      if (on) {
        expect(res.status, JSON.stringify(res.body)).toBeLessThan(300)
      } else {
        expect(res.status, JSON.stringify(res.body)).toBe(403)
        expect(res.body.error.code).toBe('FORBIDDEN')
      }
    })

    it('a paper of BE-09 questions starts', async () => {
      const res = await start(student, await be09Paper(t))
      expect(res.status, JSON.stringify(res.body)).toBeLessThan(300)
      expect((res.body as { data: { attemptId: string } }).data.attemptId).toBeTruthy()
    })

    it(on ? 'Jana Kertas draws from the PoC pool' : 'Jana Kertas has no pool: 422 SHORTAGE', async () => {
      const res = await student.post('/api/bijak/papers/generate', { subject: 'MAT', kertas: 1 })
      if (on) {
        expect(res.status, JSON.stringify(res.body)).toBe(201)
      } else {
        expect(res.status, JSON.stringify(res.body)).toBe(422)
        expect(res.body.error.code).toBe('SHORTAGE')
      }
    })
  })
}
