import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { SUBSCRIPTION_STATUSES, SUBSCRIPTION_TIERS } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestDatabase, type TestDatabase } from '../support/db'

const MODELS_JSON = fileURLToPath(new URL('../../prisma/migratable-models.json', import.meta.url))
const TABLES = ['school_packages', 'school_subscriptions', 'user_packages', 'parent_links', 'parent_invites', 'comp_students']

describe('subscriptions and parents schema (migration 0006_subscriptions_parents)', () => {
  let db: TestDatabase
  let schoolId: string
  let schoolB: string
  let packageId: string
  let parentId: string
  let studentId: string
  let student2Id: string
  let n = 0

  const user = async (): Promise<string> => {
    const [u] = await db.query<{ id: string }>(`insert into users (name) values ('Pengguna ${n++}') returning id::text`)
    return u!.id
  }
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
  const subscription = (status = 'active', tier = 'full', starts = '2026-01-01', ends = '2026-12-31') =>
    db.query(
      `insert into school_subscriptions (school_id, school_package_id, package_tier, student_quota, status, starts_on, ends_on)
       values ($1, $2, $3, 100, $4, $5, $6)`,
      [schoolId, packageId, tier, status, starts, ends],
    )

  beforeAll(async () => {
    db = await createTestDatabase()
    schoolId = (await db.query<{ id: string }>(`insert into schools (name, code) values ('Sekolah A', 'SA1') returning id::text`))[0]!.id
    schoolB = (await db.query<{ id: string }>(`insert into schools (name, code) values ('Sekolah B', 'SB1') returning id::text`))[0]!.id
    packageId = (
      await db.query<{ id: string }>(
        `insert into school_packages (code, name, slug, education_level, form_level, price_annual)
         values ('T4', 'Tingkatan 4', 'tingkatan-4', 'spm', 't4', 30.00) returning id::text`,
      )
    )[0]!.id
    parentId = await user()
    studentId = await user()
    student2Id = await user()
  })
  afterAll(async () => {
    await db.drop()
  })

  it('creates the six tables', async () => {
    for (const t of TABLES) expect((await columns(t)).length).toBeGreaterThan(0)
  })

  it('lists the five tables with a legacy source as migratable, alphabetical, and not user_packages', async () => {
    const models = JSON.parse(readFileSync(MODELS_JSON, 'utf8')) as string[]
    expect([...models].sort()).toEqual(models)
    for (const t of ['comp_students', 'parent_invites', 'parent_links', 'school_packages', 'school_subscriptions']) {
      expect(models).toContain(t)
      expect(await columns(t)).toEqual(expect.arrayContaining(['legacy_source', 'legacy_id']))
      expect(await db.query(`select 1 from pg_indexes where indexname = $1`, [`uq_${t}_legacy`])).toHaveLength(1)
    }
    expect(models).not.toContain('user_packages')
    expect(await columns('user_packages')).not.toContain('legacy_source')
  })

  it('stores money as numeric(10,2)', async () => {
    const [c] = await db.query<{ numeric_precision: number; numeric_scale: number }>(
      `select numeric_precision, numeric_scale from information_schema.columns where table_name = 'school_packages' and column_name = 'price_annual'`,
    )
    expect(c).toMatchObject({ numeric_precision: 10, numeric_scale: 2 })
    const [r] = await db.query<{ p: string }>(`select price_annual::text as p from school_packages where code = 'T4'`)
    expect(r!.p).toBe('30.00')
  })

  it('has no plaintext token or IC column', async () => {
    const all = (await Promise.all(TABLES.map(columns))).flat()
    expect(all).toContain('token_hash')
    expect(all).not.toEqual(expect.arrayContaining(['token']))
    expect(all.filter((c) => /^(token|raw_token|invite_token|ic|ic_number|ic_no)$/.test(c))).toEqual([])
    expect(await columns('comp_students')).not.toEqual(expect.arrayContaining(['ic']))
  })

  it('enforces package enums and keeps code and slug unique', async () => {
    const ins = (code: string, slug: string, edu = 'spm', form = 't4') =>
      db.query(
        `insert into school_packages (code, name, slug, education_level, form_level, price_annual) values ($1, 'X', $2, $3, $4, 1.00)`,
        [code, slug, edu, form],
      )
    expect(await rejects(`insert into school_packages (code,name,slug,education_level,form_level,price_annual) values ('ZZ','x','zz','spm','t4',1)`)).toMatch(/ck_school_packages_code/)
    expect(await rejects(`insert into school_packages (code,name,slug,education_level,form_level,price_annual) values ('T5','x','t5','college','t5',1)`)).toMatch(/ck_school_packages_education_level/)
    expect(await rejects(`insert into school_packages (code,name,slug,education_level,form_level,price_annual) values ('T5','x','t5','spm','t9',1)`)).toMatch(/ck_school_packages_form_level/)
    expect(await rejects(`insert into school_packages (code,name,slug,education_level,form_level,price_annual) values ('T5','x','t5','spm','t5',-1)`)).toMatch(/ck_school_packages_price_annual/)
    expect(await rejects(`insert into school_packages (code,name,slug,education_level,form_level,price_annual) values ('T4','x','other','spm','t4',1)`)).toMatch(/uq_school_packages_code/)
    expect(await rejects(`insert into school_packages (code,name,slug,education_level,form_level,price_annual) values ('T5','x','tingkatan-4','spm','t5',1)`)).toMatch(/uq_school_packages_slug/)
    await ins('T5', 'tingkatan-5', 'spm', 't5')
    await ins('D1_D6', 'd1-d6', 'primary', 'd1_d6')
    await ins('T1_T3', 't1-t3', 'lower_secondary', 't1_t3')
  })

  it('accepts the contract tiers and statuses and rejects any other', async () => {
    for (const status of SUBSCRIPTION_STATUSES) await subscription(status)
    for (const tier of SUBSCRIPTION_TIERS) await subscription('active', tier)
    expect(await rejects(`insert into school_subscriptions (school_id, school_package_id, package_tier, student_quota, status, starts_on, ends_on) values ($1, $2, 'gold', 5, 'active', '2026-01-01', '2026-12-31')`, [schoolId, packageId])).toMatch(/ck_school_subscriptions_package_tier/)
    expect(await rejects(`insert into school_subscriptions (school_id, school_package_id, package_tier, student_quota, status, starts_on, ends_on) values ($1, $2, 'full', 5, 'none', '2026-01-01', '2026-12-31')`, [schoolId, packageId])).toMatch(/ck_school_subscriptions_status/)
  })

  it('checks quota, question limit and date order; keeps the foreign keys', async () => {
    const base = (quota: string, limit: string, ends: string, school = schoolId, pkg = packageId) =>
      db.query(
        `insert into school_subscriptions (school_id, school_package_id, package_tier, student_quota, question_limit, status, starts_on, ends_on)
         values (${school}, ${pkg}, 'basic', ${quota}, ${limit}, 'active', '2026-06-01', '${ends}')`,
      )
    await base('null', 'null', '2026-06-01')
    expect(await rejects(`insert into school_subscriptions (school_id, school_package_id, package_tier, student_quota, status, starts_on, ends_on) values ($1, $2, 'basic', 0, 'active', '2026-01-01', '2026-02-01')`, [schoolId, packageId])).toMatch(/ck_school_subscriptions_student_quota/)
    await expect(base('5', '0', '2026-07-01')).rejects.toThrow(/ck_school_subscriptions_question_limit/)
    await expect(base('5', '500', '2026-05-31')).rejects.toThrow(/ck_school_subscriptions_dates/)
    await expect(base('5', '500', '2026-07-01', '999999')).rejects.toThrow(/fk_school_subscriptions_school_id/)
    await expect(base('5', '500', '2026-07-01', schoolId, '999999')).rejects.toThrow(/fk_school_subscriptions_school_package_id/)
    expect(await rejects(`delete from schools where id = $1`, [schoolId])).toMatch(/fk_school_subscriptions_school_id/)
    expect(await rejects(`delete from school_packages where id = $1`, [packageId])).toMatch(/fk_/)
  })

  it('indexes (school_id, starts_on, id) for the latest-subscription lookup and uses it', async () => {
    const [ix] = await db.query<{ indexdef: string }>(`select indexdef from pg_indexes where indexname = 'ix_school_subscriptions_school_starts'`)
    expect(ix!.indexdef).toMatch(/\(school_id, starts_on, id\)/)
    await db.query(`set enable_seqscan = off`)
    const plan = await db.query<{ 'QUERY PLAN': string }>(
      `explain select id from school_subscriptions where school_id = $1 and status in ('active','grace') order by starts_on desc, id desc limit 1`,
      [schoolId],
    )
    expect(plan.map((p) => p['QUERY PLAN']).join('\n')).toMatch(/ix_school_subscriptions_school_/)
  })

  it('enforces the legacy pair on subscriptions and packages', async () => {
    const ins = (id: string, src = 'cloud') =>
      db.query(
        `insert into school_subscriptions (school_id, school_package_id, package_tier, status, starts_on, ends_on, legacy_source, legacy_id)
         values ($1, $2, 'full', 'expired', '2025-01-01', '2025-12-31', $3, $4)`,
        [schoolB, packageId, src, id],
      )
    await ins('1')
    await expect(ins('1')).rejects.toThrow(/uq_school_subscriptions_legacy/)
    await expect(ins('2', 'xx')).rejects.toThrow(/ck_school_subscriptions_legacy_source/)
    await db.query(`update school_packages set legacy_source = 'cloud', legacy_id = '7' where code = 'T4'`)
    expect(
      await rejects(`update school_packages set legacy_source = 'cloud', legacy_id = '7' where code = 'T5'`),
    ).toMatch(/uq_school_packages_legacy/)
  })

  it('assigns user packages, cascading with the user', async () => {
    const admin = await user()
    await db.query(`insert into user_packages (user_id, form_level, school_package_id, student_quota) values ($1, 't4', $2, 50)`, [admin, packageId])
    const [row] = await db.query<{ assigned_at: Date }>(`select assigned_at from user_packages where user_id = $1`, [admin])
    expect(row!.assigned_at).toBeInstanceOf(Date)
    expect(await rejects(`insert into user_packages (user_id, form_level, school_package_id, student_quota) values ($1, 't1_t3', $2, 50)`, [admin, packageId])).toMatch(/ck_user_packages_form_level/)
    expect(await rejects(`insert into user_packages (user_id, form_level, school_package_id, student_quota) values ($1, 't5', $2, 0)`, [admin, packageId])).toMatch(/ck_user_packages_student_quota/)
    expect(await rejects(`insert into user_packages (user_id, form_level, school_package_id, student_quota) values (999999, 't5', $1, 5)`, [packageId])).toMatch(/fk_user_packages_user_id/)
    await db.query(`delete from users where id = $1`, [admin])
    expect(await db.query(`select 1 from user_packages where user_id = $1`, [admin])).toHaveLength(0)
  })

  it('links parent and student once, with relationship, and indexes both sides', async () => {
    const ins = (p: string, s: string, rel: string | null = 'ibu') =>
      db.query(`insert into parent_links (parent_id, student_id, relationship) values ($1, $2, $3)`, [p, s, rel])
    await ins(parentId, studentId)
    await ins(parentId, student2Id, null)
    await expect(ins(parentId, studentId, 'bapa')).rejects.toThrow(/uq_parent_links_parent_student/)
    await expect(ins(parentId, parentId)).rejects.toThrow(/ck_parent_links_not_self/)
    await expect(ins(parentId, '999999')).rejects.toThrow(/fk_parent_links_student_id/)
    await expect(ins('999999', studentId)).rejects.toThrow(/fk_parent_links_parent_id/)
    await expect(ins(studentId, parentId, 'x'.repeat(51))).rejects.toThrow(/ck_parent_links_relationship/)
    await expect(ins(studentId, parentId, '')).rejects.toThrow(/ck_parent_links_relationship/)
    const idx = await db.query<{ indexname: string }>(`select indexname from pg_indexes where tablename = 'parent_links'`)
    expect(idx.map((i) => i.indexname)).toEqual(expect.arrayContaining(['uq_parent_links_parent_student', 'ix_parent_links_student_id']))
    await db.query(`insert into parent_links (parent_id, student_id, legacy_source, legacy_id) values ($1, $2, 'cloud', 'p:s')`, [studentId, student2Id])
    await expect(
      db.query(`insert into parent_links (parent_id, student_id, legacy_source, legacy_id) values ($1, $2, 'cloud', 'p:s')`, [student2Id, studentId]),
    ).rejects.toThrow(/uq_parent_links_legacy/)
  })

  it('keeps one invite per student, a unique hashed token, single use and expiry', async () => {
    const s = await user()
    const hash = 'b'.repeat(64)
    await db.query(`insert into parent_invites (student_id, token_hash, expires_at) values ($1, $2, now() + interval '7 days')`, [s, hash])
    const s2 = await user()
    await expect(db.query(`insert into parent_invites (student_id, token_hash, expires_at) values ($1, 'c', now())`, [s2])).rejects.toThrow(/ck_parent_invites_token_hash/)
    expect(await rejects(`insert into parent_invites (student_id, token_hash, expires_at) values ($1, $2, now())`, [s, 'd'.repeat(64)])).toMatch(/uq_parent_invites_student_id/)
    expect(await rejects(`insert into parent_invites (student_id, token_hash, expires_at) values ($1, $2, now())`, [s2, hash])).toMatch(/uq_parent_invites_token_hash/)
    expect(await rejects(`insert into parent_invites (student_id, token_hash) values ($1, $2)`, [s2, 'e'.repeat(64)])).toMatch(/expires_at/)
    expect(await rejects(`update parent_invites set accepted_by_id = $1 where student_id = $2`, [parentId, s])).toMatch(/ck_parent_invites_accepted/)
    await db.query(`update parent_invites set used_at = now(), accepted_by_id = $1 where student_id = $2`, [parentId, s])
    await db.query(`delete from users where id = $1`, [parentId])
    const [row] = await db.query<{ accepted_by_id: string | null; used_at: Date | null }>(`select accepted_by_id::text, used_at from parent_invites where student_id = $1`, [s])
    expect(row).toMatchObject({ accepted_by_id: null })
    expect(row!.used_at).not.toBeNull()
  })

  it('keeps one complimentary profile per user, with no IC column, cascading with the user', async () => {
    const u = await user()
    await db.query(`insert into comp_students (user_id, package_expires_on) values ($1, '2027-06-30')`, [u])
    const [r] = await db.query<{ coins_enabled: boolean }>(`select coins_enabled from comp_students where user_id = $1`, [u])
    expect(r!.coins_enabled).toBe(false)
    expect(await rejects(`insert into comp_students (user_id, package_expires_on) values ($1, '2027-06-30')`, [u])).toMatch(/uq_comp_students_user_id/)
    expect(await rejects(`insert into comp_students (user_id) values ($1)`, [u])).toMatch(/package_expires_on/)
    expect(await rejects(`insert into comp_students (user_id, package_expires_on) values (999999, '2027-06-30')`)).toMatch(/fk_comp_students_user_id/)
    expect(await columns('comp_students')).toEqual(expect.not.arrayContaining(['ic_hash', 'ic_masked', 'ic']))
    await db.query(`delete from users where id = $1`, [u])
    expect(await db.query(`select 1 from comp_students where user_id = $1`, [u])).toHaveLength(0)
  })
})
