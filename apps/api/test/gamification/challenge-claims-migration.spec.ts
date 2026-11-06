import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestDatabase, type TestDatabase } from '../support/db'

/**
 * S7-T04 part 1, DM-63, migration 0226: `challenge_claims`, its unique (user, challenge, MYT day) and the partial unique
 * (user, client_uuid). Ruling 20 on #500.
 */
describe('migration 0226 challenge_claims', () => {
  let db: TestDatabase

  const user = async (): Promise<string> => (await db.query<{ id: string }>(`insert into users (name) values ('Pelajar Contoh') returning id::text`))[0]!.id
  const challenge = async (): Promise<string> =>
    (await db.query<{ id: string }>(`insert into challenges (title, challenge_type, target_value) values ('Cabaran', 'quiz_count', 1) returning id::text`))[0]!.id
  const claim = (userId: string, challengeId: string, day: string, opts: { syiling?: number; xp?: number; uuid?: string | null } = {}) =>
    db.query(
      `insert into challenge_claims (user_id, challenge_id, myt_date, reward_syiling, reward_xp, client_uuid) values ($1::bigint, $2::bigint, $3::date, $4, $5, $6::uuid)`,
      [userId, challengeId, day, opts.syiling ?? 5, opts.xp ?? 10, opts.uuid ?? null],
    )
  const rejects = async (run: () => Promise<unknown>): Promise<string> => {
    try {
      await run()
    } catch (err) {
      return err instanceof Error ? err.message : String(err)
    }
    throw new Error('Expected the statement to be rejected')
  }
  const count = async (userId: string) => (await db.query(`select 1 from challenge_claims where user_id = $1::bigint`, [userId])).length

  beforeAll(async () => {
    db = await createTestDatabase()
  })
  afterAll(async () => {
    await db.drop()
  })

  it('refuses a second claim of the same user, challenge and day and keeps the first', async () => {
    const [u, c] = [await user(), await challenge()]
    await claim(u, c, '2026-11-05')
    expect(await rejects(() => claim(u, c, '2026-11-05', { syiling: 0, xp: 1 }))).toMatch(/uq_challenge_claims_user_challenge_date/)
    expect(await count(u)).toBe(1)
  })

  it('allows the same user and challenge on another day, and another user or challenge on the same day', async () => {
    const [u, other] = [await user(), await user()]
    const [c, c2] = [await challenge(), await challenge()]
    await claim(u, c, '2026-11-05')
    await claim(u, c, '2026-11-06')
    await claim(u, c2, '2026-11-05')
    await claim(other, c, '2026-11-05')
    expect(await count(u)).toBe(3)
  })

  it('allows two rows with a NULL client_uuid for one user', async () => {
    const [u, c] = [await user(), await challenge()]
    await claim(u, c, '2026-11-05', { uuid: null })
    await claim(u, c, '2026-11-06', { uuid: null })
    expect(await count(u)).toBe(2)
  })

  it('refuses a repeated non-null client_uuid for one user', async () => {
    const [u, c] = [await user(), await challenge()]
    const id = randomUUID()
    await claim(u, c, '2026-11-05', { uuid: id })
    expect(await rejects(() => claim(u, c, '2026-11-06', { uuid: id }))).toMatch(/uq_challenge_claims_user_id_client_uuid/)
    expect(await count(u)).toBe(1)
  })

  it('allows the same client_uuid for two different users', async () => {
    const [a, b, c] = [await user(), await user(), await challenge()]
    const id = randomUUID()
    await claim(a, c, '2026-11-05', { uuid: id })
    await claim(b, c, '2026-11-05', { uuid: id })
    expect(await db.query(`select 1 from challenge_claims where client_uuid = $1::uuid`, [id])).toHaveLength(2)
  })

  it('refuses negative rewards and accepts zero (coins disabled)', async () => {
    const [u, c] = [await user(), await challenge()]
    expect(await rejects(() => claim(u, c, '2026-11-05', { syiling: -1 }))).toMatch(/ck_challenge_claims_reward_syiling/)
    expect(await rejects(() => claim(u, c, '2026-11-05', { xp: -1 }))).toMatch(/ck_challenge_claims_reward_xp/)
    await claim(u, c, '2026-11-05', { syiling: 0, xp: 0 })
    expect(await count(u)).toBe(1)
  })

  it('deletes the claims with the user or the challenge', async () => {
    const [u, c] = [await user(), await challenge()]
    await claim(u, c, '2026-11-05')
    await db.query(`delete from challenges where id = $1::bigint`, [c])
    expect(await count(u)).toBe(0)

    const [u2, c2] = [await user(), await challenge()]
    await claim(u2, c2, '2026-11-05')
    expect(await count(u2)).toBe(1)
    await db.query(`delete from users where id = $1::bigint`, [u2])
    expect(await count(u2)).toBe(0)
    expect(await db.query(`select 1 from challenges where id = $1::bigint`, [c2])).toHaveLength(1) // the challenge stays
  })
})
