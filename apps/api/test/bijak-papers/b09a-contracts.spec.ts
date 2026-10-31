import { BijakBlueprintContractSchema, BijakPaperCoverSchema, envelopeOf } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { referencePanels } from '../../src/modules/bijak/papers/rules'
import { bootPapersApp, loginAs, serveSeededBlueprints, type Client, type PapersTestApp } from './helpers'

describe('R1-B09a fixes in bijak/papers', () => {
  let t: PapersTestApp
  let student: Client

  beforeAll(async () => {
    t = await bootPapersApp()
    await serveSeededBlueprints(t.db)
    student = await loginAs(t, 'pelajar@demo.test')
  })
  afterAll(async () => {
    await t.close()
  })

  const contract = async () => envelopeOf(BijakBlueprintContractSchema.array()).parse((await student.get('/api/bijak/contracts')).body).data
  const matK2 = (rows: Awaited<ReturnType<typeof contract>>) => rows.find((r) => r.subject === 'MAT' && r.kertas === 2)!

  it('N1: canGenerate agrees with the serving row that generate uses (an older Disahkan row still serving)', async () => {
    expect(matK2(await contract()).canGenerate).toBe(true)
    // A Spec head is being edited (v2, active) while v1 stays the serving Disahkan row (retired, serves_students).
    await t.db.query(`update blueprints set status = 'retired' where code = '1449/2' and version = 1`)
    await t.db.query(
      `insert into blueprints (subject_id, kertas, code, version, structure_hash, status, source, duration_min, instructions, reference_sheets)
       select subject_id, kertas, code, 2, structure_hash, 'active', 'spec', duration_min, instructions, reference_sheets from blueprints where code = '1449/2' and version = 1`,
    )
    await t.db.query(
      `insert into blueprint_sections (blueprint_id, position, label, rule_type, rule_n, question_count, mark_budget, compulsory, pool)
       select (select id from blueprints where code = '1449/2' and version = 2), position, label, rule_type, rule_n, question_count, mark_budget, compulsory, pool
         from blueprint_sections where blueprint_id = (select id from blueprints where code = '1449/2' and version = 1)`,
    )
    const row = matK2(await contract())
    expect(row.source).toBe('Spec')
    expect(row.canGenerate).toBe(true)
    expect(row.unavailableReason).toBeUndefined()
    // and generate agrees: it does not answer NO_BLUEPRINT for this pair
    const res = await student.post('/api/bijak/papers/generate', { subject: 'MAT', kertas: 2 })
    expect(res.body?.error?.code).not.toBe('NO_BLUEPRINT')
    // no serving row at all: not offered
    await t.db.query(`update blueprints set serves_students = false, source = 'spec', verification_id = null where code = '1449/2' and version = 1`)
    expect(matK2(await contract()).canGenerate).toBe(false)
    expect(matK2(await contract()).unavailableReason).toBe('NO_BLUEPRINT')
  })

  it('reference panels carry imageFileId through the rule and the student cover', async () => {
    expect(referencePanels([{ title: 'Rumus', items: ['a'], imageFileId: 'tok_abc' }, { title: 'Lain', items: [], imageFileId: 7 }, { items: [] }])).toEqual([
      { title: 'Rumus', items: ['a'], imageFileId: 'tok_abc' },
      { title: 'Lain', items: [] },
    ])
    const [paper] = await t.db.query<{ id: string }>(`select id::text from papers where kind = 'pilihan' and status = 'published' order by id limit 1`)
    await t.db.query(`update papers set reference_sheets = $2::jsonb where id = $1`, [paper!.id, JSON.stringify([{ title: 'Rajah rujukan', items: [], imageFileId: 'tok_abc' }])])
    const cover = envelopeOf(BijakPaperCoverSchema).parse((await student.get(`/api/bijak/papers/${paper!.id}`)).body).data
    expect(cover.reference).toEqual([{ title: 'Rajah rujukan', items: [], imageFileId: 'tok_abc' }])
  })
})
