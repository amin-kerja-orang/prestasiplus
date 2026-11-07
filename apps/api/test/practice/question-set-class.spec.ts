import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { STUDENT_1, STUDENT_2, bootMissionsApp, client, eligibleMcqIds, loadWorld, makeClass, type Client, type MissionsTestApp, type World } from '../missions/helpers'

/**
 * S5-T11 B1 (AC-MUR-26-6): the real assignment source, no fakes. A pupil of the class starts the set; a pupil of another
 * class gets 404. Visibility is the assignment table `question_set_classrooms` (DM-46, S6-T14); `question_sets.classroom_id` is no longer read.
 */
describe('S5-T11 question_set start: class visibility and no cap/timer (real source)', () => {
  let t: MissionsTestApp
  let w: World
  let inClass: Client
  let otherClass: Client
  let setId: string

  beforeAll(async () => {
    t = await bootMissionsApp({ full: true })
    w = await loadWorld(t)
    const ids = (await eligibleMcqIds(t, w)).slice(0, 3)
    const classA = await makeClass(t, w, w.teacherA, [w.student1], 'Kelas Set A')
    await makeClass(t, w, w.teacherA, [w.student2], 'Kelas Set B')
    // A legacy set that still stores a cap of 1 and a 10 minute limit (R7: ignored).
    const row = await t.db.query<{ id: string }>(
      `insert into question_sets (teacher_id, title, time_limit_minutes, max_attempts, status) values ($1, 'Set Kelas A', 10, 1, 'published') returning id::text id`,
      [w.teacherA],
    )
    setId = (row[0] as { id: string }).id
    await t.db.query(`insert into question_set_classrooms (question_set_id, classroom_id, assigned_by) values ($1, $2, $3)`, [setId, classA, w.teacherA])
    for (const [i, q] of ids.entries()) {
      await t.db.query(`insert into question_set_items (question_set_id, position, question_id, question_version_no) values ($1, $2, $3, 1)`, [setId, i, q])
    }
    inClass = await client(t, STUDENT_1)
    otherClass = await client(t, STUDENT_2)
  }, 240_000)

  afterAll(async () => {
    await t.close()
  })

  it('a pupil of another class gets 404 NOT_FOUND on starting the set', async () => {
    const res = await otherClass.post('/practice/sessions', { mode: 'question_set', questionSetId: setId })
    expect(res.status, JSON.stringify(res.body)).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })

  it('a pupil of the class starts it, with timeLimitSec null although the stored set has a 10 minute limit and a cap of 1', async () => {
    const first = await inClass.post('/practice/sessions', { mode: 'question_set', questionSetId: setId })
    expect(first.status, JSON.stringify(first.body)).toBe(201)
    expect(first.body.data.timeLimitSec).toBeNull()
    const stored = await t.db.query<{ time_limit_sec: number | null }>('select time_limit_sec from practice_sessions where id = $1', [first.body.data.sessionId])
    expect(stored[0]?.time_limit_sec).toBeNull()
  })
})
