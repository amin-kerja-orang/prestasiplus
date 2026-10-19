import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { ACCOUNT_FAITHS, NOTIFICATION_CATEGORIES } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestDatabase, type TestDatabase } from '../support/db'

const MODELS_JSON = fileURLToPath(new URL('../../prisma/migratable-models.json', import.meta.url))
const HASH = 'a'.repeat(64)

describe('account schema (migration 0007_account_notifications)', () => {
  let db: TestDatabase
  let userId: string
  let n = 0

  const user = async (): Promise<string> =>
    (await db.query<{ id: string }>(`insert into users (name) values ('Pengguna ${n++}') returning id::text`))[0]!.id
  const rejects = async (sql: string, params: unknown[] = []): Promise<string> => {
    try {
      await db.query(sql, params)
    } catch (err) {
      return err instanceof Error ? err.message : String(err)
    }
    throw new Error(`Expected the statement to be rejected: ${sql}`)
  }
  const columns = async (table: string): Promise<string[]> =>
    (await db.query<{ column_name: string }>(`select column_name from information_schema.columns where table_name = $1`, [table])).map(
      (c) => c.column_name,
    )
  const reset = (hash: string, channel = 'email', uid = userId) =>
    db.query(`insert into password_resets (user_id, token_hash, channel, expires_at) values ($1, $2, $3, now() + interval '60 minutes')`, [
      uid,
      hash,
      channel,
    ])
  const notification = (category: string | null, uid = userId, type = 'spaced_review') =>
    db.query(`insert into notifications (user_id, type, category, title, body) values ($1, $2, $3, 'Tajuk', 'Isi')`, [uid, type, category])

  beforeAll(async () => {
    db = await createTestDatabase()
    userId = await user()
  })
  afterAll(async () => {
    await db.drop()
  })

  it('creates the three tables with identity keys', async () => {
    for (const t of ['password_resets', 'user_settings', 'notifications']) {
      const [c] = await db.query<{ is_identity: string; identity_generation: string }>(
        `select is_identity, identity_generation from information_schema.columns where table_name = $1 and column_name = 'id'`,
        [t],
      )
      expect(c).toMatchObject({ is_identity: 'YES', identity_generation: 'ALWAYS' })
    }
  })

  it('stores only a token hash (no plaintext token column), unique and at least 32 characters', async () => {
    const cols = await columns('password_resets')
    expect(cols).toContain('token_hash')
    expect(cols.filter((c) => /^(token|raw_token|reset_token|ic|ic_number)$/.test(c))).toEqual([])
    expect(cols.filter((c) => c.startsWith('legacy_'))).toEqual([])
    await reset(HASH)
    expect(
      await rejects(`insert into password_resets (user_id, token_hash, channel, expires_at) values ($1, $2, 'email', now() + interval '1 hour')`, [userId, HASH]),
    ).toMatch(/uq_password_resets_token_hash/)
    expect(
      await rejects(`insert into password_resets (user_id, token_hash, channel, expires_at) values ($1, 'short', 'email', now() + interval '1 hour')`, [userId]),
    ).toMatch(/ck_password_resets_token_hash/)
  })

  it('checks the reset channel and expiry, keeps single-use state, and indexes the 60 s throttle lookup', async () => {
    await reset('b'.repeat(64), 'ic')
    expect(
      await rejects(`insert into password_resets (user_id, token_hash, channel, expires_at) values ($1, $2, 'sms', now() + interval '1 hour')`, [
        userId,
        'c'.repeat(64),
      ]),
    ).toMatch(/ck_password_resets_channel/)
    expect(
      await rejects(`insert into password_resets (user_id, token_hash, channel, expires_at) values ($1, $2, 'email', now() - interval '1 hour')`, [
        userId,
        'd'.repeat(64),
      ]),
    ).toMatch(/ck_password_resets_expires/)
    await db.query(`update password_resets set used_at = now() where token_hash = $1`, [HASH])
    const [r] = await db.query<{ used: boolean }>(`select used_at is not null as used from password_resets where token_hash = $1`, [HASH])
    expect(r!.used).toBe(true)
    const [ix] = await db.query<{ indexdef: string }>(`select indexdef from pg_indexes where indexname = 'ix_password_resets_user_id_created_at'`)
    expect(ix!.indexdef).toMatch(/\(user_id, created_at\)/)
  })

  it('cascades password_resets, user_settings and notifications when the user is deleted', async () => {
    const u = await user()
    await reset('e'.repeat(64), 'email', u)
    await db.query(`insert into user_settings (user_id) values ($1)`, [u])
    await notification('system', u)
    expect(
      await rejects(`insert into password_resets (user_id, token_hash, channel, expires_at) values (999999999, $1, 'email', now() + interval '1 hour')`, [
        'f'.repeat(64),
      ]),
    ).toMatch(/fk_password_resets_user_id/)
    expect(await rejects(`insert into notifications (user_id, type, title, body) values (999999999, 'x', 't', 'b')`)).toMatch(/fk_notifications_user_id/)
    await db.query(`delete from users where id = $1`, [u])
    for (const t of ['password_resets', 'user_settings', 'notifications']) {
      expect(await db.query(`select 1 from ${t} where user_id = $1`, [u])).toHaveLength(0)
    }
  })

  it('keeps one settings row per user with the mock defaults and a nullable faith', async () => {
    await db.query(`insert into user_settings (user_id) values ($1)`, [userId])
    const [s] = await db.query<Record<string, unknown>>(
      `select spiritual_mode, show_bismillah_splash, subuh_push_enabled, to_char(subuh_push_time, 'HH24:MI') as subuh,
              ramadan_mode_enabled, to_char(sahur_push_time, 'HH24:MI') as sahur, faith from user_settings where user_id = $1`,
      [userId],
    )
    expect(s).toEqual({
      spiritual_mode: false,
      show_bismillah_splash: false,
      subuh_push_enabled: false,
      subuh: '05:30',
      ramadan_mode_enabled: false,
      sahur: '04:30',
      faith: null,
    })
    expect(await rejects(`insert into user_settings (user_id) values ($1)`, [userId])).toMatch(/uq_user_settings_user_id/)
    expect((await columns('user_settings')).filter((x) => x.startsWith('legacy_'))).toEqual([])
  })

  it('accepts the contract faiths and rejects any other', async () => {
    for (const faith of ACCOUNT_FAITHS) await db.query(`update user_settings set faith = $2 where user_id = $1`, [userId, faith])
    await db.query(`update user_settings set faith = null where user_id = $1`, [userId])
    expect(await rejects(`update user_settings set faith = 'atheist' where user_id = $1`, [userId])).toMatch(/ck_user_settings_faith/)
  })

  it('accepts the contract notification categories (and null) and rejects any other', async () => {
    for (const c of NOTIFICATION_CATEGORIES) await notification(c)
    await notification(null, userId, 'new_ticket')
    expect(await rejects(`insert into notifications (user_id, type, category, title, body) values ($1, 'x', 'promo', 't', 'b')`, [userId])).toMatch(
      /ck_notifications_category/,
    )
    expect(await rejects(`insert into notifications (user_id, type, category, title, body) values ($1, '', 'system', 't', 'b')`, [userId])).toMatch(
      /ck_notifications_type/,
    )
  })

  it('indexes the inbox page and the unread count, and uses them', async () => {
    const [inbox] = await db.query<{ indexdef: string }>(`select indexdef from pg_indexes where indexname = 'ix_notifications_user_id_created_at_id'`)
    expect(inbox!.indexdef).toMatch(/\(user_id, created_at DESC, id DESC\)/)
    const [unread] = await db.query<{ indexdef: string }>(`select indexdef from pg_indexes where indexname = 'ix_notifications_user_id_unread'`)
    expect(unread!.indexdef).toMatch(/\(user_id\) WHERE \(read_at IS NULL\)/)
    await db.query(`set enable_seqscan = off`)
    const plan = async (sql: string): Promise<string> =>
      (await db.query<{ 'QUERY PLAN': string }>(`explain ${sql}`, [userId])).map((x) => x['QUERY PLAN']).join('\n')
    expect(await plan(`select * from notifications where user_id = $1 order by created_at desc, id desc limit 20`)).toMatch(
      /ix_notifications_user_id_created_at_id/,
    )
    expect(await plan(`select count(*) from notifications where user_id = $1 and read_at is null`)).toMatch(
      /ix_notifications_user_id_(unread|created_at_id)/,
    )
    await db.query(`reset enable_seqscan`)
  })

  it('lists only notifications as migratable, with a unique legacy pair', async () => {
    const models = JSON.parse(readFileSync(MODELS_JSON, 'utf8')) as string[]
    expect([...models].sort()).toEqual(models)
    expect(models).toContain('notifications')
    expect(models).not.toContain('password_resets')
    expect(models).not.toContain('user_settings')
    expect(await columns('notifications')).toEqual(expect.arrayContaining(['legacy_source', 'legacy_id']))
    expect(await db.query(`select 1 from pg_indexes where indexname = 'uq_notifications_legacy'`)).toHaveLength(1)
    const sql = `insert into notifications (user_id, type, title, body, legacy_source, legacy_id) values ($1, 'x', 't', 'b', $2, $3)`
    await db.query(sql, [userId, 'cloud', '77'])
    expect(await rejects(sql, [userId, 'cloud', '77'])).toMatch(/uq_notifications_legacy/)
    expect(await rejects(sql, [userId, 'mars', '78'])).toMatch(/ck_notifications_legacy_source/)
  })
})
