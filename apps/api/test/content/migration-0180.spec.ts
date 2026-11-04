import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestDatabase, type TestDatabase } from '../support/db'

/**
 * S7-T09, DM-32, migration 0180: support_tickets gains created_role, school_id, admin_replied_by_id, admin_replied_at and an index.
 * The test database already ran the migration, so the backfill is proved by re-running its statements (read from the migration file)
 * on rows whose new columns were reset to NULL.
 */
const sql = readFileSync(join(__dirname, '../../prisma/migrations/0180_s5_support_ticket_context/migration.sql'), 'utf8')
const backfill = sql.slice(sql.indexOf('-- Backfill'), sql.indexOf('-- Down')).split(';').map((s) => s.trim()).filter((s) => /^(--[^\n]*\n)*\s*UPDATE/i.test(s))

describe('migration 0180 support ticket context', () => {
  let db: TestDatabase
  let schoolId: string
  let singleUser: string
  let dualUser: string
  let adminUser: string
  let singleTicket: string
  let dualTicket: string

  const q = async (text: string, params?: unknown[]) => db.query<{ id: string }>(text, params)
  const resetNew = () => db.query(`update support_tickets set created_role = null, school_id = null`)
  const runBackfill = async () => {
    for (const stmt of backfill) await db.query(stmt)
  }
  const ticket = async (id: string) =>
    (await db.query<{ created_role: string | null; school_id: string | null }>(`select created_role, school_id::text from support_tickets where id = $1::bigint`, [id]))[0]!

  beforeAll(async () => {
    db = await createTestDatabase()
    schoolId = (await q(`insert into schools (name, code) values ('SK Ujian 0180', 'M0180') returning id::text`))[0]!.id
    singleUser = (await q(`insert into users (name, email, school_id) values ('Murid Satu', 'm0180a@example.test', $1::bigint) returning id::text`, [schoolId]))[0]!.id
    dualUser = (await q(`insert into users (name, email, school_id) values ('Guru Dua', 'm0180b@example.test', $1::bigint) returning id::text`, [schoolId]))[0]!.id
    adminUser = (await q(`insert into users (name, email) values ('Admin Ujian', 'm0180c@example.test') returning id::text`))[0]!.id
    await db.query(`insert into user_roles (user_id, role) values ($1::bigint, 'student'), ($2::bigint, 'teacher'), ($2::bigint, 'school_admin')`, [singleUser, dualUser])
    singleTicket = (await q(`insert into support_tickets (user_id, subject, body) values ($1::bigint, 'S', 'b') returning id::text`, [singleUser]))[0]!.id
    dualTicket = (await q(`insert into support_tickets (user_id, subject, body) values ($1::bigint, 'D', 'b') returning id::text`, [dualUser]))[0]!.id
  })
  afterAll(async () => {
    await db.drop()
  })

  it('the four nullable columns and the index exist', async () => {
    const cols = await db.query<{ column_name: string; is_nullable: string; data_type: string }>(
      `select column_name, is_nullable, data_type from information_schema.columns where table_name = 'support_tickets'
        and column_name in ('created_role','school_id','admin_replied_by_id','admin_replied_at') order by column_name`,
    )
    expect(cols).toEqual([
      { column_name: 'admin_replied_at', is_nullable: 'YES', data_type: 'timestamp with time zone' },
      { column_name: 'admin_replied_by_id', is_nullable: 'YES', data_type: 'bigint' },
      { column_name: 'created_role', is_nullable: 'YES', data_type: 'text' },
      { column_name: 'school_id', is_nullable: 'YES', data_type: 'bigint' },
    ])
    const idx = await db.query<{ indexdef: string }>(`select indexdef from pg_indexes where indexname = 'ix_support_tickets_role_status_created'`)
    expect(idx).toHaveLength(1)
    expect(idx[0]!.indexdef).toContain('(created_role, status, created_at DESC)')
  })

  it('both foreign keys are validated and set null on delete', async () => {
    const rows = await db.query<{ conname: string; confdeltype: string; convalidated: boolean }>(
      `select conname, confdeltype::text, convalidated from pg_constraint where conrelid = 'support_tickets'::regclass
        and conname in ('fk_support_tickets_school_id','fk_support_tickets_admin_replied_by_id') order by conname`,
    )
    expect(rows).toEqual([
      { conname: 'fk_support_tickets_admin_replied_by_id', confdeltype: 'n', convalidated: true },
      { conname: 'fk_support_tickets_school_id', confdeltype: 'n', convalidated: true },
    ])

    const sch = (await q(`insert into schools (name, code) values ('SK Padam', 'M0180X') returning id::text`))[0]!.id
    const t = (await q(`insert into support_tickets (user_id, subject, body, school_id, admin_replied_by_id, admin_replied_at) values ($1::bigint, 'P', 'b', $2::bigint, $3::bigint, now()) returning id::text`, [singleUser, sch, adminUser]))[0]!.id
    await db.query(`delete from schools where id = $1::bigint`, [sch])
    await db.query(`delete from users where id = $1::bigint`, [adminUser])
    const after = await db.query<{ school_id: string | null; admin_replied_by_id: string | null }>(`select school_id::text, admin_replied_by_id::text from support_tickets where id = $1::bigint`, [t])
    expect(after).toEqual([{ school_id: null, admin_replied_by_id: null }])
  })

  it('the check accepts the seven roles and null and rejects a bad role', async () => {
    for (const role of ['admin', 'school_admin', 'ppd_officer', 'teacher', 'student', 'parent', 'sponsor']) {
      await db.query(`update support_tickets set created_role = $2 where id = $1::bigint`, [singleTicket, role])
    }
    await db.query(`update support_tickets set created_role = null where id = $1::bigint`, [singleTicket])
    await expect(db.query(`update support_tickets set created_role = 'superuser' where id = $1::bigint`, [singleTicket])).rejects.toMatchObject({ code: '23514' })
  })

  it('the backfill fills school_id and created_role for a single-role user and leaves created_role null for a dual-role user', async () => {
    expect(backfill).toHaveLength(2)
    await resetNew()
    await runBackfill()
    expect(await ticket(singleTicket)).toEqual({ created_role: 'student', school_id: schoolId })
    expect(await ticket(dualTicket)).toEqual({ created_role: null, school_id: schoolId })
  })

  it('a re-run is a no-op and never overwrites a value already set', async () => {
    await db.query(`update support_tickets set created_role = 'parent' where id = $1::bigint`, [dualTicket])
    const before = await db.query(`select id, created_role, school_id, updated_at from support_tickets order by id`)
    await runBackfill()
    await runBackfill()
    expect(await db.query(`select id, created_role, school_id, updated_at from support_tickets order by id`)).toEqual(before)
    expect((await ticket(dualTicket)).created_role).toBe('parent')
  })
})
