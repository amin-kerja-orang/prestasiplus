/**
 * Launch blueprints of the SPM standard (bijak-spm, BJS-12/13; architecture section 8): 1449/1, 1449/2, 3472/1,
 * 3472/2, 4531/2 and 1249/2 as Spec, with their difficulty profile (layer 1), the study evidence rows and,
 * when the analyst files exist, the unit quotas, KBAT marks and marks bands (layer 2).
 *
 * Mechanism: for a code that already has a blueprint (the PoC Matematik K1/K2 and the demo Sejarah K2) the module
 * adds a NEW VERSION (`version + 1`, active) and retires the previous active row of the same subject and kertas;
 * PoC papers keep pointing at the version they were built on. Codes without a row are created as version 1.
 * Skipped when a row with that code and `provenance = 'paper'` exists, so a re-run changes nothing. Existing rows
 * are never deleted; the only update is the retirement of the superseded active row.
 *
 * Nothing is verified at seed: `source = 'spec'`, `serves_students = false`, no `verification` row. Layer-2 values
 * are seeded `reviewed = false` / `kbat_reviewed = false`. A unit code that does not resolve fails the seed.
 * Needs the curriculum seed first (subjects and DSKP unit nodes). Time comes from `ctx.clock` (rows use the DB
 * default for `created_at`).
 */
import type { Prisma } from '../../src/db/generated/client'
import type { PrismaClient } from '../../src/db/client'
import { buildBlueprint, type BuiltBlueprint, type Layer2File, type ResolvedUnit, type UnitResolver } from './bijak-standards/build'
import { EVIDENCE, EVIDENCE_SOURCE_REF, EVIDENCE_YEAR } from './bijak-standards/evidence'
import { structureHashOf } from '../../src/modules/exam/blueprints/blueprint-standard'
import { LAYER1, type Layer1Blueprint } from './bijak-standards/layer1'
import { loadLayer2 } from './bijak-standards/layer2'
import type { SeedModule } from './index'

/** Layer-2 data of a blueprint; null while no analyst file exists (quota and KBAT then seed null). */
export type Layer2Loader = (code: string) => Layer2File | null

/** The exam-core code of a SEJ unit loses its "Tajuk " prefix when compared (architecture 13.1a(a)). */
const stripTajuk = (code: string): string => code.replace(/^Tajuk\s+/i, '').trim()

/** Loads the DSKP unit nodes of the subjects layer 2 mentions and answers `(subject, level, code)`. */
export async function createUnitResolver(prisma: PrismaClient, subjects: readonly string[]): Promise<UnitResolver> {
  const byKey = new Map<string, ResolvedUnit>()
  const sejKey = new Map<string, ResolvedUnit>()
  for (const subject of subjects) {
    const nodes = await prisma.curriculumNode.findMany({
      where: { kind: 'unit', subject: { code: subject } },
      select: { id: true, code: true, educationLevel: { select: { code: true } } },
    })
    for (const n of nodes) {
      const level = n.educationLevel.code
      if (level !== 'T4' && level !== 'T5') continue
      const key = `${subject}|${level}|${n.code}`
      if (byKey.has(key)) throw new Error(`launch blueprints: unit ${key} is ambiguous (more than one DSKP edition)`)
      const unit: ResolvedUnit = { nodeId: n.id.toString(), level: level as 'T4' | 'T5' }
      byKey.set(key, unit)
      if (subject === 'SEJ') sejKey.set(`${subject}|${level}|${stripTajuk(n.code)}`, unit)
    }
  }
  return (subject, level, unitCode) => {
    const exact = byKey.get(`${subject}|${level}|${unitCode}`)
    if (exact) return exact
    // SEJ only: the DSKP stores "Tajuk 11"; accept the bare number too.
    const loose = subject === 'SEJ' ? sejKey.get(`${subject}|${level}|${stripTajuk(unitCode)}`) : undefined
    if (loose) return loose
    throw new Error(`launch blueprints: unit ${subject} ${level} "${unitCode}" does not resolve to a curriculum node (run the curriculum seed first)`)
  }
}

const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue

/** The database JSON of a quota: unit refs carry the node id as a string, lines carry `reviewed`. */
function quotaJson(built: BuiltBlueprint, position: number): Prisma.InputJsonValue | undefined {
  const q = built.standard.sections[position - 1]?.quota
  if (!q) return undefined
  return json({
    basis: q.basis,
    lines: q.lines.map((l) => ({ unit: l.unit, value: l.value, reviewed: l.reviewed ?? true })),
    ...(q.levelShare ? { levelShare: q.levelShare } : {}),
  })
}

async function seedOne(prisma: PrismaClient, now: Date, l1: Layer1Blueprint, layer2: Layer2File | null, resolve: UnitResolver): Promise<boolean> {
  const done = await prisma.blueprint.findFirst({ where: { code: l1.code, provenance: 'paper' }, select: { id: true } })
  if (done) return false
  const subject = await prisma.subject.findUnique({ where: { code: l1.subject }, select: { id: true } })
  if (!subject) throw new Error(`launch blueprints: subject ${l1.subject} is missing; run the curriculum seed first`)

  const built = buildBlueprint(l1, layer2, resolve)
  const bp = built.standard
  const structureHash = structureHashOf(bp)
  const evidence = EVIDENCE[l1.code]
  if (!evidence) throw new Error(`launch blueprints: no study evidence for ${l1.code}`)

  await prisma.$transaction(
    async (tx) => {
      const sameCode = await tx.blueprint.findFirst({
        where: { code: l1.code },
        orderBy: { version: 'desc' },
        select: { version: true, instructions: true, referenceSheets: true },
      })
      // One active row per subject and kertas (partial unique index): retire the superseded one first.
      await tx.blueprint.updateMany({ where: { subjectId: subject.id, kertas: l1.kertas, status: 'active' }, data: { status: 'retired' } })
      const created = await tx.blueprint.create({
        data: {
          subjectId: subject.id,
          kertas: l1.kertas,
          code: l1.code,
          version: (sameCode?.version ?? 0) + 1,
          status: 'active',
          source: 'spec',
          provenance: 'paper',
          confidence: built.confidence,
          durationMin: l1.durationMin,
          totalMarks: bp.totalMarks ?? null,
          instructions: sameCode?.instructions ?? [],
          referenceSheets: json(sameCode?.referenceSheets ?? []),
          notes: built.notes,
          subPartRamp: l1.subPartRamp,
          kbatMarks: bp.kbatMarks ?? null,
          servesStudents: false,
          structureHash,
          sections: {
            create: bp.sections.map((s) => {
              const quota = quotaJson(built, s.position)
              return {
                position: s.position,
                label: s.label,
                ruleType: s.rule.type,
                ruleN: s.rule.type === 'choose' ? s.rule.n : null,
                questionCount: s.questionCount,
                markBudget: s.markBudget,
                compulsory: false,
                pool: null,
                allowedModes: [...s.allowedModes],
                profile: json(s.profile),
                ...(quota === undefined ? {} : { quota }),
                kbatMarks: s.kbatMarks,
                kbatReviewed: built.kbatReviewed.get(s.position) ?? true,
              }
            }),
          },
        },
        select: { id: true },
      })
      await tx.blueprintEvidence.createMany({
        data: evidence.map((e) => ({
          blueprintId: created.id,
          kind: e.kind,
          body: e.body,
          year: EVIDENCE_YEAR,
          paperCode: l1.code,
          sourceRef: EVIDENCE_SOURCE_REF,
          values: json(e.values),
          origin: 'study',
          note: e.note ?? null,
          createdAt: now,
        })),
      })
    },
    { timeout: 60_000, maxWait: 20_000 },
  )
  return true
}

export interface LaunchBlueprintsOptions {
  /** Layer-2 source; default: the analyst files in docs/reference/blueprints (a missing file seeds quota and KBAT null). */
  layer2?: Layer2Loader
}

export function createExamLaunchBlueprintsSeed(options: LaunchBlueprintsOptions = {}): SeedModule {
  const layer2 = options.layer2 ?? loadLayer2
  return {
    name: 'exam-launch-blueprints',
    async run(ctx) {
      const files = new Map(LAYER1.map((l1) => [l1.code, layer2(l1.code)]))
      const subjects = [...new Set([...files.values()].flatMap((f) => (f ? f.sections.flatMap((s) => (s.quota?.lines ?? []).flatMap((l) => (l.subject ? [l.subject] : []))) : [])))]
      const resolve = await createUnitResolver(ctx.prisma, subjects)
      for (const l1 of LAYER1) await seedOne(ctx.prisma, ctx.clock.now(), l1, files.get(l1.code) ?? null, resolve)
    },
  }
}

export const examLaunchBlueprintsSeed: SeedModule = createExamLaunchBlueprintsSeed()
