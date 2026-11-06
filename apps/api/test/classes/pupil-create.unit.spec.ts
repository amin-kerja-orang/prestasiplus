import {
  GURU_STUDENT_MESSAGES,
  GuruStudentCreateRequestSchema,
  TEACHER_STUDENTS_PAGE_SIZE,
  type RoleCode,
} from '@pp/contract'
import { describe, expect, it } from 'vitest'

import { ApiError, DEFAULT_ERROR_MESSAGES } from '../../src/common/errors/api-error'
import { ClassesService } from '../../src/modules/classes/classes.service'
import { skorPurataOf } from '../../src/modules/classes/classes.repository'
import { IcService, usernameStem } from '../../src/modules/users/credentials'
import { UsersService } from '../../src/modules/users/users.service'

/** DB-free unit tests of S6-T10: username generator, IC rules, own-class check, Skor Purata math. No real credentials: every value is a throwaway built in the test. */

const THROWAWAY = 'q'.repeat(8)
const cfgOf = (values: Record<string, unknown>) => ({ get: (k: string) => values[k] }) as never

describe('usernameStem (D113)', () => {
  it('lower-cases, folds diacritics, strips non a-z0-9 and joins the words with "."', () => {
    expect(usernameStem('Murid Contoh')).toBe('murid.contoh')
    expect(usernameStem('  Nur Aïsyah  Ñandí ')).toBe('nur.aisyah.nandi')
    expect(usernameStem("Ali bin Abu-Bakar (Jr.)")).toBe('ali.bin.abubakar.jr')
    expect(usernameStem('名前')).toBe('pelajar')
  })

  it('caps the stem at 40 characters, cutting at a word boundary when possible', () => {
    const long = 'Muhammad Aiman Hakimi bin Abdul Rahman bin Ahmad Zulkifli'
    const stem = usernameStem(long)
    expect(stem).toBe('muhammad.aiman.hakimi.bin.abdul.rahman')
    expect(stem.length).toBeLessThanOrEqual(40)
    // a single very long word is cut mid-word
    expect(usernameStem('a'.repeat(60))).toBe('a'.repeat(40))
    // exactly 40 characters stays whole
    const exact = `${'b'.repeat(19)} ${'c'.repeat(20)}`
    expect(usernameStem(exact)).toBe(`${'b'.repeat(19)}.${'c'.repeat(20)}`)
  })
})

describe('skorPurataOf (AC-GUR-41-6)', () => {
  it('sessions of 60% and 80% give 70; no sessions give null', () => {
    expect(skorPurataOf(6 / 10 + 8 / 10, 2)).toBe(70)
    expect(skorPurataOf(0, 0)).toBeNull()
  })
})

describe('create pupil request (IC rule, names)', () => {
  const ok = { name: 'Murid Contoh', classroomId: '5' }
  it('11 digits and hyphenated IC are refused with the contract message; 12 digits pass', () => {
    for (const ic of ['12345678901', '123456-12-1234']) {
      const r = GuruStudentCreateRequestSchema.safeParse({ ...ok, ic })
      expect(r.success).toBe(false)
      expect(r.error?.issues[0]?.message).toBe(GURU_STUDENT_MESSAGES.ic)
    }
    expect(GuruStudentCreateRequestSchema.safeParse({ ...ok, ic: '123456121234' }).success).toBe(true)
  })
})

function usersServiceWith(opts: { taken?: Set<string>; icTaken?: boolean; failFirstInsert?: boolean }) {
  const created: { username: string | null; icHash: string | null }[] = []
  const taken = opts.taken ?? new Set<string>()
  let attempts = 0
  const repo = {
    existingIcHashes: async (h: string[]) => (opts.icTaken ? new Set(h) : new Set<string>()),
    takenUsernames: async () => new Set(taken),
    create: async (row: { username: string | null; icHash: string | null }) => {
      attempts++
      if (opts.failFirstInsert && attempts === 1) {
        // a parallel create wins the first free name between the check and the insert
        taken.add(row.username as string)
        throw Object.assign(new Error('unique'), { code: 'P2002', meta: { target: 'uq_users_school_username' } })
      }
      created.push(row)
      return '77'
    },
    setRoles: async (_id: string, roles: RoleCode[]) => {
      expect(roles).toEqual(['student'])
    },
  }
  const prisma = { transaction: async (fn: () => Promise<unknown>) => fn() }
  const svc = new UsersService(
    prisma as never,
    { now: () => new Date('2026-11-05T00:00:00Z') } as never,
    repo as never,
    {} as never,
    { hash: async (p: string) => `hash:${p.length}` } as never,
    new IcService(cfgOf({ SESSION_SECRET: 'unit-test-secret-0123456789' })),
    {} as never,
    {} as never,
    {} as never,
  )
  return { svc, created, attemptsOf: () => attempts }
}

const pupil = { name: 'Murid Contoh', schoolId: '3', grade: 10, password: THROWAWAY, createdById: '9' }

describe('UsersService.createPupil', () => {
  it('first free suffix is 01', async () => {
    const { svc, created } = usersServiceWith({})
    expect(await svc.createPupil(pupil, async () => {})).toEqual({ id: '77', username: 'murid.contoh01' })
    expect(created[0]?.icHash).toBeNull()
  })

  it('a taken 01 gives 02 (case-insensitive set of lower-case names)', async () => {
    const { svc } = usersServiceWith({ taken: new Set(['murid.contoh01']) })
    expect((await svc.createPupil(pupil, async () => {})).username).toBe('murid.contoh02')
  })

  it('a race on uq_users_school_username retries with a fresh check and ends on the next free name', async () => {
    const { svc, attemptsOf } = usersServiceWith({ failFirstInsert: true })
    expect((await svc.createPupil(pupil, async () => {})).username).toBe('murid.contoh02')
    expect(attemptsOf()).toBe(2)
  })

  it('runs the in-transaction step with the new id and username', async () => {
    const { svc } = usersServiceWith({})
    const seen: string[] = []
    await svc.createPupil(pupil, async (id, username) => void seen.push(id, username))
    expect(seen).toEqual(['77', 'murid.contoh01'])
  })

  it('99 taken suffixes give a 409', async () => {
    const taken = new Set(Array.from({ length: 99 }, (_, i) => `murid.contoh${String(i + 1).padStart(2, '0')}`))
    const { svc } = usersServiceWith({ taken })
    await expect(svc.createPupil(pupil, async () => {})).rejects.toMatchObject({ code: 'CONFLICT', status: 409 })
  })

  it('a duplicate IC is 409 with fields.ic "No. IC sudah didaftarkan." and nothing is created', async () => {
    const { svc, created } = usersServiceWith({ icTaken: true })
    const err = await svc.createPupil({ ...pupil, ic: '123456121234' }, async () => {}).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ status: 409, fields: { ic: GURU_STUDENT_MESSAGES.icTaken } })
    expect(created).toHaveLength(0)
  })

  it('a free 12-digit IC is stored hashed and masked, never in clear', async () => {
    const { svc, created } = usersServiceWith({})
    await svc.createPupil({ ...pupil, ic: '123456121234' }, async () => {})
    expect(created[0]?.icHash).toMatch(/^[0-9a-f]{64}$/)
  })
})

function classesServiceWith(opts: { cls?: Record<string, unknown> | null; ownActive?: boolean; password?: string; schoolId?: string | null }) {
  const calls: { createPupil: unknown[] } = { createPupil: [] }
  const cls = opts.cls === undefined ? { id: '5', kind: 'classroom', teacherId: '9', schoolId: '3', educationLevelId: '11', isActive: true } : opts.cls
  const repo = {
    get: async () => cls,
    forTeacher: async () => (opts.ownActive === false ? [] : [{ isActive: true }]),
    levelGrades: async () => new Map([['11', { grade: 10, code: 'T4' }]]),
    enrol: async () => ({}),
  }
  const users = {
    createPupil: async (input: unknown, within: (id: string, u: string) => Promise<void>) => {
      calls.createPupil.push(input)
      await within('77', 'murid.contoh01')
      return { id: '77', username: 'murid.contoh01' }
    },
  }
  const audited: unknown[] = []
  const svc = new ClassesService(
    repo as never,
    {} as never,
    {} as never,
    { record: async (e: unknown) => void audited.push(e) } as never,
    {} as never,
    { now: () => new Date('2026-11-05T00:00:00Z') } as never,
    cfgOf(opts.password === undefined ? {} : { PUPIL_DEFAULT_PASSWORD: opts.password }),
    users as never,
  )
  const actor = {
    userId: '9',
    role: 'teacher',
    schoolId: opts.schoolId === undefined ? '3' : opts.schoolId,
    auth: { sessionRowId: 's', active: { scope: { level: 'own' } } },
    requestId: 'r',
    ip: '127.0.0.1',
  } as never
  return { svc, actor, calls, audited }
}

describe('ClassesService.createStudent', () => {
  const body = { name: ' Murid Contoh ', classroomId: '5' }

  it('creates in an own active class and builds the message with the configured password', async () => {
    const { svc, actor, calls, audited } = classesServiceWith({ password: THROWAWAY })
    const res = await svc.createStudent(actor, body)
    expect(res).toEqual({ id: '77', name: 'Murid Contoh', username: 'murid.contoh01', message: `Pelajar dicipta. Login: murid.contoh01 / ${THROWAWAY}` })
    expect(calls.createPupil[0]).toMatchObject({ name: 'Murid Contoh', schoolId: '3', grade: 10, password: THROWAWAY, createdById: '9' })
    expect(audited).toHaveLength(1)
    expect(JSON.stringify(audited)).not.toContain(THROWAWAY)
  })

  it('another teacher class is 422 fields.classroomId "Sila pilih kelas."', async () => {
    const { svc, actor } = classesServiceWith({ cls: { id: '5', kind: 'classroom', teacherId: '8', isActive: true }, password: THROWAWAY })
    await expect(svc.createStudent(actor, body)).rejects.toMatchObject({ status: 422, fields: { classroomId: GURU_STUDENT_MESSAGES.classroom } })
  })

  it('a teacher with no active class gets "Anda belum ada kelas aktif. Cipta kelas dahulu."', async () => {
    const { svc, actor } = classesServiceWith({ cls: null, ownActive: false, password: THROWAWAY })
    await expect(svc.createStudent(actor, body)).rejects.toMatchObject({ status: 422, fields: { classroomId: GURU_STUDENT_MESSAGES.noActiveClass } })
  })

  it('a teacher with no school gets the school message', async () => {
    const { svc, actor } = classesServiceWith({ schoolId: null, password: THROWAWAY })
    await expect(svc.createStudent(actor, body)).rejects.toMatchObject({ status: 422, fields: { classroomId: GURU_STUDENT_MESSAGES.noSchool } })
  })

  it('an unconfigured default password is a 500 with the standard BM server-error copy and nothing is created', async () => {
    const { svc, actor, calls } = classesServiceWith({})
    await expect(svc.createStudent(actor, body)).rejects.toMatchObject({
      status: 500,
      code: 'SERVER_ERROR',
      message: DEFAULT_ERROR_MESSAGES.SERVER_ERROR,
    })
    expect(calls.createPupil).toHaveLength(0)
  })

  it('an 11-digit IC is refused before anything is created', async () => {
    const { svc, actor, calls } = classesServiceWith({ password: THROWAWAY })
    await expect(svc.createStudent(actor, { ...body, ic: '12345678901' })).rejects.toMatchObject({ status: 422, fields: { ic: GURU_STUDENT_MESSAGES.ic } })
    expect(calls.createPupil).toHaveLength(0)
  })

  it('the page size constant is 25', () => {
    expect(TEACHER_STUDENTS_PAGE_SIZE).toBe(25)
  })
})
