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
  pupils.forEach((userId, i) => {
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

  const ports = app.get(PerformancePorts)
  ports.provideBijak(bijak)
  ports.provideClasses(classes)
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
    http: () => request(app.getHttpServer()) as unknown as TestAgent,
    agent: () => request.agent(app.getHttpServer()),
    async close() {
      await app.close()
      await dropDatabase(db)
    },
  }
}
