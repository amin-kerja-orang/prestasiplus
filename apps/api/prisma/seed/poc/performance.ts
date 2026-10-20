/**
 * PoC performance seed (BE-19, demo): headcount (TOV / RS) data for the demo school DEMO001, so the headcount routes of
 * M08 are not empty (no contract route writes headcount entries; they come from this seed and the ETL).
 *
 * What it writes (fictitious marks; the accounts and classes come from the identity, classes and Bijak sittings seeds):
 * - Config 1: `guru@demo.test`, class DEMO4M (Matematik), mode auto, 3 OTRs. Seven pupils (`pelajar`, `pelajar2` and
 *   `murid4` to `murid8@demo.test`): five with actual results (on track, below and one improving), `pelajar2` with a
 *   target only (no data) and `murid8` with only a TOV.
 * - Config 2: same teacher, class DEMO4S (Bahasa Melayu), mode manual, 3 OTRs. Six pupils, `murid8` is dropped.
 *
 * Idempotent: a config is found by (class, subject, year, mode), an entry by (config, pupil), a mark by (entry,
 * checkpoint); existing rows are left alone. Deterministic: fixed numbers, time from `ctx.clock`. `legacy_*` is never set.
 * Needs the classes and Bijak sittings seeds (DEMO4S, DEMO4M and the pupils), so it runs after them.
 */
import { assertSeedAllowed } from '../guard'
import type { SeedModule } from '../index'

const TEACHER = 'guru@demo.test'
const CLASS_BM = 'DEMO4S'
const CLASS_MATH = 'DEMO4M'

type Mark = number | null

interface PupilPlan {
  email: string
  tov: Mark
  /** [target, actual] per OTR. */
  otrs: readonly (readonly [Mark, Mark])[]
  etr: Mark
  rs?: Mark
  dropped?: boolean
}

const MATH_PLAN: readonly PupilPlan[] = [
  { email: 'pelajar@demo.test', tov: 55, otrs: [[60, 62], [65, 68], [70, null]], etr: 75 },
  { email: 'pelajar2@demo.test', tov: 40, otrs: [[50, null], [55, null], [60, null]], etr: 65 },
  { email: 'murid4@demo.test', tov: 70, otrs: [[75, 72], [78, 77], [80, 83]], etr: 85, rs: 82 },
  { email: 'murid5@demo.test', tov: 45, otrs: [[55, 50], [60, 52], [65, 58]], etr: 70 },
  { email: 'murid6@demo.test', tov: 62, otrs: [[66, 68], [70, 71], [74, null]], etr: 78 },
  { email: 'murid7@demo.test', tov: 35, otrs: [[45, 40], [50, 44], [55, 47]], etr: 60 },
  { email: 'murid8@demo.test', tov: 50, otrs: [[null, null], [null, null], [null, null]], etr: null },
]

const BM_PLAN: readonly PupilPlan[] = [
  { email: 'pelajar@demo.test', tov: 60, otrs: [[65, 66], [68, 70], [72, 74]], etr: 78, rs: 76 },
  { email: 'pelajar2@demo.test', tov: 52, otrs: [[58, 55], [60, null], [64, null]], etr: 68 },
  { email: 'murid4@demo.test', tov: 75, otrs: [[78, 80], [80, 82], [84, 85]], etr: 88 },
  { email: 'murid5@demo.test', tov: 48, otrs: [[55, 52], [58, 57], [62, null]], etr: 66 },
  { email: 'murid6@demo.test', tov: 66, otrs: [[70, 69], [72, 70], [75, 71]], etr: 78 },
  { email: 'murid8@demo.test', tov: 58, otrs: [[62, 60], [65, null], [68, null]], etr: 72, dropped: true },
]

export const performanceSeed: SeedModule = {
  name: 'poc-performance',
  kind: 'demo',
  async run(ctx) {
    assertSeedAllowed()
    const { prisma } = ctx
    const now = ctx.clock.now()

    const teacher = await prisma.user.findFirst({ where: { email: { equals: TEACHER, mode: 'insensitive' } }, select: { id: true } })
    if (!teacher) throw new Error(`Performance seed needs ${TEACHER}; run the identity seed first.`)
    const pupils = new Map<string, bigint>()
    for (const u of await prisma.user.findMany({
      where: { email: { in: [...new Set([...MATH_PLAN, ...BM_PLAN].map((p) => p.email))] } },
      select: { id: true, email: true },
    })) {
      if (u.email) pupils.set(u.email.toLowerCase(), u.id)
    }

    const plans: readonly { code: string; mode: 'auto' | 'manual'; plan: readonly PupilPlan[] }[] = [
      { code: CLASS_MATH, mode: 'auto', plan: MATH_PLAN },
      { code: CLASS_BM, mode: 'manual', plan: BM_PLAN },
    ]
    for (const p of plans) {
      const cls = await prisma.classroom.findFirst({ where: { joinCode: { equals: p.code, mode: 'insensitive' } } })
      if (!cls || cls.subjectId === null) throw new Error(`Performance seed needs class ${p.code} with a subject; run the classes and Bijak sittings seeds first.`)
      if (cls.legacySource != null) continue // a migrated class: never touched
      const key = { classroomId: cls.id, subjectId: cls.subjectId, academicYear: cls.academicYear, mode: p.mode }
      const config =
        (await prisma.headcountConfig.findUnique({ where: { classroomId_subjectId_academicYear_mode: key } })) ??
        (await prisma.headcountConfig.create({
          data: { ...key, teacherId: teacher.id, educationLevelId: cls.educationLevelId, activeOtrs: 3, createdAt: now, updatedAt: now },
        }))
      for (const pupil of p.plan) {
        const studentId = pupils.get(pupil.email)
        if (studentId === undefined) throw new Error(`Performance seed: pupil ${pupil.email} is missing; run the Bijak sittings seed first.`)
        const entry = await prisma.headcountEntry.upsert({
          where: { configId_studentId: { configId: config.id, studentId } },
          create: {
            configId: config.id,
            studentId,
            tov: pupil.tov,
            etr: pupil.etr,
            rs: pupil.rs ?? null,
            rsRecordedAt: pupil.rs == null ? null : now,
            dropped: pupil.dropped === true,
            createdAt: now,
            updatedAt: now,
          },
          update: {},
        })
        for (const [i, [target, actual]] of pupil.otrs.entries()) {
          if (target === null && actual === null) continue
          await prisma.headcountEntryMark.upsert({
            where: { entryId_checkpoint: { entryId: entry.id, checkpoint: i + 1 } },
            create: { entryId: entry.id, checkpoint: i + 1, target, actual },
            update: {},
          })
        }
      }
    }
  },
}
