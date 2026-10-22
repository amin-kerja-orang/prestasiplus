import type { PkskLevel, PkskQuestionStatus } from '@pp/contract'

import { FixedClock } from '../../src/db/clock'
import type { PkskActor } from '../../src/modules/pksk/actor'
import { PkskAccessService } from '../../src/modules/pksk/pksk-access.service'
import type { AccessRecord } from '../../src/modules/pksk/pksk-access.repository'
import type { DomainRecord, PackageRecord } from '../../src/modules/pksk/pksk-domains.repository'
import { PkskAdminAccessService } from '../../src/modules/pksk/pksk-admin-access.service'
import { PkskAdminQuestionsService } from '../../src/modules/pksk/pksk-admin-questions.service'
import { PkskStudentService } from '../../src/modules/pksk/pksk-student.service'
import type {
  PkskAnswerKey,
  PkskPracticeCompletion,
  PkskPracticePort,
  PkskQuestionInput,
  PkskQuestionListFilter,
  PkskQuestionRecord,
  PkskQuestionsPort,
  PkskServed,
  PkskStats,
  PkskSubscriptionPort,
} from '../../src/modules/pksk/ports'

/** Unit-test world for the PKSK services: in-memory stand-ins for the repositories and the three ports. No database. */

export const NOW = new Date('2026-10-21T04:00:00Z') // 12:00 in Malaysia

const CODES: readonly [string, 'A' | 'B' | 'C'][] = [
  ['PKSK_INSANIAH', 'A'],
  ['PKSK_MATH', 'B'],
  ['PKSK_SCI', 'B'],
  ['PKSK_ENG', 'B'],
  ['PKSK_SEJ', 'B'],
  ['PKSK_GEO', 'B'],
  ['PKSK_BUDAYA', 'B'],
  ['PKSK_SUKAN', 'B'],
  ['PKSK_MERCU', 'B'],
  ['PKSK_ALAM', 'B'],
  ['PKSK_TECH', 'B'],
  ['PKSK_EKON', 'B'],
  ['PKSK_INOV', 'B'],
  ['PKSK_GLOBAL', 'B'],
  ['PKSK_ESSAY', 'C'],
]

export const DOMAINS: DomainRecord[] = CODES.map(([code, bahagian], i) => ({
  id: String(i + 1),
  bahagian,
  name: `Domain ${code}`,
  nameEn: `Domain ${code} EN`,
  code,
  icon: 'fa-test',
  color: '#000000',
  order: i + 1,
  isActive: true,
  createdAt: new Date('2026-02-06T16:57:33Z'),
  updatedAt: new Date('2026-02-06T16:57:33Z'),
}))

export const PACKAGES: PackageRecord[] = [
  { id: '1', name: 'PKSK Tingkatan 1 (SBP/MRSM)', level: 'T1' },
  { id: '2', name: 'PKSK Tingkatan 4 (SBP/MRSM)', level: 'T4' },
  { id: '3', name: 'PKSK Kombo (T1 + T4)', level: 'ALL' },
]

export interface StoredQuestion {
  id: string
  domainCode: string
  level: PkskLevel
  status: PkskQuestionStatus
  text: string
  options: { text: string; isCorrect: boolean }[]
  difficulty: number | null
  explanation: string | null
  /** A question of the ordinary bank (not PKSK): the port must never see or change it. */
  pksk: boolean
}

export interface World {
  clock: FixedClock
  grants: AccessRecord[]
  users: Map<string, { id: string; name: string; email: string | null }>
  questions: StoredQuestion[]
  attempts: { id: string; userId: string; level: PkskLevel; completedAt: Date; scorePct: number; bahagianA: number; bahagianB: number; bahagianC: number; grade: string; isTest: boolean }[]
  mastery: { userId: string; level: PkskLevel; domainId: string; pct: number; isTest: boolean }[]
  loads: { userId: string; level: PkskLevel; domainId: string; at: Date }[]
  sessions: PkskPracticeCompletion[]
  audits: Record<string, unknown>[]
  subscribed: Set<string>
  /** Throw in the practice port after recording (rollback test). */
  failPractice: boolean
  nextId: number
}

export function seedQuestions(world: World, domainCode: string, level: PkskLevel, count: number, status: PkskQuestionStatus = 'approved'): StoredQuestion[] {
  const bahagian = CODES.find(([c]) => c === domainCode)?.[1]
  const out: StoredQuestion[] = []
  for (let i = 0; i < count; i++) {
    const id = String(world.nextId++)
    out.push({
      id,
      domainCode,
      level,
      status,
      text: `Soalan ${id}`,
      options: bahagian === 'C' ? [] : [{ text: 'A', isCorrect: i % 2 === 0 }, { text: 'B', isCorrect: i % 2 === 1 }, { text: 'C', isCorrect: false }],
      difficulty: 3,
      explanation: 'Penjelasan.',
      pksk: true,
    })
  }
  world.questions.push(...out)
  return out
}

const toRecord = (q: StoredQuestion): PkskQuestionRecord => ({
  id: q.id,
  questionText: q.text,
  domainCode: q.domainCode,
  targetLevel: q.level,
  status: q.status,
  difficultyLevel: q.difficulty,
  explanation: q.explanation,
  options: q.options.map((o) => ({ ...o })),
})

export function buildWorld() {
  const world: World = {
    clock: new FixedClock(NOW),
    grants: [],
    users: new Map([
      ['10', { id: '10', name: 'Pelajar Satu', email: 'satu@demo.test' }],
      ['11', { id: '11', name: 'Pelajar Dua', email: null }],
      ['99', { id: '99', name: 'Admin Demo', email: 'admin@demo.test' }],
    ]),
    questions: [],
    attempts: [],
    mastery: [],
    loads: [],
    sessions: [],
    audits: [],
    subscribed: new Set(),
    failPractice: false,
    nextId: 1000,
  }

  const questions: PkskQuestionsPort = {
    countApproved: (level) => {
      const out: Record<string, number> = {}
      for (const q of world.questions) if (q.pksk && q.status === 'approved' && q.level === level) out[q.domainCode] = (out[q.domainCode] ?? 0) + 1
      return Promise.resolve(out)
    },
    approvedPool: (level, codes) =>
      Promise.resolve(
        world.questions
          .filter((q) => q.pksk && q.status === 'approved' && q.level === level && codes.includes(q.domainCode))
          .map<PkskServed>((q) => ({ id: q.id, domainCode: q.domainCode, questionText: q.text, options: q.options.map((o) => ({ text: o.text })) })),
      ),
    answerKeys: (level, ids) =>
      Promise.resolve(
        world.questions
          .filter((q) => q.pksk && q.status === 'approved' && q.level === level && ids.includes(q.id))
          .map<PkskAnswerKey>((q) => ({
            id: q.id,
            domainCode: q.domainCode,
            optionCount: q.options.length,
            correctIndexes: q.options.flatMap((o, i) => (o.isCorrect ? [i] : [])),
          })),
      ),
    list: (f: PkskQuestionListFilter) => {
      const rows = world.questions
        .filter((q) => q.pksk)
        .filter((q) => (f.domainCodes ? f.domainCodes.includes(q.domainCode) : true))
        .filter((q) => (f.level ? q.level === f.level : true))
        .filter((q) => (f.status ? q.status === f.status : true))
        .filter((q) => (f.search ? q.text.toLowerCase().includes(f.search.toLowerCase()) : true))
      const page = rows.slice((f.page - 1) * f.pageSize, f.page * f.pageSize)
      return Promise.resolve({
        rows: page.map((q) => ({ id: q.id, questionText: q.text, domainCode: q.domainCode, targetLevel: q.level, status: q.status })),
        total: rows.length,
      })
    },
    stats: (): Promise<PkskStats> => {
      const k = world.questions.filter((q) => q.pksk)
      return Promise.resolve({
        total: k.length,
        approved: k.filter((q) => q.status === 'approved').length,
        pending: k.filter((q) => q.status === 'pending').length,
        t1: k.filter((q) => q.level === 'T1').length,
        t4: k.filter((q) => q.level === 'T4').length,
      })
    },
    get: (id) => {
      const q = world.questions.find((x) => x.id === id && x.pksk)
      return Promise.resolve(q ? toRecord(q) : null)
    },
    create: (input: PkskQuestionInput) => {
      const q: StoredQuestion = {
        id: String(world.nextId++),
        domainCode: input.domainCode,
        level: input.targetLevel,
        status: input.status,
        text: input.questionText,
        options: input.options,
        difficulty: input.difficultyLevel,
        explanation: input.explanation,
        pksk: true,
      }
      world.questions.push(q)
      return Promise.resolve(toRecord(q))
    },
    update: (id, input) => {
      const q = world.questions.find((x) => x.id === id && x.pksk)
      if (!q) return Promise.resolve(null)
      Object.assign(q, {
        domainCode: input.domainCode,
        level: input.targetLevel,
        status: input.status,
        text: input.questionText,
        options: input.options,
        difficulty: input.difficultyLevel,
        explanation: input.explanation,
      })
      return Promise.resolve(toRecord(q))
    },
    remove: (ids) => {
      const before = world.questions.length
      world.questions = world.questions.filter((q) => !(q.pksk && ids.includes(q.id)))
      return Promise.resolve(before - world.questions.length)
    },
    setStatus: (ids, status) => {
      let n = 0
      for (const q of world.questions) {
        if (!q.pksk || !ids.includes(q.id)) continue
        q.status = status
        n++
      }
      return Promise.resolve(n)
    },
    pkskIds: (ids) => Promise.resolve(world.questions.filter((q) => q.pksk && ids.includes(q.id)).map((q) => q.id)),
  }

  const practice: PkskPracticePort = {
    completeDirect: (input) => {
      world.sessions.push(input)
      if (world.failPractice) throw new Error('forced failure after the session is recorded')
      return Promise.resolve({ sessionId: '00000000-0000-4000-8000-000000000001', coinsEarned: 5, pointsEarned: 10, streakCount: 1, totalBalance: 105 })
    },
  }

  const subscription: PkskSubscriptionPort = { hasPkskSubscription: (userId) => Promise.resolve(world.subscribed.has(userId)) }

  const domainsRepo = {
    list: () => Promise.resolve(DOMAINS),
    byCode: (code: string) => Promise.resolve(DOMAINS.find((d) => d.code === code) ?? null),
    get: (id: string) => Promise.resolve(DOMAINS.find((d) => d.id === id) ?? null),
    listPackages: () => Promise.resolve(PACKAGES),
    getPackage: (id: string) => Promise.resolve(PACKAGES.find((p) => p.id === id) ?? null),
  }

  const accessRepo = {
    activeOf: (userId: string) => Promise.resolve(world.grants.filter((g) => g.userId === userId && g.status === 'active')),
    get: (id: string) => Promise.resolve(world.grants.find((g) => g.id === id) ?? null),
    list: (o: { userIds?: readonly string[]; page: number; pageSize: number }) => {
      const all = world.grants
        .filter((g) => (o.userIds ? o.userIds.includes(g.userId) : true))
        .sort((a, b) => b.grantedAt.getTime() - a.grantedAt.getTime() || Number(b.id) - Number(a.id))
      return Promise.resolve({ rows: all.slice((o.page - 1) * o.pageSize, o.page * o.pageSize), total: all.length })
    },
    stats: () => {
      const live = world.grants.filter((g) => g.status === 'active' && (g.expiresAt === null || g.expiresAt >= '2026-10-21'))
      return Promise.resolve({
        activeTotal: live.length,
        t1: live.filter((g) => g.packageLevel === 'T1' || g.packageLevel === 'ALL').length,
        t4: live.filter((g) => g.packageLevel === 'T4' || g.packageLevel === 'ALL').length,
      })
    },
    grant: (i: { userId: string; packageId: string; grantedById: string; expiresAt: string | null; now: Date }) => {
      const pkg = PACKAGES.find((p) => p.id === i.packageId) as PackageRecord
      const g: AccessRecord = {
        id: String(world.grants.length + 1),
        userId: i.userId,
        packageId: pkg.id,
        packageName: pkg.name,
        packageLevel: pkg.level,
        grantedById: i.grantedById,
        grantedAt: i.now,
        expiresAt: i.expiresAt,
        status: 'active',
        revokedAt: null,
      }
      world.grants.push(g)
      return Promise.resolve(g)
    },
    revoke: (id: string, now: Date) => {
      const g = world.grants.find((x) => x.id === id && x.status === 'active')
      if (!g) return Promise.resolve(false)
      g.status = 'revoked'
      g.revokedAt = now
      return Promise.resolve(true)
    },
  }

  const progressRepo = {
    attempts: (userId: string, level: PkskLevel, includeTest: boolean) =>
      Promise.resolve(
        world.attempts
          .filter((a) => a.userId === userId && a.level === level && (includeTest || !a.isTest))
          .sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime())
          .map((a) => ({ id: a.id, completedAt: a.completedAt, scorePct: a.scorePct, bahagianBPct: a.bahagianB, grade: a.grade as never })),
      ),
    addAttempt: (a: { userId: string; level: PkskLevel; completedAt: Date; scorePct: number; bahagianAPct: number; bahagianBPct: number; bahagianCPct: number; grade: string; isTest: boolean }) => {
      const row = { id: String(world.attempts.length + 1), userId: a.userId, level: a.level, completedAt: a.completedAt, scorePct: a.scorePct, bahagianA: a.bahagianAPct, bahagianB: a.bahagianBPct, bahagianC: a.bahagianCPct, grade: a.grade, isTest: a.isTest }
      world.attempts.push(row)
      return Promise.resolve({ id: row.id, completedAt: row.completedAt, scorePct: row.scorePct, grade: row.grade as never })
    },
    masteryMap: (userId: string, level: PkskLevel, includeTest: boolean) =>
      Promise.resolve(new Map(world.mastery.filter((m) => m.userId === userId && m.level === level && (includeTest || !m.isTest)).map((m) => [m.domainId, m.pct]))),
    setMastery: (userId: string, level: PkskLevel, domainId: string, pct: number, isTest: boolean) => {
      const row = world.mastery.find((m) => m.userId === userId && m.level === level && m.domainId === domainId)
      if (row) Object.assign(row, { pct, isTest })
      else world.mastery.push({ userId, level, domainId, pct, isTest })
      return Promise.resolve()
    },
    markLoaded: (userId: string, level: PkskLevel, domainId: string, at: Date) => {
      const row = world.loads.find((m) => m.userId === userId && m.level === level && m.domainId === domainId)
      if (row) row.at = at
      else world.loads.push({ userId, level, domainId, at })
      return Promise.resolve()
    },
    takeLoaded: (userId: string, level: PkskLevel, domainId: string) => {
      const i = world.loads.findIndex((m) => m.userId === userId && m.level === level && m.domainId === domainId)
      if (i < 0) return Promise.resolve(null)
      const [row] = world.loads.splice(i, 1)
      return Promise.resolve(row?.at ?? null)
    },
  }

  const usersRepo = {
    get: (id: string) => Promise.resolve(world.users.get(id) ?? null),
    getMany: (ids: readonly string[]) => Promise.resolve(ids.flatMap((i) => (world.users.has(i) ? [world.users.get(i)] : []))),
    search: ({ q }: { q: string }) =>
      Promise.resolve([...world.users.values()].filter((u) => u.name.toLowerCase().includes(q.toLowerCase()) || (u.email ?? '').toLowerCase().includes(q.toLowerCase()))),
  }

  const audit = {
    record: (e: Record<string, unknown>) => {
      world.audits.push(e)
      return Promise.resolve()
    },
  }

  /** A transaction that restores the world when the callback throws, as the database would. */
  const prisma = {
    transaction: async <T>(fn: () => Promise<T>): Promise<T> => {
      const snap = {
        attempts: structuredClone(world.attempts),
        mastery: structuredClone(world.mastery),
        loads: structuredClone(world.loads),
        grants: structuredClone(world.grants),
        questions: structuredClone(world.questions),
        audits: structuredClone(world.audits),
      }
      try {
        return await fn()
      } catch (err) {
        Object.assign(world, snap)
        throw err
      }
    },
  }

  const shuffle = <T>(items: readonly T[]): T[] => [...items]
  const gate = new PkskAccessService(accessRepo as never, subscription)
  const student = new PkskStudentService(gate, domainsRepo as never, progressRepo as never, questions, practice, shuffle, prisma as never, world.clock)
  const adminAccess = new PkskAdminAccessService(accessRepo as never, domainsRepo as never, usersRepo as never, audit as never, prisma as never, world.clock)
  const adminQuestions = new PkskAdminQuestionsService(questions, domainsRepo as never, audit as never, prisma as never)
  return { world, gate, student, adminAccess, adminQuestions, questions, practice }
}

export function grant(world: World, userId: string, level: 'T1' | 'T4' | 'ALL', opts: { expiresAt?: string | null; status?: 'active' | 'revoked' } = {}): AccessRecord {
  const pkg = PACKAGES.find((p) => p.level === level) as PackageRecord
  const g: AccessRecord = {
    id: String(world.grants.length + 1),
    userId,
    packageId: pkg.id,
    packageName: pkg.name,
    packageLevel: pkg.level,
    grantedById: null,
    grantedAt: new Date(NOW.getTime() - world.grants.length * 1000),
    expiresAt: opts.expiresAt ?? null,
    status: opts.status ?? 'active',
    revokedAt: opts.status === 'revoked' ? NOW : null,
  }
  world.grants.push(g)
  return g
}

export const STUDENT = { userId: '10', role: 'student', isTest: false } as unknown as PkskActor
export const ADMIN_CALLER = { userId: '99', role: 'admin', auth: { sessionRowId: '1', active: { scope: { level: 'national' } }, mode: null }, requestId: null, ip: null } as never
