/**
 * Secondary-only (D72, R1-B21): a blueprint (Kontrak) cannot name a Darjah unit. A DSKP unit node of a primary-stage level in a quota
 * line is refused with 422 BLUEPRINT_INVALID (QUOTA_UNIT, BM message "Kontrak tidak boleh disimpan...") and nothing is written; the level enum of the
 * blueprint contract is T4 / T5 only, so there is no field to carry a Darjah level.
 */
import { BIJAK_STANDARDS_MESSAGES as STD, BijakBlueprintInvalidErrorSchema, BijakDskpUnitSchema } from '@pp/contract'
import { z } from 'zod'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ACCOUNTS, bootBuilderApp, count, loginAs, type BuilderTestApp, type Client } from './helpers'

describe('a blueprint cannot use a Darjah unit (D72)', () => {
  let t: BuilderTestApp
  let admin: Client
  let t4Unit: string
  let primaryUnit: string

  beforeAll(async () => {
    t = await bootBuilderApp()
    admin = await loginAs(t, ACCOUNTS.admin)
    const units = z.array(BijakDskpUnitSchema).parse((await admin.get('/api/admin/bijak/dskp/units?subject=MAT')).body.data)
    t4Unit = units.find((u) => u.level === 'T4')?.nodeId as string
    // A unit node of Matematik in a primary-stage level (the seed has none: Darjah content is not loaded).
    const rows = await t.db.query<{ id: string }>(
      `insert into curriculum_nodes (subject_id, education_level_id, kind, code, title, edition, sort_order)
       select (select id from subjects where code = 'MATH'), (select id from education_levels where stage = 'primary' order by id limit 1), 'unit', 'D1.0', 'Unit Darjah', 'KSSR', 0
       returning id::text`,
    )
    primaryUnit = rows[0]?.id as string
  })
  afterAll(async () => {
    await t.close()
  })

  const bodyWith = (nodeId: string) => ({
    subject: 'MAT',
    kertas: 7,
    source: 'Spec',
    code: 'MAT/DJH',
    durationMin: 60,
    instructions: ['Jawab semua.'],
    sections: [
      {
        label: 'Bahagian A',
        markBudget: 4,
        questionCount: 4,
        rule: { type: 'all' },
        profile: { kind: 'bahagian', groups: [{ from: 1, to: 4, tpMin: 1, tpMax: 4 }] },
        quota: { basis: 'questions', lines: [{ unit: { kind: 'unit', nodeId }, value: 4 }] },
        kbatMarks: 1,
      },
    ],
  })

  it('a quota line over a Darjah unit: 422 BLUEPRINT_INVALID with QUOTA_UNIT, nothing written', async () => {
    expect(primaryUnit).toBeTruthy()
    const res = await admin.post('/api/admin/blueprints', bodyWith(primaryUnit))
    expect(res.status, JSON.stringify(res.body)).toBe(422)
    const error = BijakBlueprintInvalidErrorSchema.parse(res.body).error
    expect(error.message).toBe(STD.blueprintInvalid)
    // R1-19.3 (T41): the exact BM text of the refusal
    expect(error.message).toBe('Kontrak tidak boleh disimpan. Betulkan masalah yang disenaraikan.')
    expect(error.details.problems.map((p) => p.code)).toContain('QUOTA_UNIT')
    expect(await count(t.db, `select count(*) n from blueprints where code = 'MAT/DJH'`)).toBe(0)
  })

  it('the same blueprint over a Tingkatan 4 unit is accepted (control)', async () => {
    const res = await admin.post('/api/admin/blueprints', bodyWith(t4Unit))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
  })
})
