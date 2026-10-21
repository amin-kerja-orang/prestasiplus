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
 * - Stem = the full question text (the battle arena and the games show the stem), same text as the part prompt.
 * - Owner: the first admin account (by role). Natural key `question_versions.number_label` = `SEED-POOL-<S>-<L>-<NN>`;
 *   an existing row is never updated, so a re-run inserts nothing. No randomness; time from ctx.clock.
 *
 * Inserted just before `spm` (BE-41), whose demo Tracking sets read the SPM pool: they see the pool on the first run,
 * so a second run stays a no-op. No existing entry moves and no row of another module changes id.
 * Production: refused like every demo module (the runner skips it without ALLOW_DEMO_SEED, and a direct
 * call throws).
 */
import { QuestionPartSchema, type QuestionPart } from '@pp/contract'

import { assertSeedAllowed } from '../guard'
import type { SeedContext, SeedModule } from '../index'
import { loadTags, writePart } from './index'
import { POOL_LEVELS, POOL_SUBJECTS, poolItems, poolRef, type PoolItem, type PoolLevel, type PoolSubject } from './pool-content'

export interface PoolSpec {
  ref: string
  subject: PoolSubject
  level: PoolLevel
  /** 0-based position within the subject and level. */
  index: number
  text: string
  part: QuestionPart
  difficultyTp: number
  cognitiveLevel: number
}

const LABELS = ['A', 'B', 'C', 'D'] as const

function toPart(it: PoolItem): QuestionPart {
  return {
    label: '1',
    prompt: { ms: it.text },
    mode: 'mcq',
    marks: 1,
    options: it.options.map((body, i) => ({ label: LABELS[i] as string, body: { ms: body } })),
    key: { kind: 'option', correct: LABELS[it.correct] as string },
  }
}

/** Every question of the pool in seed order (subject, then level, then index). Pure. */
export function poolSpecs(): PoolSpec[] {
  const out: PoolSpec[] = []
  for (const subject of POOL_SUBJECTS) {
    for (const level of POOL_LEVELS) {
      poolItems(subject, level).forEach((it, index) => {
        out.push({
          ref: poolRef(subject, level, index),
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

        for (const subject of POOL_SUBJECTS) {
          for (const level of POOL_LEVELS) {
            const subjectId = subjects.get(subject)
            const levelId = levels.get(level)
            if (subjectId === undefined || levelId === undefined) throw new Error(`questions-pool seed: ${subject} or ${level} missing; run the curriculum seed first.`)
            const tags = await loadTags(tx, subjectId, levelId)
            if (tags.length === 0) throw new Error(`questions-pool seed: no DSKP unit/SP for ${subject}|${level}.`)

            for (const s of specs.filter((x) => x.subject === subject && x.level === level)) {
              if (existing.has(s.ref)) continue
              const tag = tags[s.index % tags.length] as (typeof tags)[number]
              const question = await tx.question.create({
                data: {
                  sourceType: 'manual', createdById: admin, latestVersionNo: 1, liveVersionNo: 1,
                  isActive: true, createdAt: now, updatedAt: now,
                },
              })
              const version = await tx.questionVersion.create({
                data: {
                  questionId: question.id, versionNo: 1, status: 'published', publishedAt: now,
                  type: 'mcq', stemMs: s.text, numberLabel: s.ref, language: 'ms',
                  subjectId, educationLevelId: levelId, unitNodeId: tag.unitNodeId, formOrigin: level === 'T5' ? 't5' : 't4',
                  cognitiveLevel: s.cognitiveLevel, difficultyTp: s.difficultyTp,
                  sourceKind: 'publisher', rightsStatus: 'own', createdAt: now, updatedAt: now,
                },
              })
              await tx.questionVersionSpNode.create({ data: { questionVersionId: version.id, nodeId: tag.spNodeId, createdAt: now } })
              await writePart(tx, version.id, s.part, 1, null, 1)
              await tx.questionTag.create({ data: { questionId: question.id, kind: 'pool', code: 'spm', createdAt: now } })
            }
          }
        }
      },
      { timeout: 120_000, maxWait: 20_000 },
    )
  },
}
