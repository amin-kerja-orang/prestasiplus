/**
 * CI fixture accounts of profile `uat-like` (S4-T01): one pupil per Tingkatan 1 to 3 on school DEMO001. Tingkatan 4 and 5, Admin Pusat,
 * Admin Sekolah and Guru are reused from `core-identity` (`pelajar@demo.test` grade 10, `pelajarmaju@demo.test` grade 11, `admin@demo.test`,
 * `adminsekolah@demo.test`, `guru@demo.test`). All fictitious: e-mail `pengguna{id}@contoh.invalid`, name `Murid Contoh {nnnnn}`.
 * CI fixtures only, not acceptance evidence.
 */
import type { SeedContext } from '../index'
import { demoPasswordHash } from '../core/demo-password'

export interface UatLikePupil {
  email: string
  name: string
  /** `users.grade`: 7 = Tingkatan 1 ... 9 = Tingkatan 3. */
  grade: number
}

const pupil = (id: number, grade: number): UatLikePupil => ({
  email: `pengguna${id}@contoh.invalid`,
  name: `Murid Contoh ${String(id).padStart(5, '0')}`,
  grade,
})

export const UAT_LIKE_SCHOOL_CODE = 'DEMO001'

/** Tingkatan 1, 2 and 3 pupils (grades 7, 8, 9). */
export const UAT_LIKE_PUPILS: readonly UatLikePupil[] = [pupil(90001, 7), pupil(90002, 8), pupil(90003, 9)]

/** Reused from `core-identity`: the account that must exist for the fixtures to hold (checked by the test). */
export const UAT_LIKE_REUSED_EMAILS = {
  adminPusat: 'admin@demo.test',
  adminSekolah: 'adminsekolah@demo.test',
  guru: 'guru@demo.test',
  pupilT4: 'pelajar@demo.test',
  pupilT5: 'pelajarmaju@demo.test',
} as const

export async function seedUatLikeAccounts(ctx: SeedContext): Promise<void> {
  const { prisma } = ctx
  const createdAt = ctx.clock.now()
  const school = await prisma.school.findUnique({ where: { code: UAT_LIKE_SCHOOL_CODE }, select: { id: true } })
  if (!school) throw new Error(`uat-like seed needs school ${UAT_LIKE_SCHOOL_CODE}; core-identity must run first.`)
  for (const p of UAT_LIKE_PUPILS) {
    const existing = await prisma.user.findFirst({ where: { email: { equals: p.email, mode: 'insensitive' } } })
    const data = { name: p.name, email: p.email, schoolId: school.id, grade: p.grade, isActive: true, isSuspended: false }
    const user = existing
      ? await prisma.user.update({ where: { id: existing.id }, data: { ...data, passwordHash: existing.passwordHash ?? (await demoPasswordHash()) } })
      : await prisma.user.create({ data: { ...data, passwordHash: await demoPasswordHash(), createdAt } })
    await prisma.userRole.upsert({ where: { userId_role: { userId: user.id, role: 'student' } }, create: { userId: user.id, role: 'student', createdAt }, update: {} })
  }
}
