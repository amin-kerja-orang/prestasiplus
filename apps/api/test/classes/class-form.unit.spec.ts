import { CLASS_MESSAGES } from '@pp/contract'
import { describe, expect, it } from 'vitest'

import { FixedClock } from '../../src/db/clock'
import type { ClassActor } from '../../src/modules/classes/actor'
import { toTeacherClass } from '../../src/modules/classes/classes.mapper'
import { isClassNameViolation, type ClassRecord } from '../../src/modules/classes/classes.repository'
import { ClassesService } from '../../src/modules/classes/classes.service'

/** DB-free: the class form rules of S6-T14 (create/edit validation, 409, no school) with fake collaborators. */

const record = (over: Partial<ClassRecord> = {}): ClassRecord => ({
  id: '5',
  kind: 'classroom',
  teacherId: '10',
  schoolId: '3',
  subjectId: null,
  educationLevelId: '8',
  name: '5 Bestari',
  academicYear: 2026,
  description: null,
  joinCode: 'ABC234',
  isActive: true,
  createdAt: new Date('2026-10-19T01:00:00Z'),
  ...over,
})

function build(opts: { taken?: boolean; schoolId?: string | null; own?: ClassRecord | null } = {}) {
  const calls: { nameTaken: unknown[][]; created: unknown[]; updated: unknown[]; audits: unknown[] } = { nameTaken: [], created: [], updated: [], audits: [] }
  const repo = {
    nameTaken: (...args: unknown[]) => {
      calls.nameTaken.push(args)
      return Promise.resolve(opts.taken ?? false)
    },
    activeSubjectExists: (id: string) => Promise.resolve(id === '7'),
    schoolExists: () => Promise.resolve(true),
    createClass: (input: unknown) => {
      calls.created.push(input)
      return Promise.resolve(record())
    },
    updateClass: (_id: string, input: unknown) => {
      calls.updated.push(input)
      return Promise.resolve(record({ name: 'Baharu' }))
    },
    get: (id: string) => Promise.resolve(opts.own !== undefined ? opts.own : id === '5' ? record() : null),
    subjectNames: () => Promise.resolve(new Map()),
    levelGrades: () => Promise.resolve(new Map([['8', { grade: 11, code: 'T5' }]])),
    memberCounts: () => Promise.resolve(new Map([['5', 4]])),
  }
  const curriculum = { levelForGrade: (g: number) => Promise.resolve(g >= 7 ? { id: 8n } : null) }
  const audit = { record: (e: unknown) => (calls.audits.push(e), Promise.resolve()) }
  const prisma = { transaction: <T>(fn: (tx: unknown) => Promise<T>) => fn({}) }
  const clock = new FixedClock(new Date('2026-10-19T01:00:00Z'))
  const service = new ClassesService(repo as never, curriculum as never, {} as never, audit as never, prisma as never, clock)
  const actor = {
    auth: { sessionRowId: null, active: { scope: { level: 'school' } } },
    userId: '10',
    role: 'teacher',
    schoolId: opts.schoolId === undefined ? '3' : opts.schoolId,
    isTest: false,
    requestId: null,
    ip: null,
  } as unknown as ClassActor
  return { service, actor, calls }
}

describe('class form (S6-T14)', () => {
  it('create: trims the name, subject optional, year defaults to the MYT year, writes an audit row', async () => {
    const { service, actor, calls } = build()
    await service.createClass(actor, { name: '  5 Bestari ', educationLevel: 'tingkatan-5' })
    expect(calls.nameTaken[0]).toEqual(['10', 2026, '5 Bestari'])
    expect(calls.created[0]).toMatchObject({ name: '5 Bestari', subjectId: null, academicYear: 2026, teacherId: '10', schoolId: '3' })
    expect(calls.audits).toHaveLength(1)
  })

  it('create: year 2027 and a real subject are kept; an unknown subject is fields.subjectId', async () => {
    const { service, actor, calls } = build()
    await service.createClass(actor, { name: 'A', educationLevel: 'tingkatan-1', subjectId: '7', year: 2027 })
    expect(calls.created[0]).toMatchObject({ subjectId: '7', academicYear: 2027 })
    await expect(service.createClass(actor, { name: 'A', educationLevel: 'tingkatan-1', subjectId: '99' })).rejects.toMatchObject({
      fields: { subjectId: CLASS_MESSAGES.subject },
    })
  })

  it('create: a taken name is 409 with fields.name, nothing is written', async () => {
    const { service, actor, calls } = build({ taken: true })
    await expect(service.createClass(actor, { name: '5 bestari', educationLevel: 'tingkatan-5' })).rejects.toMatchObject({
      status: 409,
      fields: { name: CLASS_MESSAGES.nameTaken },
    })
    expect(calls.created).toHaveLength(0)
  })

  it('create: a blank name and a missing level are 422 together; a Darjah level (valid slug) is refused by the service', async () => {
    const { service, actor } = build()
    await expect(service.createClass(actor, { name: ' ' })).rejects.toMatchObject({
      status: 422,
      fields: { name: CLASS_MESSAGES.nameRequired, educationLevel: CLASS_MESSAGES.educationLevelRequired },
    })
    await expect(service.createClass(actor, { name: 'A', educationLevel: 'tahun-3' })).rejects.toMatchObject({
      status: 422,
      fields: { educationLevel: CLASS_MESSAGES.educationLevelRequired },
    })
  })

  it('a teacher without a school is 422 noSchool on create and edit', async () => {
    const { service, actor, calls } = build({ schoolId: null })
    await expect(service.createClass(actor, { name: 'A', educationLevel: 'tingkatan-1' })).rejects.toMatchObject({
      status: 422,
      fields: { schoolId: CLASS_MESSAGES.noSchool },
    })
    await expect(service.updateClass(actor, '5', { name: 'A', educationLevel: 'tingkatan-1' })).rejects.toMatchObject({ status: 422 })
    expect(calls.created).toHaveLength(0)
  })

  it('edit: excludes the class itself from the name check and returns the pupil count and year', async () => {
    const { service, actor, calls } = build()
    const view = await service.updateClass(actor, '5', { name: 'Baharu', educationLevel: 'tingkatan-5' })
    expect(calls.nameTaken[0]).toEqual(['10', 2026, 'Baharu', '5'])
    expect(view).toMatchObject({ name: 'Baharu', studentCount: 4, year: 2026, academicYear: 2026 })
  })

  it('edit: another teacher, a school class, an unknown or malformed id is 404; a taken name is 409', async () => {
    const other = build({ own: record({ teacherId: '99' }) })
    await expect(other.service.updateClass(other.actor, '5', { name: 'A', educationLevel: 'tingkatan-1' })).rejects.toMatchObject({ status: 404 })
    const sc = build({ own: record({ kind: 'school_class', teacherId: null }) })
    await expect(sc.service.updateClass(sc.actor, '5', { name: 'A', educationLevel: 'tingkatan-1' })).rejects.toMatchObject({ status: 404 })
    const { service, actor } = build()
    for (const id of ['404', 'abc']) {
      await expect(service.updateClass(actor, id, { name: 'A', educationLevel: 'tingkatan-1' })).rejects.toMatchObject({ status: 404 })
    }
    const taken = build({ taken: true })
    await expect(taken.service.updateClass(taken.actor, '5', { name: 'A', educationLevel: 'tingkatan-1' })).rejects.toMatchObject({ status: 409 })
  })

  it('edit: a unique violation of the race is mapped to the same 409', async () => {
    const { service, actor, calls } = build()
    ;(service as unknown as { repo: { updateClass: () => never } }).repo.updateClass = () => {
      throw Object.assign(new Error('duplicate key value violates unique constraint "uq_classrooms_teacher_year_name"'), { code: '23505' })
    }
    await expect(service.updateClass(actor, '5', { name: 'A', educationLevel: 'tingkatan-1' })).rejects.toMatchObject({ status: 409 })
    expect(calls.audits).toHaveLength(0)
  })

  it('isClassNameViolation recognises the index name in the message or in the Prisma meta only', () => {
    expect(isClassNameViolation(new Error('violates unique constraint "uq_classrooms_teacher_year_name"'))).toBe(true)
    expect(isClassNameViolation(Object.assign(new Error('x'), { meta: { message: 'uq_classrooms_teacher_year_name' } }))).toBe(true)
    expect(isClassNameViolation(new Error('uq_classrooms_join_code_upper'))).toBe(false)
    expect(isClassNameViolation(null)).toBe(false)
  })

  it('mapper: year equals academicYear and joinCode stays', () => {
    const view = toTeacherClass(record(), 2, { subjectNames: new Map(), levels: new Map([['8', { grade: 11, code: 'T5' }]]) })
    expect(view).toMatchObject({ year: 2026, academicYear: 2026, joinCode: 'ABC234', studentCount: 2 })
  })
})
