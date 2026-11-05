import { Inject, Injectable } from '@nestjs/common'

import { idFromString, idToString, isIdString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'
import { type QuestionRecord, QuestionsRepository } from '../../questions'

const idOf = (id: string): bigint | null => (isIdString(id) ? idFromString(id) : null)

/** What the Subjek + Tingkatan has: active chapters (Bab required) and DSKP nodes (SP, TP and Aras required). */
export interface DskpFacts {
  hasChapters: boolean
  hasDskpNodes: boolean
}

/**
 * The doorway of Soalan & Rujukan (S6-T16, API-GUR-24) to its rows. A personal question lives in the question store (M04: `questions` +
 * `question_versions.visibility = 'teacher_private'`, DM-42); writes go through `QuestionsService.createPersonal / rewritePersonal /
 * removePersonal`, reads of the content through `QuestionsRepository` (by id). This class owns the OWN-ONLY queries (owner scope), the
 * curriculum lookups of the form rules and the active-Misi probe of the delete guard.
 */
@Injectable()
export class PersonalQuestionsRepository {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(QuestionsRepository) private readonly questions: QuestionsRepository,
  ) {}

  private get db() {
    return this.prisma.client
  }

  /** One page of the owner's personal question ids, newest first, and the total (same filter). */
  async page(ownerId: string, q: { page: number; pageSize: number; educationLevelId?: string | undefined }): Promise<{ ids: string[]; total: number }> {
    const owner = idOf(ownerId)
    if (owner === null) return { ids: [], total: 0 }
    let level: bigint | null = null
    if (q.educationLevelId !== undefined) {
      level = idOf(q.educationLevelId)
      if (level === null) return { ids: [], total: 0 }
    }
    const offset = (q.page - 1) * q.pageSize
    const [rows, totals] = await Promise.all([
      this.db.$queryRaw<{ id: bigint }[]>`
        SELECT q.id FROM questions q JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.latest_version_no
         WHERE v.visibility = 'teacher_private' AND v.owner_user_id = ${owner} AND (${level}::bigint IS NULL OR v.education_level_id = ${level})
         ORDER BY q.created_at DESC, q.id DESC LIMIT ${q.pageSize} OFFSET ${offset}`,
      this.db.$queryRaw<{ n: number }[]>`
        SELECT count(*)::int AS n FROM questions q JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.latest_version_no
         WHERE v.visibility = 'teacher_private' AND v.owner_user_id = ${owner} AND (${level}::bigint IS NULL OR v.education_level_id = ${level})`,
    ])
    return { ids: rows.map((r) => idToString(r.id)), total: totals[0]?.n ?? 0 }
  }

  /** The question's latest version number when it is a personal question OWNED by `ownerId`; null otherwise (another teacher's, a bank one, unknown: all 404). */
  async ownVersionNo(ownerId: string, id: string): Promise<number | null> {
    const owner = idOf(ownerId)
    const key = idOf(id)
    if (owner === null || key === null) return null
    const rows = await this.db.$queryRaw<{ version_no: number }[]>`
      SELECT q.latest_version_no AS version_no FROM questions q JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.latest_version_no
       WHERE q.id = ${key} AND v.visibility = 'teacher_private' AND v.owner_user_id = ${owner}`
    return rows[0]?.version_no ?? null
  }

  /** Records of ids in the given order (read by id: a personal question is found here, not by any bank read). */
  async records(ids: readonly string[]): Promise<QuestionRecord[]> {
    return this.questions.getMany(ids, 'latest')
  }

  async subjectNames(ids: readonly string[]): Promise<Map<string, string>> {
    const keys = [...new Set(ids)].flatMap((i) => {
      const k = idOf(i)
      return k === null ? [] : [k]
    })
    if (keys.length === 0) return new Map()
    const rows = await this.db.subject.findMany({ where: { id: { in: keys } }, select: { id: true, name: true } })
    return new Map(rows.map((r) => [idToString(r.id), r.name]))
  }

  // --- curriculum lookups of the form rules ------------------------------------------------------------

  async activeSubject(id: string): Promise<{ id: bigint } | null> {
    const key = idOf(id)
    if (key === null) return null
    const row = await this.db.subject.findUnique({ where: { id: key }, select: { id: true, isActive: true } })
    return row?.isActive === true ? { id: row.id } : null
  }

  /** An active Tingkatan (secondary stage; a Darjah is refused, D72). */
  async activeTingkatan(id: string): Promise<{ id: bigint } | null> {
    const key = idOf(id)
    if (key === null) return null
    const row = await this.db.educationLevel.findUnique({ where: { id: key }, select: { id: true, isActive: true, stage: true } })
    return row !== null && row.isActive && row.stage !== 'primary' ? { id: row.id } : null
  }

  async dskpFacts(subjectId: bigint, levelId: bigint): Promise<DskpFacts> {
    const rows = await this.db.$queryRaw<{ has_dskp: boolean; has_chapters: boolean }[]>`
      SELECT EXISTS (SELECT 1 FROM curriculum_nodes WHERE subject_id = ${subjectId} AND education_level_id = ${levelId}) AS has_dskp,
             EXISTS (SELECT 1 FROM chapters WHERE subject_id = ${subjectId} AND education_level_id = ${levelId} AND is_active AND in_tree) AS has_chapters`
    return { hasDskpNodes: rows[0]?.has_dskp === true, hasChapters: rows[0]?.has_chapters === true }
  }

  /** The chapter row when it exists and is in the tree; the caller compares subject and level. */
  async chapter(id: string): Promise<{ id: bigint; subjectId: bigint; educationLevelId: bigint } | null> {
    const key = idOf(id)
    if (key === null) return null
    const row = await this.db.chapter.findUnique({ where: { id: key }, select: { id: true, subjectId: true, educationLevelId: true, inTree: true } })
    return row !== null && row.inTree && row.subjectId !== null && row.educationLevelId !== null ? { id: row.id, subjectId: row.subjectId, educationLevelId: row.educationLevelId } : null
  }

  /** How many of these ids are SP nodes of the Subjek + Tingkatan. */
  async countSpNodes(ids: readonly bigint[], subjectId: bigint, levelId: bigint): Promise<number> {
    if (ids.length === 0) return 0
    return this.db.curriculumNode.count({ where: { id: { in: [...ids] }, kind: 'sp', subjectId, educationLevelId: levelId } })
  }

  // --- delete guard ------------------------------------------------------------------------------------

  /**
   * ADD-21 / FR-GUR-44a-8: "used by an active Misi" = the mission date is `today` (Malaysia day, `YYYY-MM-DD`) or later AND a practice session of
   * that mission holds the question (`practice_session_questions`). Pool membership alone does not block.
   */
  async usedByActiveMission(questionId: string, today: string): Promise<boolean> {
    const key = idOf(questionId)
    if (key === null) return false
    const rows = await this.db.$queryRaw<{ used: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM practice_session_questions psq
          JOIN practice_sessions ps ON ps.id = psq.session_id
          JOIN missions m ON m.id = ps.mission_id
         WHERE psq.question_id = ${key} AND m.mission_date >= ${today}::date) AS used`
    return rows[0]?.used === true
  }

  /** An OPEN (in progress, not submitted) practice session of any pupil holds the question: its served list is stored, so the content must not change under it. */
  async heldByOpenSession(questionId: string): Promise<boolean> {
    const key = idOf(questionId)
    if (key === null) return false
    const rows = await this.db.$queryRaw<{ held: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM practice_session_questions psq JOIN practice_sessions ps ON ps.id = psq.session_id
         WHERE psq.question_id = ${key} AND ps.status = 'in_progress') AS held`
    return rows[0]?.held === true
  }

  /** The Ulang Kaji rows that point at the question (a delete leaves none behind; the table has no FK to questions). */
  async dropRevisionRows(questionId: string): Promise<void> {
    const key = idOf(questionId)
    if (key === null) return
    await this.db.revisionQueue.deleteMany({ where: { questionId: key } })
  }
}
