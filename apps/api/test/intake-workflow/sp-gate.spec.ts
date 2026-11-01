import { INTAKE_GATE_MESSAGES as G, type IntakeQuestion } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { CurriculumRepository } from '../../src/modules/curriculum'
import { CurriculumFactsService } from '../../src/modules/intake/workflow/curriculum-facts'
import { itemIssues } from '../../src/modules/intake/workflow/gate'
import { createBatch, uploadOk } from '../intake-files/helpers'
import { textPdf } from '../intake-files/pdf-fixtures'
import { bootWorkflowApp, draft, extractAndRun, itemsOf, loginAs, paper, post, type LoggedIn, type WorkflowTestApp } from './helpers'

/**
 * REQ-B-034 (review minors): an SP code that is not an SP of the item's subject and level is refused with a field message and never dropped;
 * one batch of lookups serves a page; a T4+T5 item may take its SPs from either level; more than 3 codes keep the first 3.
 */
let t: WorkflowTestApp
let admin: LoggedIn
let facts: CurriculumFactsService
let repo: CurriculumRepository
let t5Sp: string
let otherSubjectSp: string

const tagOf = (over: Partial<IntakeQuestion['tag']> = {}): IntakeQuestion['tag'] =>
  ({ subject: 'MATH', level: 'T4', unit: null, unitLabel: '', sp: [], tp: 3, formOrigin: 'T4', ...over }) as IntakeQuestion['tag']

beforeAll(async () => {
  t = await bootWorkflowApp()
  admin = await loginAs(t, 'admin@demo.test')
  repo = t.app.get(CurriculumRepository)
  facts = new CurriculumFactsService(repo)
  // A fictitious T5 Matematik SP that no T4 SP shares, under a T5 unit with the same code as the T4 unit of the fixtures.
  const ids = await t.db.query<{ subject: string; t4: string; t5: string; edition: string }>(
    `select s.id::text subject, (select id::text from education_levels where code = 'T4') t4, (select id::text from education_levels where code = 'T5') t5,
            (select edition from curriculum_nodes n where n.subject_id = s.id and n.kind = 'unit' limit 1) edition
       from subjects s where s.code = 'MATH'`,
  )
  const { subject, t5, edition } = ids[0]!
  t5Sp = 'ZZ5.1.1'
  await t.db.query(
    `insert into curriculum_nodes (subject_id, education_level_id, kind, code, title, edition) values ($1, $2, 'unit', $3, 'Unit T5 ujian', $4) on conflict do nothing`,
    [subject, t5, t.codes.unit, edition],
  )
  await t.db.query(`insert into curriculum_nodes (subject_id, education_level_id, kind, code, title, edition) values ($1, $2, 'sp', $3, 'SP T5 ujian', $4) on conflict do nothing`, [subject, t5, t5Sp, edition])
  const other = await t.db.query<{ code: string }>(
    `select n.code from curriculum_nodes n join subjects s on s.id = n.subject_id where s.code = 'SCI' and n.kind = 'sp'
        and n.code not in (select m.code from curriculum_nodes m join subjects ms on ms.id = m.subject_id where ms.code = 'MATH' and m.kind = 'sp') order by n.id limit 1`,
  )
  if (!other[0]) throw new Error('the seed has no SCI SP code that MATH lacks')
  otherSubjectSp = other[0].code
}, 120_000)
afterAll(async () => {
  await t.close()
})

const question = (tag: IntakeQuestion['tag']): IntakeQuestion =>
  ({
    id: '1', label: '1', type: 'mcq', stem: 'Hitung nilai bagi ungkapan algebra berikut dengan teliti.',
    options: [{ id: 'A', text: '1' }, { id: 'B', text: '2' }], marks: 1, mode: 'working', parts: [],
    scheme: { kind: 'option', marks: 1, correct: 'B', reason: 'Kerana.' }, tag, page: 1, lowFields: [], confirmed: [],
  }) as IntakeQuestion
const messages = (tag: IntakeQuestion['tag'], f: Parameters<typeof itemIssues>[2]) => itemIssues(question(tag), undefined, f).map((i) => i.message)

describe('REQ-B-034: unknown SP codes are refused (review minors)', () => {
  it('bulk accept: the item with an unknown SP and the one with an SP of another subject are skipped with the field message; the good one is accepted', async () => {
    t.ai.paper = () =>
      paper([
        draft(t.codes, '1'),
        draft(t.codes, '2', { tag: { sp: [t.codes.sp, '9.9.9'] } }),
        draft(t.codes, '3', { tag: { sp: [otherSubjectSp] } }),
      ])
    const batch = await createBatch(admin, { subject: 'MATH' })
    await uploadOk(admin, batch.id, [{ bytes: Buffer.concat([textPdf(1), Buffer.from('\n% unik sp bulk\n')]), filename: 'sp.pdf' }])
    await t.drain()
    await extractAndRun(t, admin, batch.id)
    const [good, bad, foreign] = (await itemsOf(admin, batch.id)).map((i) => i.id) as [string, string, string]
    const res = await post(admin, '/intake/items/bulk', { action: 'accept', ids: [good, bad, foreign] })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const by = new Map((res.body.data.results as { id: string; outcome: string; reason?: string; issues?: { message: string }[] }[]).map((r) => [r.id, r]))
    expect(by.get(good)!.outcome).toBe('done')
    expect(by.get(bad)).toMatchObject({ outcome: 'skipped', reason: 'GATE_FAILED' })
    expect(by.get(bad)!.issues!.map((i) => i.message)).toContain(G.spNotInTaxonomy('9.9.9'))
    expect(by.get(foreign)).toMatchObject({ outcome: 'skipped', reason: 'GATE_FAILED' })
    expect(by.get(foreign)!.issues!.map((i) => i.message)).toContain(G.spNotInTaxonomy(otherSubjectSp))
    expect(res.body.data).toMatchObject({ done: 1, skipped: 2 })
  })

  it('a T4+T5 item with a valid T5 SP is accepted: the level that knows the code wins, with or without a unit', async () => {
    for (const unit of [null, t.codes.unit]) {
      const tag = tagOf({ level: 'T4+T5', formOrigin: 'T4', unit, sp: [t5Sp] })
      const { facts: f, ids } = await facts.resolver().resolve(tag)
      expect(f.unknownSp, String(unit)).toEqual([])
      expect(ids?.spIds).toHaveLength(1)
      const t5 = (await t.db.query<{ id: string }>(`select id::text from education_levels where code = 'T5'`))[0]!.id
      expect(ids?.educationLevelId).toBe(t5)
      if (unit !== null) expect(f.unitKnown).toBe(true)
      expect(messages(tag, f)).not.toContain(G.spNotInTaxonomy(t5Sp))
    }
    // The same code on a plain T4 item is refused (it is not a T4 SP).
    const { facts: f4 } = await facts.resolver().resolve(tagOf({ level: 'T4', sp: [t5Sp] }))
    expect(f4.unknownSp).toEqual([t5Sp])
  })

  it('more than 3 valid codes keep the first 3; an unknown code among them is still reported once', async () => {
    const sps = (await t.db.query<{ code: string }>(`select n.code from curriculum_nodes n join subjects s on s.id = n.subject_id join education_levels l on l.id = n.education_level_id where s.code = 'MATH' and l.code = 'T4' and n.kind = 'sp' order by n.id limit 5`)).map((r) => r.code)
    expect(sps.length).toBeGreaterThanOrEqual(4)
    const four = await facts.resolver().resolve(tagOf({ sp: sps.slice(0, 4) }))
    expect(four.ids?.spIds).toHaveLength(3)
    expect(four.facts.unknownSp).toEqual([])
    const mixed = await facts.resolver().resolve(tagOf({ sp: [sps[0] as string, '9.9.9', '9.9.9', sps[1] as string] }))
    expect(mixed.facts.unknownSp).toEqual(['9.9.9'])
    expect(mixed.ids?.spIds).toHaveLength(2)
  })

  it('a page of tags is looked up with one statement per subject and level, then served from the cache', async () => {
    const spy = vi.spyOn(repo, 'nodesByCodes')
    const single = vi.spyOn(repo, 'node')
    const resolver = facts.resolver()
    const sps = (await t.db.query<{ code: string }>(`select n.code from curriculum_nodes n join subjects s on s.id = n.subject_id join education_levels l on l.id = n.education_level_id where s.code = 'MATH' and l.code = 'T4' and n.kind = 'sp' order by n.id limit 20`)).map((r) => r.code)
    const tags = Array.from({ length: 100 }, (_v, i) => tagOf({ level: 'T4+T5', unit: i % 2 === 0 ? t.codes.unit : null, sp: [sps[i % sps.length] as string, sps[(i + 7) % sps.length] as string, i % 10 === 0 ? '9.9.9' : t5Sp] }))
    await resolver.prefetch(tags)
    expect(spy.mock.calls.length).toBeLessThanOrEqual(2) // MATH at T4 and at T5
    const results = await Promise.all(tags.map((tag) => resolver.resolve(tag)))
    expect(single).not.toHaveBeenCalled()
    expect(spy.mock.calls.length).toBeLessThanOrEqual(2)
    expect(results[0]!.facts.unknownSp).toContain('9.9.9')
    spy.mockRestore()
    single.mockRestore()
  })
})
