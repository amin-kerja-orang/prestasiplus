import { Inject, Injectable } from '@nestjs/common'
import { describeQuestion } from '@pp/exam-core'
import {
  SERVABILITY_ACTIVITIES,
  SERVABILITY_ACTIVITY_LABELS,
  type ServabilityActivity,
  type ServabilityBatchResult,
  type ServabilityDatabankRow,
  type ServabilityLaneQuery,
  type ServabilityOverview,
  type ServabilityPaperRow,
} from '@pp/contract'

import { idFromString, idToString, isIdString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'
import { QuestionsBijakPoolSource } from '../bijak-pool'
import { NOT_PKSK_SQL, NOT_PRIMARY_LEVEL_SQL, SERVABLE_STATUS } from '../learner-visibility'
import { QuestionsRepository } from '../questions.repository'
import { Prisma } from '../../../db/generated/client'
import { filterOf } from './filters'
import { evaluate } from './rules'
import { ServabilityService } from './servability.service'

const TITLE_MAX = 90
const CHUNK = 200
const PAPER_STATUSES = ['draft', 'published'] as const

const like = (s: string): string => `%${s.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
const chunks = <T>(list: readonly T[], size = CHUNK): T[][] => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, (i + 1) * size))
const clip = (s: string | null): string => {
  const t = (s ?? '').replace(/\s+/g, ' ').trim()
  return t.length > TITLE_MAX ? `${t.slice(0, TITLE_MAX - 1)}…` : t
}

export interface Paged<T> {
  rows: T[]
  page: number
  pageSize: number
  total: number
}

/**
 * R1-B11 (T30): the admin reads built on `ServabilityService`: batch, hub overview and the two lanes. Read-only. Counts of the
 * draw activities are the readers' own SQL filters (`filterOf`), so the hub, the lane and the student draw cannot drift; Simulasi
 * (kertas) is evaluated over the questions on published papers (the bridge decides); Jana is the pool facts before the bridge.
 */
@Injectable()
export class ServabilityReadsService {
  constructor(
    @Inject(ServabilityService) private readonly servability: ServabilityService,
    @Inject(QuestionsRepository) private readonly questions: QuestionsRepository,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(QuestionsBijakPoolSource) private readonly pool: QuestionsBijakPoolSource,
  ) {}

  private get db() {
    return this.prisma.client
  }

  async batch(ids: readonly string[]): Promise<ServabilityBatchResult> {
    const unique = [...new Set(ids)]
    const reports = await this.servability.reports(unique)
    return {
      reports: unique.flatMap((id) => {
        const r = reports.get(id)
        return r ? [r] : []
      }),
      notFound: unique.filter((id) => !reports.has(id)),
    }
  }

  async overview(): Promise<ServabilityOverview> {
    const live = { status: SERVABLE_STATUS, active: true } as const
    const bank = await this.questions.count(live)
    const [databankSubjects, spmSubjects] = await Promise.all([this.subjectsListed(true), this.subjectsListed(false)])
    const sumOver = (by: Map<string, number>, only?: ReadonlySet<string>) => [...by].reduce((n, [k, v]) => n + (only === undefined || only.has(k) ? v : 0), 0)

    const spm = await this.questions.groupCount('subject', { ...filterOf('latih_tubi_spm'), ...live })
    const bab = await this.questions.groupCount('chapter', { ...filterOf('bab'), ...live })
    const kuiz = await this.questions.count({ ...filterOf('simulasi_kuiz'), ...live })
    const onPapers = await this.questionsOnPublishedPapers()
    let paperServed = 0
    for (const part of chunks(onPapers)) {
      const reports = await this.servability.reports(part)
      for (const r of reports.values()) if (r.activities.find((a) => a.activity === 'simulasi_paper')?.served) paperServed++
    }
    const jana = await this.janaEligible()

    const rows: [ServabilityActivity, number, number, 'sql' | 'evaluated' | 'pool'][] = [
      ['databank', sumOver(spm, databankSubjects), bank, 'sql'],
      ['latih_tubi_spm', sumOver(spm, spmSubjects), bank, 'sql'],
      ['bab', sumOver(bab), bank, 'sql'],
      ['simulasi_paper', paperServed, onPapers.length, 'evaluated'],
      ['simulasi_kuiz', kuiz, bank, 'sql'],
      ['jana_kertas', jana, bank, 'pool'],
    ]
    return {
      bank,
      activities: SERVABILITY_ACTIVITIES.map((a) => {
        const [activity, served, total, basis] = rows.find((r) => r[0] === a)!
        return { activity, label: SERVABILITY_ACTIVITY_LABELS[activity], served, total, attention: Math.max(0, total - served), basis }
      }),
    }
  }

  /** Lane "Databank Soalan": questions of the Databank subjects (newest first), each with its Databank reasons. */
  async databankLane(q: ServabilityLaneQuery): Promise<Paged<ServabilityDatabankRow>> {
    const conds: Prisma.Sql[] = [Prisma.sql`v.type = 'mcq'`, Prisma.sql`c.databank_order IS NOT NULL`, NOT_PKSK_SQL, NOT_PRIMARY_LEVEL_SQL]
    if (q.subjectId !== undefined) conds.push(isIdString(q.subjectId) ? Prisma.sql`v.subject_id = ${idFromString(q.subjectId)}` : Prisma.sql`FALSE`)
    if (q.status !== undefined) conds.push(Prisma.sql`v.status = ${q.status}`)
    if (q.search) conds.push(Prisma.sql`v.stem_ms ILIKE ${like(q.search)}`)
    const where = Prisma.join(conds, ' AND ')
    const from = Prisma.sql`FROM questions q
      JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.latest_version_no
      JOIN spm_subject_configs c ON c.subject_id = v.subject_id`
    const offset = (q.page - 1) * q.pageSize
    const [rows, totals] = await Promise.all([
      this.db.$queryRaw<{ id: bigint; stem: string | null; status: string; subject_id: bigint; subject_name: string | null }[]>`
        SELECT q.id, v.stem_ms AS stem, v.status, v.subject_id, (SELECT s.name FROM subjects s WHERE s.id = v.subject_id) AS subject_name
          ${from} WHERE ${where} ORDER BY q.id DESC LIMIT ${q.pageSize} OFFSET ${offset}`,
      this.db.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n ${from} WHERE ${where}`,
    ])
    const reports = await this.servability.reports(rows.map((r) => idToString(r.id)))
    return {
      rows: rows.map((r) => {
        const id = idToString(r.id)
        const result = reports.get(id)?.activities.find((a) => a.activity === 'databank')
        return {
          questionId: id,
          title: clip(r.stem),
          subject: { id: idToString(r.subject_id), name: r.subject_name ?? '' },
          status: r.status,
          attention: result?.reasons ?? [],
        }
      }),
      page: q.page,
      pageSize: q.pageSize,
      total: totals[0]?.n ?? 0,
    }
  }

  /** Lane "Bijak SPM": curated papers (newest first) with the placed questions the bridge cannot serve, by reason. */
  async paperLane(q: ServabilityLaneQuery): Promise<Paged<ServabilityPaperRow>> {
    const statusOk = q.status === undefined || (PAPER_STATUSES as readonly string[]).includes(q.status)
    const conds: Prisma.Sql[] = [Prisma.sql`p.kind = 'pilihan'`, statusOk ? Prisma.sql`TRUE` : Prisma.sql`FALSE`]
    if (q.status !== undefined && statusOk) conds.push(Prisma.sql`p.status = ${q.status}`)
    if (q.subjectId !== undefined) conds.push(isIdString(q.subjectId) ? Prisma.sql`p.subject_id = ${idFromString(q.subjectId)}` : Prisma.sql`FALSE`)
    if (q.search) conds.push(Prisma.sql`p.title ILIKE ${like(q.search)}`)
    const where = Prisma.join(conds, ' AND ')
    const offset = (q.page - 1) * q.pageSize
    const [papers, totals] = await Promise.all([
      this.db.$queryRaw<{ id: bigint; title: string; status: string; subject_id: bigint; subject_name: string | null }[]>`
        SELECT p.id, p.title, p.status, p.subject_id, (SELECT s.name FROM subjects s WHERE s.id = p.subject_id) AS subject_name
          FROM papers p WHERE ${where} ORDER BY p.id DESC LIMIT ${q.pageSize} OFFSET ${offset}`,
      this.db.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM papers p WHERE ${where}`,
    ])
    const paperIds = papers.map((p) => p.id)
    const placements =
      paperIds.length === 0
        ? []
        : await this.db.$queryRaw<{ paper_id: bigint; question_id: bigint }[]>`
            SELECT ps.paper_id, pl.question_id FROM paper_placements pl JOIN paper_sections ps ON ps.id = pl.paper_section_id
             WHERE ps.paper_id = ANY(${paperIds}::bigint[])`
    const results = new Map<string, ReturnType<typeof evaluate>>()
    for (const part of chunks([...new Set(placements.map((p) => idToString(p.question_id)))])) {
      for (const [id, f] of await this.servability.factsOf(part)) results.set(id, evaluate({ ...f, onPublishedPaper: true }, 'simulasi_paper'))
    }
    return {
      rows: papers.map((p) => {
        const ids = placements.filter((x) => x.paper_id === p.id).map((x) => idToString(x.question_id))
        const counts = new Map<string, { code: ServabilityPaperRow['attention'][number]['code']; message: string; count: number }>()
        let attentionCount = 0
        for (const id of ids) {
          const reasons = results.get(id)?.reasons ?? []
          if (reasons.length > 0) attentionCount++
          for (const r of reasons) {
            const c = counts.get(r.code)
            if (c) c.count++
            else counts.set(r.code, { code: r.code, message: r.message, count: 1 })
          }
        }
        return {
          paperId: idToString(p.id),
          title: p.title,
          subject: { id: idToString(p.subject_id), name: p.subject_name ?? '' },
          status: p.status === 'published' ? 'published' : 'draft',
          questionCount: ids.length,
          attentionCount,
          attention: [...counts.values()],
        }
      }),
      page: q.page,
      pageSize: q.pageSize,
      total: totals[0]?.n ?? 0,
    }
  }

  // --- helpers -------------------------------------------------------------------------------------

  /** Subject ids on the Databank list (`databankOnly`) or on the Latih Tubi list (any SPM configuration row). */
  private async subjectsListed(databankOnly: boolean): Promise<Set<string>> {
    const rows = await this.db.$queryRaw<{ subject_id: bigint }[]>`
      SELECT subject_id FROM spm_subject_configs WHERE ${databankOnly ? Prisma.sql`databank_order IS NOT NULL` : Prisma.sql`TRUE`}`
    return new Set(rows.map((r) => idToString(r.subject_id)))
  }

  private async questionsOnPublishedPapers(): Promise<string[]> {
    const rows = await this.db.$queryRaw<{ question_id: bigint }[]>`
      SELECT DISTINCT pl.question_id FROM paper_placements pl
        JOIN paper_sections ps ON ps.id = pl.paper_section_id JOIN papers p ON p.id = ps.paper_id
       WHERE p.status = 'published' AND p.kind <> 'jana' ORDER BY pl.question_id`
    return rows.map((r) => idToString(r.question_id))
  }

  /** Jana pool: questions the base eligibility (unit, TP, marks, key, tag review) accepts, over every subject with a live question. */
  private async janaEligible(): Promise<number> {
    const subjects = await this.db.$queryRaw<{ id: bigint }[]>`
      SELECT DISTINCT v.subject_id AS id FROM questions q JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.live_version_no
       WHERE q.is_active AND v.status = ${SERVABLE_STATUS} AND v.subject_id IS NOT NULL`
    let n = 0
    for (const s of subjects) for (const facts of await this.pool.candidatesOf(idToString(s.id))) if (describeQuestion(facts).reasons.length === 0) n++
    return n
  }
}
