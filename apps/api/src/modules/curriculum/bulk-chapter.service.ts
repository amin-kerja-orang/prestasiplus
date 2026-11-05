import { Inject, Injectable } from '@nestjs/common'
import {
  BULK_CHAPTER_CAP,
  BulkChapterRequestSchema,
  QUESTION_MESSAGES,
  type BulkChapterRequest,
  type BulkChapterResult,
  type ChapterCoverageRow,
} from '@pp/contract'

import { AUDIT_ACTIONS, AuditService } from '../../common/audit'
import { ApiError } from '../../common/errors/api-error'
import { Prisma } from '../../db/generated/client'
import { idToString } from '../../db/ids'
import { PrismaService } from '../../db/prisma.service'
import { adminFilterConds, adminFilterOf } from '../questions/admin-filter'
import { FILTER_MAX, FILTER_MESSAGE, SEARCH_MAX, SEARCH_MESSAGE } from '../questions/http/parse'
import type { AdminListFilter } from '../questions/types'
import type { AuditActor } from './actor'
import { CurriculumRepository, type Chapter } from './curriculum.repository'
import { chapterNotFound, levelNotFound, subjectNotFound } from './errors'
import { asRecord, integerMessage, parseId, validateBody } from './validation'

/** Rows one bulk-chapter run updates at most (D115; own constant, not `FILTER_ACTION_CAP`). Defined in the contract so the UI shows the same number. */
export { BULK_CHAPTER_CAP }

type Selection = { kind: 'ids'; ids: bigint[] } | { kind: 'filter'; filter: Omit<AdminListFilter, 'page' | 'pageSize'> }

/**
 * Bulk "Tetapkan Bab" (API-DSKP-09, DM-17) and the Bab coverage counts (API-DSKP-10).
 *
 * The bulk call sets `question_versions.chapter_id` in place on the LIVE approved version of each question: no new version, no status or
 * servability change, no unit/SP/TP derivation (D89, FR-ADM-C05.3). The rows come from the same admin filter as `GET /questions`
 * (`adminFilterConds`, over the latest version) or from an id list. Per matched question: eligible when its live version is approved, the
 * Bab's subject and level equal the version's, and it has no Bab (unless `overwrite`); every other matched question is `refused` (one number).
 */
@Injectable()
export class CurriculumBulkChapterService {
  constructor(
    @Inject(CurriculumRepository) private readonly repo: CurriculumRepository,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  /**
   * One bulk run. `cap` is a parameter only so a test can use a small one; the route always passes `BULK_CHAPTER_CAP`.
   * Order of checks: body 422, unknown Bab 404, stale `expectedCount` 409 (nothing written), then the update and its counts-only audit row
   * in ONE transaction. A dry run counts only: no write, no audit row, `auditId` null.
   */
  async run(actor: AuditActor, rawBody: unknown, cap: number = BULK_CHAPTER_CAP): Promise<BulkChapterResult> {
    if (!Number.isInteger(cap) || cap < 1) throw new RangeError('bulk-chapter cap must be a positive integer')
    const body = await validateBody(BulkChapterRequestSchema, rawBody)
    const selection = this.selectionOf(body)
    const chapterId = parseId(body.chapterId)
    const chapter = chapterId === null ? null : await this.repo.chapter(chapterId)
    if (!chapter) throw chapterNotFound()
    const dryRun = body.dryRun === true
    const overwrite = body.overwrite

    if (dryRun) {
      const counts = await this.counts(selection, chapter, overwrite)
      return this.result(counts, 0, cap, true, null)
    }

    return this.prisma.transaction(async () => {
      const counts = await this.counts(selection, chapter, overwrite)
      // The count the client showed is the number of matched rows; a different count now means the selection changed (nothing is written).
      if (body.expectedCount !== counts.matched) {
        throw ApiError.of('CONFLICT', {
          message: QUESTION_MESSAGES.filterCountChanged(body.expectedCount ?? 0, counts.matched),
          details: { expected: body.expectedCount ?? 0, actual: counts.matched },
        })
      }
      const versionIds = await this.targets(selection, chapter, overwrite, cap)
      const applied = await this.apply(versionIds, chapter.id)
      const refused = counts.matched - counts.eligible
      const auditId = await this.audit.recordWithId({
        action: AUDIT_ACTIONS.CURRICULUM_QUESTIONS_BULK_CHAPTER,
        actorUserId: actor.userId,
        actorRole: actor.role,
        targetType: 'chapter',
        targetId: idToString(chapter.id),
        requestId: actor.requestId,
        ip: actor.ip,
        isTest: actor.isTest,
        // Counts only (DM-17): never a question id.
        details: { matched: counts.matched, eligible: counts.eligible, refused, applied, dryRun: false, overwrite },
      })
      return this.result(counts, applied, cap, false, auditId)
    })
  }

  private result(counts: { matched: number; eligible: number }, applied: number, cap: number, dryRun: boolean, auditId: string | null): BulkChapterResult {
    // A run tries min(eligible, cap) rows; what is left is what a further run would still try (a dry run reports the same preview).
    const remaining = counts.eligible - Math.min(counts.eligible, cap)
    return {
      matched: counts.matched,
      eligible: counts.eligible,
      refused: counts.matched - counts.eligible,
      applied,
      cap,
      remaining,
      capped: remaining > 0,
      dryRun,
      auditId,
    }
  }

  /** The ids or the filter of the body as a selection; the filter keeps the module bounds of the question list (BE-NFR-25). */
  private selectionOf(body: BulkChapterRequest): Selection {
    if (body.ids !== undefined) {
      const ids = [...new Set(body.ids)].map(parseId).filter((id): id is bigint => id !== null)
      return { kind: 'ids', ids }
    }
    const d = body.filter ?? {}
    const fields: Record<string, string> = {}
    for (const key of ['subjectId', 'educationLevelId', 'difficultyLevel', 'dskpFilter', 'complianceFilter', 'sourceFilter'] as const) {
      if ((d[key]?.length ?? 0) > FILTER_MAX) fields[`filter.${key}`] = FILTER_MESSAGE
    }
    if ((d.search?.length ?? 0) > SEARCH_MAX) fields['filter.search'] = SEARCH_MESSAGE
    if (Object.keys(fields).length > 0) throw ApiError.of('VALIDATION_ERROR', { fields })
    return { kind: 'filter', filter: adminFilterOf(d) }
  }

  /** FROM + WHERE shared by the counts and the target read: the question, its latest version `v` (the filter's) and its live version `lv`. */
  private scope(selection: Selection, chapter: Chapter, overwrite: boolean): { from: Prisma.Sql; where: Prisma.Sql; eligible: Prisma.Sql } {
    const from = Prisma.sql`FROM questions q
      JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.latest_version_no
      LEFT JOIN question_versions lv ON lv.question_id = q.id AND lv.version_no = q.live_version_no`
    const where =
      selection.kind === 'ids'
        ? selection.ids.length === 0
          ? Prisma.sql`FALSE`
          : Prisma.sql`q.id IN (${Prisma.join(selection.ids)})`
        : Prisma.join(adminFilterConds({ ...selection.filter, page: 1, pageSize: 1 }), ' AND ')
    // A Bab without a level (not in the tree) matches no version.
    const eligible =
      chapter.educationLevelId === null
        ? Prisma.sql`FALSE`
        : Prisma.sql`(lv.status = 'approved' AND lv.subject_id = ${chapter.subjectId} AND lv.education_level_id = ${chapter.educationLevelId}${overwrite ? Prisma.empty : Prisma.sql` AND lv.chapter_id IS NULL`})`
    return { from, where, eligible }
  }

  private async counts(selection: Selection, chapter: Chapter, overwrite: boolean): Promise<{ matched: number; eligible: number }> {
    const { from, where, eligible } = this.scope(selection, chapter, overwrite)
    const rows = await this.prisma.client.$queryRaw<{ matched: number; eligible: number }[]>`
      SELECT count(*)::int AS matched, (count(*) FILTER (WHERE ${eligible}))::int AS eligible ${from} WHERE ${where}`
    return { matched: rows[0]?.matched ?? 0, eligible: rows[0]?.eligible ?? 0 }
  }

  /** Ids of the live versions to update: the first `cap` eligible questions, question id ascending (stable between runs). */
  private async targets(selection: Selection, chapter: Chapter, overwrite: boolean, cap: number): Promise<bigint[]> {
    const { from, where, eligible } = this.scope(selection, chapter, overwrite)
    const rows = await this.prisma.client.$queryRaw<{ id: bigint }[]>`
      SELECT lv.id ${from} WHERE ${where} AND ${eligible} ORDER BY q.id ASC LIMIT ${cap}`
    return rows.map((r) => r.id)
  }

  /** The one in-place UPDATE (DM-17). The `status` guard keeps a version that was withdrawn since the read out of the write. */
  private async apply(versionIds: bigint[], chapterId: bigint): Promise<number> {
    if (versionIds.length === 0) return 0
    return this.prisma.client.$executeRaw`
      UPDATE question_versions SET chapter_id = ${chapterId}, updated_at = CURRENT_TIMESTAMP
       WHERE id IN (${Prisma.join(versionIds)}) AND status = 'approved'`
  }

  // --- API-DSKP-10 ----------------------------------------------------------------------------------

  private optionalId(query: Record<string, unknown>, field: string): { value?: bigint; error?: string } {
    const raw = query[field]
    if (raw === undefined || (typeof raw === 'string' && raw.trim() === '')) return {}
    const id = typeof raw === 'string' ? parseId(raw.trim()) : null
    return id === null || id < 1n ? { error: integerMessage(field) } : { value: id }
  }

  /**
   * Per offered Subjek x Tingkatan (an active subject linked to an active, non-primary level, like the DSKP report), the live, active,
   * approved question versions: `approved`, `withChapter`, `withoutChapter`. No flag predicate exists yet (S1-T07), so every approved
   * question counts. An unknown id is 404 with the flash copy.
   */
  async coverage(rawQuery: unknown): Promise<{ rows: ChapterCoverageRow[] }> {
    const query = asRecord(rawQuery)
    const s = this.optionalId(query, 'subjectId')
    const l = this.optionalId(query, 'educationLevelId')
    if (s.error !== undefined || l.error !== undefined) {
      throw ApiError.of('VALIDATION_ERROR', {
        fields: { ...(s.error === undefined ? {} : { subjectId: s.error }), ...(l.error === undefined ? {} : { educationLevelId: l.error }) },
      })
    }
    if (s.value !== undefined && !(await this.repo.subject(s.value))) throw subjectNotFound()
    if (l.value !== undefined && !(await this.repo.level(l.value))) throw levelNotFound()
    const bySubject = s.value === undefined ? Prisma.empty : Prisma.sql`AND s.id = ${s.value}`
    const byLevel = l.value === undefined ? Prisma.empty : Prisma.sql`AND l.id = ${l.value}`
    const rows = await this.prisma.client.$queryRaw<
      { subject_id: bigint; subject_name: string; level_code: string; approved: number; with_chapter: number }[]
    >`
      SELECT s.id AS subject_id, s.name AS subject_name, l.code AS level_code,
             a.approved::int AS approved, a.with_chapter::int AS with_chapter
        FROM subject_levels sl
        JOIN subjects s ON s.id = sl.subject_id AND s.is_active
        JOIN education_levels l ON l.id = sl.education_level_id AND l.is_active AND l.stage <> 'primary'
        CROSS JOIN LATERAL (
          SELECT count(*) AS approved, count(v.chapter_id) AS with_chapter
            FROM question_versions v
            JOIN questions q ON q.id = v.question_id AND q.live_version_no = v.version_no AND q.is_active
           WHERE v.subject_id = s.id AND v.education_level_id = l.id AND v.status = 'approved'
        ) a
       WHERE true ${bySubject} ${byLevel}
       ORDER BY s.sort_order, s.id, l.sort_order, l.id`
    return {
      rows: rows.map((r) => ({
        subjectId: idToString(r.subject_id),
        subjectName: r.subject_name,
        levelCode: r.level_code,
        approved: r.approved,
        withChapter: r.with_chapter,
        withoutChapter: r.approved - r.with_chapter,
      })),
    }
  }
}
