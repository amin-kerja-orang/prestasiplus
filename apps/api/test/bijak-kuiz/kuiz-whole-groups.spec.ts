/**
 * S1-T06 (FR-MUR-QP-6 / AC-QP-6, D90, D105): the random Simulasi Kuiz draws a stimulus group as ONE unit or not at all.
 * Real wiring (auth + BijakIntegrationModule + the BE-09 seed); HTTP only. The BM seed holds two plain MCQs and the three-member
 * "Pasar" group.
 */
import { BijakKuizSessionSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bootIntegrationApp, type Client, type IntegrationApp, loginAs, STUDENT } from '../bijak-integration/helpers'

process.env.THROTTLE_BIJAK_KUIZ_START_PER_MINUTE = '60'

let t: IntegrationApp
let student: Client
const ids = new Map<string, string>()
const id = (ref: string): string => {
  const v = ids.get(ref)
  if (!v) throw new Error(`seed question ${ref} not found`)
  return v
}
const PASAR = ['SEED-GRP-PASAR-1', 'SEED-GRP-PASAR-2', 'SEED-GRP-PASAR-3']

beforeAll(async () => {
  t = await bootIntegrationApp()
  student = await loginAs(t, STUDENT)
  const rows = await t.db.query<{ id: string; ref: string }>(
    `select q.id::text as id, v.number_label as ref from questions q
       join question_versions v on v.question_id = q.id and v.version_no = q.latest_version_no
      where v.number_label like 'SEED-%'`,
  )
  for (const r of rows) ids.set(r.ref, r.id)
}, 180_000)
afterAll(async () => {
  await t.close()
})

const start = async (body: Record<string, unknown>) => BijakKuizSessionSchema.parse((await student.post('/api/bijak/kuiz/sessions', body)).body.data)

describe('random Kuiz: a stimulus group is drawn whole or not at all (S1-T06)', () => {
  it('[CI] AC-QP-6: a whole group is served together, contiguous and in group order', async () => {
    const s = await start({ subject: 'BM', count: 5 })
    const items = s.items.map((i) => i.id)
    const pasar = items.filter((x) => PASAR.map(id).includes(x))
    expect(pasar).toEqual(PASAR.map(id))
    const first = items.indexOf(pasar[0]!)
    expect(items.slice(first, first + 3)).toEqual(PASAR.map(id))
  })

  it('[CI] AC-QP-6: a group with a member that cannot be served is excluded whole; its other members are not drawn singly', async () => {
    await t.db.query(`update questions set is_active = false where id = $1::bigint`, [id('SEED-GRP-PASAR-3')])
    try {
      const served = (await start({ subject: 'BM', count: 5 })).items.map((i) => i.id)
      for (const ref of PASAR) expect(served).not.toContain(id(ref))
      // regression: the questions that are not in a group are served exactly as before
      expect([...served].sort()).toEqual(['SEED-MCQ-BM-T4', 'SEED-MCQ-BM-T5'].map(id).sort())
    } finally {
      await t.db.query(`update questions set is_active = true where id = $1::bigint`, [id('SEED-GRP-PASAR-3')])
    }
  })

  it('[CI] AC-QP-6: over many draws of 5 across all subjects, every group present in a session is present with all its members', async () => {
    const size = new Map<string, number>(
      (await t.db.query<{ g: string; n: string }>(`select group_id::text g, count(*)::text n from questions where group_id is not null group by group_id`)).map((r) => [r.g, Number(r.n)]),
    )
    for (let i = 0; i < 12; i++) {
      const s = await start({ count: 5 })
      expect(s.items.length).toBeLessThanOrEqual(5)
      const per = new Map<string, number>()
      for (const it of s.items) if (it.groupId) per.set(it.groupId, (per.get(it.groupId) ?? 0) + 1)
      for (const [g, n] of per) expect(n).toBe(size.get(g))
    }
  })

  it('[CI] regression: a subject without any stimulus group is drawn as before (plain questions, count honoured)', async () => {
    const s = await start({ subject: 'MATH', count: 5 })
    expect(s.items.length).toBeGreaterThan(0)
    expect(s.items.every((i) => i.groupId === null)).toBe(true)
    expect(s.count).toBe(s.items.length)
  })
})
