import { CurriculumDskpReportSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bootCurriculumApp, expectError, idOf, loginAs, parseData, type Client, type CurriculumTestApp } from './helpers'

/**
 * API-DSKP-11 (S4-T02, FR-ADM-C04.0, AC-ADM-C04.3): `GET /api/admin/curriculum/dskp` returns live counts and
 * the state per offered Subjek x Tingkatan, and the node list when both ids are given. Nothing is stored.
 */
describe('admin DSKP load report (API-DSKP-11)', () => {
  let t: CurriculumTestApp
  let admin: Client
  let student: Client
  let math: string
  let t4: string
  let t5: string
  let d1: string

  beforeAll(async () => {
    t = await bootCurriculumApp()
    admin = await loginAs(t, 'admin@demo.test')
    student = await loginAs(t, 'pelajar@demo.test')
    math = await idOf(t.db, 'subjects', 'MATH')
    t4 = await idOf(t.db, 'education_levels', 'T4')
    t5 = await idOf(t.db, 'education_levels', 'T5')
    d1 = await idOf(t.db, 'education_levels', 'D1')
    // A small Matematik T4 tree: grouping -> unit (Bab) -> sk -> two sp and two node TP rows. The subject's general TP rows
    // (node_id null) come from the seed: unique (subject, coalesce(node, 0), tp), so the test reads their count instead.
    const ins = async (kind: string, code: string, parent: string | null): Promise<string> =>
      (await t.db.query<{ id: string }>(
        `insert into curriculum_nodes (subject_id, education_level_id, kind, code, title, parent_id, sort_order, edition)
         values ($1, $2, $3, $4, $5, $6, 0, 'Ujian') returning id::text`,
        [math, t4, kind, code, `Nod ${code}`, parent],
      ))[0]!.id
    const grouping = await ins('grouping', 'nombor-ujian', null)
    const unit = await ins('unit', '91.0', grouping)
    const sk = await ins('sk', '91.1', unit)
    await ins('sp', '91.1.1', sk)
    await ins('sp', '91.1.2', sk)
    await t.db.query(
      `insert into curriculum_tp_descriptors (subject_id, node_id, tp, descriptor, scope) values
         ($1, $2, 1, 'Unit TP1', 'unit'), ($1, $3, 2, 'SK TP2', 'sk')`,
      [math, unit, sk],
    )
  })
  afterAll(async () => {
    await t.close()
  })

  const report = async (query = '') => parseData(await admin.get(`/api/admin/curriculum/dskp${query}`), CurriculumDskpReportSchema)

  it('lists every offered Subjek x Tingkatan with live counts; nothing loaded is "belum dimuatkan" with zeros', async () => {
    const { rows, nodes } = await report()
    expect(nodes).toBeNull()
    const mathT4 = rows.find((r) => r.subject.id === math && r.level.id === t4)
    // The seed may hold nodes of its own; the counts are at least the planted tree.
    expect(mathT4).toMatchObject({ state: 'dimuatkan', level: { name: 'Tingkatan 4' } })
    expect(mathT4!.bab).toBeGreaterThanOrEqual(1)
    expect(mathT4!.sp).toBeGreaterThanOrEqual(2)
    for (const r of rows) {
      if (r.state === 'belum dimuatkan') expect([r.bab, r.sk, r.sp, r.tp]).toEqual([0, 0, 0, 0])
    }
    // Darjah is never an offered level (FR-X3-1).
    expect(rows.some((r) => r.level.id === d1)).toBe(false)
  })

  it('narrows to one subject and level and then returns the node list with TP descriptors (read-only)', async () => {
    const before = await report(`?subjectId=${math}&levelId=${t4}`)
    expect(before.rows).toHaveLength(1)
    const row = before.rows[0]!
    const planted = before.nodes!.filter((n) => n.edition === 'Ujian')
    expect(planted.map((n) => n.kind)).toEqual(['grouping', 'unit', 'sk', 'sp', 'sp'])
    expect(planted.find((n) => n.kind === 'unit')!.tpDescriptors).toEqual([{ tp: 1, descriptor: 'Unit TP1' }])
    expect(planted.find((n) => n.kind === 'sk')!.tpDescriptors).toEqual([{ tp: 2, descriptor: 'SK TP2' }])
    // Counts are exactly the node list, by kind (live, never stored).
    const all = before.nodes!
    expect(row.bab).toBe(all.filter((n) => n.kind === 'unit').length)
    expect(row.sk).toBe(all.filter((n) => n.kind === 'sk').length)
    expect(row.sp).toBe(all.filter((n) => n.kind === 'sp').length)
    expect(row.tp).toBe(all.reduce((n, x) => n + x.tpDescriptors.length, 0))
    // tpDescriptors = the subject's general rows, the same on every level row of the subject.
    const general = Number((await t.db.query<{ n: string }>(`select count(*) n from curriculum_tp_descriptors where subject_id = $1 and node_id is null`, [math]))[0]!.n)
    expect(row.tpDescriptors).toBe(general)
    expect((await report(`?subjectId=${math}&levelId=${t5}`)).rows[0]!.tpDescriptors).toBe(general)
    // A new node shows at once (computed per request).
    await t.db.query(`insert into curriculum_nodes (subject_id, education_level_id, kind, code, title, sort_order, edition) values ($1, $2, 'unit', '92.0', 'Nod 92.0', 0, 'Ujian')`, [math, t4])
    expect((await report(`?subjectId=${math}&levelId=${t4}`)).rows[0]!.bab).toBe(row.bab + 1)
  })

  it('only subjectId: the subject on every offered level, no node list', async () => {
    const { rows, nodes } = await report(`?subjectId=${math}`)
    expect(nodes).toBeNull()
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((r) => r.subject.id === math)).toBe(true)
  })

  it('422 on a malformed id, 404 on an unknown one, 403 for a pupil', async () => {
    const bad = expectError(await admin.get('/api/admin/curriculum/dskp?subjectId=abc&levelId=-1'), 'VALIDATION_ERROR')
    expect(Object.keys(bad.fields!).sort()).toEqual(['levelId', 'subjectId'])
    expectError(await admin.get('/api/admin/curriculum/dskp?subjectId=99999999'), 'NOT_FOUND', 'Subjek tidak dijumpai.')
    expectError(await admin.get('/api/admin/curriculum/dskp?levelId=99999999'), 'NOT_FOUND', 'Tahap Pendidikan tidak dijumpai.')
    expect((await student.get('/api/admin/curriculum/dskp')).status).toBe(403)
  })
})
