/**
 * REQ-B-003: the e2e seed profile serves what the e2e workflows need, from the BANK only (no PoC papers):
 * (1) the paper builder reaches "Sepadan" for Matematik Kertas 1 (blueprint 1449/1, 40 questions) with the bank pool, publishes, and a pupil
 * sees the paper (e2e/bijak/admin-publish-http.spec.ts); (2) T26c: the profile seeds a labelled E2E fixture pool of 15 structured 3472/2 questions and one published Kertas 2 paper, which e2e/api/bijak-part-input.spec.ts sits.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { E2E_K2_PAPER_TITLE } from '../../prisma/seed/e2e-k2'
import { ExamBlueprintsModule } from '../../src/modules/exam/blueprints'
import { ExamBuilderModule } from '../../src/modules/exam/builder'
import { serveSeededBlueprints } from '../support/serve-blueprints'
import { ADMIN, bootIntegrationApp, type IntegrationApp, loginAs, STUDENT } from './helpers'

let t: IntegrationApp

beforeAll(async () => {
  t = await bootIntegrationApp({ pocQuestions: false, e2eProfile: true, extraModules: [ExamBuilderModule, ExamBlueprintsModule] })
  // Terbit needs a Disahkan Kontrak (AC-R1-16.2, T34). The e2e seed verifies only its own blueprint (3472/2): 1449/1 has no admin
  // evidence to pass Sahkan, so this spec serves the seeded blueprints as an admin verification would.
  await serveSeededBlueprints(t.db)
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

  it('T26c: the e2e profile seeds a published structured Kertas 2 paper (3472/2, E2E fixture) that passes the real Terbit gates, the pupil lists it and sits it', async () => {
    const pupil = await loginAs(t, STUDENT)
    const papers = ((await pupil.get('/api/bijak/papers')).body as { data: { id: string; kertas: number; title: string }[] }).data.filter((p) => p.kertas === 2)
    const fixture = papers.find((p) => p.title === E2E_K2_PAPER_TITLE)
    expect(fixture, `K2 papers listed: ${JSON.stringify(papers)}`).toBeDefined()

    // The real Terbit endpoint on the seeded (already Terbit) paper re-runs the builder gates: counts, marks per section, groups, servable questions, DSKP facts.
    const admin = await loginAs(t, ADMIN)
    const again = await admin.post(`/api/admin/papers/${fixture!.id}/publish`)
    expect(again.status, JSON.stringify(again.body)).toBe(200)
    expect((again.body as { data: { ok: boolean; errors: string[] } }).data, JSON.stringify(again.body)).toMatchObject({ ok: true, errors: [] })

    const started = await pupil.post('/api/bijak/attempts', { paperId: fixture!.id, mode: 'exam' })
    expect(started.status, JSON.stringify(started.body)).toBeLessThan(300)
    const attemptId = (started.body as { data: { attemptId: string } }).data.attemptId
    const view = await pupil.get(`/api/bijak/attempts/${attemptId}`)
    expect(view.status, JSON.stringify(view.body)).toBe(200)
    const raw = JSON.stringify(view.body)
    for (const kind of ['numeric', 'working', 'short_text']) expect(raw, `served leaf kind ${kind}`).toContain(`"kind":"${kind}"`)
    expect(raw).not.toContain('pksk_choice')
    expect(raw, 'the served attempt never carries an answer key').not.toContain('"accepted"')
  })

  it('the E2E fixture pool is 15 structured questions: 7 + 4 + 4 for 3472/2, all approved, multi-part, each of 5 to 10 marks', async () => {
    const rows = await t.db.query<{ marks: number; leaves: number }>(
      `select sum(p.marks)::int marks, count(p.id)::int leaves
         from questions q join question_versions v on v.question_id = q.id and v.version_no = q.live_version_no join question_parts p on p.question_version_id = v.id
        where v.status = 'approved' and q.is_active and v.number_label like 'E2E-K2-%' and p.mode is not null group by q.id`,
    )
    expect(rows).toHaveLength(15)
    expect(rows.every((r) => r.leaves >= 2 && r.marks >= 5 && r.marks <= 10)).toBe(true)
  })
})
