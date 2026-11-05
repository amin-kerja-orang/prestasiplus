import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestDatabase, type TestDatabase } from '../support/db'

/**
 * S7-T06, DM-61 and DM-62, migration 0225: tournament rounds, entries and scores, `tournaments.start_date` and `rounds`,
 * `ck_tournaments_status` with `cancelled`, `recomputed_at`, `frozen_at` and `league_contributions`.
 * The test database already ran every migration. The "existing rows" cases undo 0225 with the rollback of its header, insert rows
 * in the old shape, then run the file again and check that nothing was changed or lost.
 */
const MIGRATION_0225 = readFileSync(fileURLToPath(new URL('../../prisma/migrations/0225_s7_league_tournament/migration.sql', import.meta.url)), 'utf8')

const ROLLBACK = `
  DROP TABLE "league_contributions", "tournament_round_scores", "tournament_entries", "tournament_rounds";
  ALTER TABLE "league_standings" DROP COLUMN "recomputed_at";
  ALTER TABLE "leagues" DROP COLUMN "frozen_at";
  ALTER TABLE "tournaments" DROP COLUMN "start_date", DROP COLUMN "rounds";
  ALTER TABLE "tournaments" DROP CONSTRAINT "ck_tournaments_status";
  ALTER TABLE "tournaments" ADD CONSTRAINT "ck_tournaments_status" CHECK ("status" IN ('draft', 'registration', 'ongoing', 'completed'));
  ALTER TABLE "tournaments" ALTER COLUMN "time_window_minutes" SET NOT NULL, ALTER COLUMN "top_n_scoring" SET NOT NULL, ALTER COLUMN "min_participants" SET NOT NULL;
`

describe('migration 0225 league and tournament schema', () => {
  let db: TestDatabase
  let userId: string
  let schoolId: string
  let n = 0

  const rejects = async (sql: string, params?: unknown[]): Promise<string> => {
    try {
      await db.query(sql, params)
    } catch (err) {
      return err instanceof Error ? err.message : String(err)
    }
    throw new Error(`Expected the statement to be rejected: ${sql}`)
  }
  const tournament = async (extra = '', extraValue = ''): Promise<string> =>
    (
      await db.query<{ id: string }>(
        `insert into tournaments (title, education_level_id, format, question_mode, total_questions${extra}, created_by)
         values ('Kejohanan ${String(n++)}', 'tingkatan4', 'single_match', 'random_mix', 10${extraValue}, $1) returning id::text`,
        [userId],
      )
    )[0]!.id
  const league = async (): Promise<string> =>
    (
      await db.query<{ id: string }>(
        `insert into leagues (name, type, scope, game_mode, scoring_method, start_date, end_date, invite_code)
         values ('Liga ${String(n)}', 'league', 'national', 'mixed', 'total_score', '2026-11-01', '2026-11-30', $1) returning id::text`,
        [`LG${String(n++).padStart(6, '0')}`],
      )
    )[0]!.id
  const columns = async (table: string) =>
    Object.fromEntries(
      (
        await db.query<{ column_name: string; is_nullable: string; data_type: string }>(
          `select column_name, is_nullable, data_type from information_schema.columns where table_name = $1`,
          [table],
        )
      ).map((c) => [c.column_name, `${c.data_type}${c.is_nullable === 'YES' ? ' null' : ''}`]),
    )

  beforeAll(async () => {
    db = await createTestDatabase()
    userId = (await db.query<{ id: string }>(`insert into users (name) values ('Pengguna Ujian') returning id::text`))[0]!.id
    schoolId = (await db.query<{ id: string }>(`insert into schools (name) values ('Sekolah Contoh') returning id::text`))[0]!.id
  })
  afterAll(async () => {
    await db.drop()
  })

  it('adds the columns of DM-61 and DM-62, all nullable on an existing table', async () => {
    expect(await columns('tournaments')).toMatchObject({
      start_date: 'date null',
      rounds: 'smallint null',
      time_window_minutes: 'smallint null',
      top_n_scoring: 'smallint null',
      min_participants: 'smallint null',
      total_questions: 'smallint',
    })
    expect(await columns('league_standings')).toMatchObject({ recomputed_at: 'timestamp with time zone null' })
    expect(await columns('leagues')).toMatchObject({ frozen_at: 'timestamp with time zone null' })
  })

  it('creates the four new tables with the DM-61 columns and league_contributions', async () => {
    expect(await columns('tournament_rounds')).toMatchObject({
      tournament_id: 'uuid',
      n: 'smallint',
      opens_at: 'timestamp with time zone',
      closes_at: 'timestamp with time zone',
      question_ids: 'ARRAY',
    })
    expect(await columns('tournament_entries')).toMatchObject({ tournament_id: 'uuid', user_id: 'bigint', school_id: 'bigint null', registered_at: 'timestamp with time zone' })
    expect(await columns('tournament_round_scores')).toMatchObject({
      round_id: 'bigint',
      user_id: 'bigint',
      score: 'integer',
      correct: 'smallint',
      answered: 'smallint',
      total_ms: 'integer',
      started_at: 'timestamp with time zone',
      finished_at: 'timestamp with time zone null',
      attempt_id: 'uuid',
    })
    expect(await columns('league_contributions')).toMatchObject({ league_id: 'bigint', school_id: 'bigint', user_id: 'bigint', points: 'integer' })
  })

  it('a tournament no longer needs the three old columns, and accepts start_date, rounds and the cancelled status', async () => {
    const id = await tournament(', status, start_date, rounds', `, 'cancelled', '2026-12-01', 3`)
    const [row] = await db.query<{ status: string; rounds: number; start_date: string; time_window_minutes: number | null }>(
      `select status, rounds, start_date::text, time_window_minutes from tournaments where id = $1`,
      [id],
    )
    expect(row).toEqual({ status: 'cancelled', rounds: 3, start_date: '2026-12-01', time_window_minutes: null })
  })

  it('ck_tournaments_status lists the five statuses and refuses any other', async () => {
    for (const status of ['draft', 'registration', 'ongoing', 'completed', 'cancelled']) await tournament(', status', `, '${status}'`)
    expect(await rejects(`insert into tournaments (title, education_level_id, format, question_mode, total_questions, status, created_by) values ('X', 'spm', 'league', 'subject', 10, 'upcoming', ${userId})`)).toContain('ck_tournaments_status')
  })

  it('keeps ck_tournaments_format wide and the range checks of the nullable columns', async () => {
    for (const format of ['single_match', 'knockout', 'league', 'hybrid']) {
      await db.query(
        `insert into tournaments (title, education_level_id, format, question_mode, total_questions, created_by) values ('F', 'spm', $1, 'subject', 10, $2)`,
        [format, userId],
      )
    }
    expect(await rejects(`insert into tournaments (title, education_level_id, format, question_mode, total_questions, time_window_minutes, created_by) values ('X', 'spm', 'league', 'subject', 10, 5, ${userId})`)).toContain('ck_tournaments_time_window_minutes')
    expect(await rejects(`insert into tournaments (title, education_level_id, format, question_mode, total_questions, created_by, rounds) values ('X', 'spm', 'league', 'subject', 10, ${userId}, 11)`)).toContain('ck_tournaments_rounds')
    expect(await rejects(`insert into tournaments (title, education_level_id, format, question_mode, total_questions, created_by, rounds) values ('X', 'spm', 'league', 'subject', 10, ${userId}, 0)`)).toContain('ck_tournaments_rounds')
  })

  it('rounds: one per number per tournament, closes after it opens, and gone with the tournament', async () => {
    const t = await tournament()
    await db.query(`insert into tournament_rounds (tournament_id, n, opens_at, closes_at, question_ids) values ($1, 1, '2026-12-01T00:00+08', '2026-12-01T23:59:59+08', '{1,2,3}')`, [t])
    const [r] = await db.query<{ question_ids: string[] }>(`select question_ids::text[] from tournament_rounds where tournament_id = $1`, [t])
    expect(r!.question_ids).toEqual(['1', '2', '3'])
    expect(await rejects(`insert into tournament_rounds (tournament_id, n, opens_at, closes_at) values ($1, 1, now(), now() + interval '1 day')`, [t])).toContain('uq_tournament_rounds_tournament_id_n')
    expect(await rejects(`insert into tournament_rounds (tournament_id, n, opens_at, closes_at) values ($1, 2, now(), now())`, [t])).toContain('ck_tournament_rounds_window')
    expect(await rejects(`insert into tournament_rounds (tournament_id, n, opens_at, closes_at) values ($1, 11, now(), now() + interval '1 day')`, [t])).toContain('ck_tournament_rounds_n')
    await db.query(`insert into tournament_rounds (tournament_id, n, opens_at, closes_at) values ($1, 2, now(), now() + interval '1 day')`, [t])
    const [def] = await db.query<{ question_ids: string[] }>(`select question_ids::text[] from tournament_rounds where tournament_id = $1 and n = 2`, [t])
    expect(def!.question_ids).toEqual([])
    await db.query(`delete from tournaments where id = $1`, [t])
    expect(await db.query(`select 1 from tournament_rounds where tournament_id = $1`, [t])).toHaveLength(0)
  })

  it('entries: a pupil registers once per tournament; the school may be empty', async () => {
    const t = await tournament()
    await db.query(`insert into tournament_entries (tournament_id, user_id, school_id) values ($1, $2, $3)`, [t, userId, schoolId])
    expect(await rejects(`insert into tournament_entries (tournament_id, user_id) values ($1, $2)`, [t, userId])).toContain('uq_tournament_entries_tournament_id_user_id')
    const other = await tournament()
    await db.query(`insert into tournament_entries (tournament_id, user_id) values ($1, $2)`, [other, userId])
    const [e] = await db.query<{ school_id: string | null; registered_at: Date }>(`select school_id, registered_at from tournament_entries where tournament_id = $1`, [other])
    expect(e!.school_id).toBeNull()
    expect(e!.registered_at).toBeInstanceOf(Date)
  })

  it('round scores: one row per pupil per round, a generated unique attempt_id, and cascade from the round', async () => {
    const t = await tournament()
    const [round] = await db.query<{ id: string }>(`insert into tournament_rounds (tournament_id, n, opens_at, closes_at) values ($1, 1, now(), now() + interval '1 day') returning id::text`, [t])
    const user2 = (await db.query<{ id: string }>(`insert into users (name) values ('Pengguna Dua') returning id::text`))[0]!.id
    const [a] = await db.query<{ attempt_id: string; score: number; finished_at: Date | null }>(
      `insert into tournament_round_scores (round_id, user_id) values ($1, $2) returning attempt_id::text, score, finished_at`,
      [round!.id, userId],
    )
    const [b] = await db.query<{ attempt_id: string }>(`insert into tournament_round_scores (round_id, user_id) values ($1, $2) returning attempt_id::text`, [round!.id, user2])
    expect(a).toMatchObject({ score: 0, finished_at: null })
    expect(a!.attempt_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    expect(a!.attempt_id).not.toBe(b!.attempt_id)
    expect(await rejects(`insert into tournament_round_scores (round_id, user_id) values ($1, $2)`, [round!.id, userId])).toContain('uq_tournament_round_scores_round_id_user_id')
    expect(await rejects(`insert into tournament_round_scores (round_id, user_id, attempt_id) values ($1, $2, $3)`, [round!.id, (await db.query<{ id: string }>(`insert into users (name) values ('Pengguna Tiga') returning id::text`))[0]!.id, a!.attempt_id])).toContain('uq_tournament_round_scores_attempt_id')
    await db.query(`delete from tournament_rounds where id = $1`, [round!.id])
    expect(await db.query(`select 1 from tournament_round_scores where round_id = $1`, [round!.id])).toHaveLength(0)
  })

  it('league_contributions: one row per pupil per league, gone with the league; recomputed_at and frozen_at start empty', async () => {
    const l = await league()
    await db.query(`insert into league_contributions (league_id, school_id, user_id, points) values ($1, $2, $3, 7)`, [l, schoolId, userId])
    expect(await rejects(`insert into league_contributions (league_id, school_id, user_id) values ($1, $2, $3)`, [l, schoolId, userId])).toContain('uq_league_contributions_league_id_user_id')
    await db.query(`insert into league_standings (league_id, level, school_id) values ($1, 'T4', $2)`, [l, schoolId])
    const [s] = await db.query<{ recomputed_at: Date | null; frozen_at: Date | null }>(
      `select s.recomputed_at, l.frozen_at from league_standings s join leagues l on l.id = s.league_id where l.id = $1`,
      [l],
    )
    expect(s).toEqual({ recomputed_at: null, frozen_at: null })
    await db.query(`delete from leagues where id = $1`, [l])
    expect(await db.query(`select 1 from league_contributions where league_id = $1`, [l])).toHaveLength(0)
  })

  it('refuses an impossible score or contribution, and indexes the school and user keys', async () => {
    const t = await tournament()
    const [round] = await db.query<{ id: string }>(`insert into tournament_rounds (tournament_id, n, opens_at, closes_at) values ($1, 1, now(), now() + interval '1 day') returning id::text`, [t])
    const score = (column: string, value: number, extra = '', extraValue = '') =>
      rejects(`insert into tournament_round_scores (round_id, user_id, ${column}${extra}) values ($1, $2, ${String(value)}${extraValue})`, [round!.id, userId])
    expect(await score('score', -1)).toContain('ck_tournament_round_scores_score')
    expect(await score('total_ms', -1)).toContain('ck_tournament_round_scores_total_ms')
    expect(await score('correct', 2, ', answered', ', 1')).toContain('ck_tournament_round_scores_answered')
    expect(await score('correct', -1, ', answered', ', 0')).toContain('ck_tournament_round_scores_answered')
    expect(await rejects(`insert into league_contributions (league_id, school_id, user_id, points) values ($1, $2, $3, -1)`, [await league(), schoolId, userId])).toContain('ck_league_contributions_points')
    const indexes = (await db.query<{ indexname: string }>(`select indexname from pg_indexes where tablename in ('tournament_entries', 'league_contributions')`)).map((i) => i.indexname)
    expect(indexes).toEqual(expect.arrayContaining(['ix_tournament_entries_school_id', 'ix_league_contributions_school_id', 'ix_league_contributions_user_id']))
  })

  it('runs again on rows written before it: nothing is dropped or rewritten', async () => {
    // The rollback of the header needs no `cancelled` row and no NULL in the three columns: the earlier cases wrote some.
    await db.query('delete from tournaments')
    await db.query(ROLLBACK)
    const t = (
      await db.query<{ id: string }>(
        `insert into tournaments (title, education_level_id, format, question_mode, total_questions, time_window_minutes, top_n_scoring, min_participants, status, created_by)
         values ('Lama', 'spm', 'knockout', 'subject', 40, 60, 10, 4, 'completed', $1) returning id::text`,
        [userId],
      )
    )[0]!.id
    const l = await league()
    await db.query(`insert into league_standings (league_id, level, school_id, peserta, skor, purata, sort_order) values ($1, 'T5', $2, 3, 120.5, 66.7, 1)`, [l, schoolId])
    const snapshot = async () => ({
      t: await db.query(`select id::text, title, education_level_id, format, question_mode, total_questions, time_window_minutes, top_n_scoring, min_participants, status from tournaments where id = $1`, [t]),
      s: await db.query(`select league_id::text, level, school_id::text, peserta, skor::text, purata::text, sort_order from league_standings where league_id = $1`, [l]),
      l: await db.query(`select id::text, name, status from leagues where id = $1`, [l]),
    })
    const before = await snapshot()
    await db.query(MIGRATION_0225)
    expect(await snapshot()).toEqual(before)
    const [extra] = await db.query<{ start_date: string | null; rounds: number | null }>(`select start_date::text, rounds from tournaments where id = $1`, [t])
    expect(extra).toEqual({ start_date: null, rounds: null })
    await db.query(`update tournaments set status = 'cancelled', rounds = 2 where id = $1`, [t])
  })
})
