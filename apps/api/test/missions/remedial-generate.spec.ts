import { RemedialGenerateResponseSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { MissionsRepository } from '../../src/modules/classes/missions/missions.repository'

import { QuestionsService } from '../../src/modules/questions'
import {
  ADMIN, STUDENT_1, STUDENT_MAJU, TEACHER_A, TEACHER_B, TEACHER_C,
  addAnswers, bootMissionsApp, client, count, draftMcq, eligibleMcqIds, errorIs, idOfEmail, insertRemedial, loadWorld, makeClass, publishedMcq, republish,
  type Client, type MissionsTestApp, type World,
} from './helpers'

const GEN = '/guru/command-center/remedial/generate'
const CANCEL = '/guru/command-center/remedial/cancel'

/** Items of a test as [position, question id, version] in position order. */
const itemsOf = async (t: MissionsTestApp, quizId: string) =>
  (await t.db.query<{ position: number; question_id: string; question_version_no: number }>(
    `select position, question_id::text, question_version_no from remedial_test_items where remedial_test_id = $1 order by position`,
    [quizId],
  )).map((r) => [r.position, r.question_id, r.question_version_no] as const)

describe('POST /guru/command-center/remedial/generate and /cancel (BR-M10-12)', () => {
  let t: MissionsTestApp
  let w: World
  let teacherA: Client
  let teacherB: Client
  let teacherC: Client
  let admin: Client
  let pupil: Client
  let qa: string[]
  let qb: string[]
  let ineligible: { draft: string; review: string; deactivated: string; archived: string }

  beforeAll(async () => {
    t = await bootMissionsApp()
    w = await loadWorld(t)
    teacherA = await client(t, TEACHER_A)
    teacherB = await client(t, TEACHER_B)
    teacherC = await client(t, TEACHER_C)
    admin = await client(t, ADMIN)
    pupil = await client(t, STUDENT_1)
    const svc = t.get(QuestionsService)
    const adminActor = { userId: w.admin, role: 'admin' } as const
    const spB = (await t.db.query<{ id: string }>(`select id::text from curriculum_nodes where kind = 'sp' and subject_id = $1 and education_level_id = $2 and id <> $3 order by id limit 1`, [w.tag.subjectId, w.tag.levelId, w.tag.spId]))[0]?.id as string
    qa = []
    for (let i = 0; i < 6; i++) qa.push(await publishedMcq(t, w, { text: `Soalan A${String(i)}` }))
    qb = [await publishedMcq(t, w, { spId: spB, text: 'Soalan B0' }), await publishedMcq(t, w, { spId: spB, text: 'Soalan B1' })]
    const review = await draftMcq(t, w) // ADR-0027: `approved` is servable now, so the not-yet-servable one is in review
    await svc.bulkAction('review', [review], adminActor)
    const deactivated = await publishedMcq(t, w)
    await svc.deactivate(deactivated)
    const archived = await publishedMcq(t, w)
    await svc.setStatus(archived, 'archived', w.admin)
    ineligible = { draft: await draftMcq(t, w), review, deactivated, archived }
    await makeClass(t, w, w.teacherA, [w.student1, w.student2])
    await makeClass(t, w, w.teacherC, [w.studentOther], 'Kelas Lain')
    // Pupil 1, oldest first: A0 right, A1 wrong, A2 wrong, (deactivated) wrong, A3 wrong -> 1 of 5 in the SP of the A questions.
    await addAnswers(t, w, w.student1, [
      { questionId: qa[0] as string, correct: true },
      { questionId: qa[1] as string, correct: false },
      { questionId: qa[2] as string, correct: false },
      { questionId: deactivated, correct: false },
      { questionId: qa[3] as string, correct: false },
    ])
  }, 180_000)
  afterAll(async () => {
    await t.close()
  })

  describe('guards', () => {
    it('401 anonymous, 403 for a pupil, a school admin and a missing CSRF token; nothing is written', async () => {
      const schoolAdmin = await client(t, 'adminsekolah@demo.test')
      for (const path of [GEN, CANCEL]) {
        const body = path === GEN ? { studentId: w.student1, subject: w.subjectName } : { quizId: '1' }
        errorIs(await t.http().post(`/api${path}`).send(body), 401, 'UNAUTHORIZED', 'Unauthenticated.')
        errorIs(await pupil.post(path, body), 403, 'FORBIDDEN', 'This action is unauthorized.')
        errorIs(await schoolAdmin.post(path, body), 403, 'FORBIDDEN', 'This action is unauthorized.')
        const noCsrf = await teacherA.who.agent.post(`/api${path}`).send(body)
        expect(noCsrf.status).toBe(403)
        expect(noCsrf.body.error.code).toBe('CSRF_INVALID')
      }
      expect(await count(t, 'remedial_tests')).toBe(0)
    })
  })

  describe('body validation', () => {
    it('reports studentId and subject together, with the Laravel summary message', async () => {
      const res = await teacherA.post(GEN, {})
      expect(res.status).toBe(422)
      expect(res.body.error).toMatchObject({
        code: 'VALIDATION_ERROR',
        message: 'ID pelajar tidak sah. (and 1 more error)',
        fields: { studentId: 'ID pelajar tidak sah.', subject: 'Sila pilih subjek.' },
      })
    })

    it('a single bad field is reported alone', async () => {
      const missing = await teacherA.post(GEN, { studentId: w.student1 })
      expect(missing.body.error.fields).toEqual({ subject: 'Sila pilih subjek.' })
      const blank = await teacherA.post(GEN, { studentId: w.student1, subject: '   ' })
      expect(blank.body.error.fields).toEqual({ subject: 'Sila pilih subjek.' })
      const noStudent = await teacherA.post(GEN, { subject: 'Matematik' })
      expect(noStudent.body.error.fields).toEqual({ studentId: 'ID pelajar tidak sah.' })
    })

    it('a blank, zero, negative, fractional or null studentId is the field message', async () => {
      for (const studentId of ['', '  ', 0, -3, 1.5, null]) {
        const res = await teacherA.post(GEN, { studentId, subject: w.subjectName })
        expect(res.status, JSON.stringify(studentId)).toBe(422)
        expect(res.body.error.fields).toEqual({ studentId: 'ID pelajar tidak sah.' })
      }
    })

    it('an unknown key is refused (strict body)', async () => {
      const res = await teacherA.post(GEN, { studentId: w.student1, subject: w.subjectName, extra: 1 })
      expect(res.status).toBe(422)
      expect(res.body.error.fields).toEqual({ extra: 'The extra field is not allowed.' })
    })

    it('cancel: a missing, blank or zero quizId is "ID ujian tidak sah."', async () => {
      for (const body of [{}, { quizId: '' }, { quizId: 0 }, { quizId: null }]) {
        const res = await teacherA.post(CANCEL, body)
        expect(res.status, JSON.stringify(body)).toBe(422)
        expect(res.body.error).toMatchObject({ code: 'VALIDATION_ERROR', message: 'ID ujian tidak sah.', fields: { quizId: 'ID ujian tidak sah.' } })
      }
    })
  })

  describe('refusals before anything is written', () => {
    it('403 "Pelajar ini bukan murid anda." for a pupil of another school, a pupil in no class, an unknown id and for the admin', async () => {
      const notMine = [w.studentOther, await idOfEmail(t, STUDENT_MAJU), '987654321', 'abc']
      for (const studentId of notMine) {
        errorIs(await teacherA.post(GEN, { studentId, subject: w.subjectName }), 403, 'FORBIDDEN', 'Pelajar ini bukan murid anda.')
      }
      // Another teacher of the same school does not own the pupil either, and the admin owns none.
      errorIs(await teacherB.post(GEN, { studentId: w.student1, subject: w.subjectName }), 403, 'FORBIDDEN', 'Pelajar ini bukan murid anda.')
      errorIs(await admin.post(GEN, { studentId: w.student1, subject: w.subjectName }), 403, 'FORBIDDEN', 'Pelajar ini bukan murid anda.')
    })

    it('the student check comes before the subject check (403 even for an unknown subject)', async () => {
      errorIs(await teacherA.post(GEN, { studentId: w.studentOther, subject: 'Tiada Subjek' }), 403, 'FORBIDDEN', 'Pelajar ini bukan murid anda.')
    })

    it('an unknown subject is a second 422 with fields.subject "Subjek tidak sah."', async () => {
      const res = await teacherA.post(GEN, { studentId: w.student1, subject: 'Tiada Subjek' })
      expect(res.status).toBe(422)
      expect(res.body.error).toMatchObject({ code: 'VALIDATION_ERROR', message: 'Subjek tidak sah.', fields: { subject: 'Subjek tidak sah.' } })
    })

    it('422 "Tiada soalan untuk topik lemah" (no fields) for a pupil without a weak topic in the subject', async () => {
      const res = await teacherA.post(GEN, { studentId: w.student2, subject: w.subjectName })
      expect(res.status).toBe(422)
      expect(res.body.error).toMatchObject({ code: 'VALIDATION_ERROR', message: 'Tiada soalan untuk topik lemah' })
      expect(res.body.error.fields).toBeUndefined()
    })

    it('422 "Tiada soalan untuk topik lemah" when the weak topic exists but the bank has no eligible question for the subject', async () => {
      const bare = (
        await t.db.query<{ subject_id: string; chapter_id: string }>(
          `select c.subject_id::text subject_id, c.id::text chapter_id from chapters c
            where c.in_tree and not exists (select 1 from question_versions v where v.subject_id = c.subject_id) order by c.id limit 1`,
        )
      )[0]
      expect(bare).toBeDefined()
      await addAnswers(t, w, w.student2, [
        { questionId: null, correct: false, subjectId: bare?.subject_id as string, chapterId: bare?.chapter_id as string },
        { questionId: null, correct: false, subjectId: bare?.subject_id as string, chapterId: bare?.chapter_id as string },
      ])
      const res = await teacherA.post(GEN, { studentId: w.student2, subject: bare?.subject_id })
      expect(res.status).toBe(422)
      expect(res.body.error.message).toBe('Tiada soalan untuk topik lemah')
      expect(await count(t, 'remedial_tests')).toBe(0)
    })
  })

  describe('generation', () => {
    let first: { quizId: string; totalQuestions: number }
    let firstItems: Awaited<ReturnType<typeof itemsOf>>
    let eligible: string[]

    it('201 with the bare { quizId, totalQuestions } and N ordered rows: wrong eligible answers first (newest first), then the weak topic, then the subject pool', async () => {
      eligible = await eligibleMcqIds(t, w)
      expect(eligible.length).toBeLessThanOrEqual(10)
      const res = await teacherA.post(GEN, { studentId: w.student1, subject: w.subjectName })
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      expect(res.headers['cache-control']).toBe('no-store')
      first = RemedialGenerateResponseSchema.parse(res.body)
      expect(first.totalQuestions).toBe(eligible.length)
      firstItems = await itemsOf(t, first.quizId)
      expect(firstItems).toHaveLength(first.totalQuestions)
      expect(firstItems.map((i) => i[0])).toEqual(firstItems.map((_, i) => i))
      // Newest wrong answer first; the deactivated question answered wrongly is skipped.
      expect(firstItems.slice(0, 3).map((i) => i[1])).toEqual([qa[3], qa[2], qa[1]])
      // Fewer if unavailable: exactly the eligible questions, each once, at the live version.
      expect([...firstItems.map((i) => i[1])].sort((a, b) => Number(BigInt(a) - BigInt(b)))).toEqual(eligible)
      expect(new Set(firstItems.map((i) => i[1])).size).toBe(firstItems.length)
      expect(firstItems.every((i) => i[2] === 1)).toBe(true)
      // The questions of another topic of the subject come only from the subject pool (step 3), after the weak topic.
      for (const id of qb) expect(firstItems.map((i) => i[1]).indexOf(id)).toBeGreaterThanOrEqual(qa.length)
    })

    it('only approved (servable), active questions are used: never a draft, a review, a deactivated or an archived one', async () => {
      const used = firstItems.map((i) => i[1])
      for (const id of Object.values(ineligible)) expect(used).not.toContain(id)
    })

    it('stores the test: active, the caller as teacher, before accuracy of the subject answers, a generated audit row', async () => {
      const [row] = await t.db.query<Record<string, unknown>>(
        `select teacher_id::text, student_id::text, subject_id::text, total_questions, status, before_accuracy::float8 before, after_accuracy, completed_at, is_test from remedial_tests where id = $1`,
        [first.quizId],
      )
      expect(row).toEqual({
        teacher_id: w.teacherA,
        student_id: w.student1,
        subject_id: w.tag.subjectId,
        total_questions: first.totalQuestions,
        status: 'active',
        before: 20,
        after_accuracy: null,
        completed_at: null,
        is_test: false,
      })
      const audit = await t.db.query<{ actor_user_id: string; target_id: string }>(
        `select actor_user_id::text, target_id from audit_events where action = 'classes.remedial.generated'`,
      )
      expect(audit).toEqual([{ actor_user_id: w.teacherA, target_id: first.quizId }])
    })

    it('422 "Ujian remedial aktif sudah wujud untuk pelajar ini. Batalkan dahulu." while one is open', async () => {
      const res = await teacherA.post(GEN, { studentId: w.student1, subject: w.subjectName })
      expect(res.status).toBe(422)
      expect(res.body.error).toMatchObject({ code: 'VALIDATION_ERROR', message: 'Ujian remedial aktif sudah wujud untuk pelajar ini. Batalkan dahulu.' })
      expect(res.body.error.fields).toBeUndefined()
      expect(await count(t, 'remedial_tests')).toBe(1)
    })

    it('the same history gives the same test (seeded draw): delete it (items cascade) and generate again', async () => {
      expect(await count(t, 'remedial_test_items', )).toBe(first.totalQuestions)
      await t.db.query(`delete from remedial_tests where id = $1`, [first.quizId])
      expect(await count(t, 'remedial_test_items')).toBe(0)
      const again = await teacherA.post(GEN, { studentId: w.student1, subject: w.subjectName })
      expect(again.status).toBe(201)
      expect((await itemsOf(t, again.body.quizId as string)).map((i) => i[1])).toEqual(firstItems.map((i) => i[1]))
      await t.db.query(`delete from remedial_tests`)
    })

    it('caps at 10 questions, draws the top-up deterministically and stores the version served (an edited question is version 2)', async () => {
      for (let i = 0; i < 8; i++) qa.push(await publishedMcq(t, w, { text: `Soalan tambahan ${String(i)}` }))
      await republish(t, w, qa[3] as string, 'Soalan A3 selepas suntingan.')
      const run = async () => {
        const res = await teacherA.post(GEN, { studentId: w.student1, subject: w.subjectName })
        expect(res.status, JSON.stringify(res.body)).toBe(201)
        expect(res.body.totalQuestions).toBe(10)
        const items = await itemsOf(t, res.body.quizId as string)
        await t.db.query(`delete from remedial_tests where id = $1`, [res.body.quizId])
        return items
      }
      const a = await run()
      const b = await run()
      expect(a).toHaveLength(10)
      expect(a.map((i) => i[0])).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
      expect(b).toEqual(a)
      expect(a.slice(0, 3).map((i) => i[1])).toEqual([qa[3], qa[2], qa[1]])
      // The version served is the live one: the edited question is stored as version 2, the others as version 1.
      expect(a[0]).toEqual([0, qa[3], 2])
      expect(a.slice(1).every((i) => i[2] === 1)).toBe(true)
    })

    it('accepts the subject by id, code or name (any case) and the pupil id as a number or a string', async () => {
      const code = w.subjectCode
      const variants: { studentId: string | number; subject: string }[] = [
        { studentId: Number(w.student1), subject: w.subjectName.toUpperCase() },
        { studentId: w.student1, subject: code.toLowerCase() },
        { studentId: ` ${w.student1} `, subject: w.tag.subjectId },
      ]
      for (const body of variants) {
        const res = await teacherA.post(GEN, body)
        expect(res.status, JSON.stringify(body)).toBe(201)
        await t.db.query(`delete from remedial_tests where id = $1`, [res.body.quizId])
      }
    })

    it('two parallel calls open one test only', async () => {
      const [x, y] = await Promise.all([
        teacherA.post(GEN, { studentId: w.student1, subject: w.subjectName }),
        teacherA.post(GEN, { studentId: w.student1, subject: w.subjectName }),
      ])
      expect([x.status, y.status].sort()).toEqual([201, 422])
      expect(await count(t, 'remedial_tests')).toBe(1)
      await t.db.query(`delete from remedial_tests`)
    })

    it('the partial unique index backs the lock: a second active test for the same teacher, pupil and subject is refused, and mapped to the "already open" 422', async () => {
      await t.db.query(`delete from remedial_tests`)
      const open = await insertRemedial(t, w, { teacherId: w.teacherA, studentId: w.student1, questionIds: [qa[0] as string] })
      await expect(insertRemedial(t, w, { teacherId: w.teacherA, studentId: w.student1, questionIds: [qa[1] as string] })).rejects.toMatchObject({ code: '23505' })
      // A cancelled or completed twin, another subject or another pupil is fine.
      await insertRemedial(t, w, { teacherId: w.teacherA, studentId: w.student1, status: 'cancelled', questionIds: [qa[1] as string] })
      // The service check is bypassed on purpose: the index alone must turn the race into the same refusal.
      const spy = vi.spyOn(MissionsRepository.prototype, 'hasOpen').mockResolvedValue(false)
      try {
        const res = await teacherA.post(GEN, { studentId: w.student1, subject: w.subjectName })
        expect(res.status).toBe(422)
        expect(res.body.error.message).toBe('Ujian remedial aktif sudah wujud untuk pelajar ini. Batalkan dahulu.')
      } finally {
        spy.mockRestore()
      }
      expect(await count(t, 'remedial_tests', )).toBe(2)
      await t.db.query(`delete from remedial_tests where id = $1`, [open])
      await t.db.query(`delete from remedial_tests`)
    })
  })

  describe('cancel', () => {
    let quiz: string

    beforeAll(async () => {
      const res = await teacherA.post(GEN, { studentId: w.student1, subject: w.subjectName })
      expect(res.status).toBe(201)
      quiz = res.body.quizId as string
    })

    it('404 "Ujian remedial tidak dijumpai." for an unknown or malformed id, and for another teacher\'s test (also for an admin)', async () => {
      for (const quizId of ['987654321', 'abc', '99999999999999999999']) {
        errorIs(await teacherA.post(CANCEL, { quizId }), 404, 'NOT_FOUND', 'Ujian remedial tidak dijumpai.')
      }
      for (const who of [teacherB, teacherC, admin]) errorIs(await who.post(CANCEL, { quizId: quiz }), 404, 'NOT_FOUND', 'Ujian remedial tidak dijumpai.')
      const [row] = await t.db.query<{ status: string }>(`select status from remedial_tests where id = $1`, [quiz])
      expect(row?.status).toBe('active')
    })

    it('200 { success: true } cancels an active test; the row and its items stay (status only)', async () => {
      const items = await itemsOf(t, quiz)
      const res = await teacherA.post(CANCEL, { quizId: Number(quiz) })
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ success: true })
      const [row] = await t.db.query<{ status: string; completed_at: unknown }>(`select status, completed_at from remedial_tests where id = $1`, [quiz])
      expect(row).toEqual({ status: 'cancelled', completed_at: null })
      expect(await itemsOf(t, quiz)).toEqual(items)
      const audit = await t.db.query<{ target_id: string }>(`select target_id from audit_events where action = 'classes.remedial.cancelled'`)
      expect(audit).toEqual([{ target_id: quiz }])
    })

    it('a repeat cancel is 409 "Ujian remedial ini tidak aktif." (deliberate deviation from card AC2), as is a completed test', async () => {
      errorIs(await teacherA.post(CANCEL, { quizId: quiz }), 409, 'CONFLICT', 'Ujian remedial ini tidak aktif.')
      const done = await insertRemedial(t, w, { teacherId: w.teacherA, studentId: w.student2, status: 'completed', questionIds: [qa[0] as string] })
      errorIs(await teacherA.post(CANCEL, { quizId: done }), 409, 'CONFLICT', 'Ujian remedial ini tidak aktif.')
    })

    it('the cancelled test no longer blocks generation, leaves "mine" and the scan, and stays in the progress rows', async () => {
      const mine = await pupil.get('/remedial-tests/mine')
      expect(mine.body.data.map((r: { id: string }) => r.id)).not.toContain(quiz)
      const scan = await teacherA.get('/guru/command-center/remedial/scan')
      expect(scan.body.existingRemedials.map((r: { id: string }) => r.id)).not.toContain(quiz)
      const progress = await teacherA.get('/guru/remedial-progress')
      expect(progress.body.rows.find((r: { id: string }) => r.id === quiz)?.status).toBe('cancelled')
      const again = await teacherA.post(GEN, { studentId: w.student1, subject: w.subjectName })
      expect(again.status, JSON.stringify(again.body)).toBe(201)
    })

    it('deleting a test cascades to its items', async () => {
      await t.db.query(`delete from remedial_tests`)
      expect(await count(t, 'remedial_test_items')).toBe(0)
    })
  })
})
