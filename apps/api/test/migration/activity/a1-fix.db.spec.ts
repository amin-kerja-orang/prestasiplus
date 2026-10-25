/**
 * A1-FIX against a real PostgreSQL on the `cloud-tiny` fixture (A1 reject analysis, LEAD decisions of 25 Oct 2026).
 * Fictitious values only; planted ids are 5001 up, planted BEFORE `migrate:core` runs (see `BootOptions.prepare`).
 *
 *  1. Stage cascade: the three real BM stage names (`Rendah`, `Menengah Rendah`, `Menengah Atas`) load every education
 *     level, so `chapters`, `subject_levels` and `practice_answers` resolve their `education_level_id` (no ORPHAN_PARENT).
 *  2. Orphaned classes: a class whose teacher is NOT in the source `users` (5001) is excluded with its enrolments (left out
 *     of `eligible_count`, not a reject, pupils still migrate); a class whose teacher IS in the source but was not loaded (5002,
 *     an `agent`) is still an ORPHAN_PARENT reject, and so is its enrolment.
 *  3. In-progress exam attempts are covered by `exam.db.spec.ts`.
 *  4. The two exclusion notes of a RESUMED `migrate:core` apply equal a clean run's (rebuilt from staging, not added to).
 */
import type pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runCore } from '../../../src/migration/load'
import type { AnyEntityStep } from '../../../src/migration/kit/runner'
import { testOutDir } from '../staging/helpers'
import { AS_OF, bootActivity, type ActivityHarness } from './helpers'

let h: ActivityHarness

async function plantA1(pool: pg.Pool): Promise<void> {
  // The real source holds BM stage names. Level 1 and 2 are primary; a form 1 and a form 4 level are added.
  await pool.query(`update staging_cloud.education_levels set stage = 'Rendah'`)
  await pool.query(
    `insert into staging_cloud.education_levels (id, name_bm, name_en, sort_order, curriculum, stage) values
       (3, 'Tingkatan 1', 'Form 1', 3, 'kssm', 'Menengah Rendah'), (4, 'Tingkatan 4', 'Form 4', 4, 'kssm', 'Menengah Atas')`,
  )
  await pool.query(
    `insert into staging_cloud.chapters (id, subject_id, education_level_id, number, title, strand) values
       (5001, 1, 3, 1, 'Bab Tingkatan 1', 'A'), (5002, 1, 4, 1, 'Bab Tingkatan 4', 'A')`,
  )
  // Classes: 5001 teacher 99001 is not in the source users; 5002 teacher 15 is an agent (in the source, never loaded).
  await pool.query(
    `insert into staging_cloud.classrooms (id, name, code, teacher_id, school_id, subject_id, session_year) values
       (5001, 'Darjah 1 Yatim', 'YTM5001', 99001, 1, 1, '2026'),
       (5002, 'Darjah 1 Ejen', 'EJN5002', 15, 1, 1, '2026')`,
  )
  await pool.query(
    `insert into staging_cloud.classroom_student (classroom_id, student_id) values (5001, 1), (5001, 2), (5001, 9999), (5002, 1)`,
  )
}

const levelIdOf = async (legacyId: string): Promise<string | undefined> =>
  (await h.q<{ new_id: string }>(`select new_id from etl_id_map where legacy_source = 'cloud' and entity = 'education_levels' and legacy_id = $1`, [legacyId]))[0]?.new_id

beforeAll(async () => {
  h = await bootActivity({ prepare: plantA1 })
}, 300_000)
afterAll(async () => {
  await h?.close()
})

describe('stage map and its cascade', () => {
  it('loads every education level with the v2 stage of its BM name', async () => {
    const rows = await h.q<{ legacy_id: string; stage: string }>(
      `select legacy_id, stage from education_levels where legacy_source = 'cloud' and legacy_id in ('1','2','3','4') order by legacy_id`,
    )
    expect(rows).toEqual([
      { legacy_id: '1', stage: 'primary' },
      { legacy_id: '2', stage: 'primary' },
      { legacy_id: '3', stage: 'lower_secondary' },
      { legacy_id: '4', stage: 'upper_secondary' },
    ])
    expect(await h.count('etl_rejects', `entity = 'education_levels'`)).toBe(0)
  })

  it('chapters and subject_levels resolve education_level_id: no ORPHAN_PARENT on it', async () => {
    expect(await h.count('etl_rejects', `entity in ('chapters', 'subject_levels') and column_name = 'education_level_id'`)).toBe(0)
    const chapters = await h.q<{ legacy_id: string; education_level_id: string | null }>(
      `select legacy_id, education_level_id::text from chapters where legacy_source = 'cloud' and legacy_id in ('1', '3', '5001', '5002') order by legacy_id::bigint`,
    )
    expect(chapters).toEqual([
      { legacy_id: '1', education_level_id: await levelIdOf('1') },
      { legacy_id: '3', education_level_id: await levelIdOf('2') },
      { legacy_id: '5001', education_level_id: await levelIdOf('3') },
      { legacy_id: '5002', education_level_id: await levelIdOf('4') },
    ])
    const pairs = await h.q<{ education_level_id: string }>(
      `select education_level_id::text from subject_levels where subject_id = (select new_id::bigint from etl_id_map where legacy_source = 'cloud' and entity = 'subjects' and legacy_id = '1')
         and education_level_id in ($1::bigint, $2::bigint)`,
      [await levelIdOf('3'), await levelIdOf('4')],
    )
    expect(pairs.map((p) => p.education_level_id).sort()).toEqual([(await levelIdOf('3')) as string, (await levelIdOf('4')) as string].sort())
  })

  it('practice_answers resolve education_level_id from the question snapshot', async () => {
    const pupil = (await h.q<{ legacy_id: string }>(
      `select m.legacy_id from etl_id_map m join user_roles r on r.user_id = m.new_id::bigint and r.role = 'student'
       where m.entity = 'users' and m.legacy_source = 'cloud' order by m.legacy_id::bigint limit 1`,
    ))[0]?.legacy_id
    expect(pupil).toBeTruthy()
    await h.q(
      `insert into archive_cloud.questions (id, subject_id, education_level_id, chapter_id, topic_id, difficulty_level, type, status, body) values
         (9801, 1, 3, 5001, null, '2', 'objektif', 'diluluskan', 'Soalan penanda 9801'),
         (9802, 1, 4, 5002, null, '2', 'objektif', 'diluluskan', 'Soalan penanda 9802')`,
    )
    await h.q(
      `insert into staging_cloud.practice_sessions
         (id, user_id, subject_id, mode, paper, client_uuid, total_questions, correct, accuracy, duration_seconds, syiling_earned, started_at, created_at)
       values (5101, $1, 1, 'random', 'paper1', null, 2, 1, 50, 60, 0, '2026-03-10T02:00:00Z', '2026-03-10T02:00:00Z')`,
      [pupil],
    )
    await h.q(
      `insert into staging_cloud.question_attempts (id, user_id, practice_session_id, question_id, selected_option, is_correct, time_seconds, created_at) values
         (5201, $1, 5101, 9801, 'A', '1', 5, '2026-03-10T02:01:00Z'), (5202, $1, 5101, 9802, 'B', '0', 6, '2026-03-10T02:02:00Z')`,
      [pupil],
    )
    const only = ['practice_sessions', 'practice_answers']
    expect((await h.run('dry-run', { only })).report.status).toBe('succeeded')
    const applied = await h.run('apply', { only })
    expect(applied.report.status).toBe('succeeded')
    expect(await h.count('etl_rejects', `run_id = ${applied.report.runId} and entity = 'practice_answers' and legacy_id in ('5201', '5202')`)).toBe(0)
    const answers = await h.q<{ legacy_id: string; education_level_id: string | null }>(
      `select legacy_id, education_level_id::text from practice_answers where legacy_source = 'cloud' and legacy_id in ('5201', '5202') order by legacy_id`,
    )
    expect(answers).toEqual([
      { legacy_id: '5201', education_level_id: await levelIdOf('3') },
      { legacy_id: '5202', education_level_id: await levelIdOf('4') },
    ])
  }, 180_000)
})

describe('classes whose teacher is absent from the source', () => {
  const reconOf = async (entity: string) =>
    (await h.q<{ source_count: number; eligible_count: number; loaded: number; rejected: number; status: string }>(
      `select c.source_count, c.eligible_count, c.loaded, c.rejected, c.status from etl_recon c join etl_runs r on r.id = c.run_id
       where r.mode = 'apply' and r.status = 'succeeded' and c.entity = $1 and 'classrooms' = any(r.entity_set) order by r.id desc limit 1`,
      [entity],
    ))[0]

  it('drops the class and its enrolments as an exclusion: no v2 row, no reject row', async () => {
    expect(await h.count('classrooms', `t.legacy_source = 'cloud' and t.legacy_id = '5001'`)).toBe(0)
    expect(await h.count('etl_rejects', `entity = 'classrooms' and legacy_id = '5001'`)).toBe(0)
    expect(await h.count('etl_rejects', `entity = 'enrolments' and legacy_id like '5001:%'`)).toBe(0)
    expect(await h.count('enrolments', `t.legacy_source = 'cloud' and t.legacy_id like '5001:%'`)).toBe(0)
  })

  it('keeps the class whose teacher is in the source but not loaded as an ORPHAN_PARENT reject, with its enrolment', async () => {
    expect(await h.count('classrooms', `t.legacy_source = 'cloud' and t.legacy_id = '5002'`)).toBe(0)
    const rejects = await h.q<{ entity: string; legacy_id: string; reason: string; column_name: string }>(
      `select distinct entity, legacy_id, reason, column_name from etl_rejects where legacy_id in ('5002', '5002:1') and entity in ('classrooms', 'enrolments') order by entity`,
    )
    expect(rejects).toEqual([
      { entity: 'classrooms', legacy_id: '5002', reason: 'ORPHAN_PARENT', column_name: 'teacher_id' },
      { entity: 'enrolments', legacy_id: '5002:1', reason: 'ORPHAN_PARENT', column_name: 'classroom_id' },
    ])
  })

  it('leaves the pupils of the dropped class migrated', async () => {
    expect(await h.count('users', `t.legacy_source = 'cloud' and t.legacy_id in ('1', '2')`)).toBe(2)
  })

  it('takes the excluded rows out of eligible_count and the reconciliation stays ok', async () => {
    const classes = await reconOf('classrooms')
    expect(classes && classes.source_count - classes.eligible_count, 'classrooms excluded').toBe(1)
    expect(classes?.status).toBe('ok')
    expect(classes && classes.eligible_count - classes.loaded - classes.rejected).toBe(0)
    const enrolments = await reconOf('enrolments')
    // 5001 has three pupils (one of them not in the source): all three are excluded with the class.
    expect(enrolments && enrolments.source_count - enrolments.eligible_count, 'enrolments excluded').toBe(3)
    expect(enrolments?.status).toBe('ok')
  })

  it('names the exclusions in the run notes', async () => {
    const notes = (await h.q<{ notes: Record<string, number> }>(
      `select counters -> 'notes' as notes from etl_runs where mode = 'apply' and status = 'succeeded' and entity_set @> array['classrooms']::text[] order by id desc limit 1`,
    ))[0]?.notes
    expect(notes?.['classrooms.excluded.teacher_absent_from_source']).toBe(1)
    expect(notes?.['enrolments.excluded.class_teacher_absent_from_source']).toBe(3)
  })
})

describe('the exclusion notes after a resumed core apply', () => {
  const NOTES = ['classrooms.excluded.teacher_absent_from_source', 'enrolments.excluded.class_teacher_absent_from_source']
  const savedNotes = async (r: ActivityHarness): Promise<Record<string, number>> =>
    (await r.q<{ notes: Record<string, number> }>(
      `select counters -> 'notes' as notes from etl_runs where mode = 'apply' and status = 'succeeded' and entity_set @> array['classrooms']::text[] order by id desc limit 1`,
    ))[0]?.notes ?? {}
  const pick = (all: Record<string, number>) => Object.fromEntries(NOTES.map((k) => [k, all[k]]))

  let r: ActivityHarness
  beforeAll(async () => {
    r = await bootActivity({ core: false, prepare: plantA1 })
  }, 300_000)
  afterAll(async () => {
    await r?.close()
  })

  it('equals a clean run: classrooms and enrolments batches committed before the crash are recounted from staging', async () => {
    const core = (mode: 'dry-run' | 'apply', transformSteps?: (steps: AnyEntityStep[]) => AnyEntityStep[]) =>
      runCore({ pool: r.env.pool, env: r.runEnv, source: 'cloud', asOf: AS_OF, mode, batchSize: 2, outDir: testOutDir(), transformSteps })
    // The crash comes after the classrooms and the enrolments steps have committed all their batches.
    let failed = 0
    const failSubscriptions = (steps: AnyEntityStep[]): AnyEntityStep[] =>
      steps.map((s) =>
        s.entity !== 'school_subscriptions'
          ? s
          : {
              ...s,
              async load() {
                failed += 1
                throw new Error('injected failure after enrolments')
              },
            },
      )
    expect((await core('dry-run')).report.status).toBe('succeeded')
    await expect(core('apply', failSubscriptions)).rejects.toThrow('injected failure after enrolments')
    expect(failed).toBe(1)
    expect(await r.count('classrooms', `t.legacy_source = 'cloud'`)).toBeGreaterThan(0)
    expect(await r.count('etl_checkpoints', `entity = 'enrolments'`)).toBeGreaterThan(0)

    const resumed = await core('apply')
    expect(resumed.report.status).toBe('succeeded')
    expect(resumed.report.resumedBatches).toBeGreaterThanOrEqual(2)
    // The resumed process skipped both steps, so its own context never counted the exclusions: the rebuild sets them.
    const want = { [NOTES[0] as string]: 1, [NOTES[1] as string]: 3 }
    expect(pick(Object.fromEntries(resumed.core.notes.counters))).toEqual(want)
    // What the night SQL checks read, and the same as the clean run of the harness above.
    expect(pick(await savedNotes(r))).toEqual(want)
    expect(pick(await savedNotes(h))).toEqual(want)
  }, 300_000)
})
