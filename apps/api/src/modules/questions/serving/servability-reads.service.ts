import { Inject, Injectable } from '@nestjs/common'
import {
  SERVABILITY_ACTIVITIES,
  SERVABILITY_ACTIVITY_LABELS,
  SERVABILITY_HUB_CARDS,
  SERVABILITY_PAPER_STATUSES,
  SERVABILITY_REASON_MS,
  type ServabilityHubCard,
  type ServabilityActivity,
  type ServabilityBatchResult,
  type ServabilityDatabankRow,
  type ServabilityLaneQuery,
  type ServabilityOverview,
  type ServabilityPaperRow,
} from '@pp/contract'

import { idFromString, idToString, isIdString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'
import { SERVABLE_STATUS } from '../learner-visibility'
import { QuestionsRepository } from '../questions.repository'
import { Prisma } from '../../../db/generated/client'
import { DATABANK_LANE_FROM, databankLaneConds, databankServedPredicate, filterOf, janaEligibleScope } from './filters'
import { evaluate } from './rules'
import { ServabilityService } from './servability.service'

const TITLE_MAX = 90
const CHUNK = 200
/** The rows of the Bijak SPM lane: the curated (pilihan) papers, any status. The lane list and the hub card both start here. */
const PAPER_LANE_COND = Prisma.sql`p.kind = 'pilihan'`
interface PaperRow {
  id: bigint
  title: string
  status: string
  subject_id: bigint
  subject_name: string | null
}
const PAPER_STATUSES: readonly string[] = SERVABILITY_PAPER_STATUSES
const paperStatusOf = (status: string): ServabilityPaperRow['status'] => SERVABILITY_PAPER_STATUSES.find((s) => s === status) ?? 'draft'

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
    const [spmSubjects, drawn, databankTotal, paperCard] = await Promise.all([this.subjectsListed(), this.spmDraw(), this.databankLaneTotal(), this.paperLaneCard()])
    const sumOver = (by: ReadonlyMap<string, number>, only?: ReadonlySet<string>) => [...by].reduce((n, [k, v]) => n + (only === undefined || only.has(k) ? v : 0), 0)

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
      ['databank', drawn.databankServed, databankTotal, 'sql'],
      ['latih_tubi_spm', sumOver(drawn.bySubject, spmSubjects), bank, 'sql'],
      ['bab', sumOver(bab), bank, 'sql'],
      ['simulasi_paper', paperServed, onPapers.length, 'evaluated'],
      ['simulasi_kuiz', kuiz, bank, 'sql'],
      ['jana_kertas', jana, bank, 'pool'],
    ]
    // Hub cards (R1-21.1), V2 order: Databank Soalan, then Bijak SPM. Each counts the ROWS of the lane it opens.
    const card = (lane: ServabilityHubCard['lane'], total: number, attention: number): ServabilityHubCard => ({ lane, ...SERVABILITY_HUB_CARDS[lane], total, attention })
    return {
      bank,
      cards: [card('databank', databankTotal, Math.max(0, databankTotal - drawn.databankServed)), card('bijak-spm', paperCard.total, paperCard.attention)],
      activities: SERVABILITY_ACTIVITIES.map((a) => {
        const [activity, served, total, basis] = rows.find((r) => r[0] === a)!
        return { activity, label: SERVABILITY_ACTIVITY_LABELS[activity], served, total, attention: Math.max(0, total - served), basis }
      }),
    }
  }

  /**
   * The SPM draw (Latih Tubi SPM and Databank read the same one, `filterOf`), grouped by its live subject, and how many of those
   * are served in the Databank (`databankServedPredicate`: a row of the Databank lane on a Databank subject). One statement: the
   * draw's shape check is the costly part and runs once. The Databank card is `served` of the lane's total, so its `attention`
   * is the number of lane rows with a reason.
   */
  private async spmDraw(): Promise<{ bySubject: Map<string, number>; databankServed: number }> {
    const live = this.questions.scopeSql({ ...filterOf('latih_tubi_spm'), status: SERVABLE_STATUS, active: true }, false)
    const rows = await this.db.$queryRaw<{ subject_id: bigint | null; n: number; in_lane: number }[]>`
      SELECT v.subject_id AS subject_id, count(*)::int AS n, (count(*) FILTER (WHERE ${databankServedPredicate()}))::int AS in_lane
        ${live.from} WHERE ${live.where} GROUP BY 1`
    return {
      bySubject: new Map(rows.flatMap((r) => (r.subject_id === null ? [] : [[idToString(r.subject_id), r.n] as const]))),
      databankServed: rows.reduce((n, r) => n + r.in_lane, 0),
    }
  }

  /** Rows of the Databank lane (`databankLaneConds`: the lane and the card use ONE scope). */
  private async databankLaneTotal(): Promise<number> {
    const rows = await this.db.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n ${DATABANK_LANE_FROM} WHERE ${Prisma.join(databankLaneConds(), ' AND ')}`
    return rows[0]?.n ?? 0
  }

  /** Lane "Databank Soalan": questions of the Databank subjects (newest first), each with its Databank reasons. */
  async databankLane(q: ServabilityLaneQuery): Promise<Paged<ServabilityDatabankRow>> {
    const conds = databankLaneConds()
    if (q.subjectId !== undefined) conds.push(isIdString(q.subjectId) ? Prisma.sql`v.subject_id = ${idFromString(q.subjectId)}` : Prisma.sql`FALSE`)
    if (q.status !== undefined) conds.push(Prisma.sql`v.status = ${q.status}`)
    if (q.search) conds.push(Prisma.sql`v.stem_ms ILIKE ${like(q.search)}`)
    const where = Prisma.join(conds, ' AND ')
    const from = DATABANK_LANE_FROM
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

  /**
   * Lane "Bijak SPM": curated papers (newest first). V2 (`SpmAttention::brokenSimulasiPaperIds`) flags only PUBLISHED papers: one
   * that has no question ("Disajikan tetapi tiada soalan") and, here, the placed questions the bridge cannot serve, by reason.
   * The hub card counts the same rows (`paperLaneCard`), so card and lane cannot differ.
   */
  async paperLane(q: ServabilityLaneQuery): Promise<Paged<ServabilityPaperRow>> {
    const statusOk = q.status === undefined || PAPER_STATUSES.includes(q.status)
    const conds: Prisma.Sql[] = [PAPER_LANE_COND, statusOk ? Prisma.sql`TRUE` : Prisma.sql`FALSE`]
    if (q.status !== undefined && statusOk) conds.push(Prisma.sql`p.status = ${q.status}`)
    if (q.subjectId !== undefined) conds.push(isIdString(q.subjectId) ? Prisma.sql`p.subject_id = ${idFromString(q.subjectId)}` : Prisma.sql`FALSE`)
    if (q.search) conds.push(Prisma.sql`p.title ILIKE ${like(q.search)}`)
    const where = Prisma.join(conds, ' AND ')
    const offset = (q.page - 1) * q.pageSize
    const [papers, totals] = await Promise.all([
      this.db.$queryRaw<PaperRow[]>`
        SELECT p.id, p.title, p.status, p.subject_id, (SELECT s.name FROM subjects s WHERE s.id = p.subject_id) AS subject_name
          FROM papers p WHERE ${where} ORDER BY p.id DESC LIMIT ${q.pageSize} OFFSET ${offset}`,
      this.db.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM papers p WHERE ${where}`,
    ])
    return { rows: await this.paperRows(papers), page: q.page, pageSize: q.pageSize, total: totals[0]?.n ?? 0 }
  }

  /** Hub card "Bijak SPM": every row of the lane (no filter), counted. A paper row needs attention when it carries a reason. */
  private async paperLaneCard(): Promise<{ total: number; attention: number }> {
    const papers = await this.db.$queryRaw<PaperRow[]>`
      SELECT p.id, p.title, p.status, p.subject_id, (SELECT s.name FROM subjects s WHERE s.id = p.subject_id) AS subject_name
        FROM papers p WHERE ${PAPER_LANE_COND} ORDER BY p.id DESC`
    const rows = await this.paperRows(papers)
    return { total: rows.length, attention: rows.filter((r) => r.attention.length > 0).length }
  }

  /** The lane rows of these papers: placed-question counts for all, reasons for the published ones. */
  private async paperRows(papers: readonly PaperRow[]): Promise<ServabilityPaperRow[]> {
    const paperIds = papers.map((p) => p.id)
    const placements =
      paperIds.length === 0
        ? []
        : await this.db.$queryRaw<{ paper_id: bigint; question_id: bigint }[]>`
            SELECT ps.paper_id, pl.question_id FROM paper_placements pl JOIN paper_sections ps ON ps.id = pl.paper_section_id
             WHERE ps.paper_id = ANY(${paperIds}::bigint[])`
    const published = new Set(papers.filter((p) => p.status === 'published').map((p) => p.id))
    const toEvaluate = new Set(placements.filter((p) => published.has(p.paper_id)).map((p) => idToString(p.question_id)))
    const results = new Map<string, ReturnType<typeof evaluate>>()
    for (const part of chunks([...toEvaluate])) {
      for (const [id, f] of await this.servability.factsOf(part)) results.set(id, evaluate({ ...f, onPublishedPaper: true }, 'simulasi_paper'))
    }
    return papers.map((p) => {
      const ids = placements.filter((x) => x.paper_id === p.id).map((x) => idToString(x.question_id))
      const counts = new Map<string, { code: ServabilityPaperRow['attention'][number]['code']; message: string; count: number }>()
      let attentionCount = 0
      if (published.has(p.id) && ids.length === 0) counts.set('paper_empty', { code: 'paper_empty', message: SERVABILITY_REASON_MS.paper_empty, count: 1 })
      for (const id of published.has(p.id) ? ids : []) {
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
        status: paperStatusOf(p.status),
        questionCount: ids.length,
        attentionCount,
        attention: [...counts.values()],
      }
    })
  }

  // --- helpers -------------------------------------------------------------------------------------

  /** Subject ids on the Latih Tubi list (any SPM configuration row). */
  private async subjectsListed(): Promise<Set<string>> {
    const rows = await this.db.$queryRaw<{ subject_id: bigint }[]>`SELECT subject_id FROM spm_subject_configs`
    return new Set(rows.map((r) => idToString(r.subject_id)))
  }

  private async questionsOnPublishedPapers(): Promise<string[]> {
    const rows = await this.db.$queryRaw<{ question_id: bigint }[]>`
      SELECT DISTINCT pl.question_id FROM paper_placements pl
        JOIN paper_sections ps ON ps.id = pl.paper_section_id JOIN papers p ON p.id = ps.paper_id
       WHERE p.status = 'published' AND p.kind <> 'jana' ORDER BY pl.question_id`
    return rows.map((r) => idToString(r.question_id))
  }

  /**
   * Jana pool: the questions the base eligibility (unit, TP, marks, key, tag review) accepts, counted in ONE SQL statement
   * (`janaEligibleScope`, the twin of `describeQuestion` over the pool facts, proven equal id by id by `servability-jana-count.spec.ts`). It replaces
   * loading every approved question of every subject (1.2 s on 5,000, minutes on the real bank).
   */
  private async janaEligible(): Promise<number> {
    const { from, where } = janaEligibleScope()
    const rows = await this.db.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n ${from} WHERE ${where}`
    return rows[0]?.n ?? 0
  }
}
