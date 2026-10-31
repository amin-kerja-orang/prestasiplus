/**
 * Secondary-only (D72), class report readers: a hidden Darjah population is not counted. Covers the raw-SQL readers behind the
 * class reports: `memberCounts` / `memberIds` / `memberIdsOf` (pupils of Darjah 1-6 and of primary-type schools are left out,
 * the helper is `VISIBLE_USER_SQL`), `all()` (no Darjah class) and the teacher question stats (`NOT_PRIMARY_LEVEL_SQL`).
 */
import { TeacherDashboardSchema, TeacherStudentSchema, envelopeOf } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { z } from 'zod'

import { questionsSeed } from '../../prisma/seed/questions'
import { ClassesPorts, ClassesRepository } from '../../src/modules/classes'
import { ClassesQuestionsBridgeModule } from '../../src/modules/classes/question-bridge'
import { QuestionsModule } from '../../src/modules/questions'
import { STUDENT_1, STUDENT_2, STUDENT_MAJU, TEACHER_A, bootClassesApp, client, createClass, idOfEmail, schoolOfCode, type ClassesTestApp, type Client } from './helpers'

describe('class report readers leave out the hidden Darjah population (D72)', () => {
  let t: ClassesTestApp
  let a: Client
  let repo: ClassesRepository
  let teacherA: string
  let s1: string
  let s2: string
  let sMaju: string
  let k1: { id: string }

  const idOfRef = async (ref: string): Promise<string> =>
    (await t.db.query<{ id: string }>(`select question_id::text id from question_versions where number_label = $1`, [ref]))[0]?.id as string

  beforeAll(async () => {
    t = await bootClassesApp({ seeds: [questionsSeed], modules: [QuestionsModule, ClassesQuestionsBridgeModule] })
    a = await client(t, TEACHER_A)
    repo = t.get(ClassesRepository)
    teacherA = await idOfEmail(t, TEACHER_A)
    s1 = await idOfEmail(t, STUDENT_1)
    s2 = await idOfEmail(t, STUDENT_2)
    sMaju = await idOfEmail(t, STUDENT_MAJU)
    k1 = await createClass(t, a, { name: 'Kelas Tingkatan', schoolId: await schoolOfCode(t, 'DEMO001') })
    for (const pupil of [s1, s2, sMaju]) expect((await a.put(`/guru/students/${pupil}`, { classroomId: k1.id })).status).toBe(200)
    // The teacher owns two published Matematik questions; one real answer on the T4 one.
    for (const ref of ['SEED-MCQ-MATH-T4', 'SEED-MCQ-MATH-T5']) {
      await t.db.query(`update questions set created_by_id = $2 where id = (select question_id from question_versions where number_label = $1 order by version_no desc limit 1)`, [ref, teacherA])
    }
    await t.db.query(`insert into practice_answers (user_id, question_id, is_correct, answered_at, is_test) values ($1, $2, true, now(), false)`, [s1, await idOfRef('SEED-MCQ-MATH-T4')])
  }, 180_000)
  afterAll(async () => {
    await t.close()
  })

  it('control: every enrolled pupil is counted while all are secondary', async () => {
    expect((await repo.memberCounts([k1.id])).get(k1.id)).toBe(3)
    expect(await repo.memberIds(k1.id)).toHaveLength(3)
  })

  it('a Darjah pupil (grade 1-6) and a pupil of a primary-type school are not counted or listed; the enrolment rows stay', async () => {
    await t.db.query(`update users set grade = 4 where id = $1`, [sMaju])
    await t.db.query(`update schools set type = 'SK' where code = 'DEMO002'`)
    await t.db.query(`update users set school_id = (select id from schools where code = 'DEMO002') where id = $1`, [s2])

    expect((await repo.memberCounts([k1.id])).get(k1.id)).toBe(1)
    expect(await repo.memberIds(k1.id)).toEqual([s1])
    expect((await repo.memberIdsOf([k1.id])).get(k1.id)).toEqual([s1])
    // the teacher's class card shows the same number
    expect((await repo.labels([k1.id])).get(k1.id)?.studentCount).toBe(1)

    const rows = await t.db.query<{ n: number }>(`select count(*)::int n from enrolments where classroom_id = $1 and status = 'active'`, [k1.id])
    expect(rows[0]?.n).toBe(3)
  })

  it('the dashboard counts the same pupils as the class cards; the roster, the school tab and the teacher pupil set leave the Darjah pupil out', async () => {
    const dash = envelopeOf(TeacherDashboardSchema).parse((await a.get('/guru/dashboard')).body).data
    const cards = dash.classes.reduce((n, c) => n + c.studentCount, 0)
    expect(cards).toBe(1)
    expect(dash.stats.students).toBe(cards)
    expect(dash.checklist.hasStudents).toBe(true)
    expect(await repo.teacherStudentIds(teacherA)).toEqual([s1])

    const Body = z.object({ data: z.array(TeacherStudentSchema) })
    const mine = Body.parse((await a.get('/guru/students?tab=mine')).body).data
    expect(mine.map((x) => x.id)).toEqual([s1])
    expect(mine[0]?.classes.map((c) => c.id)).toEqual([k1.id])
    const school = Body.parse((await a.get('/guru/students?tab=school')).body).data.map((x) => x.id)
    expect(school).toContain(s1)
    expect(school).not.toContain(sMaju)
    expect(school).not.toContain(s2)
    const found = (await repo.schoolStudentLines((await schoolOfCode(t, 'DEMO001')) as string, '', 500)).rows.map((x) => x.id)
    expect(found).not.toContain(sMaju)
    // the name filter still works on the raw readers (LIKE wildcards stay literal)
    expect(await repo.studentLines([s1, sMaju], '%')).toEqual([])
    expect((await repo.studentLines([s1, sMaju], '')).map((x) => x.id)).toEqual([s1])
    const hiddenName = (await t.db.query<{ name: string }>(`select name from users where id = $1`, [sMaju]))[0]?.name as string
    expect(await repo.studentLines([s1, sMaju], hiddenName.slice(0, 3).toUpperCase())).toEqual(
      (await repo.studentLines([s1], hiddenName.slice(0, 3).toUpperCase())),
    )
  })

  it('all() leaves out a Darjah class and forTeacher / schoolClasses already do', async () => {
    const primary = (await t.db.query<{ id: string }>(`select id::text from education_levels where stage = 'primary' order by id limit 1`))[0]?.id as string
    await t.db.query(
      `insert into classrooms (kind, name, teacher_id, school_id, subject_id, education_level_id, academic_year, is_active, created_at, updated_at)
       select kind, 'Kelas Darjah', teacher_id, school_id, subject_id, $2::bigint, academic_year, true, now(), now() from classrooms where id = $1`,
      [k1.id, primary],
    )
    const names = (await repo.all()).map((c) => c.name)
    expect(names).toContain('Kelas Tingkatan')
    expect(names).not.toContain('Kelas Darjah')
    expect((await repo.forTeacher(teacherA)).map((c) => c.name)).not.toContain('Kelas Darjah')
    // the report labels leave it out too, while the secondary class is still labelled
    const darjahId = (await t.db.query<{ id: string }>(`select id::text from classrooms where name = 'Kelas Darjah'`))[0]?.id as string
    const labels = await repo.labels([k1.id, darjahId])
    expect([...labels.keys()]).toEqual([k1.id])
  })

  it('teacher question stats do not count a question of a Darjah level (total, subject breakdown and used)', async () => {
    const stats = () => t.get(ClassesPorts).questions.statsOf(teacherA)
    const before = await stats()
    expect(before.used).toBe(1)
    const primary = (await t.db.query<{ id: string }>(`select id::text from education_levels where stage = 'primary' order by id limit 1`))[0]?.id as string
    await t.db.query(`update question_versions set education_level_id = $1 where number_label = 'SEED-MCQ-MATH-T4'`, [primary])
    const after = await stats()
    expect(after.total).toBe(before.total - 1)
    expect(after.used).toBe(0)
    expect(after.approved).toBe(before.approved - 1)
    const sum = (r: { bySubject: { count: number }[] }) => r.bySubject.reduce((n, x) => n + x.count, 0)
    expect(sum(after)).toBe(sum(before) - 1)
  })
})
