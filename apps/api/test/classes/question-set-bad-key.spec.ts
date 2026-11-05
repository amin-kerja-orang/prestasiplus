import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { QuestionSetStudentListSchema } from '@pp/contract'

import { bootMissionsApp, loadWorld, makeClass, publishedMcq, type MissionsTestApp, type World } from '../missions/helpers'
import { client, ADMIN, type Client } from '../classes/helpers'
import { insertSet } from '../missions/qs-helpers'

/**
 * #805 (S1-T06): an MCQ whose stored key names no option must be excluded from a teacher question set, not turn the whole read
 * (the pupil list, a start) into HTTP 500. Strict reads (the admin detail) still refuse the stored tree as before.
 */
describe('question sets: an MCQ key naming no option is excluded, not a 500', () => {
  let t: MissionsTestApp
  let w: World
  let pupil: Client
  let admin: Client
  let setId: string
  let a: string
  let b: string

  beforeAll(async () => {
    t = await bootMissionsApp({ full: true })
    w = await loadWorld(t)
    await t.db.query(`insert into comp_students (user_id, package_expires_on) values ($1, '2027-12-31') on conflict do nothing`, [w.student1])
    pupil = await client(t, 'pelajar@demo.test')
    admin = await client(t, ADMIN)
    const classId = await makeClass(t, w, w.teacherA, [w.student1], 'Kelas Kunci Rosak')
    a = await publishedMcq(t, w, { text: 'Soalan kunci A' })
    b = await publishedMcq(t, w, { text: 'Soalan kunci B' })
    // publishedMcq may leave the version in review: approve and publish by SQL.
    await t.db.query(`update question_versions set status = 'approved', published_at = coalesce(published_at, now()) where question_id = any($1::bigint[])`, [[a, b]])
    await t.db.query(`update questions set live_version_no = 1 where id = any($1::bigint[])`, [[a, b]])
    setId = await insertSet(t as never, { teacherId: w.teacherA, classroomId: classId, title: 'Set kunci rosak', maxAttempts: 0, questionIds: [a, b] })
  })
  afterAll(async () => {
    await t.close()
  })

  const countOf = async (): Promise<number> => {
    const res = await pupil.get('/set-soalan-saya')
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    return QuestionSetStudentListSchema.parse(res.body).data.find((s) => s.id === setId)?.questionCount ?? -1
  }

  it('both questions are served while the keys are sound', async () => {
    expect(await countOf()).toBe(2)
  })

  it('a key naming no option: the list answers 200 with count 1, a start serves only A', async () => {
    await t.db.query(
      `update answer_keys set content = '{"kind":"option","correct":"E"}'::jsonb where part_id in (select id from question_parts where question_version_id in (select id from question_versions where question_id = $1))`,
      [b],
    )
    expect(await countOf()).toBe(1)
    const res = await pupil.post('/practice/sessions', { mode: 'question_set', questionSetId: setId })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect((res.body.data.questions as { id: string }[]).map((q) => q.id)).toEqual([a])
  })

  it('a strict read (the admin question detail) still refuses the stored tree as before', async () => {
    const res = await admin.get(`/questions/${b}`)
    expect(res.status, JSON.stringify(res.body)).toBe(500)
    const ok = await admin.get(`/questions/${a}`)
    expect(ok.status, JSON.stringify(ok.body)).toBe(200)
  })
})
