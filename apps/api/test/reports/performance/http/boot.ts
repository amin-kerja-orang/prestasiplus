import 'reflect-metadata'

import { Test } from '@nestjs/testing'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'

import { runSeeds } from '../../../../prisma/seed'
import { identitySeed } from '../../../../prisma/seed/core/identity'
import { defineAppModule } from '../../../../src/app.module'
import { configureApp } from '../../../../src/configure-app'
import { CLOCK, FixedClock } from '../../../../src/db/clock'
import { AuthModule } from '../../../../src/modules/auth'
import { PerformanceModule, PerformancePorts } from '../../../../src/modules/reports/performance'
import { type CurriculumTestApp, dropDatabase } from '../../../curriculum/helpers'
import { createTestDatabase, type TestDatabase } from '../../../support/db'
import { InMemoryAnswerFacts, InMemoryQuestionContent } from '../fakes/in-memory-answer-facts'
import { InMemoryBijakAggregate } from '../fakes/in-memory-bijak-aggregate'
import { InMemoryClasses } from '../fakes/in-memory-classes'
import { item, sitting } from '../fakes/fixtures'

/** 2026-10-19 09:00 MYT: the clock of every HTTP spec. */
export const START = '2026-10-19T09:00:00+08:00'
const SUBMITTED = new Date('2026-10-15T10:10:00+08:00')

export interface World extends CurriculumTestApp {
  /** Database ids (decimal strings) by e-mail. */
  ids: Record<string, string>
  schools: { demo1: string; demo2: string }
  classId: string
  otherClassId: string
  bijak: InMemoryBijakAggregate
  classes: InMemoryClasses
  answers: InMemoryAnswerFacts
  content: InMemoryQuestionContent
}

/** E-mails of the extra fictitious accounts the world adds on top of the demo seed. */
export const EXTRA_PUPILS = [1, 2, 3, 4, 5, 6].map((n) => `ujian${n}@demo.test`)

async function addUser(db: TestDatabase, email: string, name: string, role: string, schoolCode: string, grade: number | null) {
  await db.query(
    `insert into users (name, email, school_id, grade, password_hash)
       select $1, $2, s.id, $3, (select password_hash from users where email = 'guru@demo.test') from schools s where s.code = $4`,
    [name, email, grade, schoolCode],
  )
  await db.query(`insert into user_roles (user_id, role) select id, $2 from users where email = $1`, [email, role])
}

/**
 * The auth and performance modules on a private migrated database with the demo identity seed, extra
 * fictitious accounts (6 pupils, a PPD officer, a parent, a sponsor) and Bijak facts injected
 * through `PerformancePorts` from Part A's in-memory fakes.
 */
export async function bootWorld(env: Record<string, string> = {}): Promise<World> {
  const db = await createTestDatabase()
  await runSeeds([identitySeed], { prisma: db.prisma })
  for (const [i, email] of EXTRA_PUPILS.entries()) await addUser(db, email, `Murid Ujian ${i + 1}`, 'student', 'DEMO001', 10)
  // The pupil of the own item analysis (API-RPT-05): a school of its own, so no figure of DEMO001 changes.
  await addUser(db, 'saya@demo.test', 'Murid Saya', 'student', 'DEMO002', 10)
  await addUser(db, 'ppd@demo.test', 'Pegawai PPD Ujian', 'ppd_officer', 'DEMO001', null)
  await addUser(db, 'ibubapa@demo.test', 'Ibu Bapa Ujian', 'parent', 'DEMO001', null)
  await addUser(db, 'penaja@demo.test', 'Penaja Ujian', 'sponsor', 'DEMO001', null)

  const rows = await db.query<{ id: string; email: string }>(`select id::text, email from users where email is not null`)
  const ids: Record<string, string> = Object.fromEntries(rows.map((r) => [r.email, r.id]))
  const schoolRows = await db.query<{ id: string; code: string }>(`select id::text, code from schools`)
  const schools = {
    demo1: schoolRows.find((s) => s.code === 'DEMO001')?.id as string,
    demo2: schoolRows.find((s) => s.code === 'DEMO002')?.id as string,
  }

  Object.assign(process.env, {
    DATABASE_URL: db.url,
    COOKIE_SECURE: 'false',
    SESSION_SECRET: 'x'.repeat(32),
    LEGACY_BCRYPT_DUMMY_COST: '4',
    LOGIN_FAILURE_FLOOR_MS: '0',
    ...env,
  })
  const clock = new FixedClock(START)
  const moduleRef = await Test.createTestingModule({ imports: [defineAppModule([AuthModule, PerformanceModule])] })
    .overrideProvider(CLOCK)
    .useValue(clock)
    .compile()
  const app = moduleRef.createNestApplication({ bufferLogs: false })
  configureApp(app)

  // Facts: nine pupils of DEMO001 sit paper 1; q1 is answered by all nine, q2 by two pupils only.
  const pupils = [ids['pelajar@demo.test'], ids['pelajarmaju@demo.test'], ids['pelajar2@demo.test'], ...EXTRA_PUPILS.map((e) => ids[e])] as string[]
  const bijak = new InMemoryBijakAggregate()
  // The same answers in the single answer store (the shared reader of the item analysis counts every mode from it).
  const answers = new InMemoryAnswerFacts()
  const at = new Date(SUBMITTED)
  pupils.forEach((userId, i) => {
    answers.addPupil({ id: userId, schoolId: schools.demo1 })
    answers.add({ userId, subjectId: '1', questionId: 'q1', mode: 'simulasi', isCorrect: i % 3 !== 0, answeredAt: at })
    if (i < 2) answers.add({ userId, subjectId: '1', questionId: 'q2', mode: 'simulasi', isCorrect: false, answeredAt: at })
    const attemptId = `att${i}`
    bijak.addSitting(sitting({ userId, attemptId, schoolId: schools.demo1, score: 6 + (i % 3), maxScore: 10, submittedAt: SUBMITTED }))
    bijak.addItem(
      item({
        userId,
        attemptId,
        schoolId: schools.demo1,
        questionId: 'q1',
        chosenLetter: i % 3 === 0 ? 'B' : 'A',
        awarded: i % 3 === 0 ? 0 : 1,
      }),
    )
    if (i < 2) bijak.addItem(item({ userId, attemptId, schoolId: schools.demo1, questionId: 'q2', chosenLetter: 'C', awarded: 0 }))
  })
  // A Mod Pelajar sitting that must never be counted.
  bijak.addSitting(sitting({ userId: pupils[0] as string, attemptId: 'test1', schoolId: schools.demo1, submittedAt: SUBMITTED }), { isTest: true })

  const classId = '9001'
  const otherClassId = '9002'
  const classes = new InMemoryClasses()
    .add({ id: classId, schoolId: schools.demo1, teacherId: ids['guru@demo.test'] as string, teacherName: 'Guru Demo', name: '4 Amanah' }, pupils)
    .add({ id: otherClassId, schoolId: schools.demo2, teacherId: null, name: '4 Cekap' }, [])

  // Question content of the pupil's own item analysis: q1 and q2 are live questions; q3 is archived (not registered).
  const content = new InMemoryQuestionContent().add({ questionId: 'q1', explanation: 'Penjelasan q1' }).add({ questionId: 'q2' })
  // The pupil `saya` answered q1 wrong in two modes (Pemulihan), q2 once wrong (Isyarat Awal), q3 (archived) twice wrong, q4 right then wrong (Pengukuhan).
  const me = ids['saya@demo.test'] as string
  answers.addPupil({ id: me, schoolId: schools.demo2 })
  answers.add({ userId: me, subjectId: '1', questionId: 'q1', mode: 'simulasi', isCorrect: false, answeredAt: at })
  answers.add({ userId: me, subjectId: '1', questionId: 'q2', mode: 'simulasi', isCorrect: false, answeredAt: at })
  answers.add({ userId: me, subjectId: '1', questionId: 'q1', mode: 'latih_tubi', isCorrect: false, answeredAt: new Date('2026-10-16T09:00:00+08:00') })
  answers.add({ userId: me, subjectId: '1', questionId: 'q3', mode: 'latih_tubi', isCorrect: false, answeredAt: at })
  answers.add({ userId: me, subjectId: '1', questionId: 'q3', mode: 'battle', isCorrect: false, answeredAt: at })
  content.add({ questionId: 'q4' })
  answers.add({ userId: me, subjectId: '1', questionId: 'q4', mode: 'latih_tubi', isCorrect: true, answeredAt: at })
  answers.add({ userId: me, subjectId: '1', questionId: 'q4', mode: 'kuiz', isCorrect: false, answeredAt: new Date('2026-10-17T09:00:00+08:00') })

  const ports = app.get(PerformancePorts)
  ports.provideBijak(bijak)
  ports.provideClasses(classes)
  ports.provideAnswerFacts(answers)
  ports.provideQuestionContent(content)
  await app.init()

  return {
    app,
    db,
    clock,
    ids,
    schools,
    classId,
    otherClassId,
    bijak,
    classes,
    answers,
    content,
    http: () => request(app.getHttpServer()) as unknown as TestAgent,
    agent: () => request.agent(app.getHttpServer()),
    async close() {
      await app.close()
      await dropDatabase(db)
    },
  }
}
