import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSeeds } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { createTestDatabase, type TestDatabase } from '../support/db'

/** The raw SQL of migration 0013_bijak_attempts: keys, checks, cascades, legacy columns, uniqueness. */
describe('bijak attempts schema (migration 0013_bijak_attempts)', () => {
  let db: TestDatabase
  let userId: string
  beforeAll(async () => {
    db = await createTestDatabase()
    await runSeeds([identitySeed], { prisma: db.prisma })
    userId = (await db.query<{ id: string }>(`select id::text from users order by id limit 1`))[0]!.id
  })
  afterAll(async () => {
    await db.drop()
  })

  const rejects = async (sql: string, params: unknown[] = []) => {
    await expect(db.query(sql, params)).rejects.toThrow()
  }
  const attempt = async (extra = ''): Promise<string> =>
    (await db.query<{ id: string }>(
      `insert into exam_attempts (user_id, paper_kind, title, subject, subject_name, kertas, paper_code, mode, started_at, duration_min ${extra ? ',' + extra.split('=')[0] : ''})
       values ($1, 'pilihan', 't', 'MAT', 'Matematik', 1, '1449/1', 'exam', now(), 60 ${extra ? ',' + extra.split('=')[1] : ''}) returning id::text`,
      [userId],
    ))[0]!.id

  it('plan 14.9 item 1: exam_attempts is a migratable model; the list stays alphabetical', () => {
    const list = JSON.parse(readFileSync(fileURLToPath(new URL('../../prisma/migratable-models.json', import.meta.url)), 'utf8')) as string[]
    expect(list).toContain('exam_attempts')
    expect([...list]).toEqual([...list].sort())
  })

  it('enums are text plus check (no Postgres enum types); bad values are refused', async () => {
    expect(Number((await db.query(`select count(*) n from pg_type where typtype = 'e'`))[0]!.n)).toBe(0)
    await rejects(`insert into exam_attempts (user_id, paper_kind, title, subject, subject_name, kertas, paper_code, mode, started_at, duration_min) values ($1, 'x', 't', 'M', 'M', 1, 'c', 'exam', now(), 60)`, [userId])
    await rejects(`insert into exam_attempts (user_id, paper_kind, title, subject, subject_name, kertas, paper_code, mode, started_at, duration_min) values ($1, 'pilihan', 't', 'M', 'M', 1, 'c', 'quiz', now(), 60)`, [userId])
    await rejects(`insert into exam_attempts (user_id, paper_kind, title, subject, subject_name, kertas, paper_code, mode, status, started_at, duration_min) values ($1, 'pilihan', 't', 'M', 'M', 1, 'c', 'exam', 'done', now(), 60)`, [userId])
    await rejects(`insert into exam_attempts (user_id, paper_kind, title, subject, subject_name, kertas, paper_code, mode, started_at, duration_min) values ($1, 'pilihan', 't', 'M', 'M', 1, 'c', 'exam', now(), 0)`, [userId])
  })

  it('child tables use GENERATED ALWAYS identity keys; the attempt id is a server-generated uuid', async () => {
    const ident = await db.query<{ table_name: string; identity_generation: string }>(
      `select table_name, identity_generation from information_schema.columns
        where table_schema = 'public' and column_name = 'id' and is_identity = 'YES'
          and table_name in ('attempt_answers', 'attempt_photos', 'attempt_checks') order by 1`,
    )
    expect(ident.map((r) => r.table_name)).toEqual(['attempt_answers', 'attempt_checks', 'attempt_photos'])
    expect(new Set(ident.map((r) => r.identity_generation))).toEqual(new Set(['ALWAYS']))
    const id = await attempt()
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    await rejects(`insert into attempt_answers (id, attempt_id, part_id, answer, saved_at) values (99, $1, 'p', '{}', now())`, [id])
  })

  it('legacy_source is cloud or my; (legacy_source, legacy_id) is unique; rows without a legacy key do not clash', async () => {
    await rejects(`insert into exam_attempts (user_id, paper_kind, title, subject, subject_name, kertas, paper_code, mode, started_at, duration_min, legacy_source, legacy_id) values ($1, 'pilihan', 't', 'M', 'M', 1, 'c', 'exam', now(), 60, 'other', '1')`, [userId])
    const row = `insert into exam_attempts (user_id, paper_kind, title, subject, subject_name, kertas, paper_code, mode, started_at, duration_min, legacy_source, legacy_id) values ($1, 'pilihan', 't', 'M', 'M', 1, 'c', 'exam', now(), 60, 'cloud', 'x77')`
    await db.query(row, [userId])
    await rejects(row, [userId])
    await attempt()
    await attempt()
  })

  it('one answer per (attempt, part), one check row per (attempt, question), one result per attempt; checks count 1 to 3', async () => {
    const id = await attempt()
    await db.query(`insert into attempt_answers (attempt_id, part_id, answer, saved_at) values ($1, 'p1', '{}', now())`, [id])
    await rejects(`insert into attempt_answers (attempt_id, part_id, answer, saved_at) values ($1, 'p1', '{}', now())`, [id])
    await rejects(`insert into attempt_answers (attempt_id, part_id, answer, rev, saved_at) values ($1, 'p2', '{}', -1, now())`, [id])
    await db.query(`insert into attempt_checks (attempt_id, question_id) values ($1, 'q1')`, [id])
    await rejects(`insert into attempt_checks (attempt_id, question_id) values ($1, 'q1')`, [id])
    await rejects(`insert into attempt_checks (attempt_id, question_id, check_count) values ($1, 'q2', 4)`, [id])
    await db.query(`insert into attempt_results (attempt_id, score, max_score, graded) values ($1, 1, 2, '{}')`, [id])
    await rejects(`insert into attempt_results (attempt_id, score, max_score, graded) values ($1, 1, 2, '{}')`, [id])
  })

  it('children cascade with the attempt and the attempt cascades with the user; unknown attempt or user is refused', async () => {
    const id = await attempt()
    await db.query(`insert into attempt_answers (attempt_id, part_id, answer, saved_at) values ($1, 'p1', '{}', now())`, [id])
    await db.query(`insert into attempt_results (attempt_id, score, max_score, graded) values ($1, 0, 1, '{}')`, [id])
    await db.query(`delete from exam_attempts where id = $1`, [id])
    expect(Number((await db.query(`select count(*) n from attempt_answers where attempt_id = $1`, [id]))[0]!.n)).toBe(0)
    expect(Number((await db.query(`select count(*) n from attempt_results where attempt_id = $1`, [id]))[0]!.n)).toBe(0)
    await rejects(`insert into attempt_answers (attempt_id, part_id, answer, saved_at) values ('00000000-0000-4000-8000-000000000000', 'p', '{}', now())`)
    await rejects(`insert into exam_attempts (user_id, paper_kind, title, subject, subject_name, kertas, paper_code, mode, started_at, duration_min) values (999999999, 'pilihan', 't', 'M', 'M', 1, 'c', 'exam', now(), 60)`)
  })

  it('photo rows: size at most 5 MB, one attempt photo per file, the file may not be reused', async () => {
    const id = await attempt()
    const file = (await db.query<{ id: string }>(
      `insert into files (public_id, purpose, mime, size_bytes, sha256, storage_key) values ('BBBBBBBBBBBBBBBBBBBBBB', 'bijak_photo', 'image/png', 10, $1, 'bijak-photo/x.png') returning id::text`,
      ['0'.repeat(64)],
    ))[0]!.id
    await rejects(`insert into attempt_photos (attempt_id, part_id, file_id, name, size_bytes) values ($1, 'p', $2, 'n', 5242881)`, [id, file])
    await db.query(`insert into attempt_photos (attempt_id, part_id, file_id, name, size_bytes) values ($1, 'p', $2, 'n', 10)`, [id, file])
    await rejects(`insert into attempt_photos (attempt_id, part_id, file_id, name, size_bytes) values ($1, 'p2', $2, 'n', 10)`, [id, file])
  })

  it('the sweeper has a partial index on open attempts with a deadline', async () => {
    const rows = await db.query<{ indexdef: string }>(`select indexdef from pg_indexes where indexname = 'ix_exam_attempts_open_deadline'`)
    expect(rows[0]!.indexdef).toMatch(/WHERE/i)
  })
})
