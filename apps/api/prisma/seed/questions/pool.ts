/**
 * PoC question pool (BE-09 owner seed path, kind `demo`, profile `poc` only). Demo blocker from the full-demo
 * walkthrough (PR #88): the base bank holds at most 3 published MCQs per subject and level, below every draw size.
 *
 * Seed facts (pinned by test/seed/question-pool.spec.ts):
 * - POOL_PER_LEVEL (24) published, active, single-part MCQs for each subject of POOL_SUBJECTS at Tingkatan 4 and 5:
 *   10 subjects x 2 levels x 24 = 480 questions, one version each (version_no 1, live_version_no 1).
 * - Every row carries the full curriculum tag of the publish gate: subject, level, a DSKP unit and one SP under it
 *   (round robin over the units of the subject and level, like the base seed), difficulty TP and cognitive level.
 *   That is why the pool covers only subjects with DSKP units at both levels; the others stay empty.
 * - Difficulty TP cycles 1, 2, 3, 4 (6 of each per subject and level), so Jutawan finds its 4/4/4/3 ladder.
 * - Every row is in the SPM pool (`question_tags` kind `pool`, code `spm`): 48 per subject.
 * - AZ-02 (demo 23 Oct): PRIMARY_PER_LEVEL (24) more for each subject of PRIMARY_SUBJECTS at Darjah 1 to 4 (8 x 4 x 24 =
 *   768), for practice `random` (BR-11 offers D1 to D4 only), Jutawan Ilmu and the solo games (pupil's level; Kad Memori
 *   over D1 to D4). Published, active, single-part MCQ, difficulty TP 1 to 4 and cognitive level like the Tingkatan rows,
 *   but NOT in the SPM pool and WITHOUT a DSKP unit or SP: the curriculum has no DSKP nodes below Tingkatan 4, so these
 *   rows are untagged like the base seed's untagged rows (practice and the games do not read the tag; the publish gate
 *   applies to API writes, not to this seed). `form_origin` is `t1_t3`, as the questions module sets it below T4.
 *   They are inserted AFTER every Tingkatan row, so no Tingkatan pool id moves, and a re-run on a database seeded
 *   before AZ-02 inserts only the Darjah rows.
 * - Stem = the full question text (the battle arena and the games show the stem), same text as the part prompt.
 * - Owner: the first admin account (by role). Natural key `question_versions.number_label` = `SEED-POOL-<S>-<L>-<NN>`;
 *   an existing row is never updated, so a re-run inserts nothing. No randomness; time from ctx.clock.
 *
 * Runs after `poc-performance` and BEFORE `spm-subject-configs` / `spm`: the SPM seed builds its Tracking A sets from the
 * SPM pool once per subject, so the pool must exist on the first run or a re-run would add sets. No later module creates
 * questions, so no question id of an earlier module moves. Production: refused like every demo module (the runner skips it without ALLOW_DEMO_SEED, and a direct
 * call throws).
 */
import { QuestionPartSchema, type QuestionPart } from '@pp/contract'

import { assertSeedAllowed } from '../guard'
import type { SeedContext, SeedModule } from '../index'
import type { Prisma } from '../../../src/db/generated/client'
import { loadTags } from './index'
import { POOL_LEVELS, POOL_SUBJECTS, poolItems, poolRef, type PoolItem, type PoolLevel, type PoolSubject } from './pool-content'
import { PRIMARY_LEVELS, PRIMARY_SUBJECTS, primaryItems, type PrimaryLevel, type PrimarySubject } from './pool-content-primary'

export interface PoolSpec {
  ref: string
  subject: PoolSubject | PrimarySubject
  level: PoolLevel | PrimaryLevel
  /** Tingkatan rows: DSKP unit + SP tag and the SPM pool tag. Darjah rows: neither (no DSKP nodes below Tingkatan 4). */
  tingkatan: boolean
  /** 0-based position within the subject and level. */
  index: number
  text: string
  part: McqPart
  difficultyTp: number
  cognitiveLevel: number
}

const LABELS = ['A', 'B', 'C', 'D'] as const

/** A single-part MCQ leaf: what `writePart` (./index) writes for one, here in batches. */
type McqPart = Extract<QuestionPart, { mode: 'mcq' }>

function toPart(it: PoolItem): McqPart {
  return {
    label: '1',
    prompt: { ms: it.text },
    mode: 'mcq',
    marks: 1,
    options: it.options.map((body, i) => ({ label: LABELS[i] as string, body: { ms: body } })),
    key: { kind: 'option', correct: LABELS[it.correct] as string },
  }
}

function specsOf(subject: PoolSubject | PrimarySubject, level: PoolLevel | PrimaryLevel, items: PoolItem[], tingkatan: boolean): PoolSpec[] {
  return items.map((it, index) => ({
    ref: poolRef(subject, level, index),
    subject,
    level,
    tingkatan,
    index,
    text: it.text,
    part: toPart(it),
    difficultyTp: (index % 4) + 1,
    cognitiveLevel: (index % 3) + 1,
  }))
}

/**
 * Every question of the pool in seed order: the Tingkatan part (subject, then level, then index), then the Darjah part
 * (AZ-02, same order). Pure.
 */
export function poolSpecs(): PoolSpec[] {
  const out: PoolSpec[] = []
  for (const subject of POOL_SUBJECTS) for (const level of POOL_LEVELS) out.push(...specsOf(subject, level, poolItems(subject, level), true))
  for (const subject of PRIMARY_SUBJECTS) for (const level of PRIMARY_LEVELS) out.push(...specsOf(subject, level, primaryItems(subject, level), false))
  return out
}

export const questionPoolSeed: SeedModule = {
  name: 'questions-pool',
  kind: 'demo',
  profiles: ['poc'],
  async run(ctx: SeedContext) {
    assertSeedAllowed()
    const specs = poolSpecs()
    // Validate every tree first: a bad definition must not leave half a pool behind.
    for (const s of specs) QuestionPartSchema.parse(s.part)
    const now = ctx.clock.now()

    await ctx.prisma.$transaction(
      async (tx) => {
        const existing = new Set(
          (await tx.questionVersion.findMany({ where: { numberLabel: { startsWith: 'SEED-POOL-' } }, select: { numberLabel: true } })).map(
            (v) => v.numberLabel,
          ),
        )
        if (specs.every((s) => existing.has(s.ref))) return

        const levels = new Map((await tx.educationLevel.findMany()).map((l) => [l.code, l.id]))
        const subjects = new Map((await tx.subject.findMany()).map((s) => [s.code, s.id]))
        const admin = (await tx.userRole.findFirst({ where: { role: 'admin' }, orderBy: { userId: 'asc' } }))?.userId
        if (admin === undefined) throw new Error('questions-pool seed: the identity seed must run first (needs an admin account).')

        // Grouped by subject and level in seed order (Tingkatan groups first, then Darjah).
        const groups = new Map<string, PoolSpec[]>()
        for (const s of specs) {
          const k = `${s.subject}|${s.level}`
          groups.set(k, [...(groups.get(k) ?? []), s])
        }
        for (const group of groups.values()) {
          const { subject, level, tingkatan } = group[0] as PoolSpec
          if (group.every((s) => existing.has(s.ref))) continue
          const subjectId = subjects.get(subject)
          const levelId = levels.get(level)
          if (subjectId === undefined || levelId === undefined) throw new Error(`questions-pool seed: ${subject} or ${level} missing; run the curriculum seed first.`)
          const tags = tingkatan ? await loadTags(tx, subjectId, levelId) : []
          if (tingkatan && tags.length === 0) throw new Error(`questions-pool seed: no DSKP unit/SP for ${subject}|${level}.`)

          // One query per table for the group (AZ-02: 1,248 rows one by one made the full seed slow). Rows are written
          // exactly as `writePart` (./index) writes a single-part MCQ; identity ids follow the input order, as before.
          const todo = group.filter((s) => !existing.has(s.ref))
          const questionIds = (
            await tx.question.createManyAndReturn({
              data: todo.map(() => ({
                sourceType: 'manual', createdById: admin, latestVersionNo: 1, liveVersionNo: 1, isActive: true, createdAt: now, updatedAt: now,
              })),
              select: { id: true },
            })
          )
            .map((q) => q.id)
            .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
          const pick = (s: PoolSpec) => (tingkatan ? (tags[s.index % tags.length] as (typeof tags)[number]) : null)
          const versions = await tx.questionVersion.createManyAndReturn({
            data: todo.map((s, i) => ({
              questionId: questionIds[i] as bigint, versionNo: 1, status: 'published', publishedAt: now,
              type: 'mcq', stemMs: s.text, numberLabel: s.ref, language: 'ms',
              subjectId, educationLevelId: levelId, unitNodeId: pick(s)?.unitNodeId ?? null,
              // As `QuestionsService.formOriginOf`: T4, T5, else t1_t3 (Darjah rows included).
              formOrigin: level === 'T5' ? 't5' : level === 'T4' ? 't4' : 't1_t3',
              cognitiveLevel: s.cognitiveLevel, difficultyTp: s.difficultyTp,
              sourceKind: 'publisher', rightsStatus: 'own', createdAt: now, updatedAt: now,
            })),
            select: { id: true, numberLabel: true, questionId: true },
          })
          const versionOf = new Map(versions.map((v) => [v.numberLabel, v]))
          const ver = (s: PoolSpec) => versionOf.get(s.ref) as (typeof versions)[number]
          if (tingkatan) {
            await tx.questionVersionSpNode.createMany({
              data: todo.map((s) => ({ questionVersionId: ver(s).id, nodeId: (pick(s) as (typeof tags)[number]).spNodeId, createdAt: now })),
            })
          }
          const parts = await tx.questionPart.createManyAndReturn({
            data: todo.map((s) => ({
              questionVersionId: ver(s).id, parentPartId: null, position: 1, depth: 1, label: s.part.label,
              promptMs: s.part.prompt.ms, promptEn: s.part.prompt.en ?? null, marks: s.part.marks, mode: s.part.mode,
              blankCount: null, wordMin: null, wordMax: null, reveal: s.part.reveal ?? 'after_submit',
            })),
            select: { id: true, questionVersionId: true },
          })
          const partOf = new Map(parts.map((p) => [p.questionVersionId, p.id]))
          const part = (s: PoolSpec) => partOf.get(ver(s).id) as bigint
          await tx.partOption.createMany({
            data: todo.flatMap((s) =>
              s.part.options.map((o, i) => ({ partId: part(s), label: o.label, bodyMs: o.body.ms, bodyEn: o.body.en ?? null, position: i + 1 })),
            ),
          })
          await tx.answerKey.createMany({
            data: todo.map((s) => ({ partId: part(s), kind: s.part.key.kind, content: s.part.key as Prisma.InputJsonValue })),
          })
          if (tingkatan) {
            await tx.questionTag.createMany({ data: todo.map((s) => ({ questionId: ver(s).questionId, kind: 'pool', code: 'spm', createdAt: now })) })
          }
        }
      },
      { timeout: 120_000, maxWait: 20_000 },
    )
  },
}
