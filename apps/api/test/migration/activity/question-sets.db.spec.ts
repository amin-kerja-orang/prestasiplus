/**
 * BE-29 question-set headers against a real PostgreSQL (OD-10 Q4 A, half AZ's AZ-31 / migration 0042): the teacher header is
 * loaded as "needs rebuild" with no class and no items; a blank, unmapped or non-teacher owner is rejected. Only the
 * question-set step runs. Staged values are synthetic.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { questionSetsStep } from '../../../src/migration/load/activity/question-set-steps'
import { NOT_MIGRATED_ACTIVITY } from '../../../src/migration/load/activity/not-migrated'
import { isVisibleAt } from '../../../src/modules/classes/question-sets/question-sets.service'
import type { ActivityGroup } from '../../../src/migration/load/activity'
import { bootActivity, type ActivityHarness } from './helpers'

let h: ActivityHarness
const group: ActivityGroup = { name: 'content', notMigrated: [], steps: (a) => [questionSetsStep(a)] }
const groups = [group]

let teacher = ''
let student = ''
let subject = ''
let applied: Awaited<ReturnType<ActivityHarness['run']>>
let reasons: Record<string, number> = {}
let notes: Record<string, number> = {}

beforeAll(async () => {
  h = await bootActivity()
  const mapped = async (role: string): Promise<string> =>
    (await h.q<{ legacy_id: string }>(
      `select m.legacy_id from etl_id_map m join user_roles r on r.user_id = m.new_id::bigint
       where m.legacy_source = 'cloud' and m.entity = 'users' and r.role = $1 order by m.legacy_id::bigint limit 1`, [role],
    ))[0]?.legacy_id ?? ''
  teacher = await mapped('teacher')
  student = await mapped('student')
  subject = (await h.q<{ legacy_id: string }>(`select legacy_id from etl_id_map where legacy_source = 'cloud' and entity = 'subjects' order by legacy_id::bigint limit 1`))[0]?.legacy_id ?? ''
  expect([teacher, student, subject].every((v) => v !== '')).toBe(true)

  await h.q(`delete from staging_cloud.question_sets`)
  await h.q(
    `insert into staging_cloud.question_sets (id, teacher_id, title, subject_id, education_level_id, status, created_at, updated_at) values
      (1, ${teacher}, '  Set Satu  ', ${subject}, 1, 'terbit', '2024-02-03T04:05:06Z', '2024-06-07T08:09:10Z'),
      (2, ${teacher}, 'Set Dua', null, null, null, '2024-02-03T04:05:06Z', null),
      (3, null, 'Tanpa guru', null, null, 'draf', null, null),
      (4, 99999, 'Guru tiada', null, null, 'draf', null, null),
      (5, ${student}, 'Pemilik murid', null, null, 'draf', null, null),
      (6, ${teacher}, '   ', null, null, 'draf', null, null),
      (7, ${teacher}, $1, null, null, 'draf', null, null),
      (8, ${teacher}, 'Subjek tiada', 99999, null, 'draf', null, null),
      (9, ${teacher}, 'Set Sembilan', ${subject}, 1, 'diterbitkan', null, null)`,
    ['t'.repeat(256)],
  )
  await h.q(
    `insert into archive_cloud.question_set_items (id, question_set_id, question_id, sort_order) values
      (1, 1, 11, 1), (2, 1, 12, 2), (3, 1, 13, 3), (4, 9, 11, 1), (5, 9, 12, 2), (6, 3, 11, 1), (7, 6, 11, 1)`,
  )

  const dry = await h.run('dry-run', { groups })
  expect(dry.report.status).toBe('succeeded')
  expect(await h.count('question_sets')).toBe(0)
  applied = await h.run('apply', { groups })
  notes = Object.fromEntries(applied.activity.notes.counters)
  reasons = Object.fromEntries(
    (await h.q<{ reason: string; column_name: string; n: number }>(
      `select reason, column_name, count(*)::int n from etl_rejects where run_id = $1 and entity = 'question_sets' group by 1, 2`, [applied.report.runId],
    )).map((r) => [`${r.reason}|${r.column_name}`, r.n]),
  )
}, 600_000)
afterAll(async () => {
  await h?.close()
})

describe('question-set headers (Q4 A)', () => {
  it('loads the valid headers with no class, needs_rebuild, a draft status and the legacy keys', async () => {
    expect(applied.report.status).toBe('succeeded')
    const rows = await h.q<{ legacy_source: string; legacy_id: string; classroom_id: string | null; needs_rebuild: boolean; status: string; title: string; subject_id: string | null; teacher_id: string; scheduled_at: string | null }>(
      `select legacy_source, legacy_id, classroom_id::text, needs_rebuild, status, title, subject_id::text, teacher_id::text, scheduled_at::text from question_sets order by legacy_id::bigint`,
    )
    expect(rows.map((r) => r.legacy_id)).toEqual(['1', '2', '9'])
    expect(rows.every((r) => r.legacy_source === 'cloud' && r.classroom_id === null && r.needs_rebuild && r.status === 'draft' && r.scheduled_at === null)).toBe(true)
    expect(rows[0]?.title).toBe('Set Satu')
    expect(rows[1]?.subject_id).toBeNull()
    const v2Teacher = (await h.q<{ new_id: string }>(`select new_id from etl_id_map where legacy_source = 'cloud' and entity = 'users' and legacy_id = $1`, [teacher]))[0]?.new_id
    const v2Subject = (await h.q<{ new_id: string }>(`select new_id from etl_id_map where legacy_source = 'cloud' and entity = 'subjects' and legacy_id = $1`, [subject]))[0]?.new_id
    expect(rows.every((r) => r.teacher_id === v2Teacher)).toBe(true)
    expect(rows[0]?.subject_id).toBe(v2Subject)
    expect(applied.report.recon.find((r) => r.entity === 'question_sets')).toMatchObject({ sourceCount: 9, loaded: 3, rejected: 6 })
  })

  it('keeps the staged created_at / updated_at (updated falls back to created, then to the fixed stamp)', async () => {
    const rows = await h.q<{ legacy_id: string; created_at: string; updated_at: string }>(
      `select legacy_id, to_char(created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') created_at,
              to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') updated_at
       from question_sets order by legacy_id::bigint`,
    )
    expect(rows).toEqual([
      { legacy_id: '1', created_at: '2024-02-03T04:05:06Z', updated_at: '2024-06-07T08:09:10Z' },
      { legacy_id: '2', created_at: '2024-02-03T04:05:06Z', updated_at: '2024-02-03T04:05:06Z' },
      { legacy_id: '9', created_at: '1970-01-01T00:00:00Z', updated_at: '1970-01-01T00:00:00Z' },
    ])
  })

  it('rejects a blank, unmapped or non-teacher owner, a bad title and an unmapped subject, with counts', () => {
    expect(reasons).toEqual({
      'INVALID_VALUE|teacher_id': 1,
      'ORPHAN_PARENT|teacher_id': 1,
      'UNSUPPORTED|teacher_id': 1,
      'INVALID_VALUE|title': 2,
      'ORPHAN_PARENT|subject_id': 1,
    })
  })

  it('writes no items and counts the staged items of the loaded headers only', async () => {
    expect(await h.count('question_set_items')).toBe(0)
    expect(notes['question_sets.items_not_migrated']).toBe(5)
    expect(notes['question_sets.education_level_not_stored']).toBe(2)
    const item = NOT_MIGRATED_ACTIVITY.find((n) => n.table === 'question_set_items')
    expect(item?.reason).toContain('Q4')
    expect(NOT_MIGRATED_ACTIVITY.some((n) => n.table.includes('question_sets'))).toBe(false)
  })

  it('a loaded header is never visible to a student (draft, no class, nothing for a class list to match)', async () => {
    const rows = await h.q<{ id: string; status: string; scheduled_at: Date | null }>(`select id::text, status, scheduled_at from question_sets`)
    for (const r of rows) expect(isVisibleAt({ status: r.status as 'draft', scheduledAt: r.scheduled_at }, new Date('2030-01-01T00:00:00Z'))).toBe(false)
    expect(await h.count('question_sets', `t.classroom_id = any((select array_agg(id) from classrooms)::bigint[])`)).toBe(0)
  })

  it('a second apply changes nothing', async () => {
    const before = await h.contentHashes()
    const again = await h.run('apply', { groups })
    expect(again.report.status).toBe('succeeded')
    const c = again.report.counters.question_sets
    expect(c?.inserted).toBe(0)
    expect(c?.updated).toBe(0)
    expect(await h.contentHashes()).toEqual(before)
  }, 120_000)

  it('a header a teacher already rebuilt into a class is left alone by a re-run', async () => {
    const [cls] = await h.q<{ id: string }>(`select id::text from classrooms order by id limit 1`)
    expect(cls).toBeDefined()
    await h.q(`update question_sets set classroom_id = $1::bigint, needs_rebuild = false, title = 'Dibina semula' where legacy_source = 'cloud' and legacy_id = '2'`, [cls?.id])
    const again = await h.run('apply', { groups })
    expect(again.report.status).toBe('succeeded')
    const row = (await h.q<{ classroom_id: string | null; needs_rebuild: boolean; title: string }>(`select classroom_id::text, needs_rebuild, title from question_sets where legacy_id = '2'`))[0]
    expect(row).toEqual({ classroom_id: cls?.id, needs_rebuild: false, title: 'Dibina semula' })
    expect(again.activity.notes.counters.get('question_sets.already_rebuilt')).toBe(1)
    expect(again.report.counters.question_sets?.updated).toBe(0)
  }, 120_000)
})
