import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSeeds, seedModules } from '../../prisma/seed'
import { POC_PROFILE_ORDER } from '../../prisma/seed/poc'
import {
  COUNTS_BEGIN,
  COUNTS_END,
  extractCountsTable,
  pocFingerprint,
  pocStudentCounts,
  pocTableCounts,
  pocTestRowCounts,
  quoteIdent,
  renderCountsTable,
} from '../../prisma/seed/poc/profile'
import { VERIFY_RULES, verifyPocProfile, type Queryable } from '../../prisma/seed/poc/verify'
import { createTestDatabase, type TestDatabase } from '../support/db'

const DOC = fileURLToPath(new URL('../../../../docs/plan/seed-profile.md', import.meta.url))
const asQueryable = (db: TestDatabase): Queryable => ({ query: <T>(sql: string) => db.query(sql) as Promise<T[]> })

describe('PoC profile seed (BE-26)', () => {
  let a: TestDatabase
  let b: TestDatabase
  let seedMs = 0
  let firstRun: Awaited<ReturnType<typeof pocFingerprint>>
  let firstRunSalted: Awaited<ReturnType<typeof pocFingerprint>>

  beforeAll(async () => {
    a = await createTestDatabase()
    b = await createTestDatabase()
    const t0 = performance.now()
    await runSeeds(seedModules, { prisma: a.prisma, profile: 'poc', env: { NODE_ENV: 'test' } })
    seedMs = performance.now() - t0
    firstRun = await pocFingerprint(asQueryable(a))
    firstRunSalted = await pocFingerprint(asQueryable(a), { withSalted: true })
  }, 240_000)
  afterAll(async () => {
    await a.drop()
    await b.drop()
  })

  it('composes the earlier modules in the documented order, with poc-profile last', () => {
    const names = seedModules.filter((m) => !m.profiles || m.profiles.includes('poc')).map((m) => m.name)
    expect(names).toEqual([...POC_PROFILE_ORDER])
    expect(seedModules.at(-1)?.name).toBe('poc-profile')
    expect(seedModules.at(-1)?.kind).toBe('demo')
  })

  describe('AC1 deterministic and idempotent', () => {
    it('a second run on the seeded database is a no-op (hash and counts unchanged, password hashes included)', async () => {
      await runSeeds(seedModules, { prisma: a.prisma, profile: 'poc', env: { NODE_ENV: 'test' } })
      const again = await pocFingerprint(asQueryable(a), { withSalted: true })
      expect(again.counts).toEqual(firstRunSalted.counts)
      expect(again.tables).toEqual(firstRunSalted.tables)
      expect(again.hash).toBe(firstRunSalted.hash)
    }, 120_000)

    it('seeding a second empty database gives identical content', async () => {
      await runSeeds(seedModules, { prisma: b.prisma, profile: 'poc', env: { NODE_ENV: 'test' } })
      const other = await pocFingerprint(asQueryable(b))
      expect(other.counts).toEqual(firstRun.counts)
      expect(other.tables).toEqual(firstRun.tables)
      expect(other.hash).toBe(firstRun.hash)
    }, 120_000)
  })

  describe('AC2 verify', () => {
    it('passes on the seeded profile', async () => {
      expect(await verifyPocProfile(asQueryable(a))).toEqual([])
    })

    /** One bad-row fixture per rule, applied inside a transaction that is rolled back (the pool has one connection). */
    const BAD_ROWS: Record<string, string[]> = {
      wallet_balance_equals_ledger_sum: [`update wallets set current_syiling = current_syiling + 1 where id = (select min(id) from wallets)`],
      ledger_user_has_wallet: [`delete from wallets where user_id = (select min(user_id) from coin_ledger)`],
      answer_dimensions_valid: [`update practice_answers set education_level_id = null where id = (select min(id) from practice_answers)`],
      enrolment_classroom_exists: [
        `alter table enrolments drop constraint fk_enrolments_classroom_id`,
        `insert into enrolments (classroom_id, student_id) select 987654321, min(user_id) from user_roles where role = 'student'`,
      ],
      enrolment_student_exists: [
        `insert into enrolments (classroom_id, student_id) select (select min(id) from classrooms), min(user_id) from user_roles where role = 'teacher'`,
      ],
      placement_question_published: [
        `insert into paper_placements (paper_section_id, question_id, position) select paper_section_id, 888888888, max(position) + 1 from paper_placements group by paper_section_id limit 1`,
      ],
      orphan_practice_session_questions: [
        `insert into practice_session_questions (session_id, position, question_id, question_version_no) select id, 1, 888888888, 1 from practice_sessions limit 1`,
      ],
      orphan_practice_answers_question: [`update practice_answers set question_id = 888888888 where id = (select min(id) from practice_answers)`],
      orphan_practice_checks_question: [
        `insert into practice_checks (session_id, user_id, question_id, question_version_no, selected_label, is_correct, checked_at, seq) select id, user_id, 888888888, 1, 'A', true, started_at, 1 from practice_sessions limit 1`,
      ],
      orphan_revision_queue_question: [
        `insert into revision_queue (user_id, question_id, subject_id, last_wrong_at) select (select min(id) from users), 888888888, (select min(id) from subjects), now()`,
      ],
      orphan_aggregate_items_question: [
        `update practice_attempt_aggregate_items set question_id = '888888888' where id = (select min(id) from practice_attempt_aggregate_items)`,
      ],
      orphan_exam_attempts_paper: [`update exam_attempts set paper_id = 888888888 where id = (select id from exam_attempts order by id limit 1)`],
      orphan_session_credits_session: [
        `insert into session_credits (session_id, user_id, coins_earned, points_earned, streak_count, total_balance, completed_at) select gen_random_uuid(), (select min(id) from users), 1, 1, 1, 1, now()`,
      ],
    }

    it('has a failing fixture for every rule', () => {
      expect(Object.keys(BAD_ROWS).sort()).toEqual(VERIFY_RULES.map((r) => r.name).sort())
    })

    for (const rule of VERIFY_RULES) {
      it(`${rule.name}: a bad row is reported by this rule (and rolled back afterwards)`, async () => {
        await a.query('begin')
        try {
          for (const sql of BAD_ROWS[rule.name] ?? []) await a.query(sql)
          const failures = await verifyPocProfile(asQueryable(a), [rule])
          expect(failures.map((f) => f.rule)).toEqual([rule.name])
          expect(failures[0]?.count).toBeGreaterThanOrEqual(1)
        } finally {
          await a.query('rollback')
        }
        expect(await verifyPocProfile(asQueryable(a), [rule])).toEqual([])
      })
    }

    it('answer_dimensions_valid also reports a chapter that is not in the answer subject', async () => {
      await a.query('begin')
      try {
        await a.query(
          `update practice_answers set chapter_id = (select c.id from chapters c where c.subject_id <> practice_answers.subject_id limit 1)
            where id = (select min(id) from practice_answers where chapter_id is not null)`,
        )
        const rule = VERIFY_RULES.find((r) => r.name === 'answer_dimensions_valid')!
        expect((await verifyPocProfile(asQueryable(a), [rule])).length).toBe(1)
      } finally {
        await a.query('rollback')
      }
    })
  })

  describe('AC4 profile document', () => {
    it('the table in docs/plan/seed-profile.md equals the regenerated counts', async () => {
      const doc = readFileSync(DOC, 'utf8')
      expect(doc).toContain(COUNTS_BEGIN)
      expect(doc).toContain(COUNTS_END)
      expect(extractCountsTable(doc)).toBe(renderCountsTable(await pocTableCounts(asQueryable(a))))
    })

    it('matches D45: about 20 generated students plus the demo accounts, a few papers', async () => {
      const s = await pocStudentCounts(asQueryable(a))
      expect(s.generated).toBeGreaterThanOrEqual(15)
      expect(s.generated).toBeLessThanOrEqual(25)
      expect(s.total).toBeGreaterThanOrEqual(s.demo + s.generated)
      const counts = await pocTableCounts(asQueryable(a))
      expect(counts.papers).toBeGreaterThanOrEqual(2)
      expect(counts.papers).toBeLessThanOrEqual(10)
    })

    it('Mod Pelajar (is_test) rows are absent from the profile', async () => {
      const tests = await pocTestRowCounts(asQueryable(a))
      expect(Object.values(tests).reduce((x, y) => x + y, 0)).toBe(0)
    })
  })

  it('AC6 the whole seed takes under 60 seconds', () => {
    expect(seedMs).toBeLessThan(60_000)
  })

  it('a table without a primary key is ordered by every column, so insertion order does not change its hash', async () => {
    const hashOf = async (values: string): Promise<string | undefined> => {
      await a.query(`create table zz_poc_no_pk (k int, note text, doc json)`)
      try {
        await a.query(`insert into zz_poc_no_pk (k, note, doc) values ${values}`)
        return (await pocFingerprint(asQueryable(a))).tables['zz_poc_no_pk']
      } finally {
        await a.query(`drop table zz_poc_no_pk`)
      }
    }
    const forward = await hashOf(`(1, 'b', '{"x":1}'), (1, 'a', '{"x":2}'), (2, null, null)`)
    const reverse = await hashOf(`(2, null, null), (1, 'a', '{"x":2}'), (1, 'b', '{"x":1}')`)
    expect(forward).toBeDefined()
    expect(reverse).toBe(forward)
  })
  it('quotes catalogue identifiers safely: embedded double and single quotes in table and column names', async () => {
    expect(quoteIdent('plain')).toBe('"plain"')
    expect(quoteIdent('a"b')).toBe('"a""b"')
    const odd = `zz_poc_"odd'`
    const created = [`create table ${quoteIdent(odd)} ("k""ey" int primary key, "it's" text)`, `create table ${quoteIdent(`${odd}_nopk`)} ("k""ey" int, "it's" text)`]
    for (const sql of created) await a.query(sql)
    try {
      await a.query(`insert into ${quoteIdent(odd)} values (2, 'b'), (1, 'a')`)
      await a.query(`insert into ${quoteIdent(`${odd}_nopk`)} values (2, 'b'), (1, 'a')`)
      const fp = await pocFingerprint(asQueryable(a))
      expect(fp.counts[odd]).toBe(2)
      expect(fp.counts[`${odd}_nopk`]).toBe(2)
      expect((await pocTableCounts(asQueryable(a)))[odd]).toBe(2)
    } finally {
      await a.query(`drop table ${quoteIdent(odd)}`)
      await a.query(`drop table ${quoteIdent(`${odd}_nopk`)}`)
    }
  })
})
