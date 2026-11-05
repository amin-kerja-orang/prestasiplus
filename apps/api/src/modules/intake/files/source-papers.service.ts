import { Inject, Injectable } from '@nestjs/common'
import {
  INTAKE_ITEM_STATE_LABELS,
  SOURCE_PAPER_PAGE_SIZE,
  SOURCE_PAPER_SOURCE_LABEL,
  type IntakeItemState,
  type IntakePaperType,
  type SourcePaperDetail,
  type SourcePaperIssue,
  type SourcePaperListMeta,
  type SourcePaperListQuery,
  type SourcePaperQuestion,
  type SourcePaperRow,
} from '@pp/contract'

import { Prisma } from '../../../db/generated/client'
import { ApiError } from '../../../common/errors/api-error'
import { listMeta } from '../../../common/http/respond'
import { idToString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'
import { ALL_LEAVES_KEYED_SQL } from '../../questions/learner-visibility'
import { parseId } from './intake-access'

/** Items still in the review queue (same set as `OPEN` in workflow/review.service.ts and INTAKE_OPEN_STATES). */
const OPEN_ITEM_STATES = ['generated', 'needs_review', 'duplicate'] as const
const EXCERPT_MAX = 120

const openList = (): Prisma.Sql => Prisma.join(OPEN_ITEM_STATES.map((s) => Prisma.sql`${s}`))

/**
 * The ONE place that decides where "Negeri / badan" comes from. Today: the linked `source_papers.exam_board` (alias `sp`).
 * Once migration 0138 (S1-T03, DM-85) adds `intake_batches.exam_board`, change this to `nullif(btrim(b.exam_board), '')`.
 */
function negeriSql(): Prisma.Sql {
  return Prisma.sql`nullif(btrim(sp.exam_board), '')`
}

/**
 * The registry: every Admin Pusat batch (`source = 'admin'`, never a Kiriman Guru, never a Mod Pelajar test batch) that has a Tahun, with
 * the figures of its items. The scheme rule is the question module's `ALL_LEAVES_KEYED_SQL` (alias `v` = the version the item produced),
 * so the badge agrees with what a pupil is served.
 */
function papersCte(): Prisma.Sql {
  return Prisma.sql`
    WITH papers AS (
      SELECT b.id, b.subject, s.name AS subject_name, b.kertas, b.year, b.paper_type, b.status, b.created_at,
             ${negeriSql()} AS negeri,
             coalesce(a.questions, 0) AS questions,
             coalesce(a.open_items, 0) AS open_items,
             coalesce(a.unkeyed, 0) AS unkeyed,
             (b.status = 'failed' OR coalesce(a.open_items, 0) > 0) AS needs_review
        FROM intake_batches b
        LEFT JOIN source_papers sp ON sp.id = b.source_paper_id
        LEFT JOIN subjects s ON s.code = b.subject
        LEFT JOIN LATERAL (
          SELECT (count(*) FILTER (WHERE i.review_state = 'accepted' AND i.question_id IS NOT NULL))::int AS questions,
                 (count(*) FILTER (WHERE i.review_state IN (${openList()})))::int AS open_items,
                 (count(*) FILTER (WHERE i.review_state = 'accepted' AND i.question_id IS NOT NULL AND NOT ${ALL_LEAVES_KEYED_SQL}))::int AS unkeyed
            FROM intake_items i
            LEFT JOIN questions q ON q.id = i.question_id
            LEFT JOIN question_versions v ON v.question_id = q.id AND v.version_no = coalesce(i.question_version_no, q.live_version_no, q.latest_version_no)
           WHERE i.batch_id = b.id
        ) a ON true
       WHERE b.source = 'admin' AND b.year IS NOT NULL AND NOT b.is_test
    )`
}

interface PaperDbRow {
  id: bigint
  subject: string
  subject_name: string | null
  kertas: number | null
  year: number
  paper_type: string
  negeri: string | null
  questions: number
  open_items: number
  unkeyed: number
  needs_review: boolean
}

const likeOf = (text: string): string => `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`

function titleOf(r: PaperDbRow): string {
  const parts = [r.subject_name ?? r.subject, String(r.year)]
  if (r.kertas !== null) parts.push(`Kertas ${r.kertas}`)
  const base = parts.join(' ')
  return r.negeri ? `${base} - ${r.negeri}` : base
}

function toRow(r: PaperDbRow): SourcePaperRow {
  const id = idToString(r.id)
  return {
    id,
    title: titleOf(r),
    subject: r.subject,
    subjectName: r.subject_name,
    year: r.year,
    kertas: r.kertas,
    negeri: r.negeri,
    paperType: r.paper_type as IntakePaperType,
    questions: r.questions,
    source: 'intake',
    sourceLabel: SOURCE_PAPER_SOURCE_LABEL,
    needsReview: r.needs_review,
    hasScheme: r.questions > 0 && r.unkeyed === 0,
    batchId: id,
  }
}

/** Stem cut at EXCERPT_MAX characters with "...". */
export function excerptOf(stem: string | null | undefined): string {
  const flat = (stem ?? '').replace(/\s+/g, ' ').trim()
  const chars = Array.from(flat)
  return chars.length > EXCERPT_MAX ? `${chars.slice(0, EXCERPT_MAX).join('').trimEnd()}...` : flat
}

/** Sumber Kertas read model (S2-T09, API-Q-23). Read-only; the controller is Admin Pusat only. */
@Injectable()
export class SourcePapersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(query: SourcePaperListQuery): Promise<{ data: SourcePaperRow[]; meta: SourcePaperListMeta }> {
    const db = this.prisma.client
    const conds: Prisma.Sql[] = []
    if (query.subject) conds.push(Prisma.sql`p.subject = ${query.subject.toUpperCase()}`)
    if (query.year !== undefined) conds.push(Prisma.sql`p.year = ${query.year}`)
    if (query.negeri) conds.push(Prisma.sql`lower(p.negeri) = lower(${query.negeri})`)
    if (query.kertas !== undefined) conds.push(Prisma.sql`p.kertas = ${query.kertas}`)
    if (query.jenis) conds.push(Prisma.sql`p.paper_type = ${query.jenis}`)
    if (query.needsReview === true) conds.push(Prisma.sql`p.needs_review`)
    if (query.q) {
      const like = likeOf(query.q)
      conds.push(
        Prisma.sql`(p.subject ILIKE ${like} OR p.subject_name ILIKE ${like} OR p.negeri ILIKE ${like} OR p.year::text ILIKE ${like}
          OR EXISTS (SELECT 1 FROM intake_files f WHERE f.batch_id = p.id AND f.original_name ILIKE ${like}))`,
      )
    }
    const where = conds.length > 0 ? Prisma.sql`WHERE ${Prisma.join(conds, ' AND ')}` : Prisma.empty
    const offset = (query.page - 1) * SOURCE_PAPER_PAGE_SIZE

    const [rows, count, tiles, years, negeri, subjects] = await Promise.all([
      db.$queryRaw<PaperDbRow[]>(
        Prisma.sql`${papersCte()} SELECT p.* FROM papers p ${where} ORDER BY p.year DESC, p.created_at DESC, p.id DESC LIMIT ${SOURCE_PAPER_PAGE_SIZE} OFFSET ${offset}`,
      ),
      db.$queryRaw<{ n: number }[]>(Prisma.sql`${papersCte()} SELECT count(*)::int AS n FROM papers p ${where}`),
      db.$queryRaw<{ total: number; review: number }[]>(
        Prisma.sql`${papersCte()} SELECT count(*)::int AS total, (count(*) FILTER (WHERE needs_review))::int AS review FROM papers`,
      ),
      db.$queryRaw<{ year: number }[]>(Prisma.sql`${papersCte()} SELECT DISTINCT year FROM papers ORDER BY year DESC`),
      db.$queryRaw<{ negeri: string }[]>(Prisma.sql`${papersCte()} SELECT DISTINCT negeri FROM papers WHERE negeri IS NOT NULL ORDER BY negeri`),
      db.$queryRaw<{ code: string; name: string | null }[]>(Prisma.sql`${papersCte()} SELECT DISTINCT subject AS code, subject_name AS name FROM papers ORDER BY subject`),
    ])
    const meta: SourcePaperListMeta = {
      ...listMeta(query.page, SOURCE_PAPER_PAGE_SIZE, count[0]?.n ?? 0),
      totalPapers: tiles[0]?.total ?? 0,
      needsReviewCount: tiles[0]?.review ?? 0,
      options: { years: years.map((r) => r.year), negeri: negeri.map((r) => r.negeri), subjects },
    }
    return { data: rows.map(toRow), meta }
  }

  async detail(idText: string): Promise<SourcePaperDetail> {
    const id = parseId(idText)
    if (id === null) throw ApiError.of('NOT_FOUND')
    const db = this.prisma.client
    const rows = await db.$queryRaw<PaperDbRow[]>(Prisma.sql`${papersCte()} SELECT p.* FROM papers p WHERE p.id = ${id}`)
    const row = rows[0]
    if (!row) throw ApiError.of('NOT_FOUND')

    const [files, batch, openItems, questions] = await Promise.all([
      db.$queryRaw<{ original_name: string; status: string; error_code: string | null }[]>`
        SELECT original_name, status, error_code FROM intake_files WHERE batch_id = ${id} ORDER BY id`,
      db.$queryRaw<{ status: string; status_reason: string | null }[]>`SELECT status, status_reason FROM intake_batches WHERE id = ${id}`,
      db.$queryRaw<{ id: bigint; label: string; position: number; review_state: string }[]>(
        Prisma.sql`SELECT id, number_label AS label, position, review_state FROM intake_items
         WHERE batch_id = ${id} AND review_state IN (${openList()}) ORDER BY position, id`,
      ),
      db.$queryRaw<{ item_id: bigint; label: string; position: number; question_id: bigint; stem_ms: string | null; stem_en: string | null; parts: number }[]>`
        SELECT i.id AS item_id, i.number_label AS label, i.position, i.question_id, v.stem_ms, v.stem_en,
               (SELECT count(*) FROM question_parts kp WHERE kp.question_version_id = v.id)::int AS parts
          FROM intake_items i
          JOIN questions q ON q.id = i.question_id
          LEFT JOIN question_versions v ON v.question_id = q.id AND v.version_no = coalesce(i.question_version_no, q.live_version_no, q.latest_version_no)
         WHERE i.batch_id = ${id} AND i.review_state = 'accepted' AND i.question_id IS NOT NULL
         ORDER BY i.position, i.id`,
    ])

    const issues: SourcePaperIssue[] = []
    if (batch[0]?.status === 'failed') issues.push({ itemId: null, where: 'Kertas', message: batch[0].status_reason?.trim() || 'Pemprosesan kertas gagal.' })
    for (const f of files) {
      if (f.status === 'failed') issues.push({ itemId: null, where: f.original_name, message: `Fail gagal diproses${f.error_code ? ` (${f.error_code})` : ''}.` })
    }
    for (const it of openItems) {
      const label = INTAKE_ITEM_STATE_LABELS[it.review_state as IntakeItemState] ?? it.review_state
      issues.push({ itemId: idToString(it.id), where: `Soalan ${it.label || it.position}`, message: `Belum selesai disemak (${label}).` })
    }
    const questionList: SourcePaperQuestion[] = questions.map((r) => ({
      no: r.label || String(r.position),
      questionId: idToString(r.question_id),
      excerpt: excerptOf(r.stem_ms ?? r.stem_en),
      parts: r.parts ?? 0,
    }))
    return { ...toRow(row), fileNames: files.map((f) => f.original_name), issues, questionList }
  }
}
