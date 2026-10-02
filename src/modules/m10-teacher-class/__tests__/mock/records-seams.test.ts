/**
 * F-30: the M10 records that the student side reads — missions, remedial tests, question sets — and
 * M05's seams over the real M10 repositories (M05 `seams.ts` calls `missions.forStudent`,
 * `missions.questionIdsFor`, `remedialTests.forStudent`, `remedialTests.complete` and
 * `questionSets.visibleFor` by name).
 */

import { beforeAll, describe, expect, it } from 'vitest'

import type { TransportResponse } from '@/api/transport'
import { setUser } from '@/mock/core-data/set-user'
import type { MockRuntime } from '@/mock/index'
import { curriculum } from '@/modules/m03-curriculum/mock'
import { questions } from '@/modules/m04-question-bank/mock'
import { practice } from '@/modules/m05-practice/mock'

import { classrooms, missions, questionSets, remedialTests } from '../../mock'
import { bootM10 } from './helpers'

let runtime: MockRuntime

beforeAll(async () => {
  ;({ runtime } = await bootM10({ withPractice: true }))
}, 180_000)

function api(
  method: 'GET' | 'POST',
  url: string,
  token: string,
  body?: unknown,
): Promise<TransportResponse> {
  const headers: Record<string, string> = {
    accept: 'application/json',
    authorization: `Bearer ${token}`,
  }
  if (body !== undefined) headers['content-type'] = 'application/json'
  return runtime.transport.request({
    method,
    url,
    headers,
    ...(body !== undefined ? { body } : {}),
  })
}

/** Starts a session, answers every question (the first `correct` right) and submits it. */
async function play(userId: number, body: Record<string, unknown>, correct: number) {
  const token = setUser(userId).token
  const start = await api('POST', '/api/practice/sessions', token, body)
  if (start.status !== 201) return { start }
  const data = (start.body as { data: { sessionId: string; questions: { id: number }[] } }).data
  let i = 0
  for (const q of data.questions) {
    const key = questions.get(q.id)?.correctAnswer ?? 0
    await api('POST', `/api/practice/sessions/${data.sessionId}/check-answer`, token, {
      questionId: q.id,
      selectedOptionId: i++ < correct ? key : (key + 1) % 4,
    })
  }
  const submit = await api('POST', `/api/practice/sessions/${data.sessionId}/submit`, token, {
    answers: [],
    timeSpent: 120,
  })
  return { start, data, submit }
}

describe('missions (M10 §6.5, BR-M10-17, BR-M10-35)', () => {
  it('lists the missions of a day for their recipients only', () => {
    expect(missions.forStudent(3001, '2026-09-22').map((m) => m.id)).toEqual([7101])
    expect(missions.forStudent(3008, '2026-09-24').map((m) => m.id)).toEqual([7102])
    // nothing dated today (25 Sep) reaches a student: the M05 empty state holds
    for (const id of [2, 3, 4, 3001, 3008])
      expect(missions.forStudent(id, '2026-09-25')).toEqual([])
    expect(missions.forStudent(2, '2026-09-22')).toEqual([])
    expect(missions.forTeacher(5).map((m) => m.id)).toEqual([7102, 7101])
  })

  it('has the designed missions: 7101 latih_tubi Kimia, 7102 tracking_a BM, 7103 / 7104 of teacher 4402', () => {
    expect(missions.get(7101)).toMatchObject({
      title: 'Misi Harian 22/09/2026',
      missionType: 'latih_tubi',
      missionSource: 'bank_soalan',
      subjectId: 10,
      chapterId: null,
      questionCount: 10,
      coinsPerCorrect: 3,
      teacherId: 5,
    })
    expect(missions.get(7101)?.recipientIds).toEqual(classrooms.memberIds('classroom', 2001))
    expect(missions.get(7102)).toMatchObject({
      missionType: 'tracking_a',
      subjectId: 1,
      missionDate: '2026-09-24',
    })
    for (const [id, date] of [
      [7103, '2026-09-08'],
      [7104, '2026-09-22'],
    ] as const) {
      const m = missions.get(id)
      expect(m).toMatchObject({
        teacherId: 4402,
        missionType: 'latih_tubi',
        subjectId: 3,
        missionDate: date,
      })
      expect(m?.recipientIds).toEqual(classrooms.memberIds('classroom', 813))
      expect(m?.recipientIds).toHaveLength(44)
    }
  })

  it('questionIdsFor returns only eligible M04 ids, deterministic per (mission, student)', () => {
    const ids = missions.questionIdsFor(7101, 3001)
    expect(ids).toHaveLength(10)
    expect(new Set(ids).size).toBe(10)
    for (const id of ids) {
      expect(questions.getEligible(id), `question ${String(id)}`).not.toBeNull()
      expect(questions.get(id)?.subjectId).toBe(10)
    }
    expect(missions.questionIdsFor(7101, 3001)).toEqual(ids)
    expect(missions.questionIdsFor(7101, 3002)).not.toEqual(ids)
    // not a recipient, unknown mission → empty pool (M05 answers 422 NOT_ENOUGH_QUESTIONS)
    expect(missions.questionIdsFor(7101, 2)).toEqual([])
    expect(missions.questionIdsFor(99999, 3001)).toEqual([])
    // TODO XR-M10→M06: tracking_a draws from M06, which is not built
    expect(missions.questionIdsFor(7102, 3001)).toEqual([])
  })

  it('falls back to the SPM pool when the chapter pool is empty (BR-M10-35)', () => {
    const chapter = curriculum.chapters(10, 11)[0]
    expect(chapter).toBeDefined()
    const m = missions.create(
      {
        teacherId: 5,
        title: 'Misi bab',
        missionType: 'latih_tubi',
        missionDate: '2026-09-25',
        subjectId: 10,
        chapterId: chapter?.id ?? null,
        questionCount: 10,
        recipientIds: [3001],
      },
      '2026-09-25T09:00:00+08:00',
    )
    expect(m.id).toBe(9_000_001)
    const ids = missions.questionIdsFor(m.id, 3001)
    expect(ids.length).toBeGreaterThan(0)
    for (const id of ids) expect(questions.getEligible(id)).not.toBeNull()
    expect(missions.forStudent(3001, '2026-09-25').map((x) => x.id)).toEqual([m.id])
  })
})

describe('remedial tests (M10 §6.8, BR-M10-12/13)', () => {
  it("lists the student's own tests; the designed 7601 (active) and 7602 (completed)", () => {
    expect(remedialTests.forStudent(3008).map((t) => t.id)).toEqual([7601])
    expect(remedialTests.forStudent(3007).map((t) => t.id)).toEqual([7602])
    expect(remedialTests.forStudent(2)).toEqual([])
    const a = remedialTests.forStudent(3008)[0]
    expect(a).toMatchObject({
      status: 'active',
      beforeAccuracy: 12.5,
      afterAccuracy: null,
      totalQuestions: 5,
      subjectId: 10,
      subjectCode: 'CHEM',
      teacherId: 5,
    })
    expect(a?.questionIds).toHaveLength(5)
    for (const id of a?.questionIds ?? []) expect(questions.getEligible(id)).not.toBeNull()
    expect(remedialTests.forStudent(3007)[0]).toMatchObject({
      status: 'completed',
      beforeAccuracy: 33,
      afterAccuracy: 60,
    })
    expect(remedialTests.forTeacher(5).map((t) => t.id)).toEqual([7601, 7602])
  })

  it('get(id, viewer) serves the Q4 preview to the own teacher or an admin only', () => {
    const own = remedialTests.get(7601, { id: 5, role: 'teacher' })
    expect(own).toMatchObject({
      id: 7601,
      teacherId: 5,
      studentId: 3008,
      subjectName: 'Kimia',
      totalQuestions: 5,
      status: 'active',
      beforeAccuracy: 12.5,
      afterAccuracy: null,
      completedAt: null,
    })
    expect(own?.teacherName).toBe('Guru Demo')
    expect(own?.studentName).toBe('Murid Demo 08')
    expect(remedialTests.get(7601, { id: 1, role: 'admin' })?.id).toBe(7601)
    expect(remedialTests.get(7601, { id: 3008, role: 'student' })).toBeNull()
    expect(remedialTests.get(7601, { id: 5301, role: 'teacher' })).toBeNull()
    expect(remedialTests.get(999999, { id: 1, role: 'admin' })).toBeNull()
  })

  it('cancel and complete change the status; complete acts on an active test only', () => {
    const t = remedialTests.create(
      {
        teacherId: 5,
        studentId: 3001,
        subjectId: 10,
        subjectCode: 'CHEM',
        subjectName: 'Kimia',
        questionIds: remedialTests.forStudent(3008)[0]?.questionIds ?? [],
        beforeAccuracy: 20,
      },
      '2026-09-25T09:00:00+08:00',
    )
    expect(t.status).toBe('active')
    expect(t.id).toBe(9_000_001)
    expect(remedialTests.cancel(t.id)).toBe(true)
    remedialTests.complete(t.id, { afterAccuracy: 90, completedAt: '2026-09-25T10:00:00+08:00' })
    expect(remedialTests.getRow(t.id)?.status).toBe('cancelled')
    remedialTests.complete(7602, { afterAccuracy: 10, completedAt: '2026-09-25T10:00:00+08:00' })
    expect(remedialTests.getRow(7602)).toMatchObject({ status: 'completed', afterAccuracy: 60 })
  })
})

describe('question sets (M10 §6.6, BR-M10-18)', () => {
  it('shows a student the published sets of their classes; a draft is never visible', () => {
    expect(questionSets.visibleFor(3001).map((s) => s.id)).toEqual([7402])
    expect(questionSets.visibleFor(3008).map((s) => s.id)).toEqual([7402])
    expect(questionSets.visibleFor(2)).toEqual([])
    expect(questionSets.get(7401)).toMatchObject({
      status: 'draft',
      classroomId: 2001,
      timeLimitMinutes: 30,
      maxAttempts: 0,
      questionIds: [],
    })
    const s = questionSets.get(7402)
    expect(s).toMatchObject({
      status: 'published',
      classroomId: 2002,
      subjectId: 5,
      maxAttempts: 1,
      timeLimitMinutes: null,
    })
    expect(s?.questionIds).toEqual([
      700201, 700202, 700203, 700204, 700205, 700206, 700207, 700208, 700209, 700210,
    ])
    expect(s?.createdAt.startsWith('2026-08-28')).toBe(true)
  })

  it('shows a scheduled set once scheduledAt has passed and derives TOV / AR inside a group', () => {
    const at = Date.parse('2026-09-26T12:00:00+08:00')
    const scheduled = questionSets.create(
      {
        teacherId: 5,
        classroomKind: 'classroom',
        classroomId: 2001,
        subjectId: 10,
        title: 'Latih Tubi Kimia Sep 2026 - Set 2',
        groupTag: 'Kimia Sep 2026',
        status: 'scheduled',
        scheduledAt: '2026-09-26T08:00:00+08:00',
        questionIds: [1, 2],
      },
      '2026-09-25T09:00:00+08:00',
    )
    expect(
      questionSets.visibleFor(3001, Date.parse('2026-09-25T15:40:00+08:00')).map((s) => s.id),
    ).toEqual([7402])
    expect(questionSets.visibleFor(3001, at).map((s) => s.id)).toEqual([7402, scheduled.id])
    expect(questionSets.roleOf(7401)).toBe('TOV')
    expect(questionSets.roleOf(scheduled.id)).toBe('AR')
    expect(questionSets.roleOf(7402)).toBeNull()
    expect(questionSets.forClass('classroom', 2001).map((s) => s.id)).toEqual([7401, scheduled.id])
  })
})

describe('M05 seams over the real M10 store', () => {
  it('a mission of 22 Sep is started and completed by a recipient; nothing is startable on 25 Sep', async () => {
    runtime.clock.setNow('2026-09-25T15:40:00+08:00')
    const none = await api('POST', '/api/practice/sessions', setUser(3001).token, {
      mode: 'mission',
      missionId: 7101,
    })
    expect(none.status).toBe(404)
    runtime.clock.setNow('2026-09-22T10:00:00+08:00')
    const { start, submit } = await play(3001, { mode: 'mission', missionId: 7101 }, 6)
    expect(start.status, JSON.stringify(start.body)).toBe(201)
    expect(submit?.status).toBe(200)
    const linked = practice.query('Q-SESS-LINK', {}, 7101).rows
    expect(linked.filter((r) => r.userId === 3001)).toHaveLength(1)
    // not a recipient: 404 (the mission is not in the student's list)
    const other = await api('POST', '/api/practice/sessions', setUser(2).token, {
      mode: 'mission',
      missionId: 7101,
    })
    expect(other.status).toBe(404)
    runtime.clock.setNow('2026-09-25T15:40:00+08:00')
  })

  it('remedial test 7601 is started by its student and completed through remedialTests.complete', async () => {
    runtime.clock.setNow('2026-09-25T15:40:00+08:00')
    const wrong = await api('POST', '/api/practice/sessions', setUser(3007).token, {
      mode: 'remedial',
      remedialTestId: 7601,
    })
    expect(wrong.status).toBe(404)
    const done = await api('POST', '/api/practice/sessions', setUser(3007).token, {
      mode: 'remedial',
      remedialTestId: 7602,
    })
    expect(done.status).toBe(409)
    const ids = remedialTests.forStudent(3008)[0]?.questionIds ?? []
    const { start, submit, data } = await play(3008, { mode: 'remedial', remedialTestId: 7601 }, 4)
    expect(start.status, JSON.stringify(start.body)).toBe(201)
    expect(data?.questions.map((q) => q.id).sort()).toEqual([...ids].sort())
    expect(submit?.status).toBe(200)
    const t = remedialTests.getRow(7601)
    expect(t?.status).toBe('completed')
    expect(t?.afterAccuracy).toBe(80)
    expect(t?.completedAt).not.toBeNull()
    const again = await api('POST', '/api/practice/sessions', setUser(3008).token, {
      mode: 'remedial',
      remedialTestId: 7601,
    })
    expect(again.status).toBe(409)
  })

  it('question set 7402 is offered to the members of class 2002 only', async () => {
    const outsider = await api('POST', '/api/practice/sessions', setUser(2).token, {
      mode: 'question_set',
      questionSetId: 7402,
    })
    expect(outsider.status).toBe(404)
    const draft = await api('POST', '/api/practice/sessions', setUser(3001).token, {
      mode: 'question_set',
      questionSetId: 7401,
    })
    expect(draft.status).toBe(404)
  })
})
