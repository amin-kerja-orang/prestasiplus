/**
 * Exam seed (BE-15): the PoC blueprints ("Kontrak") and the four PoC papers of the Bijak SPM
 * prototype (D45: two short papers showing stimulus groups, maths input and equivalence marking,
 * plus a Matematik Kertas 1 and a Sejarah paper), with their sections and placements.
 *
 * Source: the one-time export of the prototype data in `src/modules/bijak/papers/poc/` (invented,
 * fictitious practice content; never `src/**` of the frontend). Needs the curriculum seed first
 * (it references the subjects MATH, SCI and SEJ by code).
 *
 * Idempotent and safe next to loaded or admin-made rows (plan 14.9 item 4): a blueprint is matched
 * by (code, version 1) and skipped when its subject and kertas already have an active blueprint; a
 * paper by (kind, title, subject). Existing rows are never updated or deleted. `legacy_*` does not
 * exist on these tables. Time comes from `ctx.clock`.
 *
 * QUESTIONS (BE-09): the placements point at the reserved PoC question ids (`POC_QUESTION_ID_BASE`),
 * so the papers seed correctly before the question bank exists. The question rows themselves belong
 * to M04: the step at the end runs only when the `questions` table exists (information_schema check)
 * and hands the export to a loader supplied by the BE-09 integration. TODO(BE-09 wire-up): implement
 * `PocQuestionLoader` against the BE-09 repository (insert with the reserved ids, status `published`)
 * and use `createExamSeed({ questionLoader })` in `seedModules`.
 */
import type { PrismaClient } from '../../src/db/client'
import { POC_BANK, type PocBank, type PocBlueprint, type PocPaper, pocQuestionId } from '../../src/modules/bijak/papers/poc'
import { curriculumCodeOf } from '../../src/modules/bijak/papers/subject-codes'
import { structureHashOf } from './bijak-standards/hash'
import type { SeedContext, SeedModule } from './index'

const SOURCE_TO_DB: Readonly<Record<PocBlueprint['source'], string>> = { Disahkan: 'verified', Spec: 'spec', Draf: 'draft' }

/** Loads the PoC questions into the question bank with the reserved ids. Supplied by BE-09. */
export type PocQuestionLoader = (ctx: SeedContext, bank: PocBank, idOf: (key: string) => bigint) => Promise<void>

export interface ExamSeedOptions {
  questionLoader?: PocQuestionLoader
}

export async function questionTableExists(prisma: PrismaClient): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ present: boolean }[]>`
    select exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'questions') as present`
  return rows[0]?.present === true
}

export async function subjectIds(prisma: PrismaClient): Promise<Map<string, bigint>> {
  const codes = [...new Set(POC_BANK.subjects.map((s) => curriculumCodeOf(s.code)))]
  const rows = await prisma.subject.findMany({ where: { code: { in: codes } }, select: { id: true, code: true } })
  const byCode = new Map(rows.map((r) => [r.code, r.id]))
  const out = new Map<string, bigint>()
  for (const s of POC_BANK.subjects) {
    const id = byCode.get(curriculumCodeOf(s.code))
    if (id === undefined) throw new Error(`exam seed: subject ${curriculumCodeOf(s.code)} is missing; run the curriculum seed first`)
    out.set(s.code, id)
  }
  return out
}

/** The exam-core structural form of a PoC blueprint (no profile, quota or KBAT: those exist from the bijak-spm layers on). */
function pocStructureHash(bp: PocBlueprint): string {
  return structureHashOf({
    subject: curriculumCodeOf(bp.subject),
    kertas: bp.kertas,
    code: bp.code,
    version: 1,
    durationMin: bp.durationMin,
    sections: bp.sections.map((s, i) => ({
      position: i + 1,
      label: s.label,
      rule: s.rule,
      questionCount: s.take,
      markBudget: s.markBudget ?? s.take,
      compulsory: s.compulsory ?? false,
      pool: s.pool,
      allowedModes: [],
      profile: null,
      quota: null,
      kbatMarks: null,
    })),
  })
}

/**
 * Creates one blueprint (version 1, active) unless it exists: matched by (code, version 1), and skipped when
 * its subject and kertas already have an active blueprint. Shared with `exam-demo-blueprints.ts`.
 */
export async function createBlueprintIfAbsent(prisma: PrismaClient, subjectId: bigint, bp: PocBlueprint): Promise<void> {
  const exists = await prisma.blueprint.findFirst({
    where: { OR: [{ code: bp.code, version: 1 }, { subjectId, kertas: bp.kertas, status: 'active' }] },
    select: { id: true },
  })
  if (exists) return
  await prisma.blueprint.create({
    data: {
      subjectId,
      kertas: bp.kertas,
      code: bp.code,
      version: 1,
      structureHash: pocStructureHash(bp),
      status: 'active',
      source: SOURCE_TO_DB[bp.source],
      durationMin: bp.durationMin,
      instructions: bp.instructions,
      referenceSheets: bp.reference ?? [],
      sections: {
        create: bp.sections.map((s, i) => ({
          position: i + 1,
          label: s.label,
          instruction: s.instruction ?? null,
          ruleType: s.rule.type,
          ruleN: s.rule.type === 'choose' ? s.rule.n : null,
          questionCount: s.take,
          markBudget: s.markBudget ?? null,
          compulsory: s.compulsory ?? false,
          pool: s.pool,
        })),
      },
    },
  })
}

async function seedBlueprints(prisma: PrismaClient, subjects: Map<string, bigint>): Promise<void> {
  for (const bp of POC_BANK.blueprints) await createBlueprintIfAbsent(prisma, subjects.get(bp.subject) as bigint, bp)
}

async function seedPaper(prisma: PrismaClient, ctx: SeedContext, paper: PocPaper, subjects: Map<string, bigint>): Promise<void> {
  const subjectId = subjects.get(paper.subject) as bigint
  const exists = await prisma.paper.findFirst({ where: { kind: 'pilihan', title: paper.title, subjectId }, select: { id: true } })
  if (exists) return
  const blueprint = await prisma.blueprint.findFirst({
    where: { subjectId, kertas: paper.kertas, code: paper.code },
    orderBy: { version: 'desc' },
    select: { id: true },
  })
  await prisma.paper.create({
    data: {
      kind: 'pilihan',
      title: paper.title,
      subjectId,
      kertas: paper.kertas,
      year: paper.year,
      paperCode: paper.code,
      printedDurationMin: paper.durationMin,
      instructions: paper.instructions,
      referenceSheets: paper.reference ?? [],
      blueprintId: blueprint?.id ?? null,
      status: 'published',
      version: 1,
      publishedAt: ctx.clock.now(),
      sections: {
        create: paper.sections.map((s, i) => ({
          position: i + 1,
          label: s.label,
          title: s.title ?? null,
          instruction: s.instruction ?? null,
          ruleType: s.rule.type,
          ruleN: s.rule.type === 'choose' ? s.rule.n : null,
          questionCount: s.questionCount,
          markBudget: s.markBudget,
          compulsory: s.compulsory ?? false,
          placements: {
            create: s.questionIds.map((key, j) => ({ questionId: pocQuestionId(key), pinnedVersionNo: 1, position: j + 1 })),
          },
        })),
      },
    },
  })
}

export function createExamSeed(options: ExamSeedOptions = {}): SeedModule {
  return {
    name: 'exam',
    async run(ctx) {
      const prisma = ctx.prisma
      const subjects = await subjectIds(prisma)
      await seedBlueprints(prisma, subjects)
      for (const paper of POC_BANK.papers) await seedPaper(prisma, ctx, paper, subjects)
      // M04 owns the questions (D12): load them only when its tables exist and a loader is wired.
      if (await questionTableExists(prisma)) {
        if (options.questionLoader) await options.questionLoader(ctx, POC_BANK, pocQuestionId)
        else console.warn('seed exam: PoC questions are not written to the questions table (no PocQuestionLoader wired); with BIJAK_POC_QUESTIONS=true the API serves them at runtime from the PoC bank')
      }
    },
  }
}

export const examSeed: SeedModule = createExamSeed()
