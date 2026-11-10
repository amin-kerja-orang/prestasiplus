/**
 * M-D on the real loader output: the verify check "stimulus groups: members, order and completeness versus the V2 plan" passes on a clean load
 * (a carrier group, V2 order) and is a `mismatch` (never only reported) when two members swap position (out of V2 order), a gap is left in
 * group_position, or a member is detached from its group (a split). Synthetic rows only.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runVerify } from '../../../src/migration/verify'
import { addArchive, bootQuestions, type QuestionsHarness } from './helpers'

let h: QuestionsHarness
const NAME = 'stimulus groups: members, order and completeness versus the V2 plan'
const check = async () => (await runVerify({ pool: h.pool, env: h.runEnv, source: 'cloud' })).checks.find((c) => c.name === NAME)
const sql = (t: string, p: unknown[] = []) => h.pool.query(t, p)
const memberIds = async (): Promise<{ id: string; legacy_id: string; group_position: number }[]> =>
  (await sql(`select id::text as id, legacy_id, group_position::int as group_position from questions where group_id is not null and legacy_id in ('5002', '5003') order by group_position`)).rows

type Member = Awaited<ReturnType<typeof memberIds>>[number]
const pair = async (): Promise<[Member, Member]> => {
  const m = await memberIds()
  return [m[0] as Member, m[1] as Member]
}

beforeAll(async () => {
  h = await bootQuestions()
  // carrier "Rajah 1" (5001, no options) with followers 5002 and 5003; 5004 is a plain question.
  await addArchive(h.pool, [
    { id: 5001, body: 'Rajah 1', image: 'soalan/rajah-a.png', options: [] },
    { id: 5002, body: 'Berdasarkan Rajah 1, hitung luas kawasan berlorek.' },
    { id: 5003, body: 'Berdasarkan Rajah 1, nyatakan jenis sudut.' },
    { id: 5004, body: 'Soalan biasa 5004 tanpa rujukan.' },
  ])
  await h.both()
}, 300_000)
afterAll(async () => {
  await h?.close()
})

describe('stimulus groups versus the V2 plan (M-D)', () => {
  it('passes on a clean load: the group has both followers, positions 1..2, V2 order', async () => {
    expect((await memberIds()).map((m) => [m.legacy_id, m.group_position])).toEqual([['5002', 1], ['5003', 2]])
    const c = await check()
    expect(c, JSON.stringify(c)).toMatchObject({ status: 'ok', expected: 0, actual: 0 })
    expect(c?.detail).toContain('1 planned groups with 2 loaded members')
  })

  it('is a mismatch when two members are out of V2 order', async () => {
    const [a, b] = await pair()
    await sql(`update questions set group_position = group_position + 100 where id in ($1::bigint, $2::bigint)`, [a.id, b.id])
    await sql(`update questions set group_position = case id when $1::bigint then 2 else 1 end where id in ($1::bigint, $2::bigint)`, [a.id, b.id])
    const c = await check()
    expect(c?.status).toBe('mismatch')
    expect(c?.detail).toContain('1 out of V2 order')
    await sql(`update questions set group_position = group_position + 100 where id in ($1::bigint, $2::bigint)`, [a.id, b.id])
    await sql(`update questions set group_position = case id when $1::bigint then 1 else 2 end where id in ($1::bigint, $2::bigint)`, [a.id, b.id])
    expect((await check())?.status).toBe('ok')
  })

  it('is a mismatch for a gap in group_position', async () => {
    const [, b] = await pair()
    await sql(`update questions set group_position = 5 where id = $1::bigint`, [b.id])
    const c = await check()
    expect(c?.status).toBe('mismatch')
    expect(c?.detail).toContain('1 with a gap in group_position')
    await sql(`update questions set group_position = 2 where id = $1::bigint`, [b.id])
  })

  it('is a mismatch for a split group (a member detached from its group)', async () => {
    const [, b] = await pair()
    await sql(`update questions set group_id = null, group_position = null where id = $1::bigint`, [b.id])
    const c = await check()
    expect(c?.status).toBe('mismatch')
    expect(c?.detail).toContain('1 split')
    expect(c?.detail).toContain('1 with the wrong member count')
  })
})
