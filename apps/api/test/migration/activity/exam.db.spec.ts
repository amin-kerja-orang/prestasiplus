/**
 * Exam attempt headers and the free-text guarantee of `migrate:activity` (card AC2, BE-29 Part A), against a real
 * PostgreSQL. The spec plants the marker `SENTINEL_FREE_TEXT` in every source column that holds free text or
 * grading detail (the served composition and section selections of the attempts, the part responses with their
 * AI grading, the structured answers, and the stem and options of an archived question), runs the exam and
 * practice entities, and then scans EVERY text / varchar / jsonb / array column of EVERY table of the v2 public
 * schema: the marker must not appear anywhere.
 *
 * Planted (S1, S2 are migrated pupils of the fixture; fictitious values, surrogate ids from 7001 up):
 *   attempts 7001 (submitted, score 30/40, sections), 7002 (auto-submitted, no score, no paper), 7003 (status still
 *   in progress = rejected), 7004 (abandoned, score 5/40), 7005 (marked = submitted, 12/40), 7006 (no status id =
 *   rejected INVALID_VALUE), 7007 (a status id with no lookup row = INVALID_VALUE), 7008 (a slug outside the map =
 *   UNKNOWN_ENUM). The status is `exam_attempts.status_id` -> `attempt_statuses.slug`.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bootActivity, type ActivityHarness } from './helpers'

const ONLY = ['practice_sessions', 'practice_answers', 'exam_attempts']
const SENTINEL = 'SENTINEL_FREE_TEXT'

let h: ActivityHarness
let s1 = ''
let s2 = ''
let runId = ''

beforeAll(async () => {
  h = await bootActivity()
  const pupils = await h.q<{ legacy_id: string }>(
    `select m.legacy_id from etl_id_map m join user_roles r on r.user_id = m.new_id::bigint and r.role = 'student'
     where m.entity = 'users' and m.legacy_source = 'cloud' order by m.legacy_id::bigint limit 2`,
  )
  s1 = pupils[0]?.legacy_id ?? ''
  s2 = pupils[1]?.legacy_id ?? ''
  expect(s1 && s2, 'the fixture must give two migrated pupils').toBeTruthy()

  // The status lookup of .cloud: the three real slugs, plus map aliases and one slug the map does not know.
  await h.q(`delete from staging_cloud.attempt_statuses`)
  await h.q(
    `insert into staging_cloud.attempt_statuses (id, slug) values
       (1, 'in_progress'), (2, 'submitted'), (3, 'marked'), (4, 'auto_submitted'), (5, 'abandoned'), (6, 'slug_tidak_dikenali')`,
  )
  await h.q(
    `insert into staging_cloud.exam_attempts
       (id, user_id, exam_paper_id, mode, status_id, score, max_score, section_scores, section_selections, served_composition, created_at, updated_at)
     values
       (7001, $1, 1, 'exam', 2, 30, 40, '{"a":15,"b":15}', '{"note":"${SENTINEL}"}', '[{"stem":"${SENTINEL}"}]', '2026-03-10T01:00:00Z', '2026-03-10T03:00:00Z'),
       (7002, $2, null, 'latihan', 4, null, null, null, '{"note":"${SENTINEL}"}', null, '2026-03-11T01:00:00Z', '2026-03-11T02:00:00Z'),
       (7003, $1, 1, 'exam', 1, 0, 40, null, null, '[{"stem":"${SENTINEL}"}]', '2026-03-12T01:00:00Z', '2026-03-12T01:00:00Z'),
       (7004, $2, 1, 'latihan', 5, 5, 40, '{"a":5}', null, null, '2026-03-13T01:00:00Z', '2026-03-13T02:00:00Z'),
       (7005, $1, 1, 'exam', 3, 12, 40, null, null, null, '2026-03-15T01:00:00Z', '2026-03-15T02:00:00Z'),
       (7006, $1, 1, 'exam', null, 1, 40, null, null, null, '2026-03-16T01:00:00Z', '2026-03-16T02:00:00Z'),
       (7007, $1, 1, 'exam', 99, 1, 40, null, null, null, '2026-03-17T01:00:00Z', '2026-03-17T02:00:00Z'),
       (7008, $1, 1, 'exam', 6, 1, 40, null, null, null, '2026-03-18T01:00:00Z', '2026-03-18T02:00:00Z')`,
    [s1, s2],
  )
  // The title year comes from the paper's questions (exam_questions.exam_paper_id -> source_papers); the fixture has none.
  await h.q(`delete from archive_cloud.exam_questions`)
  await h.q(
    `insert into archive_cloud.exam_questions (id, source_paper_id, exam_paper_id, number_label) values (1, 1, 1, '1'), (2, 1, 1, '2')`,
  )
  // The free-text and grading columns of the source: planted, and never to be read.
  await h.q(
    `insert into staging_cloud.part_responses (id, exam_attempt_id, question_part_id, response, awarded_marks, ai_grade, grading_status, graded_by)
     values (8001, 7001, 1, '"${SENTINEL}"'::jsonb, 3, '{"comment":"${SENTINEL}"}', 'graded', '${SENTINEL}')`,
  )
  await h.q(
    `insert into staging_cloud.structured_attempt_answers (id, structured_attempt_id, structured_sub_question_id, awarded)
     values (8101, 1, 1, 2)`,
  )
  // An archived question whose stem and options carry the marker, answered in a practice session.
  await h.q(`insert into archive_cloud.questions (id, subject_id, education_level_id, chapter_id, topic_id, difficulty_level, type, status, body)
             values (9501, 1, 1, 1, 1, '2', 'objektif', 'diluluskan', '${SENTINEL} stem')`)
  await h.q(`insert into archive_cloud.question_options (id, question_id, label, body, is_correct)
             values (9601, 9501, 'A', '${SENTINEL} option', '1'), (9602, 9501, 'B', 'lain', '0')`)
  await h.q(
    `insert into staging_cloud.practice_sessions (id, user_id, subject_id, mode, paper, client_uuid, total_questions, correct, accuracy, duration_seconds, syiling_earned, started_at, created_at)
     values (7101, $1, 1, 'random', 'paper1', null, 3, 1, 33, 90, 1, '2026-03-14T02:00:00Z', '2026-03-14T02:00:00Z')`,
    [s1],
  )
  await h.q(
    `insert into staging_cloud.question_attempts (id, user_id, practice_session_id, question_id, selected_option, is_correct, time_seconds, created_at)
     values (7201, $1, 7101, 9501, 'A', '1', 9, '2026-03-14T02:01:00Z')`,
    [s1],
  )
}, 300_000)
afterAll(async () => {
  await h?.close()
})

describe('exam attempts (AC2)', () => {
  it('dry-runs and applies with every reconciliation row ok', async () => {
    const dry = await h.run('dry-run', { only: ONLY })
    expect(dry.report.status).toBe('succeeded')
    expect(await h.count('exam_attempts')).toBe(0)
    const applied = await h.run('apply', { only: ONLY })
    expect(applied.report.status).toBe('succeeded')
    for (const r of applied.report.recon) expect(r.eligibleCount - r.loaded - r.rejected, r.entity).toBe(0)
    runId = applied.report.runId
    // Rejected statuses are counted by name: 7003 is in_progress; 7006 (no id), 7007 (no lookup row) and 7008 (unknown slug) are `other`.
    expect(applied.activity.notes.counters.get('exam_attempts.status_rejected.in_progress')).toBe(1)
    expect(applied.activity.notes.counters.get('exam_attempts.status_rejected.other')).toBe(3)
  }, 180_000)

  it('loads the header with the documented sentinels and the result with the score only', async () => {
    const a = (await h.q(
      `select paper_id, paper_kind, title, subject, subject_name, kertas, paper_code, mode, status, started_at::text, duration_min,
              composition::text, flags, picks::text, position, submitted_at::text, deadline_at, is_test
       from exam_attempts where legacy_source = 'cloud' and legacy_id = '7001'`,
    ))[0]
    expect(a).toMatchObject({
      paper_id: null, paper_kind: 'pilihan', title: 'Kertas Contoh (2025)', subject: 'legacy', kertas: 1, paper_code: 'LEGACY',
      mode: 'exam', status: 'submitted', duration_min: 1, composition: '[]', flags: ['historical'], picks: '{}', position: 0,
      deadline_at: null, is_test: false,
    })
    const r = (await h.q(
      `select r.score::text, r.max_score::text, r.section_scores::text, r.graded::text, r.provisional, r.pending_review, r.coins, r.points
       from attempt_results r join exam_attempts e on e.id = r.attempt_id where e.legacy_source = 'cloud' and e.legacy_id = '7001'`,
    ))[0]
    expect(r).toMatchObject({ score: '30.00', max_score: '40.00', provisional: false, pending_review: 0, coins: null, points: null })
    expect(JSON.parse(String(r?.section_scores))).toEqual({ a: 15, b: 15 })
    expect(JSON.parse(String(r?.graded))).toEqual({ sections: [], questions: [] })
  })

  it('maps the statuses, uses the fixed title without a paper, and writes no result without a score', async () => {
    const rows = await h.q<{ legacy_id: string; status: string; title: string; submitted_at: string | null; has_result: boolean }>(
      `select e.legacy_id, e.status, e.title, e.submitted_at::text, exists (select 1 from attempt_results r where r.attempt_id = e.id) as has_result
       from exam_attempts e where e.legacy_source = 'cloud' and e.legacy_id in ('7001','7002','7003','7004','7005') order by e.legacy_id`,
    )
    expect(rows.map((r) => [r.legacy_id, r.status, r.has_result])).toEqual([
      ['7001', 'submitted', true],
      ['7002', 'auto_submitted', false],
      ['7004', 'abandoned', true],
      ['7005', 'submitted', true], // slug `marked`
    ])
    expect(rows[1]?.title).toBe('Percubaan peperiksaan lama')
    expect(rows[2]?.submitted_at).toBeNull()
    const rejected = await h.q<{ legacy_id: string; reason: string; column_name: string }>(
      `select legacy_id, reason, column_name from etl_rejects where run_id = $1 and entity = 'exam_attempts' and legacy_id in ('7003','7006','7007','7008') order by legacy_id`,
      [runId],
    )
    expect(rejected).toEqual([
      { legacy_id: '7003', reason: 'UNKNOWN_ENUM', column_name: 'status' }, // slug in_progress
      { legacy_id: '7006', reason: 'INVALID_VALUE', column_name: 'status' }, // no status_id
      { legacy_id: '7007', reason: 'INVALID_VALUE', column_name: 'status' }, // status_id without a lookup row
      { legacy_id: '7008', reason: 'UNKNOWN_ENUM', column_name: 'status' }, // slug the map does not know
    ])
  })

  it('keeps SENTINEL_FREE_TEXT out of every text, varchar, jsonb and array column of every v2 table', async () => {
    // The marker really is in the source (so the scan below proves something).
    expect(await h.count('staging_cloud.exam_attempts', `t.section_selections::text like '%${SENTINEL}%'`)).toBeGreaterThan(0)
    expect(await h.count('staging_cloud.part_responses', `t.response::text like '%${SENTINEL}%'`)).toBe(1)
    expect(await h.count('archive_cloud.questions', `t.body like '%${SENTINEL}%'`)).toBe(1)

    const cols = await h.q<{ table_name: string; column_name: string }>(
      `select c.table_name, c.column_name from information_schema.columns c
       join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
       where c.table_schema = 'public'
         and (c.data_type in ('text', 'character varying', 'character', 'jsonb', 'json') or (c.data_type = 'ARRAY' and c.udt_name in ('_text', '_varchar')))
       order by 1, 2`,
    )
    expect(cols.length).toBeGreaterThan(100)
    const offenders: string[] = []
    for (const { table_name: t, column_name: c } of cols) {
      const n = Number((await h.q<{ n: string }>(`select count(*)::text as n from "public"."${t}" where "${c}"::text like $1`, [`%${SENTINEL}%`]))[0]?.n)
      if (n > 0) offenders.push(`${t}.${c}`)
    }
    expect(offenders).toEqual([])
    // The scan covers the tables this spec wrote.
    const scanned = new Set(cols.map((c) => c.table_name))
    for (const t of ['exam_attempts', 'attempt_results', 'practice_answers', 'practice_sessions', 'etl_rejects']) expect(scanned.has(t), t).toBe(true)
    // The answer that came from the marked question carries the hash and the ids, not the text.
    const answer = (await h.q<{ legacy_content_hash: string; legacy_question_ref: string }>(
      `select legacy_content_hash, legacy_question_ref from practice_answers where legacy_source = 'cloud' and legacy_id = '7201'`,
    ))[0]
    expect(answer?.legacy_question_ref).toBe('9501')
    expect(answer?.legacy_content_hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('never selects the free-text or grading columns of the source', async () => {
    // A second apply reads the same input; its statements must not name those columns of the attempts or the part tables.
    const seen: string[] = []
    const pgModule = await import('pg')
    const original = pgModule.default.Client.prototype.query
    pgModule.default.Client.prototype.query = function patched(this: unknown, ...args: unknown[]) {
      const first = args[0]
      if (typeof first === 'string') seen.push(first)
      else if (first && typeof first === 'object' && typeof (first as { text?: unknown }).text === 'string') seen.push((first as { text: string }).text)
      return (original as (...a: unknown[]) => unknown).apply(this, args)
    } as typeof original
    try {
      expect((await h.run('apply', { only: ONLY })).report.status).toBe('succeeded')
    } finally {
      pgModule.default.Client.prototype.query = original
    }
    const reads = seen.filter((s) => /staging_cloud"?\."?exam_attempts/.test(s))
    expect(reads.length).toBeGreaterThan(0)
    for (const s of reads) expect(s).not.toMatch(/section_selections|served_composition/)
    // The status is read through the lookup, not from a column of the attempt.
    expect(reads.some((s) => /attempt_statuses/.test(s) && /status_id/.test(s))).toBe(true)
    expect(seen.filter((s) => /\b(part_responses|structured_attempt_answers|ai_grade)\b/.test(s))).toEqual([])
  }, 180_000)

  it('a second apply changes nothing', async () => {
    const before = await h.contentHashes()
    const again = await h.run('apply', { only: ONLY })
    expect(again.report.status).toBe('succeeded')
    for (const c of Object.values(again.report.counters)) {
      expect(c.inserted).toBe(0)
      expect(c.updated).toBe(0)
    }
    expect(await h.contentHashes()).toEqual(before)
    expect(await h.count('attempt_results')).toBe(await h.count('exam_attempts', `t.legacy_source = 'cloud' and exists (select 1 from attempt_results r where r.attempt_id = t.id)`))
  }, 180_000)
})
