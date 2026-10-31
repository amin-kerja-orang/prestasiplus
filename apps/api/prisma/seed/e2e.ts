/**
 * Local / E2E seed (R1-B19, T26). Profile `e2e` only, and only behind an explicit flag: it runs when the seed is started with
 * `--profile=e2e` AND `E2E_SEED=1` (or `true`) is set. Default off: with the flag missing the module logs one line and creates nothing,
 * and a server never runs it by default (the `poc` profile does not include it, and as a demo module the production guard skips it).
 *
 * What it creates or ensures (all fictitious, idempotent):
 * - a Tingkatan 4 pupil (`murid.t4.e2e@example.test`, grade 10, school DEMO001);
 * - an Admin Pusat (`admin.pusat.e2e@example.test`, national scope);
 * - one T4 launch blueprint (default Matematik Tambahan Kertas 2, code `3472/2`, override with `E2E_BLUEPRINT`). It is the one launch blueprint that can pass the checks as
 *   seeded: its layer-2 KBAT values are complete and its study evidence has two bodies with a trial paper and a skema each (D77); the others are INCOMPLETE
 *   in `docs/reference/blueprints/README.md` or have a single body, and the seed never invents evidence) moved from Spec to Disahkan with
 *   `serves_students = true`. The move uses the same checks and the same repository calls as the Kontrak "Sahkan" action
 *   (`BlueprintVerificationService.verify`): the AC-39.1 blueprint gate and the AC-39.7 evidence comparison (two or more
 *   bodies, D77) must pass, the layer-2 values are reviewed as the admin's section review does, then an insert-only verification
 *   row is written and `source`, `verification_id` and `serves_students` flip in one update. A blueprint that does not pass makes
 *   the seed fail loudly (it never forces Disahkan).
 *
 * Passwords: the demo convention of `core/demo-password.ts` (the published `Demo1234`, or the argon2id hash in
 * `SEED_DEMO_PASSWORD_HASH`). No secret is stored here. Needs the curriculum and launch-blueprint seeds first (they run earlier in
 * the registry).
 */
import { BijakEvidenceValuesSchema } from '@pp/contract'

import type { PrismaClient } from '../../src/db/client'
import type { PrismaService } from '../../src/db/prisma.service'
import { bijakCodeOf } from '../../src/modules/bijak/papers/subject-codes'
import { reviewedQuotaDoc, structureHashOf, toStandard, unitLevelsOf } from '../../src/modules/exam/blueprints/blueprint-standard'
import { BlueprintsRepository } from '../../src/modules/exam/blueprints/blueprints.repository'
import { checkEvidence, validateForVerification, type EvidenceItem } from '../../src/modules/exam/blueprints/exam-core.adapter'
import { demoPasswordHash } from './core/demo-password'
import type { SeedContext, SeedModule } from './index'

export const E2E_FLAG = 'E2E_SEED'
export const E2E_PUPIL_EMAIL = 'murid.t4.e2e@example.test'
export const E2E_ADMIN_EMAIL = 'admin.pusat.e2e@example.test'
export const E2E_DEFAULT_BLUEPRINT = '3472/2'

/** True only for an explicit `E2E_SEED=1` or `E2E_SEED=true`. */
export function e2eSeedEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env[E2E_FLAG] === '1' || env[E2E_FLAG] === 'true'
}

async function ensureUser(
  ctx: SeedContext,
  input: { email: string; name: string; username: string; role: 'student' | 'admin'; grade: number | null; schoolId: bigint | null; national: boolean },
): Promise<bigint> {
  const { prisma } = ctx
  const createdAt = ctx.clock.now()
  const existing = await prisma.user.findFirst({ where: { email: { equals: input.email, mode: 'insensitive' } } })
  const data = { name: input.name, email: input.email, username: input.username, schoolId: input.schoolId, grade: input.grade, isActive: true, isSuspended: false }
  const user = existing
    ? await prisma.user.update({ where: { id: existing.id }, data: { ...data, passwordHash: existing.passwordHash ?? (await demoPasswordHash()) } })
    : await prisma.user.create({ data: { ...data, passwordHash: await demoPasswordHash(), createdAt } })
  await prisma.userRole.upsert({ where: { userId_role: { userId: user.id, role: input.role } }, create: { userId: user.id, role: input.role, createdAt }, update: {} })
  if (input.national) {
    await prisma.userScope.upsert({
      where: { userId_role: { userId: user.id, role: 'admin' } },
      create: { userId: user.id, role: 'admin', level: 'national', createdAt },
      update: { level: 'national', stateCode: null, districtCode: null, schoolId: null },
    })
  }
  return user.id
}

/** Spec -> Disahkan through the repository the Sahkan action uses. Idempotent: an already Disahkan head is left as it is. */
async function verifyBlueprint(prisma: PrismaClient, code: string, adminId: bigint, at: Date): Promise<void> {
  const row = await prisma.blueprint.findFirst({ where: { code, status: 'active' }, select: { id: true, subjectId: true, kertas: true } })
  if (!row) throw new Error(`e2e seed: no active blueprint with code ${code} (the launch-blueprint seed must run first)`)
  const subject = await prisma.subject.findUniqueOrThrow({ where: { id: row.subjectId }, select: { id: true, code: true, name: true } })
  const repo = new BlueprintsRepository({ client: prisma } as unknown as PrismaService)

  let head = await repo.active(subject.id, row.kertas)
  if (!head) throw new Error(`e2e seed: blueprint ${code} has no active head`)
  if (head.source === 'verified') return

  // The admin's section review (AC-39.9): the layer-2 values the seed carries as "Belum disemak" are reviewed in place.
  for (const s of head.sections) {
    const quotaLines = ((s.quota as { lines?: { reviewed?: boolean }[] } | null)?.lines ?? [])
    if (!s.kbatReviewed || quotaLines.some((l) => l.reviewed === false)) {
      await repo.stampSectionReviewed(head.id, s.position, reviewedQuotaDoc(s.quota), at)
    }
  }
  head = (await repo.active(subject.id, row.kertas))!

  const units = await repo.unitsOfSubject(subject.id)
  const bp = toStandard(head, bijakCodeOf(subject.code))
  const gate = validateForVerification(bp, {
    unitLevels: unitLevelsOf(units),
    subjectHasBothLevels: units.some((u) => u.level === 'T4') && units.some((u) => u.level === 'T5'),
  })
  const evidenceRows = await repo.evidenceOf(head.id)
  const items: EvidenceItem[] = evidenceRows.map((r) => ({ id: r.id.toString(), kind: r.kind as EvidenceItem['kind'], body: r.body, values: BijakEvidenceValuesSchema.parse(r.values) }))
  const evidence = checkEvidence(bp, items)
  const passes = gate.problems.length === 0 && gate.completeness.length === 0 && evidence.completeness.length === 0 && evidence.passes
  if (!passes) {
    const why = [
      ...gate.problems.map((p) => p.code),
      ...gate.completeness.map((c) => c.code),
      ...evidence.completeness.map((c) => c.code),
      ...evidence.lines.filter((l) => l.status !== 'ok').map((l) => `evidence:${String(l.status)}`),
    ]
    throw new Error(`e2e seed: blueprint ${code} does not pass the Sahkan checks (${[...new Set(why)].join(', ') || 'unknown'}); it was not marked Disahkan`)
  }

  const hash = structureHashOf(bp)
  await prisma.$transaction(async (tx) => {
    const txRepo = new BlueprintsRepository({ client: tx } as unknown as PrismaService)
    const verification = await txRepo.insertVerification({
      blueprintId: head.id,
      verifiedById: adminId,
      note: 'E2E seed: Disahkan for local end-to-end runs.',
      structureHash: hash,
      checkResult: JSON.parse(JSON.stringify({ passes, blueprintProblems: gate.problems, completeness: [...gate.completeness, ...evidence.completeness], lines: evidence.lines })),
      evidenceSnapshot: JSON.parse(JSON.stringify(evidenceRows.map((r) => ({ id: r.id.toString(), kind: r.kind, body: r.body, year: r.year, paperCode: r.paperCode, setLabel: r.setLabel, sourceRef: r.sourceRef, values: r.values, origin: r.origin, note: r.note })))),
      verifiedAt: at,
    })
    await txRepo.clearServing(subject.id, row.kertas, head.id, at)
    await txRepo.markVerified(head.id, verification.id, hash, at)
  })
}

export const e2eSeed: SeedModule = {
  name: 'e2e-bijak',
  kind: 'demo',
  profiles: ['e2e'],
  async run(ctx) {
    if (!e2eSeedEnabled()) {
      console.warn(`seed: e2e-bijak skipped: set ${E2E_FLAG}=1 to create the local E2E accounts and the Disahkan blueprint`)
      return
    }
    const { prisma } = ctx
    const school = await prisma.school.findUnique({ where: { code: 'DEMO001' }, select: { id: true } })
    if (!school) throw new Error('e2e seed: school DEMO001 is missing (core-identity must run first)')
    await ensureUser(ctx, { email: E2E_PUPIL_EMAIL, name: 'Murid Ujian E2E', username: 'murid-t4-e2e', role: 'student', grade: 10, schoolId: school.id, national: false })
    const adminId = await ensureUser(ctx, { email: E2E_ADMIN_EMAIL, name: 'Admin Pusat Ujian E2E', username: 'admin-pusat-e2e', role: 'admin', grade: null, schoolId: null, national: true })
    const code = (process.env.E2E_BLUEPRINT ?? E2E_DEFAULT_BLUEPRINT).trim() || E2E_DEFAULT_BLUEPRINT
    await verifyBlueprint(prisma, code, adminId, ctx.clock.now())
  },
}
