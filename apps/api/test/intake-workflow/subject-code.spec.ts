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

  it('REQ-B-015: an MAT batch and a MATH batch of the same official paper share ONE source_papers row, with the MATH subject_id', async () => {
    const runBatch = async (subject: string, mark: string): Promise<string> => {
      t.ai.paper = () => paper([draft(t.codes, '1', { tag: tagOf(subject, 'T4', t.codes.unit, [t.codes.sp]) })])
      const batch = await createBatch(teacher, { subject, paperType: 'exam', year: 2019, kertas: 2 })
      await uploadOk(teacher, batch.id, [{ bytes: Buffer.concat([textPdf(1), Buffer.from(`\n% ${mark}\n`)]), filename: `${mark}.pdf` }])
      await t.drain()
      await extractAndRun(t, teacher, batch.id)
      return batch.id
    }
    const a = await runBatch('MAT', 'kertas dua mat')
    const b = await runBatch('MATH', 'kertas dua math')
    const rows = await t.db.query<{ id: string; natural_key: string; subject_code: string }>(
      `select sp.id::text id, sp.natural_key, s.code subject_code from source_papers sp join subjects s on s.id = sp.subject_id where sp.year = 2019 and sp.kertas = 'K2' and sp.exam_type = 'sebenar'`,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ natural_key: 'math|2019||k2|sebenar', subject_code: 'MATH' })
    const linked = await t.db.query<{ source_paper_id: string }>(`select source_paper_id::text from intake_batches where id = any($1::bigint[])`, [[a, b]])
    expect(linked.map((r) => r.source_paper_id)).toEqual([rows[0]!.id, rows[0]!.id])
  })

  it('REQ-B-015: a source paper written with the old Bijak key ("sn|...") is reused by an SCI batch, not duplicated', async () => {
    const subject = (await t.db.query<{ id: string }>(`select id::text id from subjects where code = 'SCI'`))[0]!.id
    const old = (
      await t.db.query<{ id: string }>(
        `insert into source_papers (natural_key, subject_id, kertas, year, exam_type, rights_status) values ('sn|2018||k1|sebenar', $1, 'K1', 2018, 'sebenar', 'own') returning id::text id`,
        [subject],
      )
    )[0]!.id
    t.ai.paper = () => paper([draft(t.codes, '1', { tag: tagOf('SCI', 'T4') })])
    const batch = await createBatch(teacher, { subject: 'SCI', paperType: 'exam', year: 2018, kertas: 1 })
    await uploadOk(teacher, batch.id, [{ bytes: Buffer.concat([textPdf(1), Buffer.from('\n% sains lama\n')]), filename: 'sains.pdf' }])
    await t.drain()
    await extractAndRun(t, teacher, batch.id)
    expect((await t.db.query(`select 1 from source_papers where year = 2018 and kertas = 'K1' and exam_type = 'sebenar'`))).toHaveLength(1)
    expect((await t.db.query<{ source_paper_id: string }>(`select source_paper_id::text from intake_batches where id = $1`, [batch.id]))[0]!.source_paper_id).toBe(old)
  })
})
