/**
 * REQ-B-003: the e2e seed profile serves what the e2e workflows need, from the BANK only (no PoC papers):
 * (1) the paper builder reaches "Sepadan" for Matematik Kertas 1 (blueprint 1449/1, 40 questions) with the bank pool, publishes, and a pupil
 * sees the paper (e2e/bijak/admin-publish-http.spec.ts); (2) there is no honest structured Kertas 2 paper in the bank seed, so
 * e2e/api/bijak-part-input.spec.ts is `test.fixme` (the published K2 papers of the seed are PoC papers that answer 403).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ExamBlueprintsModule } from '../../src/modules/exam/blueprints'
import { ExamBuilderModule } from '../../src/modules/exam/builder'
import { ADMIN, bootIntegrationApp, type IntegrationApp, loginAs, STUDENT } from './helpers'

let t: IntegrationApp

beforeAll(async () => {
  t = await bootIntegrationApp({ pocQuestions: false, e2eProfile: true, extraModules: [ExamBuilderModule, ExamBlueprintsModule] })
}, 300_000)
afterAll(async () => {
  await t.close()
})

type Unit = { questionIds: string[]; eligible: boolean; placed: boolean }

describe('e2e profile: builder pool and published papers come from the bank (REQ-B-003)', () => {
  it('Matematik Kertas 1 (1449/1, 40 questions): the bank pool offers at least 40 eligible units, the draft reaches Sepadan, Terbitkan works, the pupil sees it', async () => {
    const admin = await loginAs(t, ADMIN)
    const title = 'E2E bank paper K1'
    const created = await admin.post('/api/admin/papers', { subject: 'MAT', kertas: 1, title })
    expect(created.status, JSON.stringify(created.body)).toBe(201)
    const id = (created.body as { data: { id: string } }).data.id
    const sectionId = ((await admin.get(`/api/admin/papers/${id}`)).body as { data: { paper: { sections: { id: string }[] } } }).data.paper.sections[0]!.id

    const poolOf = async (): Promise<Unit[]> =>
      ((await admin.get(`/api/admin/papers/${id}/sections/${sectionId}/pool?pageSize=100`)).body as { data: Unit[] }).data
    const offered = (await poolOf()).filter((u) => u.eligible).length
    expect(offered, 'eligible bank units offered by the builder pool').toBeGreaterThanOrEqual(40)

    for (let i = 0; i < 40; i++) {
      const next = (await poolOf()).find((u) => u.eligible && !u.placed)
      expect(next, `candidate ${String(i + 1)}`).toBeDefined()
      for (const questionId of next!.questionIds) {
        const placed = await admin.post(`/api/admin/papers/${id}/placements`, { sectionId, questionId })
        expect(placed.status, JSON.stringify(placed.body)).toBe(201)
      }
    }
    const published = await admin.post(`/api/admin/papers/${id}/publish`)
    expect(published.status, JSON.stringify(published.body)).toBe(200)
    expect((published.body as { data: { ok: boolean; errors: string[] } }).data, JSON.stringify(published.body)).toMatchObject({ ok: true, errors: [] })

    const pupil = await loginAs(t, STUDENT)
    const titles = ((await pupil.get('/api/bijak/papers')).body as { data: { title: string }[] }).data.map((p) => p.title)
    expect(titles).toContain(title)
  })

  it('there is no honest structured Kertas 2 in the bank seed: a published K2 paper of the e2e profile cannot be started (PoC ids), so the part-input e2e is fixme', async () => {
    const pupil = await loginAs(t, STUDENT)
    const papers = ((await pupil.get('/api/bijak/papers')).body as { data: { id: string; kertas: number }[] }).data.filter((p) => p.kertas === 2)
    for (const p of papers) {
      const started = await pupil.post('/api/bijak/attempts', { paperId: p.id, mode: 'exam' })
      expect(started.status, `K2 paper ${p.id}`).toBe(403)
    }
    // The bank's structured questions: 2 Matematik and 1 Sains (essay mode); every K2 blueprint needs 5 or more.
    const rows = await t.db.query<{ n: number }>(
      `select count(distinct q.id)::int n from questions q join question_versions v on v.question_id = q.id and v.version_no = q.live_version_no
        where v.status = 'approved' and q.is_active and exists (select 1 from question_parts p where p.question_version_id = v.id and p.mode in ('numeric', 'working', 'short_text', 'essay'))`,
    )
    expect(rows[0]!.n).toBeLessThan(5)
  })
})
