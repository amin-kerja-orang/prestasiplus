import {
  BijakBuilderEditorSchema,
  BijakBuilderPaperCreateResultSchema,
  BijakBuilderPublishResultSchema,
  envelopeOf,
} from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSeeds } from '../../prisma/seed'
import { DEMO_BLUEPRINTS, examDemoBlueprintsSeed } from '../../prisma/seed/exam-demo-blueprints'
import { POC_BANK, pocQuestionId } from '../../prisma/seed/poc/export'
import { ACCOUNTS, bootBuilderApp, loginAs, type BuilderTestApp, type Client } from './helpers'

const Editor = envelopeOf(BijakBuilderEditorSchema)
const Created = envelopeOf(BijakBuilderPaperCreateResultSchema)
const Publish = envelopeOf(BijakBuilderPublishResultSchema)

/**
 * Demo fix B4 follow-up (QA #61), through the production wiring (`ExamBuilderModule`, the real
 * `QuestionBankBuilderSource`, no fake):
 * - the `exam-demo-blueprints` seed adds the Sejarah Kertas 2 Kontrak the export lacks, so with
 *   `BIJAK_POC_QUESTIONS` on a Sejarah paper can be built from the PoC questions and published (the open
 *   item of 155cf00; the composite itself is covered by `poc-flag.spec.ts`);
 * - flag off (the production default): PoC ids stay refused, as before the composite.
 */
const wire = (key: string) => pocQuestionId(key).toString()
const pocPaper = (subject: string, kertas: number) => POC_BANK.papers.find((p) => p.subject === subject && p.kertas === kertas)!
const MAT1 = pocPaper('MAT', 1)
const SEJ2 = pocPaper('SEJ', 2)

async function boot(on: boolean) {
  const t = await bootBuilderApp({ realBank: true, env: { BIJAK_POC_QUESTIONS: on ? 'true' : 'false' } })
  await runSeeds([examDemoBlueprintsSeed], { prisma: t.db.prisma })
  const admin = await loginAs(t, ACCOUNTS.admin)
  return { t, admin }
}

function helpers(get: () => { t: BuilderTestApp; admin: Client }) {
  const q = (sql: string, params: unknown[] = []) => get().t.db.query<Record<string, unknown>>(sql, params)
  return {
    q,
    async create(subject: string, kertas: number) {
      const res = await get().admin.post('/api/admin/papers', { subject, kertas })
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      return Created.parse(res.body).data.id
    },
    async editor(id: string) {
      const res = await get().admin.get(`/api/admin/papers/${id}`)
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      return Editor.parse(res.body).data
    },
    async publish(id: string) {
      const res = await get().admin.post(`/api/admin/papers/${id}/publish`)
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      return Publish.parse(res.body).data
    },
    async seededId(title: string) {
      return String((await q(`select id::text id from papers where title = $1`, [title]))[0]!.id)
    },
  }
}

describe('BIJAK_POC_QUESTIONS=true (staging / demo): Sejarah Kertas 2 blueprint', () => {
  let ctx: { t: BuilderTestApp; admin: Client }
  const h = helpers(() => ctx)
  beforeAll(async () => {
    ctx = await boot(true)
  }, 120_000)
  afterAll(async () => {
    await ctx.t.close()
  })

  it('the demo blueprints seed adds the missing Sejarah Kertas 2 Kontrak, once', async () => {
    expect(DEMO_BLUEPRINTS.map((b) => [b.subject, b.kertas, b.code])).toEqual([['SEJ', 2, SEJ2.code]])
    const n = async () => Number((await h.q(`select count(*) n from blueprints where code = $1 and status = 'active' and source = 'spec'`, [SEJ2.code]))[0]!.n)
    expect(await n()).toBe(1)
    await runSeeds([examDemoBlueprintsSeed], { prisma: ctx.t.db.prisma })
    expect(await n()).toBe(1)
    expect(Number((await h.q(`select count(*) n from blueprints`))[0]!.n)).toBe(POC_BANK.blueprints.length + 1)
  })

  it('the seeded Sejarah Kertas 2 blueprint lets a new Sejarah paper be built from the PoC questions and published', async () => {
    const id = await h.create('SEJ', 2)
    const e = await h.editor(id)
    expect(e.blueprint?.code).toBe(SEJ2.code)
    expect(e.paper.sections.map((s) => [s.label, s.questionCount, s.markBudget])).toEqual(SEJ2.sections.map((s) => [s.label, s.questionCount, s.markBudget]))
    const res = await ctx.admin.put(`/api/admin/papers/${id}`, {
      sections: e.paper.sections.map((s, i) => ({ id: s.id, questionIds: SEJ2.sections[i]!.questionIds.map(wire) })),
    })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(await h.publish(id)).toEqual({ ok: true, errors: [] })
  })
})

describe('BIJAK_POC_QUESTIONS=false (production default): PoC ids are refused as before', () => {
  let ctx: { t: BuilderTestApp; admin: Client }
  const h = helpers(() => ctx)
  beforeAll(async () => {
    ctx = await boot(false)
  }, 120_000)
  afterAll(async () => {
    await ctx.t.close()
  })

  it('PoC ids are not candidates and a PUT that places them is refused (422)', async () => {
    const id = await h.create('MAT', 1)
    const empty = await h.editor(id)
    const keys = MAT1.sections.flatMap((s) => s.questionIds).map(wire)
    expect(empty.questions.map((x) => x.id)).not.toEqual(expect.arrayContaining([keys[0]]))
    const res = await ctx.admin.put(`/api/admin/papers/${id}`, {
      sections: [{ id: empty.paper.sections[0]!.id, questionIds: keys }],
    })
    expect(res.status, JSON.stringify(res.body)).toBe(422)
  })

  it('a withdrawn seeded PoC paper cannot be re-published (its questions are not Terbit)', async () => {
    const id = await h.seededId(SEJ2.title)
    expect((await ctx.admin.post(`/api/admin/papers/${id}/withdraw`)).status).toBe(200)
    const res = await h.publish(id)
    expect(res.ok).toBe(false)
    expect((await h.q('select status from papers where id = $1', [id]))[0]!.status).toBe('withdrawn')
  })
})
