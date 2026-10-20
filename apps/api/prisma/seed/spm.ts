/**
 * SPM hub seed (BE-41, owner M06, kind `demo`, runs after the curriculum and the question bank).
 *
 * - `spm_subject_configs`: the 19 Latih Tubi subjects with group, list positions and target (the mock
 *   `SPM_SUBJECTS`). This is reference data in nature, but a `reference` seed module needs LEAD approval
 *   (see seedModules in ./index.ts and test/subscriptions/seed-production.spec.ts), so it ships as `demo` here
 *   and production loading is the LEAD's call.
 * - `duta_profiles`: five FICTITIOUS ambassadors (invented names only; no real person).
 * - `spm_tracking_sets`: one Tracking A set (year 2026) per subject that has published questions in the seeded
 *   bank, built from the SPM-pool (single-leaf MCQ) questions in id order, read through the questions doorway. The demo bank is tiny, so the sets read as "Belum Cukup".
 * - Idempotent and deterministic: rows are matched by their natural key (subject, slug, subject+year+set) and
 *   left as they are; no randomness, no real time (times come from `ctx.clock`).
 */
import type { PrismaClient } from '../../src/db/client'
import type { PrismaService } from '../../src/db/prisma.service'
import { QuestionsRepository } from '../../src/modules/questions/questions.repository'
import { mcqItemOf } from '../../src/modules/spm/rules'
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

export interface DutaSeed {
  slug: string
  name: string
  initials: string
  tier: 'bintang' | 'inspirasi' | 'tetamu'
  tagline: string
  subject: string
  state: string
  rating: string
  isActive: boolean
}

/** Fictitious ambassadors. */
export const DUTA_PROFILES: readonly DutaSeed[] = [
  { slug: 'cikgu-contoh-matematik', name: 'Cikgu Contoh Matematik', initials: 'CM', tier: 'bintang', tagline: 'Pakar Matematik SPM, suka ajar langkah demi langkah.', subject: 'Matematik', state: 'Johor', rating: '4.90', isActive: true },
  { slug: 'cikgu-contoh-bahasa', name: 'Cikgu Contoh Bahasa', initials: 'CB', tier: 'bintang', tagline: 'Pakar Bahasa Melayu SPM, mahir ulas Kertas 2.', subject: 'Bahasa Melayu', state: 'Pahang', rating: '4.80', isActive: true },
  { slug: 'cikgu-contoh-sains', name: 'Cikgu Contoh Sains', initials: 'CS', tier: 'bintang', tagline: 'Pakar Sains SPM, jurulatih eksperimen sekolah.', subject: 'Sains', state: 'Selangor', rating: '4.70', isActive: true },
  { slug: 'cikgu-contoh-inspirasi', name: 'Cikgu Contoh Inspirasi', initials: 'CI', tier: 'inspirasi', tagline: 'Penggerak komuniti pembelajaran.', subject: 'Sejarah', state: 'Perak', rating: '4.50', isActive: true },
  { slug: 'cikgu-contoh-tetamu', name: 'Cikgu Contoh Tetamu', initials: 'CT', tier: 'tetamu', tagline: 'Tetamu jemputan.', subject: 'Biologi', state: 'Sabah', rating: '4.20', isActive: true },
]

/** The year of the demo sets (the module's Tracking year). */
const TRACKING_YEAR = 2026

async function seedConfigs(db: PrismaClient, now: Date): Promise<void> {
  for (const c of SPM_SUBJECT_CONFIGS) {
    const subject = await db.subject.findUnique({ where: { code: c.code }, select: { id: true } })
    if (!subject) continue // a partial curriculum seed: skip, do not fail
    await db.spmSubjectConfig.upsert({
      where: { subjectId: subject.id },
      update: {},
      create: { subjectId: subject.id, grp: c.grp, displayOrder: c.displayOrder, databankOrder: c.databankOrder, targetType: c.targetType, targetSize: c.targetSize, createdAt: now, updatedAt: now },
    })
  }
}

async function seedDuta(db: PrismaClient, now: Date): Promise<void> {
  for (const d of DUTA_PROFILES) {
    await db.dutaProfile.upsert({
      where: { slug: d.slug },
      update: {},
      create: { slug: d.slug, name: d.name, initials: d.initials, tier: d.tier, tagline: d.tagline, subject: d.subject, state: d.state, rating: d.rating, isActive: d.isActive, createdAt: now, updatedAt: now },
    })
  }
}

/** One set (set 1, year 2026) per configured subject with live-published active questions in the seeded bank. */
async function seedSets(db: PrismaClient, now: Date): Promise<void> {
  const questions = new QuestionsRepository({ client: db } as unknown as PrismaService)
  const configs = await db.spmSubjectConfig.findMany({ orderBy: { id: 'asc' } })
  for (const c of configs) {
    const existing = await db.spmTrackingSet.findUnique({
      where: { subjectId_year_setNo: { subjectId: c.subjectId, year: TRACKING_YEAR, setNo: 1 } },
      select: { id: true },
    })
    if (existing) continue
    // Other owner's data only through its doorway (ADR-0014): the SPM pool of the subject, in id order.
    const ids = await questions.eligibleIds({ subjectId: String(c.subjectId), type: 'mcq' })
    const rows: { id: bigint }[] = []
    for (let i = 0; i < ids.length; i += 200) {
      for (const r of await questions.getMany(ids.slice(i, i + 200), 'live')) if (r.spmPool && mcqItemOf(r.version.stemMs, r.version.parts) !== null) rows.push({ id: BigInt(r.id) })
    }
    rows.sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0))
    if (rows.length === 0) continue
    await db.spmTrackingSet.create({
      data: {
        subjectId: c.subjectId,
        year: TRACKING_YEAR,
        setNo: 1,
        dskpTagged: rows.length,
        createdAt: now,
        updatedAt: now,
        questions: { create: rows.map((r, i) => ({ questionId: r.id, position: i + 1 })) },
      },
    })
  }
}

export const spmSeed: SeedModule = {
  name: 'spm',
  kind: 'demo',
  async run(ctx) {
    const now = ctx.clock.now()
    await seedConfigs(ctx.prisma, now)
    await seedDuta(ctx.prisma, now)
    await seedSets(ctx.prisma, now)
  },
}
