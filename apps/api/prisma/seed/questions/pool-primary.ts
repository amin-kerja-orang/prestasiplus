/**
 * PoC primary question pool (BE-09 owner seed path, kind `demo`, profile `poc` only): published, active, single-part MCQs
 * for Darjah 1 to 4. The base pool (`questions-pool`) only covers Tingkatan 4 and 5, so for a pupil in Darjah 1 to 4 the
 * practice "random" mode, the games (Jutawan Ilmu subject tiles, the five solo games) and Kad Memori had nothing to draw.
 *
 * Seed facts (pinned by test/seed/question-pool-primary.spec.ts):
 * - PRIMARY_PER_LEVEL (24) questions for each subject of PRIMARY_SUBJECTS (BM, BI, MATH, SCI) at D1 to D4:
 *   4 subjects x 4 levels x 24 = 384 questions, one version each (version_no 1, live_version_no 1).
 * - Difficulty TP cycles 1, 2, 3, 4 (6 of each per subject and level), so Jutawan finds its 4/4/4/3 ladder.
 * - NOT in the SPM pool: no `question_tags` row (SPM is Tingkatan 4 and 5 only).
 * - Curriculum tag: subject and level always; the DSKP unit and SP only when the curriculum seed has them. The curriculum
 *   seed currently holds DSKP nodes for Tingkatan 4 and 5 only (none for Darjah 1 to 4), so `unit_node_id` stays null and
 *   there is no SP row for these questions. No consumer of the five games, practice "random" or Jutawan reads the unit.
 *   If the curriculum seed gains Darjah nodes later, a fresh database tags the rows (an existing row is never updated).
 * - `form_origin` is 't1_t3': the CHECK constraint only allows t1_t3, t4 and t5, and `t1_t3` is the value the questions
 *   module itself stores for every level below Tingkatan 4 (`QuestionsService.formOriginOf`).
 * - Natural key `question_versions.number_label` = `SEED-PRIM-<S>-<L>-<NN>`. The prefix differs from the base pool's
 *   `SEED-POOL-` on purpose: each module's "already seeded" check and the base pool's spec count their own rows only.
 *   An existing row is never updated, so a re-run inserts nothing. No randomness; time from ctx.clock.
 * - Owner: the first admin account (by role), like the base pool.
 *
 * Order: registered right after `questions-pool`, so before `spm-subject-configs` / `spm`. That keeps every earlier question
 * id where it was (this module creates questions after all earlier creators, and no later module creates questions), and the
 * SPM seed builds its sets from the SPM pool, which holds no Darjah question. Production: refused like every demo module
 * (the runner skips it without ALLOW_DEMO_SEED, and a direct call throws).
 */
import { QuestionPartSchema, type QuestionPart } from '@pp/contract'

import { assertSeedAllowed } from '../guard'
import type { SeedContext, SeedModule } from '../index'
import { json, loadTags, type Tag } from './index'
import { toPart } from './pool'
import {
  PRIMARY_LEVELS, PRIMARY_SUBJECTS, primaryItems, primaryRef,
  type PrimaryLevel, type PrimarySubject,
} from './pool-content-primary'

type McqPart = Extract<QuestionPart, { mode: 'mcq' }>

export interface PrimarySpec {
  ref: string
  subject: PrimarySubject
  level: PrimaryLevel
  /** 0-based position within the subject and level. */
  index: number
  text: string
  part: QuestionPart
  difficultyTp: number
  cognitiveLevel: number
}

/** Every question of the primary pool in seed order (subject, then level, then index). Pure. */
export function primarySpecs(): PrimarySpec[] {
  const out: PrimarySpec[] = []
  for (const subject of PRIMARY_SUBJECTS) {
    for (const level of PRIMARY_LEVELS) {
      primaryItems(subject, level).forEach((it, index) => {
        out.push({
          ref: primaryRef(subject, level, index),
          subject,
          level,
          index,
          text: it.text,
          part: toPart(it),
          difficultyTp: (index % 4) + 1,
          cognitiveLevel: (index % 3) + 1,
        })
      })
    }
  }
  return out
}

export const questionPoolPrimarySeed: SeedModule = {
  name: 'questions-pool-primary',
  kind: 'demo',
  profiles: ['poc'],
  async run(ctx: SeedContext) {
    assertSeedAllowed()
    const specs = primarySpecs()
    // Validate every tree first: a bad definition must not leave half a pool behind.
    for (const s of specs) QuestionPartSchema.parse(s.part)
    const now = ctx.clock.now()

    await ctx.prisma.$transaction(
      async (tx) => {
        const existing = new Set(
          (await tx.questionVersion.findMany({ where: { numberLabel: { startsWith: 'SEED-PRIM-' } }, select: { numberLabel: true } })).map(
            (v) => v.numberLabel,
          ),
        )
        if (specs.every((s) => existing.has(s.ref))) return

        const levels = new Map((await tx.educationLevel.findMany()).map((l) => [l.code, l.id]))
        const subjects = new Map((await tx.subject.findMany()).map((s) => [s.code, s.id]))
        const admin = (await tx.userRole.findFirst({ where: { role: 'admin' }, orderBy: { userId: 'asc' } }))?.userId
        if (admin === undefined) throw new Error('questions-pool-primary seed: the identity seed must run first (needs an admin account).')

        // Batched on purpose: one multi-row insert per table instead of ~10 statements per question (about 3 s for the
        // 384 rows), because the whole seed runs inside several specs with a 30 s limit. The result is the same rows
        // as writing them one by one: ids are serial and assigned in VALUES order, and the order is subject, level, index.
        const missing: { spec: PrimarySpec; subjectId: bigint; levelId: bigint; tag: Tag | undefined }[] = []
        for (const subject of PRIMARY_SUBJECTS) {
          for (const level of PRIMARY_LEVELS) {
            const subjectId = subjects.get(subject)
            const levelId = levels.get(level)
            if (subjectId === undefined || levelId === undefined) {
              throw new Error(`questions-pool-primary seed: ${subject} or ${level} missing; run the curriculum seed first.`)
            }
            // Empty today (no Darjah DSKP nodes in the curriculum seed): the rows are then written without unit and SP.
            const tags = await loadTags(tx, subjectId, levelId)
            for (const s of specs.filter((x) => x.subject === subject && x.level === level)) {
              if (existing.has(s.ref)) continue
              missing.push({ spec: s, subjectId, levelId, tag: tags.length > 0 ? (tags[s.index % tags.length] as Tag) : undefined })
            }
          }
        }

        const byId = <T extends { id: bigint }>(rows: T[], n: number, what: string): T[] => {
          if (rows.length !== n) throw new Error(`questions-pool-primary seed: inserted ${rows.length} ${what}, expected ${n}.`)
          return [...rows].sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0))
        }
        const questions = byId(
          await tx.question.createManyAndReturn({
            data: missing.map(() => ({
              sourceType: 'manual', createdById: admin, latestVersionNo: 1, liveVersionNo: 1, isActive: true, createdAt: now, updatedAt: now,
            })),
            select: { id: true },
          }),
          missing.length,
          'questions',
        )
        const versions = await tx.questionVersion.createManyAndReturn({
          data: missing.map((m, i) => ({
            questionId: (questions[i] as { id: bigint }).id, versionNo: 1, status: 'published', publishedAt: now,
            type: 'mcq', stemMs: m.spec.text, numberLabel: m.spec.ref, language: 'ms',
            subjectId: m.subjectId, educationLevelId: m.levelId, unitNodeId: m.tag?.unitNodeId ?? null, formOrigin: 't1_t3',
            cognitiveLevel: m.spec.cognitiveLevel, difficultyTp: m.spec.difficultyTp,
            sourceKind: 'publisher', rightsStatus: 'own', createdAt: now, updatedAt: now,
          })),
          select: { id: true, numberLabel: true },
        })
        if (versions.length !== missing.length) throw new Error('questions-pool-primary seed: version insert count mismatch.')
        const versionOf = new Map(versions.map((v) => [v.numberLabel, v.id]))
        const versionIds = missing.map((m) => versionOf.get(m.spec.ref) as bigint)

        const spRows = missing.flatMap((m, i) => (m.tag ? [{ questionVersionId: versionIds[i] as bigint, nodeId: m.tag.spNodeId, createdAt: now }] : []))
        if (spRows.length > 0) await tx.questionVersionSpNode.createMany({ data: spRows })

        // Every item is one leaf MCQ part, written exactly as `writePart` writes it (position 1, depth 1, no parent).
        const parts = await tx.questionPart.createManyAndReturn({
          data: missing.map((m, i) => {
            const part = m.spec.part as McqPart
            return {
              questionVersionId: versionIds[i] as bigint, parentPartId: null, position: 1, depth: 1, label: part.label,
              promptMs: part.prompt.ms, promptEn: part.prompt.en ?? null, marks: part.marks, mode: part.mode,
              blankCount: null, wordMin: null, wordMax: null, reveal: part.reveal ?? 'after_submit',
            }
          }),
          select: { id: true, questionVersionId: true },
        })
        if (parts.length !== missing.length) throw new Error('questions-pool-primary seed: part insert count mismatch.')
        const partOf = new Map(parts.map((p) => [p.questionVersionId, p.id]))
        const partIds = versionIds.map((v) => partOf.get(v) as bigint)
        await tx.partOption.createMany({
          data: missing.flatMap((m, i) =>
            (m.spec.part as McqPart).options.map((o, k) => ({
              partId: partIds[i] as bigint, label: o.label, bodyMs: o.body.ms, bodyEn: o.body.en ?? null, position: k + 1,
            })),
          ),
        })
        await tx.answerKey.createMany({
          data: missing.map((m, i) => ({ partId: partIds[i] as bigint, kind: (m.spec.part as McqPart).key.kind, content: json((m.spec.part as McqPart).key) })),
        })
      },
      { timeout: 120_000, maxWait: 20_000 },
    )
  },
}
