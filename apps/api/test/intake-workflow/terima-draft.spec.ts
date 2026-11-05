import { IntakeBulkResultEnvelopeSchema, INTAKE_GATE_MESSAGES as G, INTAKE_MESSAGES } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bootWorkflowApp, draft, extractAndRun, itemsOf, loginAs, paper, post, readyBatch, type LoggedIn, type WorkflowTestApp } from './helpers'

/** S1-T04: a manual Terima validates only what a Draf needs; the unit, SP, TP and scheme confirmation are asked later (Hantar/Terbitkan). */
let t: WorkflowTestApp
let teacher: LoggedIn
let admin: LoggedIn

beforeAll(async () => {
  t = await bootWorkflowApp()
  teacher = await loginAs(t, 'guru@demo.test')
  admin = await loginAs(t, 'admin@demo.test')
}, 120_000)
afterAll(async () => {
  await t.close()
})

async function extracted(over: Parameters<typeof draft>[2][], stimuli: Parameters<typeof paper>[1] = {}): Promise<string[]> {
  t.ai.paper = () => paper(over.map((o, i) => draft(t.codes, String(i + 1), o)), stimuli)
  const { batchId } = await readyBatch(t, teacher)
  await extractAndRun(t, teacher, batchId)
  return (await itemsOf(teacher, batchId)).map((i) => i.id)
}

const count = async (sql: string): Promise<number> => Number((await t.db.query<{ n: string }>(sql))[0]!.n)
const counts = async () => ({
  questions: await count(`select count(*)::text n from questions`),
  stimuli: await count(`select count(*)::text n from stimuli`),
  groups: await count(`select count(*)::text n from stimulus_groups`),
  images: await count(`select count(*)::text n from files where purpose = 'question_image'`),
})
const messages = (res: { body: { error: { details: { issues: Array<{ message: string }> } } } }): string[] => res.body.error.details.issues.map((i) => i.message)

async function refused(id: string, expected: string[]): Promise<void> {
  const before = await counts()
  const res = await post(teacher, `/intake/items/${id}/accept`)
  expect(res.status, JSON.stringify(res.body)).toBe(422)
  expect(res.body.error.code).toBe('VALIDATION_ERROR')
  expect(res.body.error.message).toBe(INTAKE_MESSAGES.gateFailed)
  const issues = messages(res)
  expect(issues.length).toBeGreaterThan(0)
  for (const m of issues) expect(m).toMatch(/^Soalan \d+: /)
  for (const e of expected) expect(issues).toContain(e)
  expect(await counts()).toEqual(before)
  const rows = await t.db.query<{ state: string; q: string | null }>(`select review_state state, question_id::text q from intake_items where id = $1`, [id])
  expect(rows[0]!.q).toBeNull()
  expect(rows[0]!.state).not.toBe('accepted')
}

describe('Terima creates a Draf without unit, SP, TP or scheme confirmation', () => {
  it('a missing unit, SP and an unconfirmed low field do not block; the Draf has no unit and no SP', async () => {
    const [id] = await extracted([{ tag: { unit: null, sp: [] }, lowFields: ['stem'], fieldConfidence: { stem: 0.5 } }])
    const res = await post(teacher, `/intake/items/${id!}/accept`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.data.state).toBe('accepted')
    const q = await t.db.query<{ unit_id: string | null; n: string; status: string }>(
      `select v.unit_node_id::text unit_id, (select count(*) from question_version_sp_nodes s where s.question_version_id = v.id)::text n, v.status
       from question_versions v join intake_items i on i.question_id = v.question_id and i.question_version_no = v.version_no where i.id = $1`,
      [id],
    )
    expect(q).toEqual([{ unit_id: null, n: '0', status: 'draft' }])
  })
})

describe('Terima refuses what a Draf cannot be without, at once, with "Soalan {no}:" messages', () => {
  it('an empty stem', async () => {
    const [id] = await extracted([{ stem: ' ' }])
    await refused(id!, [`Soalan 1: ${G.stemEmpty}`])
  })

  it('needsManual', async () => {
    const [id] = await extracted([{ needsManual: true }])
    await refused(id!, [`Soalan 1: ${G.needsManual}`])
  })

  it('a subject that is not in the curriculum', async () => {
    const [id] = await extracted([{ tag: { subject: 'TIADAKOD' } }])
    await refused(id!, [`Soalan 1: ${G.subjectLevelMissing}`])
  })

  it('a free-text SP that is not in the taxonomy', async () => {
    const [id] = await extracted([{ tag: { sp: ['9.9.9'] } }])
    await refused(id!, [`Soalan 1: ${G.spNotInTaxonomy('9.9.9')}`])
  })

  it('a unit that is not in the taxonomy', async () => {
    const [id] = await extracted([{ tag: { unit: 'TIDAK-WUJUD' } }])
    await refused(id!, [`Soalan 1: ${G.unitNotInTaxonomy}`])
  })

  it('an MCQ with fewer than 2 options, and an MCQ without a key', async () => {
    const [few, nokey] = await extracted([
      { options: [{ id: 'A', text: 'Satu' }], scheme: { kind: 'option', marks: 1, correct: 'A', reason: 'x' } },
      { scheme: { kind: 'option', marks: 1, correct: 'Z', reason: 'x' } },
    ])
    await refused(few!, [`Soalan 1: ${G.mcqOptionsMin}`])
    await refused(nokey!, [`Soalan 2: ${G.mcqKeyMissing}`])
  })
})

describe('bulk Terima follows the same rule', () => {
  it('one good item (no unit, SP) is accepted, one with an empty stem is refused with its issues', async () => {
    const [good, bad] = await extracted([{ tag: { unit: null, sp: [] } }, { stem: '' }])
    const res = await post(admin, '/intake/items/bulk', { action: 'accept', ids: [good!, bad!] })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const out = IntakeBulkResultEnvelopeSchema.parse(res.body).data
    expect(out.results.map((r) => [r.outcome, r.reason])).toEqual([
      ['done', null],
      ['skipped', 'GATE_FAILED'],
    ])
    expect(out.done).toBe(1)
    expect(out.skipped).toBe(1)
    expect(out.results[1]!.issues?.map((i) => i.message)).toContain(`Soalan 2: ${G.stemEmpty}`)
  })
})
