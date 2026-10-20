import {
  BijakBuilderEditorSchema,
  BijakBuilderPaperCreateResultSchema,
  BijakBuilderPaperSummarySchema,
  BijakBuilderPublishResultSchema,
  envelopeOf,
  listEnvelopeOf,
} from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { FakeBank } from './fakes'
import { ACCOUNTS, bootBuilderApp, loginAs, type BuilderTestApp, type Client } from './helpers'

const Editor = envelopeOf(BijakBuilderEditorSchema)
const Created = envelopeOf(BijakBuilderPaperCreateResultSchema)
const Publish = envelopeOf(BijakBuilderPublishResultSchema)
const Summaries = listEnvelopeOf(BijakBuilderPaperSummarySchema)

/**
 * BIJAK_POC_QUESTIONS=true with an EMPTY bank (the demo database: the seed loads no PoC questions into
 * `questions`). The builder must still list the PoC questions, publish a new paper built from them, and
 * withdraw then re-publish a seeded PoC paper. Needs Docker Postgres.
 */
describe('paper builder with BIJAK_POC_QUESTIONS on and an empty bank', () => {
  let t: BuilderTestApp
  let admin: Client

  beforeAll(async () => {
    t = await bootBuilderApp({ builderSource: new FakeBank(), env: { BIJAK_POC_QUESTIONS: 'true' } })
    admin = await loginAs(t, ACCOUNTS.admin)
  })
  afterAll(async () => {
    await t.close()
  })

  const editor = async (id: string) => {
    const res = await admin.get(`/api/admin/papers/${id}`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    return Editor.parse(res.body).data
  }

  it('lists > 0 candidate questions for a new paper', async () => {
    const res = await admin.post('/api/admin/papers', { subject: 'MAT', kertas: 2 })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const e = await editor(Created.parse(res.body).data.id)
    expect(e.questions.length).toBeGreaterThan(0)
  })

  it('withdraw then re-publish of every seeded paper succeeds; a new paper copied from a seed publishes', async () => {
    const list = Summaries.parse((await admin.get('/api/admin/papers?status=terbit')).body).data
    expect(list.length).toBeGreaterThan(0)
    for (const row of list) {
      expect((await admin.post(`/api/admin/papers/${row.id}/withdraw`)).status).toBe(200)
      const pub = await admin.post(`/api/admin/papers/${row.id}/publish`)
      expect(pub.status, JSON.stringify(pub.body)).toBe(200)
      expect(Publish.parse(pub.body).data, row.title).toEqual({ ok: true, errors: [] })
    }
    // create -> add the seed paper's questions -> publish
    const seed = list.find((r) => r.subject === 'MAT' && r.kertas === 2) ?? list[0]!
    const seedEditor = await editor(seed.id)
    const created = await admin.post('/api/admin/papers', { subject: seedEditor.paper.subject, kertas: seedEditor.paper.kertas })
    const id = Created.parse(created.body).data.id
    const fresh = await editor(id)
    const put = await admin.put(`/api/admin/papers/${id}`, {
      sections: fresh.paper.sections.map((s, i) => ({ id: s.id, questionIds: seedEditor.paper.sections[i]?.questionIds ?? [] })),
    })
    expect(put.status, JSON.stringify(put.body)).toBe(200)
    const pub = await admin.post(`/api/admin/papers/${id}/publish`)
    expect(Publish.parse(pub.body).data).toEqual({ ok: true, errors: [] })
  })
})
