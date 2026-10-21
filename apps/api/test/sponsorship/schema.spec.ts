import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { STUDENT, bootSponsorshipApp, idOfEmail, type SponsorshipTestApp } from './helpers'

describe('AC8 table, constraints and indexes', () => {
  let t: SponsorshipTestApp
  let userId: string

  beforeAll(async () => {
    t = await bootSponsorshipApp()
    userId = await idOfEmail(t, STUDENT)
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  const insert = (over: Record<string, unknown> = {}) => {
    const row = { student_id: userId, applicant_user_id: userId, applicant_role: 'student', student_category: 'B40', reason: 'Sebab', ...over }
    const keys = Object.keys(row)
    return t.db.query(`insert into foster_applications (${keys.join(', ')}) values (${keys.map((_, i) => `$${String(i + 1)}`).join(', ')}) returning id::text`, Object.values(row))
  }

  it('the columns, types, nullability and defaults are those of the card', async () => {
    const cols = await t.db.query<{ column_name: string; data_type: string; is_nullable: string; column_default: string | null; is_identity: string }>(
      `select column_name, data_type, is_nullable, column_default, is_identity from information_schema.columns where table_schema = 'public' and table_name = 'foster_applications' order by ordinal_position`,
    )
    expect(cols.map((c) => [c.column_name, c.data_type, c.is_nullable])).toEqual([
      ['id', 'bigint', 'NO'],
      ['student_id', 'bigint', 'NO'],
      ['applicant_user_id', 'bigint', 'NO'],
      ['applicant_role', 'text', 'NO'],
      ['student_category', 'text', 'NO'],
      ['family_income_range', 'text', 'YES'],
      ['reason', 'text', 'NO'],
      ['status', 'text', 'NO'],
      ['created_at', 'timestamp with time zone', 'NO'],
      ['is_test', 'boolean', 'NO'],
      ['legacy_source', 'text', 'YES'],
      ['legacy_id', 'text', 'YES'],
    ])
    const by = (n: string) => cols.find((c) => c.column_name === n)
    expect(by('id')?.is_identity).toBe('YES')
    expect(by('status')?.column_default).toBe("'pending'::text")
    expect(by('is_test')?.column_default).toBe('false')
  })

  it('the three indexes and the legacy unique index exist, status and created_at descending', async () => {
    const rows = await t.db.query<{ indexname: string; indexdef: string }>(`select indexname, indexdef from pg_indexes where schemaname = 'public' and tablename = 'foster_applications'`)
    const def = (name: string) => rows.find((r) => r.indexname === name)?.indexdef ?? ''
    expect(def('ix_foster_applications_status_created_at')).toMatch(/\(status, created_at DESC\)$/)
    expect(def('ix_foster_applications_student_id')).toMatch(/\(student_id\)$/)
    expect(def('ix_foster_applications_applicant_user_id')).toMatch(/\(applicant_user_id\)$/)
    expect(def('uq_foster_applications_legacy')).toMatch(/UNIQUE INDEX .*\(legacy_source, legacy_id\)$/)
  })

  it('the check constraints exist by name', async () => {
    const rows = await t.db.query<{ conname: string }>(`select conname from pg_constraint where conrelid = 'foster_applications'::regclass and contype = 'c' order by conname`)
    expect(rows.map((r) => r.conname)).toEqual([
      'ck_foster_applications_family_income_range',
      'ck_foster_applications_legacy_source',
      'ck_foster_applications_status',
      'ck_foster_applications_student_category',
    ])
  })

  it('a valid row defaults to pending, not test, no legacy pair', async () => {
    const id = ((await insert()) as { id: string }[])[0]?.id as string
    const row = (await t.db.query<{ status: string; is_test: boolean; family_income_range: string | null }>(`select status, is_test, family_income_range from foster_applications where id = $1`, [id]))[0]
    expect(row).toEqual({ status: 'pending', is_test: false, family_income_range: null })
  })

  it('rejects a category outside the five, an income outside the four and a status outside the four', async () => {
    await expect(insert({ student_category: 'VIP' })).rejects.toThrow(/ck_foster_applications_student_category/)
    await expect(insert({ student_category: 'b40' })).rejects.toThrow(/ck_foster_applications_student_category/)
    await expect(insert({ family_income_range: 'RM9' })).rejects.toThrow(/ck_foster_applications_family_income_range/)
    await expect(insert({ family_income_range: '' })).rejects.toThrow(/ck_foster_applications_family_income_range/)
    await expect(insert({ status: 'done' })).rejects.toThrow(/ck_foster_applications_status/)
    await expect(insert({ legacy_source: 'other' })).rejects.toThrow(/ck_foster_applications_legacy_source/)
  })

  it('accepts every allowed value', async () => {
    for (const student_category of ['B40', 'Asnaf', 'Yatim', 'OKU', 'Lain-lain']) await insert({ student_category })
    for (const family_income_range of ['< RM1,000', 'RM1,000 - RM2,500', 'RM2,500 - RM4,000', '> RM4,000']) await insert({ family_income_range })
    for (const status of ['pending', 'approved', 'matched', 'rejected']) await insert({ status })
  })

  it('the foreign keys to users hold, and the legacy pair is unique', async () => {
    await expect(insert({ student_id: '999999999' })).rejects.toThrow(/fk_foster_applications_student_id/)
    await expect(insert({ applicant_user_id: '999999999' })).rejects.toThrow(/fk_foster_applications_applicant_user_id/)
    await insert({ legacy_source: 'cloud', legacy_id: 'L1' })
    await expect(insert({ legacy_source: 'cloud', legacy_id: 'L1' })).rejects.toThrow(/uq_foster_applications_legacy/)
  })
})
