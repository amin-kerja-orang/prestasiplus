/**
 * Practice sessions and answers of `migrate:activity` against a real PostgreSQL (card AC1, BE-29 Part A).
 * The BE-35 fixture is booted by `bootActivity` (BE-28 applied); this spec plants its own synthetic rows with SQL
 * inserts into `staging_cloud` / `archive_cloud` (fictitious values, ids from 1001 / 5001 / 9001 up) and runs only
 * the two practice entities.
 *
 * Planted data (S1 and S2 are migrated pupils of the fixture):
 *   questions 9001..9004 in the archive: 9001 (subject 1, difficulty 3, 3 options), 9002 (subject 2), 9003 (chapter 4 =
 *     the orphan chapter of the fixture), 9004 (no subject)
 *   sessions  1001 (S1, subject 1, random), 1002 (S2, subject 2, chapter), 1003 (S1, mode spm = rejected), 1004 / 1005 /
 *             1006 (the real modes spm_tahun_lepas, spm_mock -> past_year and spm_ramalan -> ramalan), 1007 (battle = rejected)
 *   canonical questions for the source-paper key: 9001 -> exam question 9301 (source paper 1, label 7), 9002 -> 9302
 *             (no source paper, label 8)
 *   attempts  5001 ok, 5002 ok (lower-case label), 5003 ok, 5004 ok (subject from the session), 5005 orphan chapter,
 *             5006 on the rejected session, 5007 question not in the archive (session subject), 5008 bad label
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { contentHash } from '../../../src/migration/snapshot-dims'
import { bootActivity, type ActivityHarness } from './helpers'

const ONLY = ['practice_sessions', 'practice_answers']
const PLANTED_OK = ['5001', '5002', '5003', '5004', '5007']

let h: ActivityHarness
let s1 = ''
let s2 = ''
let runId = ''
const mapped = async (entity: string, legacyId: string): Promise<string> => {
  const rows = await h.q<{ new_id: string }>(
    `select new_id from etl_id_map where legacy_source = 'cloud' and entity = $1 and legacy_id = $2`,
    [entity, legacyId],
  )
  return rows[0]?.new_id ?? ''
}

beforeAll(async () => {
  h = await bootActivity()
  const pupils = await h.q<{ legacy_id: string }>(
    `select m.legacy_id from etl_id_map m join user_roles r on r.user_id = m.new_id::bigint and r.role = 'student'
     where m.entity = 'users' and m.legacy_source = 'cloud' order by m.legacy_id::bigint limit 2`,
  )
  s1 = pupils[0]?.legacy_id ?? ''
  s2 = pupils[1]?.legacy_id ?? ''
  expect(s1 && s2, 'the fixture must give two migrated pupils').toBeTruthy()

  await h.q(
    `insert into archive_cloud.questions (id, subject_id, education_level_id, chapter_id, topic_id, difficulty_level, type, status, body) values
       (9001, 1, 1, 1, 1, '3', 'objektif', 'diluluskan', 'Soalan penanda 9001'),
       (9002, 2, 2, 3, 3, '5', 'objektif', 'diluluskan', 'Soalan penanda 9002'),
       (9003, 1, 2, 4, null, '2', 'objektif', 'diluluskan', 'Soalan penanda 9003'),
       (9004, null, null, null, null, null, 'objektif', 'diluluskan', 'Soalan penanda 9004')`,
  )
  await h.q(
    `insert into archive_cloud.question_options (id, question_id, label, body, is_correct) values
       (9101, 9001, 'A', 'Pilihan C', '0'), (9102, 9001, 'B', 'Pilihan A', '1'), (9103, 9001, 'C', 'Pilihan B', '0')`,
  )
  await h.q(
    `insert into staging_cloud.practice_sessions
       (id, user_id, subject_id, mode, paper, client_uuid, total_questions, correct, accuracy, duration_seconds, syiling_earned, started_at, created_at)
     values
       (1001, $1, 1, 'random', 'paper1', '11111111-1111-4111-8111-111111111111', 5, 2, 40, 120, 3, '2026-03-10T02:00:00Z', '2026-03-10T02:00:00Z'),
       (1002, $2, 2, 'chapter', 'paper2', 'not-a-uuid', 4, 4, 100, 60, 0, '2026-03-11T02:00:00Z', '2026-03-11T02:00:00Z'),
       (1003, $1, 1, 'spm', 'paper1', null, 4, 1, 25, 60, 0, '2026-03-12T02:00:00Z', '2026-03-12T02:00:00Z'),
       (1004, $1, 1, 'spm_tahun_lepas', null, null, 4, 1, 25, 60, 0, '2026-03-12T03:00:00Z', '2026-03-12T03:00:00Z'),
       (1005, $1, 1, 'spm_mock', null, null, 4, 1, 25, 60, 0, '2026-03-12T04:00:00Z', '2026-03-12T04:00:00Z'),
       (1006, $1, 1, 'spm_ramalan', null, null, 4, 1, 25, 60, 0, '2026-03-12T05:00:00Z', '2026-03-12T05:00:00Z'),
       (1007, $1, 1, 'battle', null, null, 4, 1, 25, 60, 0, '2026-03-12T06:00:00Z', '2026-03-12T06:00:00Z')`,
    [s1, s2],
  )
  // The canonical bridge: the natural key is the question's own source paper (exam_questions.source_paper_id).
  await h.q(
    `insert into archive_cloud.exam_questions (id, source_paper_id, exam_paper_id, number_label) values (9301, 1, 1, '7'), (9302, null, 1, '8')`,
  )
  await h.q(
    `insert into archive_cloud.legacy_canonical_map (id, source, legacy_id, canonical_type, canonical_id) values
       (9401, 'questions', '9001', 'exam_question', 9301), (9402, 'questions', '9002', 'exam_question', 9302)`,
  )
  await h.q(
    `insert into staging_cloud.question_attempts (id, user_id, practice_session_id, question_id, selected_option, is_correct, time_seconds, created_at) values
       (5001, $1, 1001, 9001, 'A', '1', 11, '2026-03-10T02:01:00Z'),
       (5002, $1, 1001, 9002, 'b', '0', 12, '2026-03-10T02:02:00Z'),
       (5003, $2, 1002, 9001, 'C', '1', 13, '2026-03-11T02:01:00Z'),
       (5004, $2, 1002, 9004, 'A', '1', 14, '2026-03-11T02:02:00Z'),
       (5005, $2, 1002, 9003, 'A', '0', 15, '2026-03-11T02:03:00Z'),
       (5006, $1, 1003, 9001, 'A', '1', 16, '2026-03-12T02:01:00Z'),
       (5007, $1, 1001, 99999, 'A', '0', 17, '2026-03-10T02:03:00Z'),
       (5008, $1, 1001, 9001, 'Z', '1', 18, '2026-03-10T02:04:00Z')`,
    [s1, s2],
  )
}, 300_000)
afterAll(async () => {
  await h?.close()
})

describe('practice sessions and answers (AC1)', () => {
  it('dry-runs and applies with every reconciliation row ok', async () => {
    const dry = await h.run('dry-run', { only: ONLY })
    expect(dry.report.status).toBe('succeeded')
    expect(await h.count('practice_answers')).toBe(0)
    const applied = await h.run('apply', { only: ONLY })
    expect(applied.report.status).toBe('succeeded')
    for (const r of applied.report.recon) expect(r.eligibleCount - r.loaded - r.rejected, r.entity).toBe(0)
    runId = applied.report.runId
  }, 180_000)

  it('migrates sessions as completed rows with completed_at = started_at + duration, and counts spm separately', async () => {
    const rows = await h.q<{ legacy_id: string; status: string; mode: string; completed_at: string; started_at: string; client_uuid: string | null; legacy_paper: string }>(
      `select legacy_id, status, mode, completed_at::text, started_at::text, client_uuid::text, legacy_paper
       from practice_sessions where legacy_source = 'cloud' and legacy_id in ('1001','1002','1003') order by legacy_id`,
    )
    expect(rows.map((r) => r.legacy_id)).toEqual(['1001', '1002']) // 1003 (spm) is rejected
    const first = rows[0]
    expect(first).toMatchObject({ status: 'completed', mode: 'random', client_uuid: '11111111-1111-4111-8111-111111111111', legacy_paper: 'paper1' })
    const diff = await h.q<{ s: string }>(`select extract(epoch from (completed_at - started_at))::text as s from practice_sessions where legacy_source = 'cloud' and legacy_id = '1001'`)
    expect(Number(diff[0]?.s)).toBe(120)
    expect(rows[1]?.client_uuid).toBeNull() // invalid client_uuid becomes null
    const rejected = await h.q<{ reason: string; column_name: string }>(
      `select reason, column_name from etl_rejects where run_id = $1 and entity = 'practice_sessions' and legacy_id = '1003'`, [runId],
    )
    expect(rejected).toEqual([{ reason: 'UNKNOWN_ENUM', column_name: 'mode' }])
  })

  it('stores every migrated answer as a historical snapshot with its own dimensions and no question link', async () => {
    const all = await h.q<{ n: string; linked: string; hist: string; nosubject: string }>(
      `select count(*)::text as n, count(*) filter (where question_id is not null)::text as linked,
              count(*) filter (where historical)::text as hist, count(*) filter (where subject_id is null)::text as nosubject
       from practice_answers where legacy_source = 'cloud'`,
    )
    const a = all[0]
    expect(Number(a?.n)).toBeGreaterThanOrEqual(PLANTED_OK.length)
    expect(a).toMatchObject({ linked: '0', hist: a?.n, nosubject: '0' })

    const planted = await h.q<{ legacy_id: string }>(
      `select legacy_id from practice_answers where legacy_source = 'cloud' and legacy_id = any($1::text[]) order by legacy_id`, [PLANTED_OK],
    )
    expect(planted.map((r) => r.legacy_id)).toEqual(PLANTED_OK)

    const one = (await h.q(
      `select subject_id::text, education_level_id::text, chapter_id::text, topic_id::text, difficulty, question_type, selected_label,
              is_correct, time_seconds, answered_at::text, historical, client_uuid::text, legacy_question_ref, legacy_content_hash,
              source_natural_key, number_label
       from practice_answers where legacy_source = 'cloud' and legacy_id = '5001'`,
    ))[0]
    expect(one).toMatchObject({
      subject_id: await mapped('subjects', '1'), education_level_id: await mapped('education_levels', '1'),
      chapter_id: await mapped('chapters', '1'), topic_id: await mapped('topics', '1'),
      difficulty: 3, question_type: 'mcq', selected_label: 'A', is_correct: true, time_seconds: 11, historical: true,
      client_uuid: '11111111-1111-4111-8111-111111111111', legacy_question_ref: '9001',
    })
    // The hash is the helper's SHA-256 of the normalised stem and sorted options, not the text.
    expect(one?.legacy_content_hash).toBe(contentHash('Soalan penanda 9001', ['Pilihan C', 'Pilihan A', 'Pilihan B']))
    expect(one?.legacy_content_hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('maps the real .cloud practice modes and counts spm and battle by name', async () => {
    const rows = await h.q<{ legacy_id: string; mode: string }>(
      `select legacy_id, mode from practice_sessions where legacy_source = 'cloud' and legacy_id in ('1004','1005','1006','1007') order by legacy_id`,
    )
    expect(rows).toEqual([
      { legacy_id: '1004', mode: 'past_year' },
      { legacy_id: '1005', mode: 'past_year' },
      { legacy_id: '1006', mode: 'ramalan' },
    ])
    const rejected = await h.q<{ legacy_id: string; reason: string; column_name: string }>(
      `select legacy_id, reason, column_name from etl_rejects where run_id = $1 and entity = 'practice_sessions' and legacy_id in ('1003','1007') order by legacy_id`,
      [runId],
    )
    expect(rejected).toEqual([
      { legacy_id: '1003', reason: 'UNKNOWN_ENUM', column_name: 'mode' },
      { legacy_id: '1007', reason: 'UNKNOWN_ENUM', column_name: 'mode' },
    ])
  })

  it('reads the source-paper key straight from exam_questions.source_paper_id and the question type from questions.type', async () => {
    const rows = await h.q<{ legacy_id: string; source_natural_key: string | null; number_label: string | null; question_type: string | null }>(
      `select legacy_id, source_natural_key, number_label, question_type from practice_answers
       where legacy_source = 'cloud' and legacy_id in ('5001','5002','5003') order by legacy_id`,
    )
    expect(rows).toEqual([
      { legacy_id: '5001', source_natural_key: 'contoh-2025-1', number_label: '7', question_type: 'mcq' },
      { legacy_id: '5002', source_natural_key: null, number_label: '8', question_type: 'mcq' },
      { legacy_id: '5003', source_natural_key: 'contoh-2025-1', number_label: '7', question_type: 'mcq' },
    ])
  })

  it('upper-cases the label, falls back to the session subject and keeps an unarchived question reference', async () => {
    const rows = await h.q<{ legacy_id: string; subject_id: string; selected_label: string; chapter_id: string | null; legacy_question_ref: string; legacy_content_hash: string | null; difficulty: number | null }>(
      `select legacy_id, subject_id::text, selected_label, chapter_id::text, legacy_question_ref, legacy_content_hash, difficulty
       from practice_answers where legacy_source = 'cloud' and legacy_id in ('5002','5004','5007') order by legacy_id`,
    )
    expect(rows[0]).toMatchObject({ legacy_id: '5002', selected_label: 'B', subject_id: await mapped('subjects', '2') })
    // 5004: the question has no subject -> the session's subject (2); no chapter.
    expect(rows[1]).toMatchObject({ legacy_id: '5004', subject_id: await mapped('subjects', '2'), chapter_id: null })
    // 5007: the question is not in the archive -> session subject (1), reference kept, no hash, no difficulty.
    expect(rows[2]).toMatchObject({ legacy_id: '5007', subject_id: await mapped('subjects', '1'), legacy_question_ref: '99999', legacy_content_hash: null, difficulty: null })
  })

  it('rejects unknown dimensions, an unloaded session and an invalid label with reason codes', async () => {
    const rejects = await h.q<{ legacy_id: string; reason: string; column_name: string }>(
      `select legacy_id, reason, column_name from etl_rejects
       where run_id = $1 and entity = 'practice_answers' and legacy_id in ('5005','5006','5008') order by legacy_id`, [runId],
    )
    expect(rejects).toEqual([
      { legacy_id: '5005', reason: 'ORPHAN_PARENT', column_name: 'chapter_id' },
      { legacy_id: '5006', reason: 'ORPHAN_PARENT', column_name: 'practice_session_id' },
      { legacy_id: '5008', reason: 'INVALID_VALUE', column_name: 'selected_option' },
    ])
    expect(await h.count('practice_answers', `legacy_source = 'cloud' and legacy_id in ('5005','5006','5008')`)).toBe(0)
  })

  it('gives the same per-user and per-subject accuracy as the staged attempts joined to the archived questions', async () => {
    // Per user: v2 (from practice_answers) versus staged question_attempts, over the answers that were migrated.
    const perUserV2 = await h.q<{ k: string; n: string; c: string }>(
      `select user_id::text as k, count(*)::text as n, sum(is_correct::int)::text as c
       from practice_answers where legacy_source = 'cloud' group by 1 order by 1`,
    )
    const perUserStaged = await h.q<{ k: string; n: string; c: string }>(
      `select u.new_id as k, count(*)::text as n, sum((qa.is_correct = '1')::int)::text as c
       from staging_cloud.question_attempts qa
       join etl_id_map u on u.entity = 'users' and u.legacy_source = 'cloud' and u.legacy_id = qa.user_id::text
       where qa.id::text in (select legacy_id from practice_answers where legacy_source = 'cloud')
       group by 1 order by 1`,
    )
    expect(perUserV2.length).toBeGreaterThan(0)
    expect(perUserV2).toEqual(perUserStaged)

    // Per subject: the question's subject, else the session's (the same rule, computed from the staged tables).
    const perSubjectV2 = await h.q<{ k: string; n: string; c: string }>(
      `select subject_id::text as k, count(*)::text as n, sum(is_correct::int)::text as c
       from practice_answers where legacy_source = 'cloud' group by 1 order by 1`,
    )
    const perSubjectStaged = await h.q<{ k: string; n: string; c: string }>(
      `select s.new_id as k, count(*)::text as n, sum((qa.is_correct = '1')::int)::text as c
       from staging_cloud.question_attempts qa
       left join archive_cloud.questions q on q.id = qa.question_id
       left join staging_cloud.practice_sessions ps on ps.id = qa.practice_session_id
       join etl_id_map s on s.entity = 'subjects' and s.legacy_source = 'cloud' and s.legacy_id = coalesce(q.subject_id, ps.subject_id)::text
       where qa.id::text in (select legacy_id from practice_answers where legacy_source = 'cloud')
       group by 1 order by 1`,
    )
    expect(perSubjectV2).toEqual(perSubjectStaged)

    // The session counters are not touched by the answers: correct_count stays the .cloud figure.
    const s = await h.q<{ correct_count: number; question_count: number }>(
      `select correct_count, question_count from practice_sessions where legacy_source = 'cloud' and legacy_id = '1001'`,
    )
    expect(s[0]).toEqual({ correct_count: 2, question_count: 5 })
  })

  it('a second apply changes nothing', async () => {
    const before = await h.contentHashes()
    const again = await h.run('apply', { only: ONLY })
    expect(again.report.status).toBe('succeeded')
    for (const c of Object.values(again.report.counters)) {
      expect(c.inserted).toBe(0)
      expect(c.updated).toBe(0)
    }
    expect(await h.contentHashes()).toEqual(before)
  }, 180_000)
})
