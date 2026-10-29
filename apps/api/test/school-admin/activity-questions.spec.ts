import { SchoolAdminActivityReportSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { curriculumSeed } from '../../prisma/seed/curriculum'
import { runSeeds } from '../../prisma/seed'
import { questionsSeed } from '../../prisma/seed/questions'
import { AuthModule } from '../../src/modules/auth'
import { ClassesQuestionsBridgeModule } from '../../src/modules/classes/question-bridge'
import { QuestionsModule } from '../../src/modules/questions'
import { SchoolAdminModule } from '../../src/modules/school-admin'
import { UsersModule } from '../../src/modules/users'
import { apiOf, bootSchoolAdminApp, login, SCHOOL_ADMIN, schoolIdOf, TEACHER, userIdOf, type Api, type SchoolAdminTestApp } from './helpers'
import { addTeacher } from './reports-fixtures'

/**
 * SW12-02 (Codex P2): the M27 teacher table shows "MCQ" and "Struktur" as two columns, so the real question bridge must hand over
 * the structured share of `total` and the report must not put everything under MCQ.
 */
describe('GET /admin-sekolah/laporan-aktiviti: teacher MCQ / Struktur split from the real question bridge', () => {
  let t: SchoolAdminTestApp
  let admin: Api
  let mixed: string
  let nothing: string
  let seededTeacher: string

  const own = async (ref: string, owner: string) =>
    t.db.query(`update questions set created_by_id = $2 where id = (select question_id from question_versions where number_label = $1 limit 1)`, [ref, owner])

  beforeAll(async () => {
    t = await bootSchoolAdminApp({ modules: [AuthModule, UsersModule, SchoolAdminModule, QuestionsModule, ClassesQuestionsBridgeModule] })
    await runSeeds([curriculumSeed, questionsSeed], { prisma: t.db.prisma })
    const s1 = await schoolIdOf(t.db, 'DEMO001')
    mixed = await addTeacher(t.db, s1, 'Guru Campuran')
    nothing = await addTeacher(t.db, s1, 'Guru Tiada Soalan')
    seededTeacher = await userIdOf(t.db, TEACHER)
    for (const ref of ['SEED-MCQ-MATH-T4', 'SEED-MCQ-MATH-T5', 'SEED-MCQ-SCI-T4', 'SEED-STR-TREE', 'SEED-STR-ANYN']) await own(ref, mixed)
    admin = apiOf(await login(t, SCHOOL_ADMIN))
  }, 180_000)
  afterAll(async () => {
    await t.close()
  })

  it('a teacher with 3 objective and 2 structured questions shows MCQ 3 and Struktur 2 (not MCQ 5, Struktur 0)', async () => {
    const r = SchoolAdminActivityReportSchema.parse((await admin.get('/admin-sekolah/laporan-aktiviti')).body.data)
    expect(r.teachers.find((x) => x.userId === mixed)).toMatchObject({ mcq: 3, structured: 2 })
  })

  it('a teacher without questions is 0 / 0, and the seeded teacher with one objective question under review is 1 / 0', async () => {
    const r = SchoolAdminActivityReportSchema.parse((await admin.get('/admin-sekolah/laporan-aktiviti')).body.data)
    expect(r.teachers.find((x) => x.userId === nothing)).toMatchObject({ mcq: 0, structured: 0 })
    expect(r.teachers.find((x) => x.userId === seededTeacher)).toMatchObject({ mcq: 1, structured: 0 })
  })
})
