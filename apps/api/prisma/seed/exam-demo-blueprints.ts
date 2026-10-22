/**
 * Demo blueprints (demo fix B4, QA #61): the Kontrak the prototype export lacks for a seeded paper. The
 * export has a blueprint for every seeded PoC paper except Sejarah Kertas 2, so the paper builder could
 * not create (or rebuild) a Sejarah Kertas 2 paper. This module derives that blueprint from the seeded
 * PoC Sejarah paper (same code, duration, instructions and section shape; fictitious practice content
 * only). Pool tags follow the export's `<SUBJECT><kertas>-<section>` naming; the PoC Sejarah questions
 * carry no pool tag, so Jana's pool for them stays empty, as before.
 *
 * A separate demo module, registered right after `exam` (practice stays last), so the BE-15 seed and
 * the scenarios shared with the mock (four Kontrak; Sejarah has none, `NO_BLUEPRINT` for Jana) keep
 * their export-only shape. Idempotent
 * with the `exam` rule (`createBlueprintIfAbsent`): skipped when the code exists at version 1 or the
 * subject and kertas already have an active blueprint (an admin-made one included). Never updates rows.
 */
import { POC_BANK, type PocBlueprint, type PocPaper } from '../../src/modules/bijak/papers/poc'
import { createBlueprintIfAbsent, subjectIds } from './exam'
import type { SeedModule } from './index'

/** A blueprint with the shape of a seeded paper (`take` = the section's question count). */
export function blueprintOfPaper(paper: PocPaper, source: PocBlueprint['source']): PocBlueprint {
  return {
    subject: paper.subject,
    kertas: paper.kertas,
    source,
    code: paper.code,
    durationMin: paper.durationMin,
    instructions: paper.instructions,
    ...(paper.reference ? { reference: paper.reference } : {}),
    sections: paper.sections.map((s, i) => ({
      label: s.label,
      markBudget: s.markBudget,
      ...(s.compulsory ? { compulsory: s.compulsory } : {}),
      ...(s.instruction ? { instruction: s.instruction } : {}),
      rule: s.rule,
      pool: `${paper.subject}${paper.kertas}-${String.fromCharCode(65 + i)}`,
      take: s.questionCount,
    })),
  }
}

/** Every seeded paper whose subject and kertas have no blueprint in the export (today: Sejarah Kertas 2). */
export const DEMO_BLUEPRINTS: readonly PocBlueprint[] = POC_BANK.papers
  .filter((p) => !POC_BANK.blueprints.some((b) => b.subject === p.subject && b.kertas === p.kertas))
  .map((p) => blueprintOfPaper(p, 'Spec'))

export const examDemoBlueprintsSeed: SeedModule = {
  name: 'exam-demo-blueprints',
  async run(ctx) {
    const subjects = await subjectIds(ctx.prisma)
    for (const bp of DEMO_BLUEPRINTS) await createBlueprintIfAbsent(ctx.prisma, subjects.get(bp.subject) as bigint, bp)
  },
}
