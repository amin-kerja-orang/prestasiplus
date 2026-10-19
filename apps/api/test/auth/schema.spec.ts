import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { ROLE_CODES, SCOPE_LEVELS } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestDatabase, TEST_TX, type TestDatabase } from '../support/db'

const MODELS_JSON = fileURLToPath(new URL('../../prisma/migratable-models.json', import.meta.url))

describe('identity schema (migration 0002_identity)', () => {
  let db: TestDatabase
  let schoolId: string
  let userId: string

  beforeAll(async () => {
    db = await createTestDatabase()
    const [s] = await db.query<{ id: string }>(
      `insert into schools (name, code) values ('SMK Ujian', 'UJI001') returning id::text`,
    )
    schoolId = s!.id
    const [u] = await db.query<{ id: string }>(
      `insert into users (name, email, school_id) values ('Pengguna Ujian', 'Ujian@Demo.Test', $1) returning id::text`,
      [schoolId],
    )
    userId = u!.id
  })
  afterAll(async () => {
    await db.drop()
  })

  const rejects = async (sql: string, params: unknown[] = []): Promise<string> => {
    try {
      await db.query(sql, params)
    } catch (err) {
      return err instanceof Error ? err.message : String(err)
    }
    throw new Error(`Expected the statement to be rejected: ${sql}`)
  }

  it('creates the seven tables', async () => {
    const rows = await db.query<{ table_name: string }>(
      `select table_name from information_schema.tables where table_schema = 'public' order by 1`,
    )
    const names = rows.map((r) => r.table_name)
    for (const t of [
      'audit_events',
      'login_attempts',
      'schools',
      'sessions',
      'user_roles',
      'user_scopes',
      'users',
    ]) {
      expect(names).toContain(t)
    }
  })

  it('lists the migratable tables and gives each the legacy pair and its unique index', async () => {
    const models = JSON.parse(readFileSync(MODELS_JSON, 'utf8')) as string[]
    for (const t of ['schools', 'user_roles', 'user_scopes', 'users']) expect(models).toContain(t)
    expect([...models].sort()).toEqual(models)
    for (const t of ['schools', 'user_roles', 'user_scopes', 'users']) {
      const cols = await db.query<{ column_name: string }>(
        `select column_name from information_schema.columns where table_name = $1`,
        [t],
      )
      expect(cols.map((c) => c.column_name)).toEqual(expect.arrayContaining(['legacy_source', 'legacy_id']))
      const idx = await db.query<{ indexname: string }>(`select indexname from pg_indexes where indexname = $1`, [
        `uq_${t}_legacy`,
      ])
      expect(idx).toHaveLength(1)
    }
    // users also carries legacy_hash; the runtime tables carry no legacy columns.
    const hash = await db.query(
      `select 1 from information_schema.columns where table_name = 'users' and column_name = 'legacy_hash'`,
    )
    expect(hash).toHaveLength(1)
    for (const t of ['sessions', 'login_attempts', 'audit_events']) {
      const cols = await db.query(
        `select 1 from information_schema.columns where table_name = $1 and column_name like 'legacy_%'`,
        [t],
      )
      expect(cols).toHaveLength(0)
    }
  })

  it('uses GENERATED ALWAYS identity keys', async () => {
    const msg = await rejects(`insert into users (id, name) values (999, 'Tidak boleh')`)
    expect(msg).toMatch(/non-DEFAULT/)
    const ident = await db.query<{ table_name: string; identity_generation: string }>(
      `select table_name, identity_generation from information_schema.columns
        where table_schema = 'public' and column_name = 'id' and is_identity = 'YES' order by 1`,
    )
    expect(ident.map((r) => r.table_name)).toEqual([
      'audit_events',
      'login_attempts',
      'schools',
      'user_roles',
      'user_scopes',
      'users',
    ])
    expect(new Set(ident.map((r) => r.identity_generation))).toEqual(new Set(['ALWAYS']))
  })

  it('stores enums as text + check with the contract codes', async () => {
    for (const role of ROLE_CODES) {
      await db.query(`insert into user_roles (user_id, role) values ($1, $2) on conflict do nothing`, [userId, role])
    }
    expect(await rejects(`insert into user_roles (user_id, role) values ($1, 'superuser')`, [userId])).toMatch(
      /ck_user_roles_role/,
    )
    for (const level of SCOPE_LEVELS) {
      // a valid row for every level: the fields the level requires are supplied
      await db.query(
        `insert into user_scopes (user_id, role, level, state_code, district_code, school_id)
         values ($1, 'teacher', $2, 'SGR', 'PETALING', $3)
         on conflict (user_id, role) do update set level = excluded.level`,
        [userId, level, schoolId],
      )
    }
    expect(
      await rejects(`insert into user_scopes (user_id, role, level) values ($1, 'admin', 'galaxy')`, [userId]),
    ).toMatch(/ck_user_scopes_level/)
    const enumTypes = await db.query(`select 1 from pg_type where typtype = 'e' and typnamespace = 'public'::regnamespace`)
    expect(enumTypes).toHaveLength(0)
  })

  it('mirrors the contract scope refinement in a check', async () => {
    const bad = [
      ['state', null, null, null],
      ['district', null, null, null],
      ['school', null, null, null],
      ['class', null, null, null],
    ] as const
    for (const [level, st, di, sc] of bad) {
      expect(
        await rejects(
          `insert into user_scopes (user_id, role, level, state_code, district_code, school_id)
           values ($1, 'ppd_officer', $2, $3, $4, $5)`,
          [userId, level, st, di, sc],
        ),
      ).toMatch(/ck_user_scopes_shape/)
    }
    await db.query(`delete from user_scopes where user_id = $1`, [userId])
    await db.query(`insert into user_scopes (user_id, role, level) values ($1, 'admin', 'national')`, [userId])
    expect(
      await rejects(`insert into user_scopes (user_id, role, level) values ($1, 'admin', 'self')`, [userId]),
    ).toMatch(/uq_user_scopes_user_id_role/)
  })

  it('keeps e-mail unique case-insensitively, null allowed many times', async () => {
    expect(await rejects(`insert into users (name, email) values ('Salinan', 'ujian@demo.test')`)).toMatch(
      /uq_users_email/,
    )
    await db.query(`insert into users (name) values ('Tanpa E-mel A'), ('Tanpa E-mel B')`)
  })

  it('keeps a username unique per school, case-insensitively, and shareable across schools', async () => {
    const [s2] = await db.query<{ id: string }>(
      `insert into schools (name, code) values ('SK Ujian', 'UJI002') returning id::text`,
    )
    await db.query(`insert into users (name, username, school_id) values ('Roster A', 'Murid77', $1)`, [schoolId])
    expect(
      await rejects(`insert into users (name, username, school_id) values ('Roster B', 'murid77', $1)`, [schoolId]),
    ).toMatch(/uq_users_school_username/)
    await db.query(`insert into users (name, username, school_id) values ('Roster C', 'murid77', $1)`, [s2!.id])
    const found = await db.query(`select 1 from users where lower(username) = 'murid77'`)
    expect(found).toHaveLength(2)
  })

  it('enforces the legacy row convention (check + unique pair; many NULL pairs allowed)', async () => {
    await db.query(`insert into users (name, legacy_source, legacy_id) values ('Warisan', 'cloud', '1001')`)
    expect(
      await rejects(`insert into users (name, legacy_source, legacy_id) values ('Warisan 2', 'cloud', '1001')`),
    ).toMatch(/uq_users_legacy/)
    expect(await rejects(`insert into users (name, legacy_source, legacy_id) values ('Ganjil', 'other', '1')`)).toMatch(
      /ck_users_legacy_source/,
    )
    await db.query(`insert into users (name) values ('V2 A'), ('V2 B')`)
  })

  it('restricts grade to 1..11', async () => {
    expect(await rejects(`insert into users (name, grade) values ('Gred', 12)`)).toMatch(/ck_users_grade/)
  })

  it('stores sessions by hash with a consistent mode triple', async () => {
    const base = `insert into sessions (user_id, token_hash, csrf_hash, active_role, expires_at`
    await db.query(`${base}) values ($1, 'h1', 'c1', 'admin', now() + interval '1 hour')`, [userId])
    await db.query(
      `${base}, mode_kind, mode_return_role, mode_since) values ($1, 'h2', 'c2', 'student', now() + interval '1 hour',
       'mod_pelajar', 'admin', now())`,
      [userId],
    )
    expect(
      await rejects(`${base}, mode_kind) values ($1, 'h3', 'c3', 'student', now(), 'mod_pelajar')`, [userId]),
    ).toMatch(/ck_sessions_mode_complete/)
    expect(
      await rejects(`${base}) values ($1, 'h4', 'c4', 'wizard', now())`, [userId]),
    ).toMatch(/ck_sessions_active_role/)
    expect(await rejects(`${base}) values ($1, 'h1', 'c9', 'admin', now())`, [userId])).toMatch(
      /uq_sessions_token_hash/,
    )
    const [row] = await db.query<{ id: string }>(`select id::text from sessions where token_hash = 'h1'`)
    expect(row!.id).toMatch(/^[0-9a-f-]{36}$/)
    const cols = await db.query<{ column_name: string }>(
      `select column_name from information_schema.columns where table_name = 'sessions'`,
    )
    // only hashes: there is no column that could hold the raw cookie value or CSRF token
    expect(cols.map((c) => c.column_name)).not.toEqual(expect.arrayContaining(['token']))
    expect(cols.map((c) => c.column_name)).toEqual(
      expect.arrayContaining(['token_hash', 'csrf_hash', 'remember', 'last_seen_at', 'expires_at', 'revoked_at']),
    )
  })

  it('keeps one throttle counter per identifier + client address', async () => {
    await db.query(
      `insert into login_attempts (identifier_hash, ip_hash, attempts, expires_at) values ('i', 'p', 1, now())`,
    )
    expect(
      await rejects(`insert into login_attempts (identifier_hash, ip_hash, expires_at) values ('i', 'p', now())`),
    ).toMatch(/uq_login_attempts_identifier_ip/)
    await db.query(`insert into login_attempts (identifier_hash, ip_hash, expires_at) values ('i', 'q', now())`)
  })

  it('appends audit events and keeps them when the actor is deleted', async () => {
    const [actor] = await db.query<{ id: string }>(`insert into users (name) values ('Pelaku') returning id::text`)
    await db.query(
      `insert into audit_events (actor_user_id, action, target_type, target_id, detail)
       values ($1::bigint, 'role_switch', 'user', $2::text, '{"from":"teacher","to":"school_admin"}')`,
      [actor!.id, actor!.id],
    )
    await db.query(`delete from users where id = $1`, [actor!.id])
    const rows = await db.query<{ actor_user_id: string | null; is_test: boolean }>(
      `select actor_user_id::text, is_test from audit_events where action = 'role_switch'`,
    )
    expect(rows).toEqual([{ actor_user_id: null, is_test: false }])
  })

  it('cascades roles, scopes and sessions with the user (Prisma client, bigint ids)', async () => {
    const created = await db.prisma.$transaction(async (tx) => {
      const u = await tx.user.create({ data: { name: 'Sementara' } })
      await tx.userRole.create({ data: { userId: u.id, role: 'teacher' } })
      await tx.session.create({
        data: { userId: u.id, tokenHash: 'tmp-hash', csrfHash: 'tmp-csrf', activeRole: 'teacher', expiresAt: new Date() },
      })
      return u
    }, TEST_TX)
    expect(typeof created.id).toBe('bigint')
    await db.prisma.user.delete({ where: { id: created.id } })
    expect(await db.prisma.userRole.count({ where: { userId: created.id } })).toBe(0)
    expect(await db.prisma.session.count({ where: { userId: created.id } })).toBe(0)
  })

  it('defers the created_by self reference to commit', async () => {
    const c = await db.query<{ condeferrable: boolean; condeferred: boolean }>(
      `select condeferrable, condeferred from pg_constraint where conname = 'fk_users_created_by_id'`,
    )
    expect(c).toEqual([{ condeferrable: true, condeferred: true }])
  })

  it('has the lookup indexes the auth module relies on', async () => {
    const rows = await db.query<{ indexname: string }>(`select indexname from pg_indexes where schemaname = 'public'`)
    const names = rows.map((r) => r.indexname)
    for (const n of [
      'uq_users_email',
      'uq_users_school_username',
      'ix_users_username_lower',
      'ix_users_ic_hash',
      'ix_users_school_id',
      'uq_sessions_token_hash',
      'ix_sessions_user_id',
      'ix_sessions_expires_at',
      'uq_login_attempts_identifier_ip',
      'ix_audit_events_action_created_at',
      'ix_audit_events_actor_user_id_created_at',
      'ix_audit_events_target',
      'uq_schools_code',
    ]) {
      expect(names, n).toContain(n)
    }
  })
})
