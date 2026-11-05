import { BijakBuilderPaperListQuerySchema, BijakBuilderPaperSummarySchema, listEnvelopeOf } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import {
  BuilderService,
  PaperImportError,
  PaperImportGroupSplitError,
  PaperImportPublishedError,
  PaperImportQuestionError,
  type ImportDraftPaperInput,
} from '../../src/modules/exam/builder'
import { PrismaService } from '../../src/db/prisma.service'
import { serveSeededBlueprints } from '../support/serve-blueprints'
import { FakeBank, matBank } from './fakes'
import { ACCOUNTS, bootBuilderApp, expectError, loginAs, type BuilderTestApp, type Client } from './helpers'

vi.setConfig({ testTimeout: 120_000 })

const List = listEnvelopeOf(BijakBuilderPaperSummarySchema)

/** S1-T10 (D1, D2, D5, D11): the import-only methods of the Set Builder. Fictitious ids and labels. */
describe('BuilderService.importDraftPaper and the imported filter of the paper list', () => {
  let t: BuilderTestApp
  let bank: FakeBank
  let admin: Client
  let svc: BuilderService
  let subjectId: bigint
  let labels: string[]
  let batchNo = 0

  const q = (sql: string, params: unknown[] = []) => t.db.query<Record<string, unknown>>(sql, params)
  const newBatch = async (): Promise<bigint> =>
    BigInt(
      String(
        (await q(`insert into intake_batches (paper_type, subject, kertas, year, source_text, rights_status) values ('trial', 'MAT', 2, 2025, $1, 'own') returning id::text id`, [`b${String(++batchNo)}`]))[0]!.id,
      ),
    )
  const pl = (id: string, n: string, versionNo = 1) => ({ questionId: BigInt(id), versionNo, numberLabel: n })
  const input = (sourceBatchId: bigint, sections: ImportDraftPaperInput['sections'], over: Partial<ImportDraftPaperInput> = {}): ImportDraftPaperInput => ({
    subjectId,
    kertas: 2,
    year: 2025,
    paperCode: 'K2',
    sourceBatchId,
    sections,
    ...over,
  })
  const placements = async (paperId: bigint) =>
    q(
      `select s.label, s.position sp, s.admin_created, s.rule_type, s.rule_n, s.question_count, p.question_id::text qid, p.pinned_version_no v, p.number_label n, p.position
         from paper_sections s left join paper_placements p on p.paper_section_id = s.id where s.paper_id = $1 order by s.position, p.position`,
      [paperId.toString()],
    )

  beforeAll(async () => {
    bank = matBank()
    for (const id of ['700051', '700052', '700053', '700054', '700055']) bank.add({ id, marks: 1, status: 'draft' })
    bank.add({ id: '700061', marks: 1, status: 'review', groupId: '800009' }).add({ id: '700062', marks: 1, status: 'review', groupId: '800009' }).addGroup('800009', ['700061', '700062'])
    t = await bootBuilderApp({ builderSource: bank, papersSource: bank })
    admin = await loginAs(t, ACCOUNTS.admin)
    svc = t.app.get(BuilderService)
    subjectId = BigInt(String((await q(`select id::text id from subjects where code = 'MATH'`))[0]!.id))
    labels = (await q(`select s.label from blueprint_sections s join blueprints b on b.id = s.blueprint_id where b.code = '1449/2' and b.status = 'active' order by s.position`)).map((r) => String(r.label))
  })
  afterAll(async () => {
    await t.close()
  })

  it('no Disahkan Kontrak: creates one draft paper with the default title, no blueprint, admin-created sections in label order, Draf questions pinned', async () => {
    const batch = await newBatch()
    const res = await svc.importDraftPaper(input(batch, [{ label: 'Bahagian A', placements: [pl('700051', '1', 2), pl('700052', '2')] }, { label: 'Bahagian B', placements: [pl('700053', '1')] }]))
    expect(res).toMatchObject({ created: true, added: 3 })
    const paper = (await q(`select title, status, kind, paper_code, year, source_batch_id::text sb, blueprint_id, created_by_id from papers where id = $1`, [res.paperId.toString()]))[0]!
    expect(paper).toMatchObject({ title: 'Percubaan SPM Matematik Kertas 2 (draf)', status: 'draft', kind: 'pilihan', paper_code: 'K2', year: 2025, sb: batch.toString(), blueprint_id: null })
    const rows = await placements(res.paperId)
    expect(rows.map((r) => [r.label, r.qid, r.v, r.n, r.admin_created, r.rule_type])).toEqual([
      ['Bahagian A', '700051', 2, '1', true, 'all'],
      ['Bahagian A', '700052', 1, '2', true, 'all'],
      ['Bahagian B', '700053', 1, '1', true, 'all'],
    ])
    expect(rows.map((r) => r.sp)).toEqual([1, 1, 2])
  })

  it('a custom title is kept; the first call with no sections gives one Bahagian A', async () => {
    const batch = await newBatch()
    const res = await svc.importDraftPaper(input(batch, [], { title: '  Kertas percubaan ujian  ' }))
    expect((await q(`select title from papers where id = $1`, [res.paperId.toString()]))[0]!.title).toBe('Kertas percubaan ujian')
    expect((await placements(res.paperId)).map((r) => r.label)).toEqual(['Bahagian A'])
  })

  it('a label that matches a Disahkan Kontrak section copies its rule and figures and sets the blueprint; another label is admin-created, Jawab Semua', async () => {
    await serveSeededBlueprints(t.db)
    const batch = await newBatch()
    const contract = (await q(`select s.label, s.rule_type, s.rule_n, s.question_count, s.compulsory from blueprint_sections s join blueprints b on b.id = s.blueprint_id where b.code = '1449/2' and b.status = 'active' order by s.position`))[0]!
    const res = await svc.importDraftPaper(
      input(batch, [
        { label: `  ${String(contract.label).toUpperCase()} `, placements: [pl('700051', '1')] },
        { label: 'Bahagian Tambahan', placements: [pl('700052', '1')] },
      ]),
    )
    const paper = (await q(`select p.blueprint_id::text bp, b.code from papers p join blueprints b on b.id = p.blueprint_id where p.id = $1`, [res.paperId.toString()]))[0]!
    expect(paper.code).toBe('1449/2')
    const rows = await placements(res.paperId)
    expect(rows[0]).toMatchObject({ admin_created: false, rule_type: contract.rule_type, rule_n: contract.rule_n, question_count: contract.question_count })
    expect(rows[0]!.label).toBe(String(contract.label).toUpperCase())
    expect(rows[1]).toMatchObject({ label: 'Bahagian Tambahan', admin_created: true, rule_type: 'all', rule_n: null, question_count: 1 })
    expect(labels.length).toBeGreaterThan(0)
  })

  it('a stimulus group stays whole and contiguous at the position of its first member', async () => {
    const batch = await newBatch()
    const res = await svc.importDraftPaper(input(batch, [{ label: 'Bahagian A', placements: [pl('700054', '1'), pl('700061', '2'), pl('700055', '3'), pl('700062', '4')] }]))
    expect((await placements(res.paperId)).map((r) => [r.qid, r.n])).toEqual([
      ['700054', '1'],
      ['700061', '2'],
      ['700062', '4'],
      ['700055', '3'],
    ])
  })

  it('only the members given are placed (a rejected member is not pulled in)', async () => {
    const batch = await newBatch()
    const res = await svc.importDraftPaper(input(batch, [{ label: 'Bahagian A', placements: [pl('700021', '1')] }]))
    expect((await placements(res.paperId)).map((r) => r.qid)).toEqual(['700021'])
  })

  it('a group split across two labels is refused with a typed error and nothing is written', async () => {
    const batch = await newBatch()
    const err = await svc.importDraftPaper(input(batch, [{ label: 'Bahagian A', placements: [pl('700061', '1')] }, { label: 'Bahagian B', placements: [pl('700062', '2')] }])).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(PaperImportGroupSplitError)
    expect(err).toBeInstanceOf(PaperImportError)
    expect(err).toMatchObject({ code: 'GROUP_SPLIT', groupId: '800009' })
    expect(await q(`select id from papers where source_batch_id = $1`, [batch.toString()])).toHaveLength(0)
  })

  it('an unknown question is refused with a typed error', async () => {
    const batch = await newBatch()
    await expect(svc.importDraftPaper(input(batch, [{ label: 'Bahagian A', placements: [pl('999999', '1')] }]))).rejects.toBeInstanceOf(PaperImportQuestionError)
    expect(await q(`select id from papers where source_batch_id = $1`, [batch.toString()])).toHaveLength(0)
  })

  it('the transaction of the caller is used: a failure after the import leaves no paper', async () => {
    const batch = await newBatch()
    await expect(
      t.app.get(PrismaService).transaction(async (tx) => {
        await svc.importDraftPaper(input(batch, [{ label: 'Bahagian A', placements: [pl('700051', '1')] }]), tx)
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')
    expect(await q(`select id from papers where source_batch_id = $1`, [batch.toString()])).toHaveLength(0)
  })

  it('a second call appends only the new questions, never a second paper, and keeps what is there', async () => {
    const batch = await newBatch()
    const first = await svc.importDraftPaper(input(batch, [{ label: 'Bahagian A', placements: [pl('700051', '1')] }]))
    await q(`update paper_placements set marks_override = 3 where question_id = 700051`)
    const again = await svc.importDraftPaper(
      input(batch, [
        { label: 'bahagian a', placements: [pl('700051', '1'), pl('700052', '2')] },
        { label: 'Bahagian C', placements: [pl('700053', '1')] },
      ]),
    )
    expect(again).toEqual({ paperId: first.paperId, created: false, added: 2 })
    expect((await placements(first.paperId)).map((r) => [r.label, r.qid, r.n])).toEqual([
      ['Bahagian A', '700051', '1'],
      ['Bahagian A', '700052', '2'],
      ['Bahagian C', '700053', '1'],
    ])
    expect((await q(`select marks_override from paper_placements where question_id = 700051`))[0]!.marks_override).toBe(3)
    const none = await svc.importDraftPaper(input(batch, [{ label: 'Bahagian A', placements: [pl('700051', '1')] }]))
    expect(none).toEqual({ paperId: first.paperId, created: false, added: 0 })
    expect(await q(`select id from papers where source_batch_id = $1`, [batch.toString()])).toHaveLength(1)
  })

  it('a re-call that adds the last member of a group puts it next to its group; a group already in another section is a split', async () => {
    const batch = await newBatch()
    const first = await svc.importDraftPaper(input(batch, [{ label: 'Bahagian A', placements: [pl('700061', '1'), pl('700054', '2')] }]))
    const split = await svc.importDraftPaper(input(batch, [{ label: 'Bahagian B', placements: [pl('700062', '3')] }])).catch((e: unknown) => e)
    expect(split).toBeInstanceOf(PaperImportGroupSplitError)
    await svc.importDraftPaper(input(batch, [{ label: 'Bahagian A', placements: [pl('700062', '3')] }]))
    expect((await placements(first.paperId)).map((r) => [r.qid, r.n])).toEqual([
      ['700061', '1'],
      ['700062', '3'],
      ['700054', '2'],
    ])
  })

  it('a published paper is refused with a typed error and left as it is', async () => {
    const batch = await newBatch()
    const first = await svc.importDraftPaper(input(batch, [{ label: 'Bahagian A', placements: [pl('700051', '1')] }]))
    await q(`update papers set status = 'published' where id = $1`, [first.paperId.toString()])
    const err = await svc.importDraftPaper(input(batch, [{ label: 'Bahagian A', placements: [pl('700052', '2')] }])).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(PaperImportPublishedError)
    expect(err).toMatchObject({ code: 'PAPER_PUBLISHED', paperId: first.paperId })
    expect(await placements(first.paperId)).toHaveLength(1)
  })

  it('the 0161 columns: skipped cleanly while absent, written (surface simulasi, exam_board) once present', async () => {
    const before = await newBatch()
    const a = await svc.importDraftPaper(input(before, [{ label: 'Bahagian A', placements: [pl('700051', '1')] }], { examBoard: 'Johor' }))
    expect(a.created).toBe(true)
    await q(`alter table papers add column surface text, add column exam_board text`)
    // the answer is cached on the service: a new check only after the cache is dropped
    const again = await newBatch()
    const cached = await svc.importDraftPaper(input(again, [{ label: 'Bahagian A', placements: [pl('700051', '1')] }], { examBoard: 'Johor' }))
    expect((await q(`select surface, exam_board from papers where id = $1`, [cached.paperId.toString()]))[0]).toEqual({ surface: null, exam_board: null })
    ;(svc as unknown as { importColumns: undefined }).importColumns = undefined
    const last = await newBatch()
    const c = await svc.importDraftPaper(input(last, [{ label: 'Bahagian A', placements: [pl('700051', '1')] }], { examBoard: 'Johor' }))
    expect((await q(`select surface, exam_board from papers where id = $1`, [c.paperId.toString()]))[0]).toEqual({ surface: 'simulasi', exam_board: 'Johor' })
  })

  describe('GET /api/admin/papers?imported=true', () => {
    it('lists only imported papers, newest first, with sourceBatchId and importIssueCount', async () => {
      const batch = await newBatch()
      const res0 = await svc.importDraftPaper(input(batch, [{ label: 'Bahagian A', placements: [pl('700051', '1'), pl('700001', '2'), pl('700061', '3'), pl('700062', '4')] }]))
      const res = await admin.get('/api/admin/papers?imported=true&pageSize=100')
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      const rows = List.parse(res.body).data
      expect(rows.length).toBeGreaterThan(1)
      expect(rows.every((r) => r.sourceBatchId !== null)).toBe(true)
      expect(rows[0]!.id).toBe(res0.paperId.toString())
      expect(rows[0]).toMatchObject({ sourceBatchId: batch.toString(), importIssueCount: 3, questionCount: 4, status: 'draf' })
      const ids = rows.map((r) => BigInt(r.id))
      expect(ids).toEqual([...ids].sort((a, b) => (a < b ? 1 : -1)))
      const all = List.parse((await admin.get('/api/admin/papers?pageSize=100')).body).data
      expect(all.length).toBeGreaterThan(rows.length)
      expect(all.filter((r) => r.sourceBatchId === null).every((r) => r.importIssueCount === 0)).toBe(true)
    })

    it('sourceBatchId narrows to the paper of one batch; imported=false is refused by the schema', async () => {
      const batch = await newBatch()
      const made = await svc.importDraftPaper(input(batch, [{ label: 'Bahagian A', placements: [pl('700051', '1')] }]))
      const one = List.parse((await admin.get(`/api/admin/papers?sourceBatchId=${batch.toString()}`)).body).data
      expect(one.map((r) => r.id)).toEqual([made.paperId.toString()])
      expectError(await admin.get('/api/admin/papers?imported=false'), 'VALIDATION_ERROR')
      expect(BijakBuilderPaperListQuerySchema.safeParse({ imported: 'false' }).success).toBe(false)
      expect(BijakBuilderPaperListQuerySchema.safeParse({ imported: 'true' }).success).toBe(true)
    })
  })
})
