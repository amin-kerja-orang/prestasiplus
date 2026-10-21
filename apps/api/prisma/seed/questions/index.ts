/**
 * Question bank seed (BE-09, kind `demo`, runs after `curriculumSeed`).
 *
 * Seed facts (tests rely on them, see test/questions/seed.spec.ts):
 * - 19 questions, each with one version (version_no 1). 16 are `published` (live_version_no = 1, is_active
 *   true): 6 single MCQ (MATH, SCI, BM x T4, T5), 3 structured (3-level tree, ECF, "any N of M"), group
 *   SEED-GRP-PASAR (3 ordered members, one passage) and group SEED-GRP-AYAT (4 members, one passage,
 *   lettered option bank A to D, match_letter). Plus 1 `draft`, 1 `review`, 1 `archived` (reason `withdrawn`).
 * - Every published row carries the full curriculum tag (subject, level, unit, 1 SP, TP), so the
 *   publish gate holds. The draft and review rows only carry subject and level.
 * - Owners: `review` row belongs to the first teacher account; everything else to the first admin
 *   (both resolved by role from the identity seed). The teacher owns exactly one question.
 * - Natural key for idempotency: `question_versions.number_label` (prefix `SEED-`). Rows that exist
 *   are never updated or deleted; a re-run inserts nothing. This model has no legacy columns.
 * - Determinism: difficulty/cognitive level come from `ctx.prng('questions')` (drawn for every spec
 *   in a fixed order, even when the row exists), time from `ctx.clock`.
 */
import { QuestionPartSchema, type QuestionPart } from '@pp/contract'

import type { Prisma } from '../../../src/db/generated/client'
import type { TxClient } from '../../../src/db/client'
import type { SeedContext, SeedModule } from '../index'
import { SEED_GROUPS, SEED_QUESTIONS, SEED_STIMULI, type SeedQuestion } from './content'

export const json = (v: unknown): Prisma.InputJsonValue => v as Prisma.InputJsonValue

export interface Tag {
  unitNodeId: bigint
  spNodeId: bigint
}

/** First sp node under each unit of (subject, level), unit by unit in sort order. */
export async function loadTags(tx: TxClient, subjectId: bigint, levelId: bigint): Promise<Tag[]> {
  const nodes = await tx.curriculumNode.findMany({
    where: { subjectId, educationLevelId: levelId, kind: { in: ['unit', 'sk', 'sp'] } },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    select: { id: true, kind: true, parentId: true },
  })
  const skByUnit = new Map<bigint, bigint[]>()
  const spBySk = new Map<bigint, bigint[]>()
  for (const n of nodes) {
    if (n.parentId === null) continue
    const target = n.kind === 'sk' ? skByUnit : n.kind === 'sp' ? spBySk : undefined
    if (target) target.set(n.parentId, [...(target.get(n.parentId) ?? []), n.id])
  }
  const tags: Tag[] = []
  for (const unit of nodes.filter((n) => n.kind === 'unit')) {
    const sp = (skByUnit.get(unit.id) ?? []).flatMap((sk) => spBySk.get(sk) ?? [])[0]
    if (sp !== undefined) tags.push({ unitNodeId: unit.id, spNodeId: sp })
  }
  return tags
}

export async function writePart(
  tx: TxClient, versionId: bigint, part: QuestionPart, position: number, parentId: bigint | null, depth: number,
): Promise<void> {
  if ('children' in part) {
    const row = await tx.questionPart.create({
      data: {
        questionVersionId: versionId, parentPartId: parentId, position, depth, label: part.label,
        promptMs: part.prompt.ms, promptEn: part.prompt.en ?? null,
      },
    })
    for (const [i, child] of part.children.entries()) await writePart(tx, versionId, child, i + 1, row.id, depth + 1)
    return
  }
  const row = await tx.questionPart.create({
    data: {
      questionVersionId: versionId, parentPartId: parentId, position, depth, label: part.label,
      promptMs: part.prompt.ms, promptEn: part.prompt.en ?? null, marks: part.marks, mode: part.mode,
      blankCount: part.mode === 'short_text' ? (part.blankCount ?? null) : null,
      wordMin: part.mode === 'essay' ? (part.wordRange?.min ?? null) : null,
      wordMax: part.mode === 'essay' ? (part.wordRange?.max ?? null) : null,
      reveal: part.reveal ?? 'after_submit',
    },
  })
  if (part.mode === 'mcq') {
    await tx.partOption.createMany({
      data: part.options.map((o, i) => ({ partId: row.id, label: o.label, bodyMs: o.body.ms, bodyEn: o.body.en ?? null, position: i + 1 })),
    })
  }
  await tx.answerKey.create({ data: { partId: row.id, kind: part.key.kind, content: json(part.key) } })
}

export const questionsSeed: SeedModule = {
  name: 'questions',
  kind: 'demo',
  async run(ctx: SeedContext) {
    // Validate every tree first: a bad definition must not leave half a bank behind.
    for (const q of SEED_QUESTIONS) for (const p of q.parts) QuestionPartSchema.parse(p)

    const now = ctx.clock.now()
    const prng = ctx.prng('questions')
    // Drawn for every spec in order so the values do not depend on which rows already exist.
    const drawn = new Map<string, { tp: number; cognitive: number }>()
    for (const q of SEED_QUESTIONS) drawn.set(q.ref, { tp: prng.int(2, 5), cognitive: prng.int(1, 4) })

    await ctx.prisma.$transaction(
      async (tx) => {
        const levels = new Map((await tx.educationLevel.findMany()).map((l) => [l.code, l.id]))
        const subjects = new Map((await tx.subject.findMany()).map((s) => [s.code, s.id]))
        const owners = {
          admin: (await tx.userRole.findFirst({ where: { role: 'admin' }, orderBy: { userId: 'asc' } }))?.userId,
          teacher: (await tx.userRole.findFirst({ where: { role: 'teacher' }, orderBy: { userId: 'asc' } }))?.userId,
        }
        if (owners.admin === undefined || owners.teacher === undefined) {
          throw new Error('questions seed: the identity seed must run first (needs an admin and a teacher account).')
        }

        const tagCache = new Map<string, Tag[]>()
        const tagsFor = async (q: SeedQuestion): Promise<Tag[]> => {
          const k = `${q.subject}|${q.level}`
          let tags = tagCache.get(k)
          if (!tags) {
            tags = await loadTags(tx, subjects.get(q.subject) as bigint, levels.get(q.level) as bigint)
            tagCache.set(k, tags)
          }
          if (tags.length === 0) throw new Error(`questions seed: no DSKP unit/SP for ${k}; run the curriculum seed first.`)
          return tags
        }
        const used = new Map<string, number>()

        const stimulusIds = new Map<string, bigint>()
        for (const s of SEED_STIMULI) {
          const found = await tx.stimulus.findFirst({ where: { label: s.ref }, select: { id: true } })
          const id =
            found?.id ??
            (await tx.stimulus.create({ data: { kind: s.kind, label: s.ref, bodyMs: s.body, createdAt: now, updatedAt: now } })).id
          stimulusIds.set(s.ref, id)
        }
        const groupIds = new Map<string, bigint>()
        for (const g of SEED_GROUPS) {
          const found = await tx.stimulusGroup.findFirst({ where: { label: g.ref }, select: { id: true } })
          if (found) {
            groupIds.set(g.ref, found.id)
            continue
          }
          const group = await tx.stimulusGroup.create({ data: { label: g.ref, createdAt: now, updatedAt: now } })
          groupIds.set(g.ref, group.id)
          await tx.stimulusGroupStimulus.createMany({
            data: g.stimuli.map((ref, i) => ({ groupId: group.id, stimulusId: stimulusIds.get(ref) as bigint, position: i + 1, createdAt: now })),
          })
          if (g.optionBank) {
            await tx.stimulusGroupOption.createMany({
              data: g.optionBank.map((o, i) => ({ groupId: group.id, label: o.label, bodyMs: o.body, position: i + 1, createdAt: now })),
            })
          }
        }

        for (const q of SEED_QUESTIONS) {
          const k = `${q.subject}|${q.level}`
          const n = used.get(k) ?? 0
          used.set(k, n + 1) // counted for every spec, so the unit choice is stable across re-runs
          if (await tx.questionVersion.findFirst({ where: { numberLabel: q.ref }, select: { id: true } })) continue

          const draw = drawn.get(q.ref) as { tp: number; cognitive: number }
          const pool = q.tagged ? await tagsFor(q) : []
          const tag = pool[n % Math.max(pool.length, 1)]
          const published = q.status === 'published'
          const question = await tx.question.create({
            data: {
              sourceType: 'manual', createdById: owners[q.owner], latestVersionNo: 1, liveVersionNo: published ? 1 : null,
              groupId: q.group ? (groupIds.get(q.group.ref) as bigint) : null, groupPosition: q.group?.position ?? null,
              isActive: true, createdAt: now, updatedAt: now,
            },
          })
          const version = await tx.questionVersion.create({
            data: {
              questionId: question.id, versionNo: 1, status: q.status,
              archiveReason: q.status === 'archived' ? 'withdrawn' : null, publishedAt: published ? now : null,
              type: q.type, stemMs: q.stem, numberLabel: q.ref, language: 'ms',
              subjectId: subjects.get(q.subject) as bigint, educationLevelId: levels.get(q.level) as bigint,
              unitNodeId: tag?.unitNodeId ?? null, formOrigin: q.level === 'T5' ? 't5' : 't4',
              cognitiveLevel: q.tagged ? draw.cognitive : null, difficultyTp: q.tagged ? draw.tp : null,
              sourceKind: 'publisher', rightsStatus: 'own', createdAt: now, updatedAt: now,
            },
          })
          if (tag) await tx.questionVersionSpNode.create({ data: { questionVersionId: version.id, nodeId: tag.spNodeId, createdAt: now } })
          for (const [i, ref] of (q.stimuli ?? []).entries()) {
            await tx.questionVersionStimulus.create({
              data: { questionVersionId: version.id, stimulusId: stimulusIds.get(ref) as bigint, position: i + 1, createdAt: now },
            })
          }
          for (const [i, part] of q.parts.entries()) await writePart(tx, version.id, part, i + 1, null, 1)
          for (const code of q.pools ?? []) await tx.questionTag.create({ data: { questionId: question.id, kind: 'pool', code, createdAt: now } })
        }
      },
      { timeout: 120_000, maxWait: 20_000 },
    )
  },
}
