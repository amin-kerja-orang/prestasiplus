import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { loginAs as loginWithIdentifier } from '../curriculum/helpers'
import { bootQuestionsApp, expectError, loginAs, type Client, type QuestionsTestApp } from './helpers'

/**
 * admin-list-perf (A2 pre-scan Minor): a 1 to 2 character or punctuation-only search term cannot use the trigram index (migration 0106)
 * and scans the bank, and V2 accepts such terms (no 422). The list route therefore has a per-user bucket
 * (`THROTTLE_QUESTIONS_LIST_PER_MINUTE`, default 60). A small limit makes it visible; the test clock never advances inside the spec.
 */
describe('GET /api/questions: per-user rate limit for the list (admin-list-perf)', () => {
  let t: QuestionsTestApp
  let admin: Client
  let other: Client

  beforeAll(async () => {
    process.env.THROTTLE_QUESTIONS_LIST_PER_MINUTE = '4'
    t = await bootQuestionsApp()
    admin = await loginAs(t, 'admin')
    // A second Admin Pusat (same demo password) to prove the bucket is per user.
    const [u] = await t.db.query<{ id: string }>(
      `insert into users (name, email, password_hash, is_active, created_at, updated_at)
       select 'Admin Pusat Kedua', 'admin2@demo.test', password_hash, true, now(), now() from users where email = 'admin@demo.test' returning id::text`,
    )
    await t.db.query(`insert into user_roles (user_id, role) values ($1::bigint, 'admin')`, [u?.id])
    other = await loginWithIdentifier(t as never, 'admin2@demo.test')
  })
  afterAll(async () => {
    delete process.env.THROTTLE_QUESTIONS_LIST_PER_MINUTE
    await t.close()
  })

  it('short and punctuation-only terms are still accepted (200, not 422) until the per-user limit, then 429 with Retry-After', async () => {
    for (const q of ['a', 'ab', '%', '_']) {
      const res = await admin.get(`/api/questions?search=${encodeURIComponent(q)}`)
      expect(res.status, `search=${q}: ${JSON.stringify(res.body)}`).toBe(200)
    }
    const limited = await admin.get(`/api/questions?search=${encodeURIComponent('\\')}`)
    expectError(limited, 'RATE_LIMITED')
    expect(limited.status).toBe(429)
    expect(Number(limited.headers['retry-after'])).toBeGreaterThanOrEqual(1)
    // The same bucket covers every list call of that user, not only short terms.
    expectError(await admin.get('/api/questions'), 'RATE_LIMITED')
  })

  it('another user is not affected, and a normal search works', async () => {
    const res = await other.get('/api/questions?search=Matematik')
    expect(res.status, JSON.stringify(res.body)).toBe(200)
  })
})
