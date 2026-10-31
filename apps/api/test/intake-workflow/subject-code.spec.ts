import { INTAKE_GATE_MESSAGES as G, type IntakeQuestion } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { CurriculumFactsService } from '../../src/modules/intake/workflow/curriculum-facts'
import { itemIssues } from '../../src/modules/intake/workflow/gate'
import { CurriculumRepository } from '../../src/modules/curriculum'
import { createBatch, uploadOk } from '../intake-files/helpers'
import { textPdf } from '../intake-files/pdf-fixtures'
import { bootWorkflowApp, draft, extractAndRun, itemsOf, loginAs, paper, post, type LoggedIn, type WorkflowTestApp } from './helpers'

/**
 * R1E2E-01: the contract and the Bijak UI speak MAT and SN; the curriculum `subjects` rows are MATH and SCI. The intake gate
 * looked the tag subject up raw, so every Matematik and Sains item was refused with "Subjek dan tingkatan perlu ditetapkan."
 * The lookup now goes through `curriculumCodeOf`. A genuinely missing subject or Tingkatan is still refused.
 */
let t: WorkflowTestApp
let teacher: LoggedIn
let facts: CurriculumFactsService

beforeAll(async () => {
  t = await bootWorkflowApp()
  teacher = await loginAs(t, 'guru@demo.test')
  facts = new CurriculumFactsService(t.app.get(CurriculumRepository))
}, 120_000)
afterAll(async () => {
  await t.close()
})

const tagOf = (subject: string, level: string, unit: string | null = null, sp: string[] = []): IntakeQuestion['tag'] =>
  ({ subject, level, unit, unitLabel: '', sp, tp: 3, formOrigin: level === 'T5' ? 'T5' : 'T4' }) as IntakeQuestion['tag']

const question = (tag: IntakeQuestion['tag']): IntakeQuestion =>
  ({
    id: '1',
    label: '1',
    type: 'mcq',
    stem: 'Hitung nilai bagi ungkapan algebra berikut dengan teliti.',
    options: [
      { id: 'A', text: '1' },
      { id: 'B', text: '2' },
    ],
    marks: 1,
    mode: 'working',
    parts: [],
    scheme: { kind: 'option', marks: 1, correct: 'B', reason: 'Kerana.' },
    tag,
    page: 1,
    lowFields: [],
    confirmed: [],
  }) as IntakeQuestion

const subjectLevelIssue = (issues: { message: string }[]) => issues.some((i) => i.message === G.subjectLevelMissing)

describe('intake tag subject: Bijak codes resolve to the curriculum subject (R1E2E-01)', () => {
  it.each([
    ['MAT', 'T4'],
    ['SN', 'T4'],
    ['MAT', 'T5'],
    ['SN', 'T5'],
    ['MATH', 'T4'], // the curriculum code itself still works
    ['SCI', 'T4'],
    ['SEJ', 'T4'], // codes without an alias pass through unchanged
  ])('%s %s resolves and the gate does not refuse the subject or level', async (subject, level) => {
    const tag = tagOf(subject, level)
    const { facts: f, ids } = await facts.resolver().resolve(tag)
    expect(f.subjectKnown).toBe(true)
    expect(f.levelKnown).toBe(true)
    expect(ids).not.toBeNull()
    expect(subjectLevelIssue(itemIssues(question(tag), undefined, f))).toBe(false)
  })

  it('MAT and MATH (SN and SCI) resolve to the same subject id', async () => {
    const r = facts.resolver()
    expect((await r.resolve(tagOf('MAT', 'T4'))).ids?.subjectId).toBe((await r.resolve(tagOf('MATH', 'T4'))).ids?.subjectId)
    expect((await r.resolve(tagOf('SN', 'T4'))).ids?.subjectId).toBe((await r.resolve(tagOf('SCI', 'T4'))).ids?.subjectId)
  })

  it('the unit of MAT T4 is found in the curriculum list (not only the subject)', async () => {
    const tag = tagOf('MAT', 'T4', t.codes.unit, [t.codes.sp])
    const { facts: f, ids } = await facts.resolver().resolve(tag)
    expect(f.unitKnown).toBe(true)
    expect(ids?.unitId).not.toBeNull()
    expect(ids?.spIds.length).toBe(1)
  })

  it('the extraction taxonomy of MAT is the same list as MATH', async () => {
    const a = await facts.taxonomy('MAT')
    expect(a.length).toBeGreaterThan(0)
    expect(a).toEqual(await facts.taxonomy('MATH'))
  })

  it('regression: a genuinely missing subject is still refused', async () => {
    for (const tag of [tagOf('TIADA', 'T4'), tagOf('', 'T4'), tagOf('MATX', 'T5')]) {
      const { facts: f, ids } = await facts.resolver().resolve(tag)
      expect(ids, JSON.stringify(tag)).toBeNull()
      expect(f.subjectKnown && f.levelKnown, JSON.stringify(tag)).toBe(false)
      expect(subjectLevelIssue(itemIssues(question(tag), undefined, f)), JSON.stringify(tag)).toBe(true)
    }
  })

  it('regression: a known subject whose Tingkatan is not in the curriculum is still refused', async () => {
    const repo = t.app.get(CurriculumRepository)
    const noLevel = { subjectByCode: repo.subjectByCode.bind(repo), levelByCode: () => Promise.resolve(null) } as unknown as CurriculumRepository
    const tag = tagOf('MAT', 'T4')
    const { facts: f, ids } = await new CurriculumFactsService(noLevel).resolver().resolve(tag)
    expect(ids).toBeNull()
    expect(f).toMatchObject({ subjectKnown: true, levelKnown: false })
    expect(subjectLevelIssue(itemIssues(question(tag), undefined, f))).toBe(true)
  })

  it('end to end: a batch of subject MAT with MAT T4 items extracts and accepts into a Draf question', async () => {
    t.ai.paper = () => paper([draft(t.codes, '1', { tag: tagOf('MAT', 'T4', t.codes.unit, [t.codes.sp]) })])
    const batch = await createBatch(teacher, { subject: 'MAT' })
    await uploadOk(teacher, batch.id, [{ bytes: Buffer.concat([textPdf(1), Buffer.from('\n% unik mat t4\n')]), filename: 'mat.pdf' }])
    await t.drain()
    await extractAndRun(t, teacher, batch.id)
    const [item] = await itemsOf(teacher, batch.id)
    expect(item).toBeDefined()
    const res = await post(teacher, `/intake/items/${item!.id}/accept`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.data.state).toBe('accepted')
    expect(res.body.data.question?.status).toBe('draft')
    const [row] = await t.db.query<{ code: string }>(
      `select s.code from questions q join question_versions v on v.question_id = q.id and v.version_no = 1 join subjects s on s.id = v.subject_id where q.id = $1`,
      [res.body.data.question.id],
    )
    expect(row?.code).toBe('MATH')
  })
})
