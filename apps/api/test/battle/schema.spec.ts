import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestDatabase, type TestDatabase } from '../support/db'

const TABLES = ['battles', 'battle_participants', 'battle_questions', 'battle_answers', 'battle_queues', 'battle_invitations', 'tournaments', 'tournament_subjects']
const PRISMA = fileURLToPath(new URL('../../prisma/', import.meta.url))
const CONTRACT_BATTLE = fileURLToPath(new URL('../../../../packages/contract/src/battle/', import.meta.url))

describe('battle schema (migration 0027_battle)', () => {
  let db: TestDatabase
  let n = 0

  const rejects = async (sql: string, params: unknown[] = []): Promise<string> => {
    try {
      await db.query(sql, params)
    } catch (err) {
      return err instanceof Error ? err.message : String(err)
    }
    throw new Error(`Expected the statement to be rejected: ${sql}`)
  }
  const user = async (): Promise<string> => (await db.query<{ id: string }>(`insert into users (name) values ('Pengguna ${String(n++)}') returning id::text`))[0]!.id
  const battle = async (extra = ''): Promise<string> =>
    (await db.query<{ id: string }>(`insert into battles (mode, question_type${extra ? ', ' + extra.split('=')[0] : ''}) values ('quick_match', 'biasa'${extra ? ', ' + extra.split('=')[1] : ''}) returning id::text`))[0]!.id
  const question = async (): Promise<string> => {
    const rows = await db.query<{ id: string }>(`select id::text from questions limit 1`)
    if (rows[0]) return rows[0].id
    return (await db.query<{ id: string }>(`insert into questions default values returning id::text`))[0]!.id
  }
  const tournament = (over: Record<string, string> = {}) => {
    const v = { title: `'T'`, education_level_id: `'spm'`, format: `'single_match'`, question_mode: `'subject'`, total_questions: '10', time_window_minutes: '30', top_n_scoring: '5', min_participants: '2', ...over }
    return `insert into tournaments (${Object.keys(v).join(', ')}, created_by) values (${Object.values(v).join(', ')}, (select min(id) from users)) returning id::text`
  }

  beforeAll(async () => {
    db = await createTestDatabase()
    await user()
  })
  afterAll(async () => {
    await db.drop()
  })

  it('creates the eight tables; bigint tables use GENERATED ALWAYS identity, battles/invitations/tournaments use uuid', async () => {
    const found = await db.query<{ table_name: string }>(`select table_name from information_schema.tables where table_schema = 'public' and table_name = any($1::text[])`, [TABLES])
    expect(found.map((r) => r.table_name).sort()).toEqual([...TABLES].sort())
    const ids = await db.query<{ table_name: string; data_type: string; identity_generation: string | null }>(
      `select table_name, data_type, identity_generation from information_schema.columns where table_schema = 'public' and column_name = 'id' and table_name = any($1::text[])`,
      [TABLES],
    )
    const byTable = Object.fromEntries(ids.map((r) => [r.table_name, r]))
    for (const t of ['battles', 'battle_invitations', 'tournaments']) expect(byTable[t]?.data_type).toBe('uuid')
    for (const t of ['battle_participants', 'battle_questions', 'battle_answers', 'battle_queues', 'tournament_subjects']) {
      expect(byTable[t]).toMatchObject({ data_type: 'bigint', identity_generation: 'ALWAYS' })
    }
    expect(await db.query(`select 1 from pg_type where typtype = 'e'`)).toHaveLength(0)
  })

  it('timestamps are timestamptz', async () => {
    const rows = await db.query<{ table_name: string; column_name: string; data_type: string }>(
      `select table_name, column_name, data_type from information_schema.columns where table_schema = 'public' and table_name = any($1::text[]) and (column_name like '%\\_at')`,
      [TABLES],
    )
    expect(rows.length).toBeGreaterThan(8)
    expect(new Set(rows.map((r) => r.data_type))).toEqual(new Set(['timestamp with time zone']))
  })

  it('battles: mode, question type, status, winner, pksk level and answered are checked; defaults hold', async () => {
    const id = await battle()
    expect(await db.query(`select status, answered, is_test, winner from battles where id = $1`, [id])).toEqual([{ status: 'active', answered: 0, is_test: false, winner: null }])
    expect(await rejects(`insert into battles (mode, question_type) values ('1v1', 'biasa')`)).toMatch(/ck_battles_mode/)
    expect(await rejects(`insert into battles (mode, question_type) values ('quick_match', 'x')`)).toMatch(/ck_battles_question_type/)
    expect(await rejects(`insert into battles (mode, question_type, status) values ('quick_match', 'biasa', 'done')`)).toMatch(/ck_battles_status/)
    expect(await rejects(`insert into battles (mode, question_type, winner) values ('quick_match', 'biasa', 'C')`)).toMatch(/ck_battles_winner/)
    expect(await rejects(`insert into battles (mode, question_type, pksk_target_level) values ('quick_match', 'pksk', 'T2')`)).toMatch(/ck_battles_pksk_target_level/)
    expect(await rejects(`insert into battles (mode, question_type, answered) values ('quick_match', 'biasa', 11)`)).toMatch(/ck_battles_answered/)
    for (const mode of ['school_battle', 'challenge', 'queue_join']) await db.query(`insert into battles (mode, question_type) values ($1, 'spm')`, [mode])
  })

  it('LEG: battles and battle_participants carry legacy_source/legacy_id (battles also legacy_hash) with check and unique pair; no other table does', async () => {
    const cols = await db.query<{ table_name: string; column_name: string }>(
      `select table_name, column_name from information_schema.columns where table_schema = 'public' and table_name = any($1::text[]) and column_name like 'legacy\\_%'`,
      [TABLES],
    )
    const got: Record<string, string[]> = {}
    for (const c of cols) (got[c.table_name] ??= []).push(c.column_name)
    expect(Object.keys(got).sort()).toEqual(['battle_participants', 'battles'])
    expect(got['battles']?.sort()).toEqual(['legacy_hash', 'legacy_id', 'legacy_source'])
    expect(got['battle_participants']?.sort()).toEqual(['legacy_id', 'legacy_source'])

    expect(await rejects(`insert into battles (mode, question_type, legacy_source, legacy_id) values ('quick_match', 'biasa', 'other', '1')`)).toMatch(/ck_battles_legacy_source/)
    await db.query(`insert into battles (mode, question_type, legacy_source, legacy_id) values ('quick_match', 'biasa', 'cloud', '77')`)
    expect(await rejects(`insert into battles (mode, question_type, legacy_source, legacy_id) values ('quick_match', 'biasa', 'cloud', '77')`)).toMatch(/uq_battles_legacy/)
    await db.query(`insert into battles (mode, question_type) values ('quick_match', 'biasa')`) // rows without a legacy key do not clash
    await db.query(`insert into battles (mode, question_type) values ('quick_match', 'biasa')`)

    const b = await battle()
    const u = await user()
    expect(await rejects(`insert into battle_participants (battle_id, side, user_id, legacy_source, legacy_id) values ($1, 'A', $2, 'other', '1')`, [b, u])).toMatch(/ck_battle_participants_legacy_source/)
    await db.query(`insert into battle_participants (battle_id, side, user_id, legacy_source, legacy_id) values ($1, 'A', $2, 'cloud', 'p1')`, [b, u])
    const b2 = await battle()
    expect(await rejects(`insert into battle_participants (battle_id, side, user_id, legacy_source, legacy_id) values ($1, 'A', $2, 'cloud', 'p1')`, [b2, u])).toMatch(/uq_battle_participants_legacy/)
  })

  it('LEG columns never appear in the contract schema, paths or the emitted OpenAPI', () => {
    const files = readdirSync(CONTRACT_BATTLE).filter((f) => f.endsWith('.ts')).map((f) => readFileSync(join(CONTRACT_BATTLE, f), 'utf8'))
    for (const text of files) expect(text).not.toMatch(/legacy_?(source|id|hash)/i)
    const openapi = readFileSync(fileURLToPath(new URL('../../../../packages/contract/openapi.json', import.meta.url)), 'utf8')
    expect(openapi).not.toMatch(/legacy_(source|id|hash)/)
  })

  it('battle_participants: side A/B unique per battle, score and correct ranges, school kept when it is deleted', async () => {
    const b = await battle()
    const [u1, u2] = [await user(), await user()]
    await db.query(`insert into battle_participants (battle_id, side, user_id) values ($1, 'A', $2)`, [b, u1])
    expect(await rejects(`insert into battle_participants (battle_id, side, user_id) values ($1, 'A', $2)`, [b, u2])).toMatch(/uq_battle_participants_battle_id_side/)
    expect(await rejects(`insert into battle_participants (battle_id, side, user_id) values ($1, 'C', $2)`, [b, u2])).toMatch(/ck_battle_participants_side/)
    expect(await rejects(`insert into battle_participants (battle_id, side, user_id, score) values ($1, 'B', $2, -1)`, [b, u2])).toMatch(/ck_battle_participants_score/)
    expect(await rejects(`insert into battle_participants (battle_id, side, user_id, correct) values ($1, 'B', $2, 11)`, [b, u2])).toMatch(/ck_battle_participants_correct/)
    expect(await rejects(`insert into battle_participants (battle_id, side, user_id) values ($1, 'B', 999999999)`, [b])).toMatch(/fk_battle_participants_user_id/)
    const [school] = await db.query<{ id: string }>(`insert into schools (name) values ('Sekolah Contoh') returning id::text`)
    await db.query(`insert into battle_participants (battle_id, side, user_id, school_id, is_bot) values ($1, 'B', $2, $3, true)`, [b, u2, school!.id])
    await db.query(`delete from schools where id = $1`, [school!.id])
    expect(await db.query(`select school_id from battle_participants where battle_id = $1 and side = 'B'`, [b])).toEqual([{ school_id: null }])
  })

  it('battle_questions: position 1..10 unique per battle; battle_answers: one per (battle, user, position), option 0..3 or null, seconds 0..15', async () => {
    const b = await battle()
    const u = await user()
    const q = await question()
    await db.query(`insert into battle_questions (battle_id, position, question_id) values ($1, 1, $2)`, [b, q])
    expect(await rejects(`insert into battle_questions (battle_id, position, question_id) values ($1, 1, $2)`, [b, q])).toMatch(/uq_battle_questions_battle_id_position/)
    expect(await rejects(`insert into battle_questions (battle_id, position, question_id) values ($1, 0, $2)`, [b, q])).toMatch(/ck_battle_questions_position/)
    expect(await rejects(`insert into battle_questions (battle_id, position, question_id) values ($1, 11, $2)`, [b, q])).toMatch(/ck_battle_questions_position/)

    const answer = (pos: number, opt: string, sec: number, pts = 0) =>
      db.query(`insert into battle_answers (battle_id, user_id, position, question_id, option_id, correct, seconds, points) values ($1, $2, ${String(pos)}, $3, ${opt}, false, ${String(sec)}, ${String(pts)})`, [b, u, q])
    await answer(1, 'null', 15) // timeout
    await rejects(`insert into battle_answers (battle_id, user_id, position, question_id, option_id, correct, seconds, points) values ($1, $2, 1, $3, 0, false, 1, 0)`, [b, u, q]).then((m) => expect(m).toMatch(/uq_battle_answers_battle_id_user_id_position/))
    await answer(2, '3', 0, 1000)
    expect(await rejects(`insert into battle_answers (battle_id, user_id, position, question_id, option_id, correct, seconds, points) values ($1, $2, 3, $3, 4, false, 1, 0)`, [b, u, q])).toMatch(/ck_battle_answers_option_id/)
    expect(await rejects(`insert into battle_answers (battle_id, user_id, position, question_id, option_id, correct, seconds, points) values ($1, $2, 3, $3, 1, false, 16, 0)`, [b, u, q])).toMatch(/ck_battle_answers_seconds/)
    expect(await rejects(`insert into battle_answers (battle_id, user_id, position, question_id, option_id, correct, seconds, points) values ($1, $2, 11, $3, 1, false, 1, 0)`, [b, u, q])).toMatch(/ck_battle_answers_position/)
    // Deleting the battle removes its questions, answers and participants.
    await db.query(`delete from battles where id = $1`, [b])
    expect(await db.query(`select 1 from battle_answers where battle_id = $1`, [b])).toHaveLength(0)
    expect(await db.query(`select 1 from battle_questions where battle_id = $1`, [b])).toHaveLength(0)
  })

  it('battle_queues: defaults, checks, and the battle link is cleared when the battle goes', async () => {
    const u = await user()
    const [q] = await db.query<{ id: string; status: string; polls: number; wait_polls: number; open_to_all: boolean }>(
      `insert into battle_queues (owner_id, mode, question_type) values ($1, 'quick_match', 'biasa') returning id::text, status, polls, wait_polls, open_to_all`,
      [u],
    )
    expect(q).toMatchObject({ status: 'waiting', polls: 0, wait_polls: 0, open_to_all: false })
    expect(await rejects(`insert into battle_queues (owner_id, mode, question_type) values ($1, 'challenge', 'biasa')`, [u])).toMatch(/ck_battle_queues_mode/)
    expect(await rejects(`insert into battle_queues (owner_id, mode, question_type, status) values ($1, 'quick_match', 'biasa', 'x')`, [u])).toMatch(/ck_battle_queues_status/)
    expect(await rejects(`insert into battle_queues (owner_id, mode, question_type, joiner_outcome) values ($1, 'quick_match', 'biasa', 'x')`, [u])).toMatch(/ck_battle_queues_joiner_outcome/)
    expect(await rejects(`insert into battle_queues (owner_id, mode, question_type, pksk_target_level) values ($1, 'quick_match', 'pksk', 'T9')`, [u])).toMatch(/ck_battle_queues_pksk_target_level/)
    for (const s of ['waiting', 'incoming_challenge', 'matched', 'expired', 'abandoned']) await db.query(`update battle_queues set status = $2 where id = $1`, [q!.id, s])
    const b = await battle()
    await db.query(`update battle_queues set battle_id = $2 where id = $1`, [q!.id, b])
    await db.query(`delete from battles where id = $1`, [b])
    expect(await db.query(`select battle_id from battle_queues where id = $1`, [q!.id])).toEqual([{ battle_id: null }])
  })

  it('battle_invitations: sender differs from receiver, status and type checked, uuid default', async () => {
    const [a, b] = [await user(), await user()]
    const [inv] = await db.query<{ id: string; status: string }>(`insert into battle_invitations (sender_id, receiver_id, question_type) values ($1, $2, 'biasa') returning id::text, status`, [a, b])
    expect(inv!.status).toBe('pending')
    expect(inv!.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    expect(await rejects(`insert into battle_invitations (sender_id, receiver_id, question_type) values ($1, $1, 'biasa')`, [a])).toMatch(/ck_battle_invitations_parties/)
    expect(await rejects(`insert into battle_invitations (sender_id, receiver_id, question_type, status) values ($1, $2, 'biasa', 'x')`, [a, b])).toMatch(/ck_battle_invitations_status/)
    expect(await rejects(`insert into battle_invitations (sender_id, receiver_id, question_type) values ($1, $2, 'x')`, [a, b])).toMatch(/ck_battle_invitations_question_type/)
  })

  it('tournaments: every range and code of the create form is checked in the database', async () => {
    const [t] = await db.query<{ id: string }>(tournament())
    expect(t!.id).toBeTruthy()
    expect(await db.query(`select status, description from tournaments where id = $1`, [t!.id])).toEqual([{ status: 'draft', description: '' }])
    expect(await rejects(tournament({ title: `' '` }))).toMatch(/ck_tournaments_title/)
    expect(await rejects(tournament({ title: `'${'x'.repeat(256)}'` }))).toMatch(/ck_tournaments_title/)
    expect(await rejects(tournament({ education_level_id: `'tingkatan3'` }))).toMatch(/ck_tournaments_education_level_id/)
    expect(await rejects(tournament({ format: `'swiss'` }))).toMatch(/ck_tournaments_format/)
    expect(await rejects(tournament({ groups_count: '1' }))).toMatch(/ck_tournaments_groups_count/)
    expect(await rejects(tournament({ groups_count: '9' }))).toMatch(/ck_tournaments_groups_count/)
    await db.query(tournament({ format: `'league'`, groups_count: '8' }))
    expect(await rejects(tournament({ question_mode: `'x'` }))).toMatch(/ck_tournaments_question_mode/)
    expect(await rejects(tournament({ total_questions: '4' }))).toMatch(/ck_tournaments_total_questions/)
    expect(await rejects(tournament({ total_questions: '101' }))).toMatch(/ck_tournaments_total_questions/)
    expect(await rejects(tournament({ time_window_minutes: '9' }))).toMatch(/ck_tournaments_time_window_minutes/)
    expect(await rejects(tournament({ top_n_scoring: '51' }))).toMatch(/ck_tournaments_top_n_scoring/)
    expect(await rejects(tournament({ min_participants: '0' }))).toMatch(/ck_tournaments_min_participants/)
    expect(await rejects(tournament({ status: `'live'` }))).toMatch(/ck_tournaments_status/)
    expect(await rejects(tournament({ registration_opens_at: `'2026-01-02T00:00:00Z'`, registration_closes_at: `'2026-01-01T00:00:00Z'` }))).toMatch(/ck_tournaments_registration_window/)
    await db.query(tournament({ registration_opens_at: `'2026-01-01T00:00:00Z'`, registration_closes_at: `'2026-01-02T00:00:00Z'` }))
  })

  it('tournament_subjects: unique pair, removed with the tournament', async () => {
    const [t] = await db.query<{ id: string }>(tournament({ question_mode: `'random_mix'` }))
    const [s] = await db.query<{ id: string }>(`insert into subjects (code, name, name_en, color) values ('BTL1', 'Subjek Contoh', 'Sample', '#4f46e5') returning id::text`)
    await db.query(`insert into tournament_subjects (tournament_id, subject_id) values ($1, $2)`, [t!.id, s!.id])
    expect(await rejects(`insert into tournament_subjects (tournament_id, subject_id) values ($1, $2)`, [t!.id, s!.id])).toMatch(/uq_tournament_subjects_tournament_id_subject_id/)
    await db.query(`delete from tournaments where id = $1`, [t!.id])
    expect(await db.query(`select 1 from tournament_subjects where tournament_id = $1`, [t!.id])).toHaveLength(0)
  })

  it('has the indexes of the card and the migratable list holds exactly the two LEG tables', async () => {
    const idx = await db.query<{ indexname: string }>(`select indexname from pg_indexes where schemaname = 'public' and tablename = any($1::text[])`, [TABLES])
    const names = idx.map((i) => i.indexname)
    for (const want of ['ix_battles_status_created_at', 'ix_battle_participants_user_id', 'ix_battle_participants_school_id', 'ix_battle_queues_owner_id', 'ix_battle_invitations_receiver_id_status', 'ix_tournaments_status_registration_opens_at']) {
      expect(names).toContain(want)
    }
    const listed = (JSON.parse(readFileSync(join(PRISMA, 'migratable-models.json'), 'utf8')) as string[]).filter((t) => TABLES.includes(t))
    expect(listed).toEqual(['battle_participants', 'battles'])
  })
})
