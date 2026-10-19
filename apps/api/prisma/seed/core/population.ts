/**
 * Core population seed (BE-07, demo): a deterministic, fictitious PoC population (D45) on top of the
 * BE-03 demo accounts and the BE-05 schools: students, teachers and one school admin per extra
 * school, plus the demo accounts of docs/AKAUN-DEMO.md that the identity seed does not create
 * (parent, sponsor, PPD officer, JPN officer).
 *
 * SECURITY: every account uses the published demo password `Demo1234`. This is the explicit,
 * documented exception to D59 and is allowed only because this seed is a DEMO module: the runner
 * refuses it in production unless ALLOW_DEMO_SEED is set, and `run` checks the same guard itself.
 *
 * Rules: fictitious data only (e-mails on example.test / demo.test, names `<Role> Contoh <Word>`);
 * idempotent (users by e-mail, roles by user + role, scopes by user + role) and deterministic (names
 * come from a seeded stream); `legacy_*`, IC and phone data are never set. Existing hashes are kept.
 */
import { hash } from '@node-rs/argon2'

import { assertSeedAllowed, type SeedModule } from '../index'
import { CLASS_NAMES, NAME_WORDS, ROLE_LABELS } from './fixtures/names'
import { DEMO_PASSWORD } from './identity'

const ARGON2_OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const
let demoHash: Promise<string> | undefined
function demoPasswordHash(): Promise<string> {
  demoHash ??= hash(DEMO_PASSWORD, ARGON2_OPTIONS)
  return demoHash
}

type RoleCode = 'admin' | 'school_admin' | 'ppd_officer' | 'teacher' | 'student' | 'parent' | 'sponsor'

type ScopeSpec =
  | { level: 'school' }
  | { level: 'district'; stateCode: string; districtCode: string }
  | { level: 'state'; stateCode: string }

export interface PopulationAccount {
  email: string
  name: string
  roles: readonly RoleCode[]
  schoolCode: string | null
  grade?: number
  classLabel?: string
  /** Scope row written for the role (the other roles derive their scope at login). */
  scope?: ScopeSpec
}

/** Demo accounts of docs/AKAUN-DEMO.md that BE-03 does not seed. JPN is a state-level ppd_officer (D31). */
export const EXTRA_DEMO_ACCOUNTS: readonly PopulationAccount[] = [
  { email: 'ibubapa@demo.test', name: 'Ibu Bapa Demo', roles: ['parent'], schoolCode: null },
  { email: 'penaja@demo.test', name: 'Penaja Demo', roles: ['sponsor'], schoolCode: null },
  {
    email: 'ppd@demo.test',
    name: 'Pegawai PPD Demo',
    roles: ['ppd_officer'],
    schoolCode: null,
    scope: { level: 'district', stateCode: 'Selangor', districtCode: 'Petaling' },
  },
  {
    email: 'jpn@demo.test',
    name: 'Pegawai JPN Demo',
    roles: ['ppd_officer'],
    schoolCode: null,
    scope: { level: 'state', stateCode: 'Selangor' },
  },
]

interface SchoolPlan {
  code: string
  /** Grade range of the pupils. */
  grades: readonly [number, number]
  /** Form-style class label (grade - 6) for secondary schools. */
  secondary: boolean
  students: number
  teachers: number
  /** One pure school_admin is created for schools that have none yet. */
  schoolAdmin: boolean
}

/** DEMO001 and DEMO002 come from BE-03, DEMO003 and DEMO004 from BE-05. */
export const SCHOOL_PLANS: readonly SchoolPlan[] = [
  { code: 'DEMO001', grades: [7, 11], secondary: true, students: 6, teachers: 2, schoolAdmin: false },
  { code: 'DEMO002', grades: [1, 6], secondary: false, students: 5, teachers: 2, schoolAdmin: true },
  { code: 'DEMO003', grades: [1, 6], secondary: false, students: 5, teachers: 2, schoolAdmin: true },
  { code: 'DEMO004', grades: [1, 6], secondary: false, students: 5, teachers: 2, schoolAdmin: true },
]

const pad = (n: number): string => String(n).padStart(2, '0')

/** Builds the generated accounts. Pure and deterministic for a given stream. */
export function buildPopulation(prng: { int(min: number, max: number): number }): PopulationAccount[] {
  // Seeded Fisher-Yates shuffle: each generated account gets a distinct name word.
  const words = [...NAME_WORDS]
  for (let i = words.length - 1; i > 0; i--) {
    const j = prng.int(0, i)
    const a = words[i] as string
    words[i] = words[j] as string
    words[j] = a
  }
  const total = SCHOOL_PLANS.reduce((n, p) => n + p.students + p.teachers + (p.schoolAdmin ? 1 : 0), 0)
  if (total > words.length) throw new Error('Population plan needs more name words than the fixture has.')
  let w = 0
  const nextWord = (): string => words[w++] as string

  const out: PopulationAccount[] = []
  for (const plan of SCHOOL_PLANS) {
    const key = plan.code.toLowerCase()
    for (let i = 1; i <= plan.students; i++) {
      const grade = prng.int(plan.grades[0], plan.grades[1])
      const cls = CLASS_NAMES[prng.int(0, CLASS_NAMES.length - 1)] as string
      out.push({
        email: `murid.${key}.${pad(i)}@example.test`,
        name: `${ROLE_LABELS.student} Contoh ${nextWord()}`,
        roles: ['student'],
        schoolCode: plan.code,
        grade,
        classLabel: `${plan.secondary ? grade - 6 : grade} ${cls}`,
      })
    }
    for (let i = 1; i <= plan.teachers; i++) {
      out.push({
        email: `guru.${key}.${pad(i)}@example.test`,
        name: `${ROLE_LABELS.teacher} Contoh ${nextWord()}`,
        roles: ['teacher'],
        schoolCode: plan.code,
        scope: { level: 'school' },
      })
    }
    if (plan.schoolAdmin) {
      out.push({
        email: `adminsekolah.${key}@example.test`,
        name: `${ROLE_LABELS.school_admin} Contoh ${nextWord()}`,
        roles: ['school_admin'],
        schoolCode: plan.code,
        scope: { level: 'school' },
      })
    }
  }
  return out
}

export const populationSeed: SeedModule = {
  name: 'core-population',
  async run(ctx) {
    // Defence in depth: the runner already refuses demo modules in production without the flag.
    assertSeedAllowed()
    const { prisma } = ctx
    const createdAt = ctx.clock.now()

    const accounts = [...EXTRA_DEMO_ACCOUNTS, ...buildPopulation(ctx.prng('core-population'))]
    const schoolIds = new Map<string, bigint>()
    for (const s of await prisma.school.findMany({ select: { id: true, code: true } })) {
      if (s.code) schoolIds.set(s.code, s.id)
    }

    for (const a of accounts) {
      const schoolId = a.schoolCode ? (schoolIds.get(a.schoolCode) ?? null) : null
      if (a.schoolCode && schoolId === null) {
        throw new Error(`Population seed needs school ${a.schoolCode}; run the identity and schools seeds first.`)
      }
      const existing = await prisma.user.findFirst({ where: { email: { equals: a.email, mode: 'insensitive' } } })
      const data = {
        name: a.name,
        email: a.email,
        schoolId,
        grade: a.grade ?? null,
        classLabel: a.classLabel ?? null,
        isActive: true,
        isSuspended: false,
      }
      let userId: bigint
      if (existing) {
        const passwordHash = existing.passwordHash ?? (await demoPasswordHash())
        await prisma.user.update({ where: { id: existing.id }, data: { ...data, passwordHash } })
        userId = existing.id
      } else {
        const row = await prisma.user.create({ data: { ...data, passwordHash: await demoPasswordHash(), createdAt } })
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

      if (a.scope) {
        const role = a.roles[0] as RoleCode
        const scopeData = {
          level: a.scope.level,
          stateCode: a.scope.level === 'school' ? null : a.scope.stateCode,
          districtCode: a.scope.level === 'district' ? a.scope.districtCode : null,
          schoolId: a.scope.level === 'school' ? schoolId : null,
        }
        await prisma.userScope.upsert({
          where: { userId_role: { userId, role } },
          create: { userId, role, ...scopeData, createdAt },
          update: scopeData,
        })
      }
    }
  },
}
