import {
  BijakBuilderEditorSchema,
  BijakBuilderPaperCreateResultSchema,
  BijakBuilderPublishResultSchema,
  envelopeOf,
} from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSeeds } from '../../prisma/seed'
import { DEMO_BLUEPRINTS, examDemoBlueprintsSeed } from '../../prisma/seed/exam-demo-blueprints'
import { POC_BANK, pocQuestionId } from '../../src/modules/bijak/papers/poc'
import { ACCOUNTS, bootBuilderApp, loginAs, type BuilderTestApp, type Client } from './helpers'

const Editor = envelopeOf(BijakBuilderEditorSchema)
const Created = envelopeOf(BijakBuilderPaperCreateResultSchema)
const Publish = envelopeOf(BijakBuilderPublishResultSchema)

/**
 * Demo fix B4 (QA #61): with `BIJAK_POC_QUESTIONS` on (staging / demo), the paper builder sees the PoC
 * questions next to the BE-09 bank, through the production wiring (`ExamBuilderModule`, the real
 * `QuestionBankBuilderSource`, no fake), so Admin Pusat can build and publish a paper from them and can
 * withdraw and re-publish a seeded PoC paper. Off (the production default) nothing changes: PoC ids are
 * refused as before.
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

describe('BIJAK_POC_QUESTIONS=true (staging / demo): the builder sees the PoC questions', () => {
  let ctx: { t: BuilderTestApp; admin: Client }
  const h = helpers(() => ctx)
  beforeAll(async () => {
    ctx = await boot(true)
  }, 120_000)
  afterAll(async () => {
    await ctx.t.close()
  })

  it('a new MAT kertas 1 paper offers the PoC questions as candidates, is filled with them and publishes', async () => {
    const id = await h.create('MAT', 1)
    const empty = await h.editor(id)
    const keys = MAT1.sections.flatMap((s) => s.questionIds).map(wire)
    expect(empty.questions.map((x) => x.id)).toEqual(expect.arrayContaining(keys))
    const res = await ctx.admin.put(`/api/admin/papers/${id}`, {
      sections: [{ id: empty.paper.sections[0]!.id, questionIds: keys }],
    })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(await h.publish(id)).toEqual({ ok: true, errors: [] })
    const row = (await h.q('select status, published_at from papers where id = $1', [id]))[0]!
    expect(row.status).toBe('published')
    expect(row.published_at).not.toBeNull()
    // the pinned version of a PoC question is 1
    expect(
      (await h.q(`select distinct pl.pinned_version_no v from paper_placements pl join paper_sections s on s.id = pl.paper_section_id where s.paper_id = $1`, [id])).map((r) => r.v),
    ).toEqual([1])
  })

  it('withdraw then publish of a seeded PoC paper succeeds and sets published_at again', async () => {
    const id = await h.seededId(SEJ2.title)
    const w = await ctx.admin.post(`/api/admin/papers/${id}/withdraw`)
    expect(w.status, JSON.stringify(w.body)).toBe(200)
    expect((await h.q('select status, published_at from papers where id = $1', [id]))[0]).toMatchObject({ status: 'withdrawn', published_at: null })
    expect(await h.publish(id)).toEqual({ ok: true, errors: [] })
    const row = (await h.q('select status, version, published_at from papers where id = $1', [id]))[0]!
    expect(row).toMatchObject({ status: 'published', version: 2 })
    expect(row.published_at).not.toBeNull()
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
