/**
 * SPM subject configuration (BE-41, owner M06, kind `reference`).
 *
 * The 19 Latih Tubi subjects with group, list positions and target (the mock `SPM_SUBJECT_CONFIGS`). Without these
 * rows the hub, Latih Tubi and Tracking A are empty, so the module runs in EVERY environment, production included
 * (LEAD to confirm: it extends the pinned reference set of BE-25).
 *
 * - Subjects are resolved by curriculum code. A code whose subject does not exist yet is skipped without error
 *   (in production the subjects arrive later from the ETL); a later run picks it up.
 * - Idempotent upsert on `subject_id`; existing rows are left as they are. Deterministic; time from `ctx.clock`.
 * - Fictitious/personal data: none.
 */
import type { SeedModule } from './index'

type TargetType = 'spm' | 'custom' | 'latihan'

const S3_TERAS = ['BM', 'BI', 'MATH', 'SCI', 'SEJ', 'PI', 'PM']
const S3_ELEKTIF = ['GEO', 'BIO', 'CHEM', 'PHY', 'PERNIAGA', 'AKAUN', 'EKON', 'ADDMATH', 'PSV', 'BA', 'TI', 'PSI']
/** Position on the Tahun Lepas list (BR-M06-06); BA is not listed. */
const S2_ORDER = ['BM', 'BI', 'MATH', 'SCI', 'SEJ', 'BIO', 'EKON', 'PHY', 'GEO', 'CHEM', 'ADDMATH', 'PI', 'PM', 'PSV', 'PSI', 'PERNIAGA', 'AKAUN', 'TI']
/** BR-M06-04 targets. */
const TARGETS: Readonly<Record<string, readonly [TargetType, number]>> = {
  BM: ['custom', 34],
  BI: ['custom', 36],
  MATH: ['spm', 40],
  SCI: ['spm', 40],
  SEJ: ['spm', 40],
  GEO: ['spm', 40],
  BIO: ['spm', 40],
  CHEM: ['spm', 40],
  PHY: ['spm', 40],
  PI: ['latihan', 40],
  PM: ['latihan', 40],
  EKON: ['latihan', 40],
  BA: ['latihan', 40],
  PSI: ['latihan', 40],
  ADDMATH: ['latihan', 20],
}

export interface SpmConfigSeed {
  code: string
  grp: 'teras' | 'elektif'
  displayOrder: number
  databankOrder: number | null
  targetType: TargetType | null
  targetSize: number | null
}

export const SPM_SUBJECT_CONFIGS: readonly SpmConfigSeed[] = [
  ...S3_TERAS.map((code, i) => ({ code, grp: 'teras' as const, displayOrder: i })),
  ...S3_ELEKTIF.map((code, i) => ({ code, grp: 'elektif' as const, displayOrder: i })),
].map((s) => {
  const t = TARGETS[s.code]
  const order = S2_ORDER.indexOf(s.code)
  return { ...s, databankOrder: order < 0 ? null : order, targetType: t?.[0] ?? null, targetSize: t?.[1] ?? null }
})


export const spmSubjectConfigsSeed: SeedModule = {
  name: 'spm-subject-configs',
  kind: 'reference',
  async run(ctx) {
    const now = ctx.clock.now()
    const db = ctx.prisma
    for (const c of SPM_SUBJECT_CONFIGS) {
      const subject = await db.subject.findUnique({ where: { code: c.code }, select: { id: true } })
      if (!subject) continue
      await db.spmSubjectConfig.upsert({
        where: { subjectId: subject.id },
        update: {},
        create: { subjectId: subject.id, grp: c.grp, displayOrder: c.displayOrder, databankOrder: c.databankOrder, targetType: c.targetType, targetSize: c.targetSize, createdAt: now, updatedAt: now },
      })
    }
  },
}
