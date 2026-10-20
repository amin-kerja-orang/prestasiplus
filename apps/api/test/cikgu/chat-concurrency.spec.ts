import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { STUDENT_1, TEACHER_A, TEACHER_B, bootCikguApp, client, idOfEmail, type CikguTestApp } from './helpers'

describe('quota under concurrency (AC4): the advisory lock keeps the limit exact', () => {
  let t: CikguTestApp

  beforeAll(async () => {
    t = await bootCikguApp()
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  it('40 parallel teacher turns: exactly 30 succeed and 10 are 429 {"quota_exhausted":true}; 30 turns stored', async () => {
    const teacher = await client(t, TEACHER_B)
    const results = await Promise.all(Array.from({ length: 40 }, (_, i) => teacher.post('/cikgu/send', { message: `Terangkan topik ${String(i)}` })))
    const ok = results.filter((r) => r.status === 200)
    const exhausted = results.filter((r) => r.status === 429)
    expect(ok).toHaveLength(30)
    expect(exhausted).toHaveLength(10)
    for (const r of exhausted) expect(r.text).toBe('{"quota_exhausted":true}')
    // Every success saw a different count: turns_remaining is 29 down to 0, once each.
    expect(ok.map((r) => r.body.turns_remaining as number).sort((a, b) => a - b)).toEqual(Array.from({ length: 30 }, (_, i) => i))
    const userId = await idOfEmail(t, TEACHER_B)
    const turns = await t.db.query<{ n: number }>(`select count(*)::int n from chat_messages where user_id = $1 and role = 'user'`, [userId])
    expect(turns[0]?.n).toBe(30)
    expect((await t.db.query<{ n: number }>(`select count(*)::int n from chat_messages where user_id = $1 and role = 'bot'`, [userId]))[0]?.n).toBe(30)
  })

  it('parallel turns of different users do not block each other: each gets its own count', async () => {
    const a = await client(t, TEACHER_A)
    const s = await client(t, STUDENT_1)
    const results = await Promise.all([
      ...Array.from({ length: 12 }, () => a.post('/cikgu/send', { message: 'hai' })),
      ...Array.from({ length: 12 }, () => s.post('/cikgu/send', { message: 'hai' })),
    ])
    expect(results.slice(0, 12).every((r) => r.status === 200)).toBe(true)
    expect(results.slice(12).filter((r) => r.status === 200)).toHaveLength(10)
    expect(results.slice(12).filter((r) => r.status === 429)).toHaveLength(2)
  })
})
