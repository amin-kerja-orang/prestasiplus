import { INTAKE_GATE_MESSAGES as G, type IntakeQuestion } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { draftIssues, type CurriculumFacts } from '../../src/modules/intake/workflow/gate'
import { bootWorkflowApp, draft, extractAndRun, itemsOf, loginAs, paper, patch, post, readyBatch, type LoggedIn, type WorkflowTestApp } from './helpers'

/** S1-T03: Terima also refuses an MCQ stem under 10 characters and a Bab outside the item's Subjek and Tingkatan (FR-ADM-Q09.3). */
const facts: CurriculumFacts = { subjectKnown: true, levelKnown: true, unitKnown: null, unknownSp: [] }
const question = (over: Partial<IntakeQuestion> = {}): IntakeQuestion =>
  ({
    id: '1', label: '3', type: 'mcq', stem: 'Hitung nilai bagi ungkapan algebra berikut.',
    options: [{ id: 'A', text: '1' }, { id: 'B', text: '2' }], marks: 1, mode: 'working', parts: [],
    scheme: { kind: 'option', marks: 1, correct: 'B', reason: 'Kerana.' },
    tag: { subject: 'MATH', level: 'T4', unit: null, unitLabel: '', sp: [], tp: 3, formOrigin: 'T4' },
    page: 1, lowFields: [], confirmed: [], ...over,
  }) as IntakeQuestion

describe('draftIssues: MCQ stem length and Bab', () => {
  it('refuses an MCQ stem under 10 characters with the Soalan prefix, but not a blank one twice, a long one, or a non-MCQ', () => {
    expect(draftIssues(question({ stem: 'Pendek' }), undefined, facts).map((i) => i.message)).toEqual([`Soalan 3: ${G.mcqStemShort}`])
    expect(draftIssues(question({ stem: 'Sepuluh ok' }), undefined, facts)).toEqual([])
    expect(draftIssues(question({ stem: '  ' }), undefined, facts).map((i) => i.message)).toEqual([`Soalan 3: ${G.stemEmpty}`])
    expect(draftIssues(question({ type: 'short', stem: 'Pendek', options: [] }), undefined, { ...facts }).map((i) => i.message)).not.toContain(`Soalan 3: ${G.mcqStemShort}`)
  })

  it('refuses a Bab that is not a Bab, or is a Bab of another Subjek or Tingkatan; a matching Bab and no Bab pass', () => {
    expect(draftIssues(question(), undefined, { ...facts, babState: 'mismatch' }).map((i) => i.message)).toEqual([`Soalan 3: ${G.chapterMismatch}`])
    expect(draftIssues(question(), undefined, { ...facts, babState: 'unknown' }).map((i) => i.message)).toEqual([`Soalan 3: ${G.chapterInvalid}`])
    expect(draftIssues(question(), undefined, { ...facts, babState: 'ok' })).toEqual([])
    expect(draftIssues(question(), undefined, facts)).toEqual([])
  })
})

describe('Terima through the API', () => {
  let t: WorkflowTestApp
  let admin: LoggedIn
  beforeAll(async () => {
    t = await bootWorkflowApp()
    admin = await loginAs(t, 'admin@demo.test')
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  it('an edited MCQ stem under 10 characters refuses Terima at once and creates nothing', async () => {
    t.ai.paper = () => paper([draft(t.codes, '1')])
    const { batchId } = await readyBatch(t, admin)
    await extractAndRun(t, admin, batchId)
    const [id] = (await itemsOf(admin, batchId)).map((i) => i.id)
    expect((await patch(admin, `/intake/items/${id!}`, { stem: 'Pendek' })).status).toBe(200)
    const res = await post(admin, `/intake/items/${id!}/accept`)
    expect(res.status, JSON.stringify(res.body)).toBe(422)
    expect(res.body.error.details.issues.map((i: { message: string }) => i.message)).toContain(`Soalan 1: ${G.mcqStemShort}`)
    expect((await t.db.query<{ n: string }>(`select count(*)::text n from intake_items where id = $1 and question_id is not null`, [id]))[0]?.n).toBe('0')
  })
})
