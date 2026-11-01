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
 * R1-B07: `BIJAK_POC_QUESTIONS` is a deprecated no-op. The builder registers the question bank only (`ExamBuilderModule`), whatever the
 * flag says; the PoC fixture is a test double (`test/support/poc`). Two parts, both on an EMPTY bank (the demo database: the seed loads
 * no PoC questions into `questions`). Needs Docker Postgres.
 */
describe('BIJAK_POC_QUESTIONS=true is a no-op: the builder sees the bank only', () => {
  let t: BuilderTestApp
  let admin: Client

  beforeAll(async () => {
    t = await bootBuilderApp({ builderSource: new FakeBank(), env: { BIJAK_POC_QUESTIONS: 'true' } })
    admin = await loginAs(t, ACCOUNTS.admin)
  })
  afterAll(async () => {
    await t.close()
  })

  it('offers no PoC question (reserved id block) and publishes nothing from them', async () => {
    const created = await admin.post('/api/admin/papers', { subject: 'MAT', kertas: 2 })
    expect(created.status, JSON.stringify(created.body)).toBe(201)
    const e = Editor.parse((await admin.get(`/api/admin/papers/${Created.parse(created.body).data.id}`)).body).data
    expect(e.questions).toEqual([]) // the empty fake bank; the flag adds nothing
    const list = Summaries.parse((await admin.get('/api/admin/papers?status=terbit')).body).data
    expect(list.length).toBeGreaterThan(0) // the seeded PoC papers exist, but their questions are not servable
    const row = list[0]!
    expect((await admin.post(`/api/admin/papers/${row.id}/withdraw`)).status).toBe(200)
    const pub = Publish.parse((await admin.post(`/api/admin/papers/${row.id}/publish`)).body).data
    expect(pub.ok).toBe(false)
  })
})

describe('paper builder with the test-only PoC double plugged and an empty bank', () => {
  let t: BuilderTestApp
  let admin: Client

  beforeAll(async () => {
    t = await bootBuilderApp({ builderSource: new FakeBank(), pocBuilder: true })
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

  it('withdraw then re-publish of every seeded paper succeeds; a new paper built from PoC questions publishes', async () => {
    const list = Summaries.parse((await admin.get('/api/admin/papers?status=terbit')).body).data
    expect(list.length).toBeGreaterThan(0)
    for (const row of list) {
      expect((await admin.post(`/api/admin/papers/${row.id}/withdraw`)).status).toBe(200)
      const pub = await admin.post(`/api/admin/papers/${row.id}/publish`)
      expect(pub.status, JSON.stringify(pub.body)).toBe(200)
      expect(Publish.parse(pub.body).data, row.title).toEqual({ ok: true, errors: [] })
    }
    // create -> add PoC candidates that meet each section's count and budget -> publish. The test blueprints
    // have small budgets, so try every scope of the seed papers and require at least one to be buildable.
    const scopes = [...new Set(list.map((r) => `${r.subject}:${r.kertas}`))]
    let published = 0
    for (const scope of scopes) {
      const [subject, kertas] = scope.split(':')
      const created = await admin.post('/api/admin/papers', { subject, kertas: Number(kertas) })
      if (created.status !== 201) continue
      const id = Created.parse(created.body).data.id
      const fresh = await editor(id)
      const pool = fresh.questions.filter((x) => !x.groupId)
      const used = new Set<string>()
      const pick = (n: number, budget: number, from: typeof pool): typeof pool | null => {
        if (n === 0) return budget === 0 ? [] : null
        for (let i = 0; i < from.length; i++) {
          const x = from[i]!
          if (x.marks > budget) continue
          const rest = pick(n - 1, budget - x.marks, from.slice(i + 1))
          if (rest) return [x, ...rest]
        }
        return null
      }
      const sections: { id: string; questionIds: string[] }[] = []
      for (const s of fresh.paper.sections) {
        const chosen = pick(s.questionCount, s.markBudget, pool.filter((x) => !used.has(x.id)))
        if (!chosen) break
        for (const x of chosen) used.add(x.id)
        sections.push({ id: s.id, questionIds: chosen.map((x) => x.id) })
      }
      if (sections.length !== fresh.paper.sections.length) continue
      const put = await admin.put(`/api/admin/papers/${id}`, { sections })
      expect(put.status, JSON.stringify(put.body)).toBe(200)
      const pub = await admin.post(`/api/admin/papers/${id}/publish`)
      expect(Publish.parse(pub.body).data, scope).toEqual({ ok: true, errors: [] })
      published++
    }
    expect(published, `scopes tried: ${scopes.join(', ')}`).toBeGreaterThan(0)
  })
})
