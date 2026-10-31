/**
 * SPM hub demo seed (BE-41, owner M06, kind `demo`, runs after the curriculum and the question bank).
 *
 * - `spm_subject_configs` are NOT seeded here: they are the reference module `spm-subject-configs` (./spm-subject-configs.ts),
 *   which must run before this one (Tracking A sets are built for the configured subjects).
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

export { SPM_SUBJECT_CONFIGS, type SpmConfigSeed } from './spm-subject-configs'

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
    // Keyset pages of the SPM pool (live, active, `pool` tag, MCQ), hydrated 200 at a time to keep only single-leaf MCQs.
    const rows: { id: bigint }[] = []
    for (let after: string | undefined; ; ) {
      const page = await questions.eligibleIdsPage({ subjectId: String(c.subjectId), type: 'mcq', spmPool: true }, after, 200)
      if (page.length === 0) break
      for (const r of await questions.getMany(page, 'live')) if (mcqItemOf(r.version.stemMs, r.version.parts) !== null) rows.push({ id: BigInt(r.id) })
      after = page[page.length - 1]
      if (page.length < 200) break
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
    await seedDuta(ctx.prisma, now)
    await seedSets(ctx.prisma, now)
  },
}
