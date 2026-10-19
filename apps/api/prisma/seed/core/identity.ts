/**
 * Core identity seed (BE-03): the demo accounts of docs/AKAUN-DEMO.md plus the schools they need.
 *
 * Rules: fictitious names only; every account uses the documented demo password `Demo1234` (a
 * documented exception to D59b, demo data only, never real or production data); idempotent (schools
 * by `code`, users by e-mail or by school + username, roles by user + role) and `legacy_*` is never
 * set. The password is hashed (argon2id) only when the account has no hash yet, so a re-run neither
 * pays the hashing cost nor changes an existing hash.
 */
import { hash } from '@node-rs/argon2'

import type { SeedModule } from '../index'

export const DEMO_PASSWORD = 'Demo1234'

/** OWASP argon2id minimum (19 MiB, t=2, p=1). The auth module uses the same parameters. */
const ARGON2_OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const

/**
 * argon2id of the demo password, computed ONCE per process and shared by every demo account.
 * All demo accounts use the same published password, so hashing it per account only burned CPU
 * (about 10 hashes per seed run, which made the seed tests time out under load). Sharing one
 * hash (one random salt) is fine for demo data; an account that already has a hash keeps it.
 */
let demoHash: Promise<string> | undefined
function demoPasswordHash(): Promise<string> {
  demoHash ??= hash(DEMO_PASSWORD, ARGON2_OPTIONS)
  return demoHash
}

type RoleCode = 'admin' | 'school_admin' | 'ppd_officer' | 'teacher' | 'student' | 'parent' | 'sponsor'

export interface DemoSchool {
  code: string
  name: string
  state: string
  district: string
  isActive: boolean
}

export interface DemoAccount {
  email: string | null
  username: string | null
  name: string
  roles: readonly RoleCode[]
  /** Key into DEMO_SCHOOLS by `code`; null = no school (Admin Pusat). */
  schoolCode: string | null
  grade?: number
  classLabel?: string
  isActive?: boolean
  isSuspended?: boolean
  /** National scope row (the only scope row the seed writes). */
  nationalScope?: boolean
}

export const DEMO_SCHOOLS: readonly DemoSchool[] = [
  { code: 'DEMO001', name: 'SMK Demo Satu', state: 'Selangor', district: 'Petaling', isActive: true },
  { code: 'DEMO002', name: 'SK Demo Dua', state: 'Selangor', district: 'Gombak', isActive: true },
]

export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  {
    email: 'pelajar@demo.test',
    username: 'murid01',
    name: 'Murid Demo',
    roles: ['student'],
    schoolCode: 'DEMO001',
    grade: 10,
    classLabel: '4 Amanah',
  },
  {
    email: 'pelajarmaju@demo.test',
    username: null,
    name: 'Murid Demo Maju',
    roles: ['student'],
    schoolCode: 'DEMO001',
    grade: 11,
    classLabel: '5 Amanah',
  },
  {
    email: 'pelajar2@demo.test',
    username: null,
    name: 'Murid Demo Kosong',
    roles: ['student'],
    schoolCode: 'DEMO001',
    grade: 10,
    classLabel: '4 Bestari',
  },
  { email: 'guru@demo.test', username: null, name: 'Guru Demo', roles: ['teacher'], schoolCode: 'DEMO001' },
  {
    email: 'adminsekolah@demo.test',
    username: null,
    name: 'Admin Sekolah Demo',
    roles: ['school_admin'],
    schoolCode: 'DEMO001',
  },
  {
    email: 'admin@demo.test',
    username: null,
    name: 'Admin Pusat Demo',
    roles: ['admin'],
    schoolCode: null,
    nationalScope: true,
  },
  {
    email: 'guruadmin@demo.test',
    username: null,
    name: 'Guru Admin Demo',
    roles: ['teacher', 'school_admin'],
    schoolCode: 'DEMO001',
  },
  {
    email: 'tidakaktif@demo.test',
    username: null,
    name: 'Murid Tidak Aktif Demo',
    roles: ['student'],
    schoolCode: 'DEMO001',
    grade: 10,
    isActive: false,
  },
  {
    email: 'digantung@demo.test',
    username: null,
    name: 'Murid Digantung Demo',
    roles: ['student'],
    schoolCode: 'DEMO001',
    grade: 10,
    isSuspended: true,
  },
  // Roster pupil of the second school: no e-mail, same username as `pelajar@demo.test` in school
  // DEMO001, so a username login without a school is ambiguous (AMBIGUOUS_USERNAME).
  {
    email: null,
    username: 'murid01',
    name: 'Murid Roster Demo',
    roles: ['student'],
    schoolCode: 'DEMO002',
    grade: 4,
    classLabel: '4 Cekap',
  },
]

export const identitySeed: SeedModule = {
  name: 'core-identity',
  async run(ctx) {
    const { prisma } = ctx
    const createdAt = ctx.clock.now()

    const schoolIds = new Map<string, bigint>()
    for (const s of DEMO_SCHOOLS) {
      const row = await prisma.school.upsert({
        where: { code: s.code },
        create: { ...s, createdAt },
        update: { name: s.name, state: s.state, district: s.district, isActive: s.isActive },
      })
      schoolIds.set(s.code, row.id)
    }

    for (const a of DEMO_ACCOUNTS) {
      const schoolId = a.schoolCode ? (schoolIds.get(a.schoolCode) ?? null) : null
      if (a.schoolCode && schoolId === null) throw new Error(`Unknown demo school ${a.schoolCode}.`)

      const existing = a.email
        ? await prisma.user.findFirst({ where: { email: { equals: a.email, mode: 'insensitive' } } })
        : await prisma.user.findFirst({ where: { schoolId, username: a.username } })

      const data = {
        name: a.name,
        email: a.email,
        username: a.username,
        schoolId,
        grade: a.grade ?? null,
        classLabel: a.classLabel ?? null,
        isActive: a.isActive ?? true,
        isSuspended: a.isSuspended ?? false,
      }

      let userId: bigint
      if (existing) {
        const passwordHash = existing.passwordHash ?? (await demoPasswordHash())
        await prisma.user.update({ where: { id: existing.id }, data: { ...data, passwordHash } })
        userId = existing.id
      } else {
        const passwordHash = await demoPasswordHash()
        const row = await prisma.user.create({ data: { ...data, passwordHash, createdAt } })
        userId = row.id
      }

      for (const role of a.roles) {
        await prisma.userRole.upsert({
          where: { userId_role: { userId, role } },
          create: { userId, role, createdAt },
          update: {},
        })
      }
      await prisma.userRole.deleteMany({ where: { userId, role: { notIn: [...a.roles] } } })

      if (a.nationalScope) {
        await prisma.userScope.upsert({
          where: { userId_role: { userId, role: 'admin' } },
          create: { userId, role: 'admin', level: 'national', createdAt },
          update: { level: 'national', stateCode: null, districtCode: null, schoolId: null },
        })
      }
    }
  },
}
