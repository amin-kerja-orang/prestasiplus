/**
 * The M03 curriculum repositories (D12, ADR-0014, overview §6.7): the only doorway to the
 * curriculum stores. Owner M03. Every write — M03's own seed and handlers included (overview §3
 * rule 3a) — goes through a method of `curriculum`; any other write throws `OWNERSHIP`.
 *
 * - `curriculum` — the domain contract (reads, writes, BR-19 topic progress, seed) and the chapter
 *   named queries (`CH-*`).
 * - `curriculumLevels`, `curriculumSubjects`, `curriculumSubjectLevels`, `curriculumTopics`,
 *   `curriculumSubtopics`, `legacyTopics`, `legacySubtopics` — the named count queries of the other
 *   stores (`LVL-*`, `SUBJ-*`, `LINK-*`, `TP-*`, `ST-*`, `LT-*`, `LS-*`), each typed to its own
 *   rows. They have no domain methods.
 *
 * Repository methods are synchronous (§6.7.1). Timestamps of runtime writes come from the caller
 * (`now`, epoch ms: the handler passes `ctx.clock.now()`), so the store stays a pure function of
 * its inputs.
 */

import { toIsoMyt } from '@/lib/time'
import type { SeedContext } from '@/mock/define'
import { defineRepository, RepositoryError } from '@/mock/repository'

import { answerLog } from './progress'
import {
  chapterQueries,
  legacySubtopicQueries,
  legacyTopicQueries,
  legacyTopicWhere,
  levelQueries,
  subjectLevelQueries,
  subjectQueries,
  subtopicQueries,
  topicQueries,
} from './queries'
import {
  byOrderThenId,
  chapterOrder,
  gradeOfCode,
  legacyTopicOrder,
  PRACTICE_CODE,
  progressPercent,
  SEED_TIMESTAMP,
  subtopicOrder,
  topicOrder,
} from './rules'
import {
  chaptersTable,
  legacySubtopicsTable,
  legacyTopicsTable,
  levelsTable,
  subjectLevelsTable,
  subjectsTable,
  subtopicsTable,
  topicsTable,
} from './stores'
import type {
  ChapterNode,
  ChapterRow,
  CurriculumFixture,
  EducationLevelRow,
  LearnerTopicProgress,
  LegacySubtopicRow,
  LegacyTopicRow,
  Stage,
  Subject,
  SubjectRow,
  SubtopicRow,
  TopicRow,
  TreeStats,
} from './types'

// ---------------------------------------------------------------------------------------------
// Write inputs (validated by the handler first: SRS §5 messages are the handler's job)
// ---------------------------------------------------------------------------------------------

export interface LevelInput {
  name: string
  nameEn: string
  code: string
  stage: Stage
  curriculum: string
  order: number
}

export interface SubjectInput {
  name: string
  nameEn: string
  code: string
  icon?: string | null
  color: string
  isCore: boolean
  order: number
  educationLevelIds: readonly number[]
}

export interface ChapterInput {
  subjectId: number
  educationLevelId: number
  name: string
  nameEn?: string | null
  chapterNumber?: number | null
  description?: string | null
}

export interface TopicInput {
  chapterId: number
  name: string
  nameEn?: string | null
  topicNumber?: string | null
  description?: string | null
  learningStandard?: string | null
}

export interface SubtopicInput {
  topicId: number
  name: string
  nameEn?: string | null
  learningObjective?: string | null
}

export interface SeedOptions {
  /**
   * SRS §6.9 "Test-only records": Sejarah Darjah 1 "Bab 3: Bab Tidak Aktif Demo" (inactive) with
   * one inactive topic "Topik 1: Topik Tidak Aktif Demo". Not observed on live, so it is **off by
   * default** (the default seed mirrors the 1,251 observed chapters); E2E-M03-06 turns it on with
   * the `curriculumInactiveDemo` override. Runtime ids (chapter 1342, topic 2424).
   */
  inactiveDemo?: boolean
}

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

const iso = (now: number): string => toIsoMyt(now)
const linkId = (subjectId: number, educationLevelId: number) =>
  `${String(subjectId)}:${String(educationLevelId)}`
const opt = <T>(value: T | undefined): T | null => (value === undefined ? null : value)
const nextSeq = (rows: readonly { createdSeq: number }[]) =>
  rows.reduce((max, r) => Math.max(max, r.createdSeq), 0) + 1

function contract(message: string): never {
  throw new RepositoryError('CONTRACT', `curriculum: ${message}`)
}

// ---------------------------------------------------------------------------------------------
// Count repositories (named queries only)
// ---------------------------------------------------------------------------------------------

export const curriculumLevelsRepo = defineRepository({
  name: 'curriculumLevels',
  owner: 'M03',
  store: levelsTable,
  queries: levelQueries,
})

export const curriculumSubjectsRepo = defineRepository({
  name: 'curriculumSubjects',
  owner: 'M03',
  store: subjectsTable,
  queries: subjectQueries,
})

export const curriculumSubjectLevelsRepo = defineRepository({
  name: 'curriculumSubjectLevels',
  owner: 'M03',
  store: subjectLevelsTable,
  queries: subjectLevelQueries,
})

export const curriculumTopicsRepo = defineRepository({
  name: 'curriculumTopics',
  owner: 'M03',
  store: topicsTable,
  queries: topicQueries,
})

export const curriculumSubtopicsRepo = defineRepository({
  name: 'curriculumSubtopics',
  owner: 'M03',
  store: subtopicsTable,
  queries: subtopicQueries,
})

export const legacyTopicsRepo = defineRepository({
  name: 'legacyTopics',
  owner: 'M03',
  store: legacyTopicsTable,
  queries: legacyTopicQueries,
})

export const legacySubtopicsRepo = defineRepository({
  name: 'legacySubtopics',
  owner: 'M03',
  store: legacySubtopicsTable,
  queries: legacySubtopicQueries,
})

// ---------------------------------------------------------------------------------------------
// The domain contract
// ---------------------------------------------------------------------------------------------

export const curriculumRepo = defineRepository({
  name: 'curriculum',
  owner: 'M03',
  store: chaptersTable,
  stores: {
    levels: levelsTable,
    subjects: subjectsTable,
    subjectLevels: subjectLevelsTable,
    topics: topicsTable,
    subtopics: subtopicsTable,
    legacyTopics: legacyTopicsTable,
    legacySubtopics: legacySubtopicsTable,
  },
  queries: chapterQueries,
  methods: ({ store: chapters, stores, transaction, phase }) => {
    const { levels, subjects, subjectLevels, topics, subtopics, legacyTopics, legacySubtopics } =
      stores

    // --- reads ---------------------------------------------------------------------------------

    const levelOrder = () =>
      new Map(
        levels
          .query()
          .rows.sort(byOrderThenId)
          .map((l, i) => [l.id, i]),
      )

    const levelIdsOf = (subjectId: number): number[] => {
      const rank = levelOrder()
      return subjectLevels
        .query({ where: { subjectId } })
        .rows.map((r) => r.educationLevelId)
        .sort((a, b) => (rank.get(a) ?? 0) - (rank.get(b) ?? 0) || a - b)
    }

    const withLevels = (row: SubjectRow): Subject => ({
      ...row,
      educationLevelIds: levelIdsOf(row.id),
    })

    /** BR-06: tree reads see `inTree = true` chapters only (never the 60 out-of-tree ones). */
    const chaptersOf = (subjectId: number, educationLevelId: number): ChapterRow[] =>
      chapters
        .query({ where: { subjectId, educationLevelId, inTree: true } })
        .rows.sort(chapterOrder)

    const treeChapter = (id: number): ChapterRow | undefined => {
      const row = chapters.get(id)
      return row?.inTree ? row : undefined
    }

    const topicsOf = (chapterId: number): TopicRow[] =>
      topics.query({ where: { chapterId } }).rows.sort(topicOrder)

    const subtopicsOf = (topicId: number): SubtopicRow[] =>
      subtopics.query({ where: { topicId } }).rows.sort(subtopicOrder)

    const legacyList = (filter: { gradeLevel?: string | null; subject?: string | null } = {}) =>
      legacyTopics
        .query({ where: legacyTopicWhere(filter.gradeLevel, filter.subject) })
        .rows.sort(legacyTopicOrder)

    const subjectByCode = (code: string): SubjectRow | undefined =>
      subjects.query({ where: { code: code.toUpperCase() } }).rows[0]

    /** BR-19: the k-th topic of subject + grade ↔ the k-th chapter of subject × level (BR-08). */
    const topicChapterId = (legacyTopicId: number): number | null => {
      const topic = legacyTopics.get(legacyTopicId)
      if (!topic) return null
      const subject = subjectByCode(PRACTICE_CODE[topic.subject])
      const levelId = gradeOfCode(topic.gradeLevel)
      if (!subject || levelId === null) return null
      const k = legacyList({ gradeLevel: topic.gradeLevel, subject: topic.subject }).findIndex(
        (t) => t.id === legacyTopicId,
      )
      return chaptersOf(subject.id, levelId)[k]?.id ?? null
    }

    const topicProgress = (userId: number, legacyTopicId: number): LearnerTopicProgress => {
      const empty = { legacyTopicId, sessions: 0, questionsAnswered: 0, correct: 0, progress: 0 }
      const chapterId = topicChapterId(legacyTopicId)
      if (chapterId === null) return empty
      let questionsAnswered = 0
      let correct = 0
      const sessionIds = new Set<unknown>()
      for (const row of answerLog().answersFor(userId, chapterId)) {
        questionsAnswered++
        if (row.isCorrect) correct++
        if (row.sessionId !== null && row.sessionId !== undefined) sessionIds.add(row.sessionId)
      }
      return {
        legacyTopicId,
        sessions: sessionIds.size,
        questionsAnswered,
        correct,
        progress: progressPercent(correct),
      }
    }

    // --- cascades (BR-10) --------------------------------------------------------------------

    const removeTopicCascade = (topicId: number): number => {
      const subs = subtopics.query({ where: { topicId } }).rows
      for (const s of subs) subtopics.remove(s.id)
      topics.remove(topicId)
      return subs.length
    }

    const removeChapterCascade = (chapterId: number) => {
      let topicCount = 0
      let subtopicCount = 0
      for (const t of topics.query({ where: { chapterId } }).rows) {
        subtopicCount += removeTopicCascade(t.id)
        topicCount++
      }
      chapters.remove(chapterId)
      return { chapters: 1, topics: topicCount, subtopics: subtopicCount }
    }

    const setLinks = (subjectId: number, levelIds: readonly number[]) => {
      for (const l of levelIds) if (!levels.get(l)) contract(`unknown education level ${String(l)}`)
      for (const r of subjectLevels.query({ where: { subjectId } }).rows) subjectLevels.remove(r.id)
      for (const l of new Set(levelIds)) {
        subjectLevels.insert({ id: linkId(subjectId, l), subjectId, educationLevelId: l })
      }
    }

    return {
      // --- levels ------------------------------------------------------------------------------
      /** Levels in BR-08 order; `{active: true}` = the `/api/education-levels` set (BR-11). */
      levels(filter: { active?: boolean } = {}): EducationLevelRow[] {
        const where = filter.active === undefined ? {} : { isActive: filter.active }
        return levels.query({ where }).rows.sort(byOrderThenId)
      },
      level: (id: number): EducationLevelRow | undefined => levels.get(id),
      /** Level ids in BR-08 order (keys for `withZeroCounts`). */
      levelIds: (): number[] =>
        levels
          .query()
          .rows.sort(byOrderThenId)
          .map((l) => l.id),
      /** BR-17: the level whose `grade` is `grade` (1–11), if any. */
      levelForGrade: (grade: number): EducationLevelRow | undefined =>
        levels.query({ where: { grade } }).rows.sort(byOrderThenId)[0],

      // --- subjects ----------------------------------------------------------------------------
      /**
       * Subjects in BR-08 order with their level links. `{active: true}` = the `/api/subjects` set
       * (BR-11); `educationLevelId` keeps the subjects linked to that level.
       */
      subjects(filter: { active?: boolean; educationLevelId?: number } = {}): Subject[] {
        const where = filter.active === undefined ? {} : { isActive: filter.active }
        let rows = subjects.query({ where }).rows
        if (filter.educationLevelId !== undefined) {
          const linked = new Set(
            subjectLevels
              .query({ where: { educationLevelId: filter.educationLevelId } })
              .rows.map((r) => r.subjectId),
          )
          rows = rows.filter((s) => linked.has(s.id))
        }
        return rows.sort(byOrderThenId).map(withLevels)
      },
      subject(id: number): Subject | undefined {
        const row = subjects.get(id)
        return row ? withLevels(row) : undefined
      },
      /** Case-insensitive `code` lookup (codes are stored upper-case). */
      subjectByCode(code: string): Subject | undefined {
        const row = subjectByCode(code)
        return row ? withLevels(row) : undefined
      },
      /** Subject ids in BR-08 order (keys for `withZeroCounts`). */
      subjectIds: (): number[] =>
        subjects
          .query()
          .rows.sort(byOrderThenId)
          .map((s) => s.id),
      /**
       * The subject × level links as `[subjectId, educationLevelId]` pairs, in subject then level
       * order: the allowed combinations of the M04 question dataset (`fit2d`, SRS §6.10).
       */
      subjectLevelPairs(): [number, number][] {
        const rank = levelOrder()
        const subjectRank = new Map(
          subjects
            .query()
            .rows.sort(byOrderThenId)
            .map((s, i) => [s.id, i]),
        )
        return subjectLevels
          .query()
          .rows.map((r): [number, number] => [r.subjectId, r.educationLevelId])
          .sort(
            (a, b) =>
              (subjectRank.get(a[0]) ?? 0) - (subjectRank.get(b[0]) ?? 0) ||
              (rank.get(a[1]) ?? 0) - (rank.get(b[1]) ?? 0),
          )
      },

      // --- tree --------------------------------------------------------------------------------
      /** Chapters of a subject × level pair, BR-08 order, active and inactive (BR-06). */
      chapters: chaptersOf,
      /** A tree chapter (`undefined` for unknown and out-of-tree ids: "Bab tidak dijumpai."). */
      chapter: treeChapter,
      /** Topics of a chapter, BR-08 natural order. */
      topics: topicsOf,
      topic: (id: number): TopicRow | undefined => topics.get(id),
      /** Subtopics of a topic, creation order. */
      subtopics: subtopicsOf,
      subtopic: (id: number): SubtopicRow | undefined => subtopics.get(id),
      /** SRS §7 #13: the full tree of a pair and its stats (BR-06). */
      tree(
        subjectId: number,
        educationLevelId: number,
      ): { stats: TreeStats; chapters: ChapterNode[] } {
        const nodes = chaptersOf(subjectId, educationLevelId).map((c) => ({
          ...c,
          topics: topicsOf(c.id).map((t) => ({ ...t, subtopics: subtopicsOf(t.id) })),
        }))
        const topicCount = nodes.reduce((n, c) => n + c.topics.length, 0)
        const subtopicCount = nodes.reduce(
          (n, c) => n + c.topics.reduce((m, t) => m + t.subtopics.length, 0),
          0,
        )
        return {
          stats: { chapters: nodes.length, topics: topicCount, subtopics: subtopicCount },
          chapters: nodes,
        }
      },

      // --- legacy catalogue (S12–S14) ------------------------------------------------------------
      /** BR-13: filtered case-insensitively (AND), `sequence` then id. */
      legacyTopics: legacyList,
      legacyTopic: (id: number): LegacyTopicRow | undefined => legacyTopics.get(id),
      legacySubtopics: (legacyTopicId: number): LegacySubtopicRow[] =>
        legacySubtopics
          .query({ where: { legacyTopicId } })
          .rows.sort((a, b) => a.order - b.order || a.id - b.id),

      // --- topic progress (BR-19, derived on read) -----------------------------------------------
      /** The curriculum chapter a legacy topic reads its answers from (BR-19), or `null`. */
      topicChapterId,
      /** DATA-M03-07 for `userId` and a legacy topic, from the M05 answer log (BR-19). */
      topicProgress,

      // --- writes: levels ------------------------------------------------------------------------
      createLevel(input: LevelInput, now: number): EducationLevelRow {
        return transaction(() =>
          levels.insert({
            ...input,
            code: input.code.toUpperCase(),
            isActive: true,
            grade: null,
            createdAt: iso(now),
            updatedAt: iso(now),
          }),
        )
      },
      updateLevel(id: number, input: LevelInput, now: number): EducationLevelRow | undefined {
        if (!levels.get(id)) return undefined
        return transaction(() =>
          levels.update(id, { ...input, code: input.code.toUpperCase(), updatedAt: iso(now) }),
        )
      },
      setLevelActive(id: number, isActive: boolean, now: number): EducationLevelRow | undefined {
        if (!levels.get(id)) return undefined
        return transaction(() => levels.update(id, { isActive, updatedAt: iso(now) }))
      },
      /** BR-10: the level, its subject links and every chapter of the level (cascade). */
      deleteLevel(id: number): boolean {
        if (!levels.get(id)) return false
        transaction(() => {
          for (const r of subjectLevels.query({ where: { educationLevelId: id } }).rows) {
            subjectLevels.remove(r.id)
          }
          for (const c of chapters.query({ where: { educationLevelId: id } }).rows) {
            removeChapterCascade(c.id)
          }
          levels.remove(id)
        })
        return true
      },

      // --- writes: subjects ----------------------------------------------------------------------
      createSubject(input: SubjectInput, now: number): Subject {
        const row = transaction(() => {
          const { educationLevelIds, ...fields } = input
          const created = subjects.insert({
            ...fields,
            icon: opt(fields.icon),
            code: fields.code.toUpperCase(),
            isActive: true,
            createdAt: iso(now),
            updatedAt: iso(now),
          })
          setLinks(created.id, educationLevelIds)
          return created
        })
        return withLevels(row)
      },
      /** The ticked set replaces the level links (FR-55). */
      updateSubject(id: number, input: SubjectInput, now: number): Subject | undefined {
        if (!subjects.get(id)) return undefined
        const row = transaction(() => {
          const { educationLevelIds, ...fields } = input
          const updated = subjects.update(id, {
            ...fields,
            icon: opt(fields.icon),
            code: fields.code.toUpperCase(),
            updatedAt: iso(now),
          })
          setLinks(id, educationLevelIds)
          return updated
        })
        return withLevels(row)
      },
      setSubjectActive(id: number, isActive: boolean, now: number): Subject | undefined {
        if (!subjects.get(id)) return undefined
        return withLevels(transaction(() => subjects.update(id, { isActive, updatedAt: iso(now) })))
      },
      /**
       * BR-10: the subject, its level links and every chapter of the subject (cascade), including
       * its out-of-tree chapters.
       */
      deleteSubject(id: number): boolean {
        if (!subjects.get(id)) return false
        transaction(() => {
          for (const r of subjectLevels.query({ where: { subjectId: id } }).rows) {
            subjectLevels.remove(r.id)
          }
          for (const c of chapters.query({ where: { subjectId: id } }).rows) {
            removeChapterCascade(c.id)
          }
          subjects.remove(id)
        })
        return true
      },

      // --- writes: chapters, topics, subtopics (M03 admin; M10 #36/#38 teacher creates) ----------
      createChapter(input: ChapterInput, now: number): ChapterRow {
        if (!subjects.get(input.subjectId)) contract(`unknown subject ${String(input.subjectId)}`)
        if (!levels.get(input.educationLevelId)) {
          contract(`unknown education level ${String(input.educationLevelId)}`)
        }
        return transaction(() =>
          chapters.insert({
            subjectId: input.subjectId,
            educationLevelId: input.educationLevelId,
            name: input.name,
            nameEn: opt(input.nameEn),
            chapterNumber: opt(input.chapterNumber),
            description: opt(input.description),
            inTree: true,
            isActive: true,
            createdSeq: nextSeq(chapters.query().rows),
            createdAt: iso(now),
            updatedAt: iso(now),
          }),
        )
      },
      /** Editing may change the pair; the chapter keeps its topics (BR-07). */
      updateChapter(
        id: number,
        input: ChapterInput & { isActive: boolean },
        now: number,
      ): ChapterRow | undefined {
        if (!treeChapter(id)) return undefined
        if (!subjects.get(input.subjectId)) contract(`unknown subject ${String(input.subjectId)}`)
        if (!levels.get(input.educationLevelId)) {
          contract(`unknown education level ${String(input.educationLevelId)}`)
        }
        return transaction(() =>
          chapters.update(id, {
            subjectId: input.subjectId,
            educationLevelId: input.educationLevelId,
            name: input.name,
            nameEn: opt(input.nameEn),
            chapterNumber: opt(input.chapterNumber),
            description: opt(input.description),
            isActive: input.isActive,
            updatedAt: iso(now),
          }),
        )
      },
      /** BR-10: the chapter, its topics and their subtopics. `null` when unknown. */
      deleteChapter(id: number): TreeStats | null {
        if (!treeChapter(id)) return null
        return transaction(() => removeChapterCascade(id))
      },
      createTopic(input: TopicInput, now: number): TopicRow {
        if (!treeChapter(input.chapterId)) contract(`unknown chapter ${String(input.chapterId)}`)
        return transaction(() =>
          topics.insert({
            chapterId: input.chapterId,
            name: input.name,
            nameEn: opt(input.nameEn),
            topicNumber: opt(input.topicNumber),
            description: opt(input.description),
            learningStandard: opt(input.learningStandard),
            isActive: true,
            createdSeq: nextSeq(topics.query().rows),
            createdAt: iso(now),
            updatedAt: iso(now),
          }),
        )
      },
      /** The chapter is fixed after creation (BR-07). */
      updateTopic(
        id: number,
        input: Omit<TopicInput, 'chapterId'> & { isActive: boolean },
        now: number,
      ): TopicRow | undefined {
        if (!topics.get(id)) return undefined
        return transaction(() =>
          topics.update(id, {
            name: input.name,
            nameEn: opt(input.nameEn),
            topicNumber: opt(input.topicNumber),
            description: opt(input.description),
            learningStandard: opt(input.learningStandard),
            isActive: input.isActive,
            updatedAt: iso(now),
          }),
        )
      },
      /** BR-10: the topic and its subtopics. `null` when unknown. */
      deleteTopic(id: number): { topics: 1; subtopics: number } | null {
        if (!topics.get(id)) return null
        return transaction(() => ({ topics: 1 as const, subtopics: removeTopicCascade(id) }))
      },
      /** BR-09: appended last (`createdSeq` = max + 1). */
      createSubtopic(input: SubtopicInput, now: number): SubtopicRow {
        if (!topics.get(input.topicId)) contract(`unknown topic ${String(input.topicId)}`)
        return transaction(() =>
          subtopics.insert({
            topicId: input.topicId,
            name: input.name,
            nameEn: opt(input.nameEn),
            learningObjective: opt(input.learningObjective),
            createdSeq: nextSeq(subtopics.query().rows),
            createdAt: iso(now),
            updatedAt: iso(now),
          }),
        )
      },
      updateSubtopic(
        id: number,
        input: Omit<SubtopicInput, 'topicId'>,
        now: number,
      ): SubtopicRow | undefined {
        if (!subtopics.get(id)) return undefined
        return transaction(() =>
          subtopics.update(id, {
            name: input.name,
            nameEn: opt(input.nameEn),
            learningObjective: opt(input.learningObjective),
            updatedAt: iso(now),
          }),
        )
      },
      deleteSubtopic(id: number): boolean {
        if (!subtopics.get(id)) return false
        transaction(() => subtopics.remove(id))
        return true
      },

      // --- seed ----------------------------------------------------------------------------------
      /**
       * Loads the fixture (SRS §6.9). M03's own `seed(ctx)` only: another module or a later phase
       * gets `OWNERSHIP` / `PHASE`.
       */
      seedFixture(
        ctx: Pick<SeedContext, 'module' | 'db'>,
        fixture: CurriculumFixture,
        options: SeedOptions = {},
      ) {
        if (ctx.module !== 'M03') {
          throw new RepositoryError(
            'OWNERSHIP',
            `curriculum.seedFixture: only the M03 seed loads the curriculum (called by ${ctx.module})`,
          )
        }
        if (ctx.db.phase !== 'seed' || phase() === 'live') {
          throw new RepositoryError('PHASE', 'curriculum.seedFixture: seed phase only')
        }
        const at = { createdAt: SEED_TIMESTAMP, updatedAt: SEED_TIMESTAMP }
        for (const l of fixture.levels) levels.insert({ ...l, ...at })
        for (const s of fixture.subjects) subjects.insert({ ...s, ...at })
        for (const [subjectId, educationLevelId] of fixture.subjectLevels) {
          subjectLevels.insert({
            id: linkId(subjectId, educationLevelId),
            subjectId,
            educationLevelId,
          })
        }
        for (const c of fixture.chapters) chapters.insert({ ...c, isActive: true, ...at })
        for (const t of fixture.topics) topics.insert({ ...t, isActive: true, ...at })
        for (const s of fixture.subtopics) subtopics.insert({ ...s, ...at })
        for (const t of fixture.legacyTopics) legacyTopics.insert({ ...t })
        for (const s of fixture.legacySubtopics) legacySubtopics.insert({ ...s })

        if (options.inactiveDemo) {
          const sej = subjectByCode('SEJ')
          const d1 = levels.query({ where: { code: 'D1' } }).rows[0]
          if (!sej || !d1) contract('inactiveDemo: Sejarah or Darjah 1 is missing')
          const chapter = chapters.insert({
            subjectId: sej.id,
            educationLevelId: d1.id,
            name: 'Bab Tidak Aktif Demo',
            nameEn: null,
            chapterNumber: 3,
            description: null,
            inTree: true,
            isActive: false,
            createdSeq: nextSeq(chapters.query().rows),
            ...at,
          })
          topics.insert({
            chapterId: chapter.id,
            name: 'Topik Tidak Aktif Demo',
            nameEn: null,
            topicNumber: '1',
            description: null,
            learningStandard: null,
            isActive: false,
            createdSeq: nextSeq(topics.query().rows),
            ...at,
          })
        }
      },
    }
  },
})
