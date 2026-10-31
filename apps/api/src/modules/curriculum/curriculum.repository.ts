import { Inject, Injectable } from '@nestjs/common'

import type {
  Chapter,
  CurriculumNode,
  CurriculumTpDescriptor,
  EducationLevel,
  LegacySubtopic,
  LegacyTopic,
  Subject,
  Subtopic,
  Topic,
} from '../../db/generated/client'
import { PrismaService } from '../../db/prisma.service'
import { byOrderThenId, chapterOrder, compareIds, MAP_GRADES, topicOrder } from './rules'

/** The learner catalogue (topics, learning map) is Tingkatan 4 and 5 only (secondary-only, D72); a topic of any other grade is never read. */
const LEARNER_TOPIC_GRADES: string[] = [...MAP_GRADES]

export type { Chapter, CurriculumNode, CurriculumTpDescriptor, EducationLevel, LegacySubtopic, LegacyTopic, Subject, Subtopic, Topic }

/** A subject with the ids of its linked levels, in level order (BR-08). */
export type SubjectWithLevels = Subject & { educationLevelIds: bigint[] }

export interface LevelInput {
  name: string
  nameEn: string
  code: string
  stage: string
  curriculum: string
  sortOrder: number
}

export interface SubjectInput {
  name: string
  nameEn: string
  code: string
  icon: string | null
  color: string
  isCore: boolean
  sortOrder: number
  educationLevelIds: readonly bigint[]
}

export interface ChapterInput {
  subjectId: bigint
  educationLevelId: bigint
  name: string
  nameEn: string | null
  chapterNumber: number | null
  description: string | null
}

export interface TopicInput {
  name: string
  nameEn: string | null
  topicNumber: string | null
  description: string | null
  learningStandard: string | null
}

export interface SubtopicInput {
  name: string
  nameEn: string | null
  learningObjective: string | null
}

export interface NodeFilter {
  subjectId: bigint
  educationLevelId: bigint
  kind?: CurriculumNode['kind']
  edition?: string
}

export type TreeTopic = Topic & { subtopics: Subtopic[] }
export type TreeChapter = Chapter & { topics: TreeTopic[] }

/**
 * The only doorway to the curriculum tables (data model G-12, ADR-0014). Other cards call the read
 * methods (`subjects()`, `levels()`, `chapters(subjectId, levelId)`, `node(code, filter)`); they never
 * query these tables. Ids are bigint here; the service maps them to the decimal strings of the wire.
 *
 * Every method uses `prisma.client`, so it joins the transaction a service opened with
 * `prisma.transaction(...)`. The foreign keys are `ON DELETE CASCADE` (migration 0008), but the admin
 * service only deletes a level, subject, chapter or topic that has no children (409 otherwise, LEAD
 * 2026-10-20): it calls `lock*` and then `*HasChildren` in the delete transaction.
 */
@Injectable()
export class CurriculumRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.client
  }

  // --- levels -----------------------------------------------------------------------------------

  /**
   * Levels in BR-08 order. Secondary-only (2026-10-29): primary levels (stage `primary`, D1-D6) are never returned.
   * The default is the ACTIVE set (BR-11, the `/education-levels` set); the admin Kurikulum screens and name lookups
   * of existing questions pass `{ includeInactive: true }` (every non-primary level, so a Tingkatan can be re-activated);
   * `{ active: false }` returns only the inactive non-primary ones.
   */
  async levels(filter: { active?: boolean; includeInactive?: boolean } = {}): Promise<EducationLevel[]> {
    const active = filter.active ?? (filter.includeInactive ? undefined : true)
    const rows = await this.db.educationLevel.findMany({
      where: { stage: { not: 'primary' }, ...(active === undefined ? {} : { isActive: active }) },
    })
    return rows.sort(byOrderThenId)
  }

  level(id: bigint): Promise<EducationLevel | null> {
    return this.db.educationLevel.findUnique({ where: { id } })
  }

  /** BR-17: the level whose `grade` is `grade` (1 to 11), if any. */
  async levelForGrade(grade: number): Promise<EducationLevel | null> {
    const rows = await this.db.educationLevel.findMany({ where: { grade, isActive: true, stage: { not: 'primary' } } })
    return rows.sort(byOrderThenId)[0] ?? null
  }

  levelByCode(code: string): Promise<EducationLevel | null> {
    return this.db.educationLevel.findUnique({ where: { code: code.toUpperCase() } })
  }

  async levelSubjectCounts(): Promise<Map<bigint, number>> {
    const rows = await this.db.subjectLevel.groupBy({ by: ['educationLevelId'], _count: { _all: true } })
    return new Map(rows.map((r) => [r.educationLevelId, r._count._all]))
  }

  createLevel(input: LevelInput, now: Date): Promise<EducationLevel> {
    return this.db.educationLevel.create({
      data: { ...input, code: input.code.toUpperCase(), isActive: true, grade: null, createdAt: now, updatedAt: now },
    })
  }

  updateLevel(id: bigint, input: LevelInput, now: Date): Promise<EducationLevel> {
    return this.db.educationLevel.update({
      where: { id },
      data: { ...input, code: input.code.toUpperCase(), updatedAt: now },
    })
  }

  setLevelActive(id: bigint, isActive: boolean, now: Date): Promise<EducationLevel> {
    return this.db.educationLevel.update({ where: { id }, data: { isActive, updatedAt: now } })
  }

  /**
   * Locks the level row (`FOR UPDATE`) for the rest of the transaction; false when it is gone. A
   * concurrent insert of a child (subject link, chapter, node) takes a `FOR KEY SHARE` lock on this
   * row through its foreign key, so it waits for the delete (and then fails) instead of slipping in
   * between the child check and the delete.
   */
  async lockLevel(id: bigint): Promise<boolean> {
    const rows = await this.db.$queryRaw<{ id: bigint }[]>`SELECT id FROM education_levels WHERE id = ${id} FOR UPDATE`
    return rows.length > 0
  }

  /** True when a subject link, a chapter (in the tree or not) or a DSKP node still points at the level. */
  async levelHasChildren(id: bigint): Promise<boolean> {
    const [links, chapters, nodes] = await Promise.all([
      this.db.subjectLevel.count({ where: { educationLevelId: id } }),
      this.db.chapter.count({ where: { educationLevelId: id } }),
      this.db.curriculumNode.count({ where: { educationLevelId: id } }),
    ])
    return links + chapters + nodes > 0
  }

  /** Deletes a level that has no children (the caller checked under `lockLevel`). */
  async deleteLevel(id: bigint): Promise<void> {
    await this.db.educationLevel.delete({ where: { id } })
  }

  // --- subjects ---------------------------------------------------------------------------------

  /** Level ids per subject, in level order (BR-08), for every subject. */
  private async levelIdsBySubject(): Promise<Map<bigint, bigint[]>> {
    const links = await this.db.subjectLevel.findMany({
      where: { educationLevel: { stage: { not: 'primary' } } }, // primary levels are hidden from every read
      select: { subjectId: true, educationLevelId: true, educationLevel: { select: { sortOrder: true } } },
    })
    const sorted = links.sort(
      (a, b) =>
        a.educationLevel.sortOrder - b.educationLevel.sortOrder || compareIds(a.educationLevelId, b.educationLevelId),
    )
    const map = new Map<bigint, bigint[]>()
    for (const l of sorted) {
      const ids = map.get(l.subjectId)
      if (ids) ids.push(l.educationLevelId)
      else map.set(l.subjectId, [l.educationLevelId])
    }
    return map
  }

  private async levelIdsOf(subjectId: bigint): Promise<bigint[]> {
    const links = await this.db.subjectLevel.findMany({
      where: { subjectId, educationLevel: { stage: { not: 'primary' } } },
      select: { educationLevelId: true, educationLevel: { select: { sortOrder: true } } },
    })
    return links
      .sort(
        (a, b) =>
          a.educationLevel.sortOrder - b.educationLevel.sortOrder || compareIds(a.educationLevelId, b.educationLevelId),
      )
      .map((l) => l.educationLevelId)
  }

  /**
   * Subjects in BR-08 order with their level links. `{ active: true }` is the `/subjects` set
   * (BR-11); `educationLevelId` keeps the subjects linked to that level.
   */
  async subjects(filter: { active?: boolean; educationLevelId?: bigint } = {}): Promise<SubjectWithLevels[]> {
    const rows = await this.db.subject.findMany({
      where: {
        ...(filter.active === undefined ? {} : { isActive: filter.active }),
        ...(filter.educationLevelId === undefined ? {} : { subjectLevels: { some: { educationLevelId: filter.educationLevelId } } }),
      },
    })
    const links = await this.levelIdsBySubject()
    return rows.sort(byOrderThenId).map((s) => ({ ...s, educationLevelIds: links.get(s.id) ?? [] }))
  }

  async subject(id: bigint): Promise<SubjectWithLevels | null> {
    const row = await this.db.subject.findUnique({ where: { id } })
    return row ? { ...row, educationLevelIds: await this.levelIdsOf(id) } : null
  }

  /** Case-insensitive `code` lookup (codes are stored upper-case). */
  async subjectByCode(code: string): Promise<SubjectWithLevels | null> {
    const row = await this.db.subject.findUnique({ where: { code: code.toUpperCase() } })
    return row ? { ...row, educationLevelIds: await this.levelIdsOf(row.id) } : null
  }

  /** Replaces the level links of a subject (the ticked set, FR-55). */
  private async setLinks(subjectId: bigint, levelIds: readonly bigint[]): Promise<void> {
    // Only the links to non-primary levels are replaced: the hidden Darjah links (secondary-only, 2026-10-29) are kept.
    await this.db.subjectLevel.deleteMany({ where: { subjectId, educationLevel: { stage: { not: 'primary' } } } })
    const unique = [...new Set(levelIds)]
    if (unique.length > 0) {
      await this.db.subjectLevel.createMany({
        data: unique.map((educationLevelId) => ({ subjectId, educationLevelId })),
      })
    }
  }

  async createSubject(input: SubjectInput, now: Date): Promise<SubjectWithLevels> {
    const { educationLevelIds, ...fields } = input
    const row = await this.db.subject.create({
      data: { ...fields, code: fields.code.toUpperCase(), isActive: true, createdAt: now, updatedAt: now },
    })
    await this.setLinks(row.id, educationLevelIds)
    return { ...row, educationLevelIds: await this.levelIdsOf(row.id) }
  }

  async updateSubject(id: bigint, input: SubjectInput, now: Date): Promise<SubjectWithLevels> {
    const { educationLevelIds, ...fields } = input
    const row = await this.db.subject.update({
      where: { id },
      data: { ...fields, code: fields.code.toUpperCase(), updatedAt: now },
    })
    await this.setLinks(id, educationLevelIds)
    return { ...row, educationLevelIds: await this.levelIdsOf(id) }
  }

  async setSubjectActive(id: bigint, isActive: boolean, now: Date): Promise<Subject> {
    return this.db.subject.update({ where: { id }, data: { isActive, updatedAt: now } })
  }

  /** `FOR UPDATE` on the subject row; false when it is gone. See `lockLevel`. */
  async lockSubject(id: bigint): Promise<boolean> {
    const rows = await this.db.$queryRaw<{ id: bigint }[]>`SELECT id FROM subjects WHERE id = ${id} FOR UPDATE`
    return rows.length > 0
  }

  /** True when a level link, a chapter (in the tree or not), a DSKP node or a TP descriptor still points at the subject. */
  async subjectHasChildren(id: bigint): Promise<boolean> {
    const [links, chapters, nodes, descriptors] = await Promise.all([
      this.db.subjectLevel.count({ where: { subjectId: id } }),
      this.db.chapter.count({ where: { subjectId: id } }),
      this.db.curriculumNode.count({ where: { subjectId: id } }),
      this.db.curriculumTpDescriptor.count({ where: { subjectId: id } }),
    ])
    return links + chapters + nodes + descriptors > 0
  }

  /** Deletes a subject that has no children (the caller checked under `lockSubject`). */
  async deleteSubject(id: bigint): Promise<void> {
    await this.db.subject.delete({ where: { id } })
  }

  // --- chapters, topics, subtopics --------------------------------------------------------------

  /**
   * Chapters of a subject and level in BR-08 order; in-tree only. Without `active` both active and
   * inactive chapters are returned (the admin tree, BR-06); a learner-facing caller passes
   * `{ active: true }`, like `levels()` and `subjects()`.
   */
  async chapters(subjectId: bigint, educationLevelId: bigint, filter: { active?: boolean } = {}): Promise<Chapter[]> {
    const rows = await this.db.chapter.findMany({
      where: { subjectId, educationLevelId, inTree: true, ...(filter.active === undefined ? {} : { isActive: filter.active }) },
    })
    return rows.sort(chapterOrder)
  }

  /** A tree chapter; `null` for an unknown, out-of-tree or (with `{ active: true }`) inactive id ("Bab tidak dijumpai."). */
  async chapter(id: bigint, filter: { active?: boolean } = {}): Promise<Chapter | null> {
    const row = await this.db.chapter.findUnique({ where: { id } })
    if (!row?.inTree) return null
    return filter.active !== undefined && row.isActive !== filter.active ? null : row
  }

  /** `{ id, name, subjectId }` of the tree chapters among `ids`, in the order given (M25); `{ active: true }` skips inactive ones. */
  async chaptersByIds(
    ids: readonly bigint[],
    filter: { active?: boolean } = {},
  ): Promise<{ id: bigint; name: string; subjectId: bigint }[]> {
    const rows = await this.db.chapter.findMany({
      where: { id: { in: [...new Set(ids)] }, inTree: true, ...(filter.active === undefined ? {} : { isActive: filter.active }) },
    })
    const byId = new Map(rows.map((r) => [r.id, r]))
    const out: { id: bigint; name: string; subjectId: bigint }[] = []
    for (const id of new Set(ids)) {
      const c = byId.get(id)
      if (c?.name != null) out.push({ id: c.id, name: c.name, subjectId: c.subjectId })
    }
    return out
  }

  /** Topics of a chapter, BR-08 natural order. */
  async topics(chapterId: bigint): Promise<Topic[]> {
    const rows = await this.db.topic.findMany({ where: { chapterId } })
    return rows.sort(topicOrder)
  }

  topic(id: bigint): Promise<Topic | null> {
    return this.db.topic.findUnique({ where: { id } })
  }

  /** Subtopics of a topic, creation order. */
  subtopics(topicId: bigint): Promise<Subtopic[]> {
    return this.db.subtopic.findMany({ where: { topicId }, orderBy: { id: 'asc' } })
  }

  subtopic(id: bigint): Promise<Subtopic | null> {
    return this.db.subtopic.findUnique({ where: { id } })
  }

  /** SRS #13: the full tree of a subject and level (in-tree chapters), BR-06 stats counted by the caller. */
  async tree(subjectId: bigint, educationLevelId: bigint, filter: { active?: boolean } = {}): Promise<TreeChapter[]> {
    const chapters = await this.chapters(subjectId, educationLevelId, filter)
    if (chapters.length === 0) return []
    const topics = await this.db.topic.findMany({ where: { chapterId: { in: chapters.map((c) => c.id) } } })
    const subtopics =
      topics.length === 0
        ? []
        : await this.db.subtopic.findMany({ where: { topicId: { in: topics.map((t) => t.id) } }, orderBy: { id: 'asc' } })
    const subsByTopic = new Map<bigint, Subtopic[]>()
    for (const s of subtopics) {
      const list = subsByTopic.get(s.topicId)
      if (list) list.push(s)
      else subsByTopic.set(s.topicId, [s])
    }
    const topicsByChapter = new Map<bigint, TreeTopic[]>()
    for (const t of topics.sort(topicOrder)) {
      const node: TreeTopic = { ...t, subtopics: subsByTopic.get(t.id) ?? [] }
      const list = topicsByChapter.get(t.chapterId)
      if (list) list.push(node)
      else topicsByChapter.set(t.chapterId, [node])
    }
    return chapters.map((c) => ({ ...c, topics: topicsByChapter.get(c.id) ?? [] }))
  }

  createChapter(input: ChapterInput, now: Date): Promise<Chapter> {
    return this.db.chapter.create({ data: { ...input, inTree: true, isActive: true, createdAt: now, updatedAt: now } })
  }

  /** `strand` and `dskpCode` are read-only on the wire and keep their stored value. */
  updateChapter(id: bigint, input: ChapterInput & { isActive: boolean }, now: Date): Promise<Chapter> {
    return this.db.chapter.update({ where: { id }, data: { ...input, updatedAt: now } })
  }

  /** `FOR UPDATE` on the chapter row; false when it is gone. See `lockLevel`. */
  async lockChapter(id: bigint): Promise<boolean> {
    const rows = await this.db.$queryRaw<{ id: bigint }[]>`SELECT id FROM chapters WHERE id = ${id} FOR UPDATE`
    return rows.length > 0
  }

  async chapterHasTopics(chapterId: bigint): Promise<boolean> {
    return (await this.db.topic.count({ where: { chapterId } })) > 0
  }

  async deleteChapter(id: bigint): Promise<void> {
    await this.db.chapter.delete({ where: { id } })
  }

  createTopic(chapterId: bigint, input: TopicInput, now: Date): Promise<Topic> {
    return this.db.topic.create({ data: { chapterId, ...input, isActive: true, createdAt: now, updatedAt: now } })
  }

  updateTopic(id: bigint, input: TopicInput & { isActive: boolean }, now: Date): Promise<Topic> {
    return this.db.topic.update({ where: { id }, data: { ...input, updatedAt: now } })
  }

  /** `FOR UPDATE` on the topic row; false when it is gone. See `lockLevel`. */
  async lockTopic(id: bigint): Promise<boolean> {
    const rows = await this.db.$queryRaw<{ id: bigint }[]>`SELECT id FROM topics WHERE id = ${id} FOR UPDATE`
    return rows.length > 0
  }

  async topicHasSubtopics(topicId: bigint): Promise<boolean> {
    return (await this.db.subtopic.count({ where: { topicId } })) > 0
  }

  async deleteTopic(id: bigint): Promise<void> {
    await this.db.topic.delete({ where: { id } })
  }

  createSubtopic(topicId: bigint, input: SubtopicInput, now: Date): Promise<Subtopic> {
    return this.db.subtopic.create({ data: { topicId, ...input, createdAt: now, updatedAt: now } })
  }

  updateSubtopic(id: bigint, input: SubtopicInput, now: Date): Promise<Subtopic> {
    return this.db.subtopic.update({ where: { id }, data: { ...input, updatedAt: now } })
  }

  async deleteSubtopic(id: bigint): Promise<void> {
    await this.db.subtopic.delete({ where: { id } })
  }

  // --- DSKP nodes (shared tag target, exam schema D9) --------------------------------------------

  /**
   * Nodes with printed `code` inside one subject and level (the code alone is not unique: 1.1 exists
   * in every subject and as an SK and a unit). `kind` and `edition` narrow it further. Ordered
   * deterministically (edition, kind, id).
   */
  async nodes(code: string, filter: NodeFilter): Promise<CurriculumNode[]> {
    return this.db.curriculumNode.findMany({
      where: {
        code,
        subjectId: filter.subjectId,
        educationLevelId: filter.educationLevelId,
        ...(filter.kind === undefined ? {} : { kind: filter.kind }),
        ...(filter.edition === undefined ? {} : { edition: filter.edition }),
      },
      orderBy: [{ edition: 'asc' }, { kind: 'asc' }, { id: 'asc' }],
    })
  }

  /** The node with `code` (first match in the `nodes` order), or null. */
  async node(code: string, filter: NodeFilter): Promise<CurriculumNode | null> {
    return (await this.nodes(code, filter))[0] ?? null
  }

  /**
   * Every DSKP node (grouping, unit, sk, sp) of one level, for one subject or all subjects, in printed order. Additive read for
   * the school admin heatmap (BE-21): it lists the subjects that have SPs and builds the bidang tree without a query per node.
   */
  dskpNodes(educationLevelId: bigint, subjectId?: bigint): Promise<CurriculumNode[]> {
    return this.db.curriculumNode.findMany({
      where: { educationLevelId, ...(subjectId === undefined ? {} : { subjectId }) },
      orderBy: [{ subjectId: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }],
    })
  }

  nodeById(id: bigint): Promise<CurriculumNode | null> {
    return this.db.curriculumNode.findUnique({ where: { id } })
  }

  /** Direct children in printed order. */
  childrenOf(parentId: bigint): Promise<CurriculumNode[]> {
    return this.db.curriculumNode.findMany({ where: { parentId }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] })
  }

  /** Parent chain from the node's parent up to the root (grouping or unit). */
  async ancestorsOf(id: bigint): Promise<CurriculumNode[]> {
    const chain: CurriculumNode[] = []
    let current = await this.nodeById(id)
    const seen = new Set<bigint>()
    while (current?.parentId != null && !seen.has(current.parentId)) {
      seen.add(current.parentId)
      current = await this.nodeById(current.parentId)
      if (current) chain.push(current)
    }
    return chain
  }

  /** TP descriptors of a node (`nodeId`), or the subject's general levels when `nodeId` is null. */
  tpDescriptors(subjectId: bigint, nodeId: bigint | null): Promise<CurriculumTpDescriptor[]> {
    return this.db.curriculumTpDescriptor.findMany({ where: { subjectId, nodeId }, orderBy: { tp: 'asc' } })
  }

  // --- learner catalogue (S12 to S14) -------------------------------------------------------------

  /**
   * BR-13: filtered case-insensitively (AND), `sequence` then id. An empty or absent filter does
   * not filter; an unknown code matches nothing.
   */
  async legacyTopics(filter: { gradeLevel?: string | null; subject?: string | null } = {}): Promise<LegacyTopic[]> {
    const rows = await this.db.legacyTopic.findMany({
      where: {
        // An allow-list, not a prefix test: no grade asked still means T4/T5 only; a grade outside it matches nothing.
        AND: [{ gradeLevel: { in: LEARNER_TOPIC_GRADES } }, ...(filter.gradeLevel ? [{ gradeLevel: filter.gradeLevel.toUpperCase() }] : [])],
        ...(filter.subject ? { subject: filter.subject.toUpperCase() } : {}),
      },
    })
    return rows.sort((a, b) => a.sequence - b.sequence || compareIds(a.id, b.id))
  }

  legacyTopic(id: bigint): Promise<LegacyTopic | null> {
    return this.db.legacyTopic.findFirst({ where: { id, gradeLevel: { in: LEARNER_TOPIC_GRADES } } })
  }

  /** Subtopics per learner topic id, ordered by `sortOrder` then id. */
  async legacySubtopicsByTopic(topicIds: readonly bigint[]): Promise<Map<bigint, LegacySubtopic[]>> {
    const map = new Map<bigint, LegacySubtopic[]>()
    if (topicIds.length === 0) return map
    const rows = await this.db.legacySubtopic.findMany({
      where: { legacyTopicId: { in: [...topicIds] } },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    })
    for (const r of rows) {
      const list = map.get(r.legacyTopicId)
      if (list) list.push(r)
      else map.set(r.legacyTopicId, [r])
    }
    return map
  }
}
