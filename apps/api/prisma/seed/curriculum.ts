/**
 * Curriculum seed (BE-08): levels, subjects, the subject-level pivot, the chapter tree, the learner
 * catalogue and the DSKP node tree with its TP descriptors.
 *
 * Sources (never `src/**` of the frontend): the JSON snapshots in `curriculum-data/` (the M03 mock
 * fixture exported once to compact JSON: public curriculum data observed on the live site, no
 * personal data) and the packaged DSKP extracts (`src/modules/curriculum/dskp/data/*.json`, a copy of
 * `docs/reference/dskp`) for the DSKP nodes; the DSKP part runs the same code as `npm run dskp:load`.
 *
 * Idempotent and safe next to loaded rows (plan 14.9 item 4): rows are matched by natural key and
 * only the missing ones are inserted; existing rows are never updated or deleted, so an admin edit
 * of a non-key column survives a re-run. Editing a natural key (a level or subject code, a chapter
 * or topic number or name) is not protected: the next run inserts the original row again beside the
 * edited one. `legacy_*` is never set. Ids come from the identity columns.
 */
import { readFileSync } from 'node:fs'

import { z } from 'zod'

import type { PrismaClient } from '../../src/db/client'
import { applyDskpExtract, DSKP_FILES, DSKP_ONLY_SUBJECTS, readDskpSources } from '../../src/modules/curriculum/dskp/dskp-load'
import type { DskpExtract } from '../../src/modules/curriculum/dskp/dskp-loader'
import { deriveSubjectLevelPairs } from '../../src/modules/curriculum/rules'
import type { SeedModule } from './index'

const DATA_DIR = new URL('./curriculum-data/', import.meta.url)
/** Rows per `createMany` (the pg driver allows 65,535 bind parameters per statement). */
const BATCH = 1000

const readJson = (dir: URL, name: string): unknown => JSON.parse(readFileSync(new URL(name, dir), 'utf8'))

const nullableText = z.string().nullable()
const levelRow = z.object({
  code: z.string(), name: z.string(), nameEn: z.string(), stage: z.string(), curriculum: z.string(),
  order: z.number().int(), grade: z.number().int().nullable(), isActive: z.boolean(),
})
const subjectRow = z.object({
  code: z.string(), name: z.string(), nameEn: z.string(), icon: nullableText, color: z.string(),
  isCore: z.boolean(), order: z.number().int(), isActive: z.boolean(),
})
const chapterRow = z.object({
  ref: z.number().int(), subject: z.string(), level: nullableText, name: nullableText, nameEn: nullableText,
  chapterNumber: z.number().int().nullable(), description: nullableText, inTree: z.boolean(),
})
const topicRow = z.object({
  ref: z.number().int(), chapter: z.number().int(), name: z.string(), nameEn: nullableText,
  topicNumber: nullableText, description: nullableText, learningStandard: nullableText,
})
const subtopicRow = z.object({ topic: z.number().int(), name: z.string(), nameEn: nullableText, learningObjective: nullableText })
const legacyTopicRow = z.object({
  ref: z.number().int(), gradeLevel: z.string(), subject: z.string(), name: z.string(),
  description: nullableText, icon: nullableText, sequence: z.number().int(),
})
const legacySubtopicRow = z.object({ topic: z.number().int(), name: z.string(), description: nullableText, order: z.number().int() })

export interface CurriculumSnapshot {
  levels: z.infer<typeof levelRow>[]
  subjects: z.infer<typeof subjectRow>[]
  /** `[subject code, level code]`. */
  subjectLevels: [string, string][]
  chapters: z.infer<typeof chapterRow>[]
  topics: z.infer<typeof topicRow>[]
  subtopics: z.infer<typeof subtopicRow>[]
  legacyTopics: z.infer<typeof legacyTopicRow>[]
  legacySubtopics: z.infer<typeof legacySubtopicRow>[]
}

/** Reads the JSON snapshots (also used by the tests to compare counts with the database). */
export function loadSnapshot(): CurriculumSnapshot {
  return {
    levels: z.array(levelRow).parse(readJson(DATA_DIR, 'levels.json')),
    subjects: z.array(subjectRow).parse(readJson(DATA_DIR, 'subjects.json')),
    subjectLevels: z.array(z.tuple([z.string(), z.string()])).parse(readJson(DATA_DIR, 'subject-levels.json')),
    chapters: z.array(chapterRow).parse(readJson(DATA_DIR, 'chapters.json')),
    topics: z.array(topicRow).parse(readJson(DATA_DIR, 'topics.json')),
    subtopics: z.array(subtopicRow).parse(readJson(DATA_DIR, 'subtopics.json')),
    legacyTopics: z.array(legacyTopicRow).parse(readJson(DATA_DIR, 'legacy-topics.json')),
    legacySubtopics: z.array(legacySubtopicRow).parse(readJson(DATA_DIR, 'legacy-subtopics.json')),
  }
}

// The file list, the DSKP-only subjects and the writer live in the API module (R1-B04); re-exported for the specs.
export { DSKP_FILES, DSKP_ONLY_SUBJECTS }

/** Reads and parses every packaged DSKP extract (throws on a file that does not have the extract shape). */
export function loadDskp(): { subject: string; file: string; extract: DskpExtract }[] {
  const sources = readDskpSources()
  return DSKP_FILES.map(({ file, subject }) => {
    const source = sources.find((s) => s.file === file)
    if (!source?.extract) throw new Error(`DSKP extract ${file}: ${source?.error ?? 'missing from the packaged data'}`)
    return { subject, file, extract: source.extract }
  })
}

const chunks = <T>(rows: T[], size = BATCH): T[][] => {
  const out: T[][] = []
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size))
  return out
}

const key = (...parts: (string | number | bigint | null)[]): string => parts.map((p) => (p === null ? '\u0000' : String(p))).join('\u0001')

type Tx = Pick<
  PrismaClient,
  | 'educationLevel' | 'subject' | 'subjectLevel' | 'chapter' | 'topic' | 'subtopic'
  | 'legacyTopic' | 'legacySubtopic' | 'curriculumNode' | 'curriculumTpDescriptor'
>

async function seedReference(db: Tx, snap: CurriculumSnapshot, now: Date) {
  await db.educationLevel.createMany({
    data: snap.levels.map((l) => ({
      code: l.code, name: l.name, nameEn: l.nameEn, stage: l.stage, curriculum: l.curriculum,
      sortOrder: l.order, isActive: l.isActive, grade: l.grade, createdAt: now, updatedAt: now,
    })),
    skipDuplicates: true,
  })
  // Secondary-only (2026-10-29): the Darjah levels are hidden (inactive), never deleted. createMany skips an existing row,
  // so an already-seeded database is brought in line here; only rows still active are touched (a re-run is a no-op).
  const hidden = snap.levels.filter((l) => !l.isActive).map((l) => l.code)
  if (hidden.length > 0) await db.educationLevel.updateMany({ where: { code: { in: hidden }, isActive: true }, data: { isActive: false, updatedAt: now } })
  await db.subject.createMany({
    data: [...snap.subjects, ...DSKP_ONLY_SUBJECTS].map((s) => ({
      code: s.code, name: s.name, nameEn: s.nameEn, icon: s.icon, color: s.color,
      isCore: s.isCore, sortOrder: s.order, isActive: s.isActive, createdAt: now, updatedAt: now,
    })),
    skipDuplicates: true,
  })
  const levels = new Map((await db.educationLevel.findMany()).map((l) => [l.code, l.id]))
  const subjects = new Map((await db.subject.findMany()).map((s) => [s.code, s.id]))
  const id = (m: Map<string, bigint>, code: string, what: string): bigint => {
    const v = m.get(code)
    if (v === undefined) throw new Error(`curriculum seed: unknown ${what} code "${code}"`)
    return v
  }

  // Pivot: the observed links, plus the pairs the chapters derive (a no-op on the observed data).
  const chapterPairs = deriveSubjectLevelPairs(
    snap.chapters.map((c) => ({
      subjectId: id(subjects, c.subject, 'subject'),
      educationLevelId: c.level === null ? null : id(levels, c.level, 'level'),
      inTree: c.inTree,
    })),
  )
  const pairs = new Map<string, [bigint, bigint]>()
  for (const [s, l] of snap.subjectLevels) pairs.set(key(s, l), [id(subjects, s, 'subject'), id(levels, l, 'level')])
  for (const [s, l] of chapterPairs) pairs.set(key(s, l), [s, l])
  await db.subjectLevel.createMany({
    data: [...pairs.values()].map(([subjectId, educationLevelId]) => ({ subjectId, educationLevelId })),
    skipDuplicates: true,
  })
  return { levels, subjects }
}

async function seedTree(db: Tx, snap: CurriculumSnapshot, now: Date, levels: Map<string, bigint>, subjects: Map<string, bigint>) {
  const sid = (code: string) => subjects.get(code) as bigint
  const lid = (code: string | null) => (code === null ? null : (levels.get(code) as bigint))

  // Chapters: in-tree rows by (subject, level, number, name); the out-of-tree rows have no natural
  // key, so only the shortfall per subject is inserted.
  const existing = await db.chapter.findMany({ select: { subjectId: true, educationLevelId: true, chapterNumber: true, name: true, inTree: true } })
  const have = new Set(existing.filter((c) => c.inTree).map((c) => key(c.subjectId, c.educationLevelId, c.chapterNumber, c.name)))
  const orphansHave = new Map<bigint, number>()
  for (const c of existing) if (!c.inTree) orphansHave.set(c.subjectId, (orphansHave.get(c.subjectId) ?? 0) + 1)
  const orphansSeen = new Map<bigint, number>()
  const missing = snap.chapters.filter((c) => {
    if (c.inTree) return !have.has(key(sid(c.subject), lid(c.level), c.chapterNumber, c.name))
    const n = (orphansSeen.get(sid(c.subject)) ?? 0) + 1
    orphansSeen.set(sid(c.subject), n)
    return n > (orphansHave.get(sid(c.subject)) ?? 0)
  })
  for (const batch of chunks(missing)) {
    await db.chapter.createMany({
      data: batch.map((c) => ({
        subjectId: sid(c.subject), educationLevelId: lid(c.level), name: c.name, nameEn: c.nameEn,
        chapterNumber: c.chapterNumber, description: c.description, inTree: c.inTree, createdAt: now, updatedAt: now,
      })),
    })
  }
  // Snapshot chapter ref -> database id, through the natural key of the in-tree rows.
  const chapterIds = new Map<string, bigint>()
  for (const c of await db.chapter.findMany({ where: { inTree: true }, select: { id: true, subjectId: true, educationLevelId: true, chapterNumber: true, name: true } })) {
    chapterIds.set(key(c.subjectId, c.educationLevelId, c.chapterNumber, c.name), c.id)
  }
  const chapterOf = new Map<number, bigint>()
  for (const c of snap.chapters) {
    if (!c.inTree) continue
    const dbId = chapterIds.get(key(sid(c.subject), lid(c.level), c.chapterNumber, c.name))
    if (dbId !== undefined) chapterOf.set(c.ref, dbId)
  }

  const haveTopics = new Set((await db.topic.findMany({ select: { chapterId: true, topicNumber: true, name: true } })).map((t) => key(t.chapterId, t.topicNumber, t.name)))
  const newTopics = snap.topics.filter((t) => {
    const chapterId = chapterOf.get(t.chapter)
    return chapterId !== undefined && !haveTopics.has(key(chapterId, t.topicNumber, t.name))
  })
  for (const batch of chunks(newTopics)) {
    await db.topic.createMany({
      data: batch.map((t) => ({
        chapterId: chapterOf.get(t.chapter) as bigint, name: t.name, nameEn: t.nameEn, topicNumber: t.topicNumber,
        description: t.description, learningStandard: t.learningStandard, createdAt: now, updatedAt: now,
      })),
    })
  }
  const topicIds = new Map<string, bigint>()
  for (const t of await db.topic.findMany({ select: { id: true, chapterId: true, topicNumber: true, name: true } })) {
    topicIds.set(key(t.chapterId, t.topicNumber, t.name), t.id)
  }
  const topicOf = new Map<number, bigint>()
  for (const t of snap.topics) {
    const chapterId = chapterOf.get(t.chapter)
    const dbId = chapterId === undefined ? undefined : topicIds.get(key(chapterId, t.topicNumber, t.name))
    if (dbId !== undefined) topicOf.set(t.ref, dbId)
  }

  const haveSubs = new Set((await db.subtopic.findMany({ select: { topicId: true, name: true } })).map((s) => key(s.topicId, s.name)))
  const newSubs = snap.subtopics.filter((s) => {
    const topicId = topicOf.get(s.topic)
    return topicId !== undefined && !haveSubs.has(key(topicId, s.name))
  })
  for (const batch of chunks(newSubs)) {
    await db.subtopic.createMany({
      data: batch.map((s) => ({
        topicId: topicOf.get(s.topic) as bigint, name: s.name, nameEn: s.nameEn, learningObjective: s.learningObjective,
        createdAt: now, updatedAt: now,
      })),
    })
  }
}

async function seedLearnerCatalogue(db: Tx, snap: CurriculumSnapshot) {
  const haveTopics = new Set((await db.legacyTopic.findMany({ select: { gradeLevel: true, subject: true, name: true } })).map((t) => key(t.gradeLevel, t.subject, t.name)))
  const newTopics = snap.legacyTopics.filter((t) => !haveTopics.has(key(t.gradeLevel, t.subject, t.name)))
  for (const batch of chunks(newTopics)) {
    await db.legacyTopic.createMany({
      data: batch.map((t) => ({ gradeLevel: t.gradeLevel, subject: t.subject, name: t.name, description: t.description, icon: t.icon, sequence: t.sequence })),
    })
  }
  const topicIds = new Map<string, bigint>()
  for (const t of await db.legacyTopic.findMany({ select: { id: true, gradeLevel: true, subject: true, name: true } })) {
    topicIds.set(key(t.gradeLevel, t.subject, t.name), t.id)
  }
  const refToId = new Map<number, bigint>()
  for (const t of snap.legacyTopics) {
    const dbId = topicIds.get(key(t.gradeLevel, t.subject, t.name))
    if (dbId !== undefined) refToId.set(t.ref, dbId)
  }
  const haveSubs = new Set((await db.legacySubtopic.findMany({ select: { legacyTopicId: true, name: true } })).map((s) => key(s.legacyTopicId, s.name)))
  const newSubs = snap.legacySubtopics.filter((s) => {
    const topicId = refToId.get(s.topic)
    return topicId !== undefined && !haveSubs.has(key(topicId, s.name))
  })
  for (const batch of chunks(newSubs)) {
    await db.legacySubtopic.createMany({
      data: batch.map((s) => ({ legacyTopicId: refToId.get(s.topic) as bigint, name: s.name, description: s.description, sortOrder: s.order })),
    })
  }
}

/** The DSKP tree goes through the same code as `npm run dskp:load` (R1-B04): `applyDskpExtract`. */
async function seedDskp(
  db: Tx,
  dskp: ReturnType<typeof loadDskp>,
  now: Date,
  levels: Map<string, bigint>,
  subjects: Map<string, bigint>,
) {
  for (const { subject, extract } of dskp) {
    await applyDskpExtract(db, { subjectId: subjects.get(subject) as bigint, extract, levels, now, dryRun: false })
  }
}

export const curriculumSeed: SeedModule = {
  name: 'curriculum',
  async run(ctx) {
    // Read and validate every source first: a bad file must not leave half a curriculum behind.
    const snap = loadSnapshot()
    const dskp = loadDskp()
    const now = ctx.clock.now()
    // One transaction: all of the curriculum or nothing (a failing seed never leaves partial data).
    await ctx.prisma.$transaction(
      async (tx) => {
        const { levels, subjects } = await seedReference(tx, snap, now)
        await seedTree(tx, snap, now, levels, subjects)
        await seedLearnerCatalogue(tx, snap)
        await seedDskp(tx, dskp, now, levels, subjects)
      },
      { timeout: 120_000, maxWait: 20_000 },
    )
  },
}
