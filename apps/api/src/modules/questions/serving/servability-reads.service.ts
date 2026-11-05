import { Inject, Injectable, Logger } from '@nestjs/common'
import {
  SERVABILITY_ACTIVITIES,
  SERVABILITY_ACTIVITY_LABELS,
  SERVABILITY_HUB_CARDS,
  SERVABILITY_PAPER_STATUSES,
  SERVABILITY_REASON_MS,
  latihTubiCellAttentionMs,
  trackingSetAttentionMs,
  type ServabilityHubCard,
  type ServabilityHubLane,
  type ServabilityLaneAttention,
  type ServabilityLaneRow,
  type ServabilityLatihTubiCell,
  type ServabilityActivity,
  type ServabilityBatchResult,
  type ServabilityDatabankRow,
  type ServabilityLaneQuery,
  type ServabilityOverviewCounts,
  type ServabilityPaperRow,
} from '@pp/contract'

import { idFromString, idToString, isIdString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'
import { DEFAULT_SET_SIZE } from '../../spm/config'
import { isStartable, setFigures } from '../../spm/rules'
import { NOT_PKSK_SQL, NOT_PRIMARY_LEVEL_SQL, SERVABLE_STATUS } from '../learner-visibility'
import { QuestionsRepository } from '../questions.repository'
import { Prisma } from '../../../db/generated/client'
import { DATABANK_LANE_FROM, databankLaneConds, databankServedPredicate, filterOf, janaEligibleScope } from './filters'
import { evaluate } from './rules'
import { ServabilityService } from './servability.service'

const TITLE_MAX = 120
const CHUNK = 200
/**
 * `papers.surface` arrives with DM-23 (S3-T06). Read through `to_jsonb`, these lanes run the same before and after that migration:
 * until then every paper is a Simulasi paper and the Kertas Subjektif lane is empty.
 */
const PAPER_SURFACE = Prisma.sql`to_jsonb(p)->>'surface'`
/** The rows of the Bijak SPM lane: the curated (pilihan) Simulasi papers, any status. The lane list and the hub card both start here. */
const PAPER_LANE_COND = Prisma.sql`p.kind = 'pilihan' AND coalesce(${PAPER_SURFACE}, 'simulasi') = 'simulasi'`
/** The rows of the Kertas Subjektif lane, any status. */
const KERTAS_SUBJEKTIF_COND = Prisma.sql`p.kind = 'pilihan' AND ${PAPER_SURFACE} = 'subjektif'`
/** The rows of the Subjektif lane: structured and essay questions by their latest version, any status. Aliases as `DATABANK_LANE_FROM`. */
const SUBJEKTIF_LANE_FROM = Prisma.sql`FROM questions q JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.latest_version_no`
const subjektifLaneConds = (): Prisma.Sql[] => [Prisma.sql`v.type IN ('structured', 'essay')`, NOT_PKSK_SQL, NOT_PRIMARY_LEVEL_SQL]
/**
 * A leaf of the row's version with no answer key: `no_scheme` on a non-MCQ leaf, `no_key` on an MCQ leaf (45 row 16, lead ruling on the
 * S3-T03 issue). The pupil read does not exclude these yet (S1-T07 adds both to the served rule); once it does, count through that function.
 */
const leafWithoutKey = (mode: Prisma.Sql): Prisma.Sql =>
  Prisma.sql`EXISTS (SELECT 1 FROM question_parts qp WHERE qp.question_version_id = v.id AND qp.mode IS NOT NULL AND ${mode}
     AND NOT EXISTS (SELECT 1 FROM answer_keys k WHERE k.part_id = qp.id))`
const NO_SCHEME_SQL = leafWithoutKey(Prisma.sql`qp.mode <> 'mcq'`)
const NO_KEY_SQL = leafWithoutKey(Prisma.sql`qp.mode = 'mcq'`)
/** The label V2 gives a Tracking A set in its row meta (30 Q-02). */
const TRACKING_KIND = 'ramalan'
interface PaperRow {
  id: bigint
  title: string
  status: string
  subject_id: bigint
  subject_name: string | null
}
const PAPER_STATUSES: readonly string[] = SERVABILITY_PAPER_STATUSES
/** A count in a card's attention line, as the hub prints its totals: "2,428". */
const countText = (n: number): string => n.toLocaleString('en-US')

const paperStatusOf = (status: string): ServabilityPaperRow['status'] => SERVABILITY_PAPER_STATUSES.find((s) => s === status) ?? 'draft'

const like = (s: string): string => `%${s.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
/** "#451518 · Sains · Tingkatan 4 · 4 pilihan": a part that has no value is left out. */
const metaLine = (...parts: (string | null)[]): string => parts.filter((p): p is string => p !== null && p !== '').join(' · ')
const pageOf = <T>(rows: readonly T[], q: ServabilityLaneQuery): T[] => rows.slice((q.page - 1) * q.pageSize, q.page * q.pageSize)
const chunks = <T>(list: readonly T[], size = CHUNK): T[][] => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, (i + 1) * size))
const clip = (s: string | null): string => {
  const t = (s ?? '').replace(/\s+/g, ' ').trim()
  return t.length > TITLE_MAX ? `${t.slice(0, TITLE_MAX - 1)}…` : t
}

/**
 * At most `max` calls run at once; the others wait their turn in order. The overview starts about eight heavy reads; the database
 * pool is small (10 connections by default), so they run four at a time instead of taking the whole pool from live requests.
 */
function concurrencyLimit(max: number): <T>(fn: () => Promise<T>) => Promise<T> {
  let active = 0
  const waiting: (() => void)[] = []
  return async <T>(fn: () => Promise<T>): Promise<T> => {
    if (active >= max) await new Promise<void>((resolve) => waiting.push(resolve))
    else active++
    try {
      return await fn()
    } finally {
      const next = waiting.shift()
      if (next) next()
      else active--
    }
  }
}

/** Overview reads running at once (the pool is 10; a paper evaluation uses several connections itself). */
export const OVERVIEW_PARALLEL = 4

type PaperEvaluation = ReturnType<typeof evaluate>

/**
 * The questions on published papers with their Simulasi (kertas) verdict: evaluated once and shared by the card and the activity row.
 * An id the bank did not return is in `results` with `null` ("looked up, not there"), so no second pass asks for it again.
 */
interface PaperQuestionEvaluations {
  ids: string[]
  results: Map<string, PaperEvaluation | null>
}

export interface Paged<T> {
  rows: T[]
  page: number
  pageSize: number
  total: number
}

/** A page of a lane whose items are not its rows: Latih Tubi lists cells and counts questions. */
export type LatihTubiLanePage = Paged<ServabilityLatihTubiCell> & { count: number; switchEnabled: boolean }

interface LatihTubiCellCount {
  subject_id: bigint | null
  subject_name: string | null
  level_id: bigint | null
  level_name: string | null
  n: number
}

/** The Subjektif hub card: rows of the lane, rows with a reason, and the rows per reason. */
interface SubjektifFigures {
  total: number
  attention: number
  noScheme: number
  noKey: number
}

/** One Tracking A set with the pupil's figures for it (`SpmTrackingService.views`: the same eligibility and the same size). */
interface TrackingSetView {
  id: string
  subjectId: string
  subjectName: string
  title: string
  size: number
  eligible: number
  status: string
  complete: boolean
}

/**
 * R1-B11 (T30): the admin reads built on `ServabilityService`: batch, hub overview and the two lanes. Read-only. Counts of the
 * draw activities are the readers' own SQL filters (`filterOf`), so the hub, the lane and the student draw cannot drift; Simulasi
 * (kertas) is evaluated over the questions on published papers (the bridge decides); Jana is the pool facts before the bridge.
 */
@Injectable()
export class ServabilityReadsService {
  private readonly logger = new Logger(ServabilityReadsService.name)

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

  async overview(): Promise<ServabilityOverviewCounts> {
    const live = { status: SERVABLE_STATUS, active: true } as const
    // REQ-B-022(a): the reads do not depend on each other, so they run together (four at a time, longest first) instead of one after
    // the other. The questions on published papers are evaluated ONCE: the Bijak SPM card and the Simulasi (kertas) row both use it.
    const run = concurrencyLimit(OVERVIEW_PARALLEL)
    const paperQuestions = run(() => this.evaluatePublishedPaperQuestions())
    // Every read of the overview goes through `run`, the card and the subject list included, so no more than OVERVIEW_PARALLEL hold pool connections at once.
    const paperCardP = paperQuestions.then((evaluated) => run(() => this.paperLaneCard(evaluated.results)))
    const [onPapers, drawn, bab, kuiz, jana, databankTotal, bank, spmSubjects, paperCard, trackingCard, subjektifCard, kertasTotal] = await Promise.all([
      paperQuestions,
      run(() => this.spmDraw()),
      run(() => this.questions.groupCount('chapter', { ...filterOf('bab'), ...live })),
      run(() => this.questions.count({ ...filterOf('simulasi_kuiz'), ...live })),
      run(() => this.janaEligible()),
      run(() => this.databankLaneTotal()),
      run(() => this.questions.count(live)),
      run(() => this.subjectsListed()),
      paperCardP,
      run(() => this.soft(() => this.trackingCard())),
      run(() => this.soft(() => this.subjektifFigures())),
      run(() => this.soft(() => this.kertasSubjektifFigures())),
    ])
    const sumOver = (by: ReadonlyMap<string, number>, only?: ReadonlySet<string>) => [...by].reduce((n, [k, v]) => n + (only === undefined || only.has(k) ? v : 0), 0)
    let paperServed = 0
    for (const r of onPapers.results.values()) if (r?.served) paperServed++

    const latihTubiServed = sumOver(drawn.bySubject, spmSubjects)
    const rows: [ServabilityActivity, number, number, 'sql' | 'evaluated' | 'pool'][] = [
      ['databank', drawn.databankServed, databankTotal, 'sql'],
      ['latih_tubi_spm', latihTubiServed, bank, 'sql'],
      ['bab', sumOver(bab), bank, 'sql'],
      ['simulasi_paper', paperServed, onPapers.ids.length, 'evaluated'],
      ['simulasi_kuiz', kuiz, bank, 'sql'],
      ['jana_kertas', jana, bank, 'pool'],
    ]
    // Hub cards (FR-ADM-Q01.1), PRD order. Each counts the ROWS of the lane it opens; Latih Tubi counts the questions of its cells.
    const card = (lane: ServabilityHubLane, total: number, attention: number): ServabilityHubCard => {
      const copy = SERVABILITY_HUB_CARDS[lane]
      return { lane, ...copy, total, attention, attentionLines: attention > 0 ? [{ count: attention, text: `${countText(attention)} ${copy.attentionLabel}` }] : [] }
    }
    const failed = (lane: ServabilityHubLane): ServabilityHubCard => ({ ...card(lane, 0, 0), failed: true })
    const subjektif = (f: SubjektifFigures): ServabilityHubCard => {
      const lines: ServabilityLaneAttention[] = []
      if (f.noScheme > 0) lines.push({ count: f.noScheme, text: `${countText(f.noScheme)} ${SERVABILITY_HUB_CARDS.subjektif.attentionLabel}` })
      if (f.noKey > 0) lines.push({ count: f.noKey, text: `${countText(f.noKey)} tiada kunci jawapan` })
      return { ...card('subjektif', f.total, f.attention), attentionLines: lines }
    }
    return {
      bank,
      cards: [
        card('databank', databankTotal, Math.max(0, databankTotal - drawn.databankServed)),
        trackingCard === null ? failed('tracking-a') : card('tracking-a', trackingCard.total, trackingCard.attention),
        subjektifCard === null ? failed('subjektif') : subjektif(subjektifCard),
        card('bijak-spm', paperCard.total, paperCard.attention),
        kertasTotal === null ? failed('kertas-subjektif') : card('kertas-subjektif', kertasTotal.total, kertasTotal.empty),
        card('latih-tubi', bank, Math.max(0, bank - latihTubiServed)),
      ],
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
      this.db.$queryRaw<{ id: bigint; stem: string | null; status: string; subject_id: bigint; subject_name: string | null; level_name: string | null; options: number }[]>`
        SELECT q.id, v.stem_ms AS stem, v.status, v.subject_id, (SELECT s.name FROM subjects s WHERE s.id = v.subject_id) AS subject_name,
               (SELECT l.name FROM education_levels l WHERE l.id = v.education_level_id) AS level_name,
               (SELECT count(*)::int FROM part_options o JOIN question_parts qp ON qp.id = o.part_id WHERE qp.question_version_id = v.id) AS options
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
          meta: metaLine(`#${id}`, r.subject_name, r.level_name, `${String(r.options)} pilihan`),
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
  private async paperLaneCard(evaluated?: ReadonlyMap<string, PaperEvaluation | null>): Promise<{ total: number; attention: number }> {
    const papers = await this.db.$queryRaw<PaperRow[]>`
      SELECT p.id, p.title, p.status, p.subject_id, (SELECT s.name FROM subjects s WHERE s.id = p.subject_id) AS subject_name
        FROM papers p WHERE ${PAPER_LANE_COND} ORDER BY p.id DESC`
    const rows = await this.paperRows(papers, evaluated)
    return { total: rows.length, attention: rows.filter((r) => r.attention.length > 0).length }
  }

  /** The lane rows of these papers: placed-question counts for all, reasons for the published ones. */
  private async paperRows(papers: readonly PaperRow[], evaluated?: ReadonlyMap<string, PaperEvaluation | null>): Promise<ServabilityPaperRow[]> {
    const paperIds = papers.map((p) => p.id)
    const placements =
      paperIds.length === 0
        ? []
        : await this.db.$queryRaw<{ paper_id: bigint; question_id: bigint }[]>`
            SELECT ps.paper_id, pl.question_id FROM paper_placements pl JOIN paper_sections ps ON ps.id = pl.paper_section_id
             WHERE ps.paper_id = ANY(${paperIds}::bigint[])`
    // Intentionally NOT `paperHeld`: the servability verdict covers published papers only; `paperHeld` is the served/pinned lock (it also holds a withdrawn paper with sittings).
    const published = new Set(papers.filter((p) => p.status === 'published').map((p) => p.id))
    const toEvaluate = new Set(placements.filter((p) => published.has(p.paper_id)).map((p) => idToString(p.question_id)))
    const results = new Map<string, PaperEvaluation | null>()
    // Verdicts the caller already has (the overview) are not computed again, a missing id (`null`) included; any other id is evaluated here as before.
    for (const id of toEvaluate) if (evaluated?.has(id)) results.set(id, evaluated.get(id) ?? null)
    for (const part of chunks([...toEvaluate].filter((id) => !results.has(id)))) {
      // onPublishedPaper is forced true: every id here was read from the placements of a PUBLISHED, non-jana paper, which is exactly what
      // the fact tests, so the value is the same (see the REQ-B-022(a) deviation row).
      const facts = await this.servability.factsOf(part, { jana: false })
      for (const id of part) {
        const f = facts.get(id)
        results.set(id, f ? evaluate({ ...f, onPublishedPaper: true }, 'simulasi_paper') : null)
      }
    }
    return papers.map((p) => {
      const ids = placements.filter((x) => x.paper_id === p.id).map((x) => idToString(x.question_id))
      const counts = new Map<string, { code: ServabilityPaperRow['attention'][number]['code']; message: string; count: number }>()
      let attentionCount = 0
      if (published.has(p.id) && ids.length === 0) counts.set('paper_empty', { code: 'paper_empty', message: SERVABILITY_REASON_MS.paper_empty, count: 1 })
      for (const id of published.has(p.id) ? ids : []) {
        // A placed id the bank does not return (a PoC placeholder, PKSK, Darjah) cannot be served: say so (REQ-B-033), never "no reason".
        const result = results.get(id)
        const reasons = result ? result.reasons : [{ code: 'question_missing' as const, message: SERVABILITY_REASON_MS.question_missing }]
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

  /** Options of every lane's `Subjek` filter (02-01, SR-13): every active subject, by `Susunan` then name. */
  async activeSubjects(): Promise<{ id: string; name: string }[]> {
    const rows = await this.db.$queryRaw<{ id: bigint; name: string }[]>`SELECT id, name FROM subjects WHERE is_active ORDER BY sort_order, name, id`
    return rows.map((r) => ({ id: idToString(r.id), name: r.name }))
  }

  /**
   * Lane "Latih Tubi" (FR-ADM-Q02.4): subjects x Tingkatan. A cell's `total` is the approved active bank and its `servable` the Latih Tubi
   * draw (`filterOf`, the pupil's own filter), so the cells add up to the `latih_tubi_spm` row of the overview. The lane holds no
   * question status, so `status` is ignored. A question with no subject has no cell but stays in `count` when nothing is filtered.
   */
  async latihTubiLane(q: ServabilityLaneQuery): Promise<LatihTubiLanePage> {
    const live = { status: SERVABLE_STATUS, active: true } as const
    const [totals, servable, listed, switchEnabled] = await Promise.all([
      this.latihTubiCounts(this.questions.scopeSql(live, false)),
      this.latihTubiCounts(this.questions.scopeSql({ ...filterOf('latih_tubi_spm'), ...live }, false)),
      this.subjectsListed(),
      this.latihTubiSwitch(),
    ])
    const key = (r: LatihTubiCellCount): string => `${idToString(r.subject_id ?? 0n)}:${r.level_id === null ? '' : idToString(r.level_id)}`
    const served = new Map(servable.flatMap((r) => (r.subject_id !== null && listed.has(idToString(r.subject_id)) ? [[key(r), r.n] as const] : [])))
    const term = q.search?.toLowerCase()
    const cells = totals.flatMap((r): ServabilityLatihTubiCell[] => {
      if (r.subject_id === null) return []
      const subject = { id: idToString(r.subject_id), name: r.subject_name ?? '' }
      if (q.subjectId !== undefined && subject.id !== q.subjectId) return []
      if (term !== undefined && term !== '' && !subject.name.toLowerCase().includes(term)) return []
      const n = served.get(key(r)) ?? 0
      return [
        {
          id: key(r),
          title: metaLine(subject.name, r.level_name),
          meta: metaLine(`#${subject.id}`, `${String(n)} soalan`),
          status: switchEnabled ? 'open' : 'closed',
          attention: r.n > n ? [latihTubiCellAttentionMs(r.n - n)] : [],
          actions: [],
          subject,
          level: r.level_id === null ? null : { id: idToString(r.level_id), name: r.level_name ?? '' },
          servable: n,
          total: r.n,
        },
      ]
    })
    const unfiltered = q.subjectId === undefined && (term === undefined || term === '')
    const noSubject = unfiltered ? totals.reduce((sum, r) => sum + (r.subject_id === null ? r.n : 0), 0) : 0
    return {
      rows: pageOf(cells, q),
      page: q.page,
      pageSize: q.pageSize,
      total: cells.length,
      count: cells.reduce((sum, c) => sum + c.total, noSubject),
      switchEnabled,
    }
  }

  private latihTubiCounts(scope: { from: Prisma.Sql; where: Prisma.Sql }): Promise<LatihTubiCellCount[]> {
    return this.db.$queryRaw<LatihTubiCellCount[]>`
      SELECT v.subject_id, sub.name AS subject_name, v.education_level_id AS level_id, lvl.name AS level_name, count(*)::int AS n
        ${scope.from} LEFT JOIN subjects sub ON sub.id = v.subject_id LEFT JOIN education_levels lvl ON lvl.id = v.education_level_id
       WHERE ${scope.where}
       GROUP BY v.subject_id, sub.name, sub.sort_order, v.education_level_id, lvl.name, lvl.sort_order
       ORDER BY sub.sort_order, sub.name, lvl.sort_order`
  }

  /** The Kawalan Ciri key `latih-tubi` (API-ADM-09). The table arrives with S0-T10; until then, and for a key with no row, it is ON (FR-ADM-N06.4). */
  private async latihTubiSwitch(): Promise<boolean> {
    const [table] = await this.db.$queryRaw<{ present: boolean }[]>`SELECT to_regclass('feature_flags') IS NOT NULL AS present`
    if (!table?.present) return true
    const [row] = await this.db.$queryRaw<{ enabled: boolean }[]>`SELECT enabled FROM feature_flags WHERE key = 'latih-tubi'`
    return row?.enabled ?? true
  }

  /** Lane "Tracking A": one row per set, by title (02-06). A set is incomplete when the pupil's eligibility leaves fewer questions than its size. */
  async trackingLane(q: ServabilityLaneQuery): Promise<Paged<ServabilityLaneRow>> {
    const term = q.search?.toLowerCase()
    const sets = (await this.trackingSets())
      .filter((v) => q.subjectId === undefined || v.subjectId === q.subjectId)
      .filter((v) => term === undefined || term === '' || v.title.toLowerCase().includes(term))
      .sort((x, y) => x.title.localeCompare(y.title, 'ms', { numeric: true }))
    const page = pageOf(sets, q)
    const available = await this.trackingAvailable(page.filter((v) => !v.complete).map((v) => v.subjectId))
    return {
      rows: page.map((v) => ({
        id: v.id,
        title: v.title,
        meta: metaLine(`#${v.id}`, TRACKING_KIND, `${String(v.eligible)} soalan`),
        status: v.status,
        attention: v.complete ? [] : [trackingSetAttentionMs(v.eligible, v.size, available.get(v.subjectId) ?? 0)],
        actions: ['edit'],
      })),
      page: q.page,
      pageSize: q.pageSize,
      total: sets.length,
    }
  }

  private async trackingCard(): Promise<{ total: number; attention: number }> {
    const sets = await this.trackingSets()
    return { total: sets.length, attention: sets.filter((v) => !v.complete).length }
  }

  /** Every set with its figures, computed as `SpmTrackingService.views` does for the pupil: `eligibleAmong` per subject, `setFigures`, target size or the default. */
  private async trackingSets(): Promise<TrackingSetView[]> {
    const rows = await this.db.$queryRaw<{ id: bigint; subject_id: bigint; subject_name: string; year: number; set_no: number; target_size: number | null; question_ids: bigint[] }[]>`
      SELECT t.id, t.subject_id, s.name AS subject_name, t.year, t.set_no, c.target_size,
             coalesce(array_agg(i.question_id ORDER BY i.position) FILTER (WHERE i.question_id IS NOT NULL), '{}') AS question_ids
        FROM spm_tracking_sets t JOIN subjects s ON s.id = t.subject_id
        LEFT JOIN spm_subject_configs c ON c.subject_id = t.subject_id
        LEFT JOIN spm_tracking_set_questions i ON i.set_id = t.id
       GROUP BY t.id, s.name, c.target_size`
    const bySubject = new Map<string, Set<string>>()
    for (const r of rows) {
      const ids = bySubject.get(idToString(r.subject_id)) ?? new Set<string>()
      for (const id of r.question_ids) ids.add(idToString(id))
      bySubject.set(idToString(r.subject_id), ids)
    }
    const eligible = new Map<string, Set<string>>()
    for (const [subjectId, ids] of bySubject) eligible.set(subjectId, new Set(await this.questions.eligibleAmong([...ids], { subjectId })))
    return rows.map((r) => {
      const subjectId = idToString(r.subject_id)
      const size = r.target_size ?? DEFAULT_SET_SIZE
      const ready = eligible.get(subjectId) ?? new Set<string>()
      const count = r.question_ids.filter((id) => ready.has(idToString(id))).length
      const { status } = setFigures(count, size)
      return {
        id: idToString(r.id),
        subjectId,
        subjectName: r.subject_name,
        title: `${r.subject_name} · ${String(r.year)} Set ${String(r.set_no)}`,
        size,
        eligible: count,
        status,
        complete: isStartable(status),
      }
    })
  }

  /** What could fill a set of these subjects: servable questions and groups, a group counting once (D90). */
  private async trackingAvailable(subjectIds: readonly string[]): Promise<Map<string, number>> {
    const unique = [...new Set(subjectIds)]
    const out = new Map<string, number>()
    for (const subjectId of unique) {
      const { from, where } = this.questions.scopeSql({ subjectId, status: SERVABLE_STATUS, active: true }, true)
      const [row] = await this.db.$queryRaw<{ n: number }[]>`SELECT ((count(*) FILTER (WHERE q.group_id IS NULL)) + count(DISTINCT q.group_id))::int AS n ${from} WHERE ${where}`
      out.set(subjectId, row?.n ?? 0)
    }
    return out
  }

  /** Lane "Subjektif" (FR-ADM-Q23.3): structured and essay questions, newest first, each with its `no_scheme` and `no_key` sentences. */
  async subjektifLane(q: ServabilityLaneQuery): Promise<Paged<ServabilityLaneRow>> {
    const conds = subjektifLaneConds()
    if (q.subjectId !== undefined) conds.push(isIdString(q.subjectId) ? Prisma.sql`v.subject_id = ${idFromString(q.subjectId)}` : Prisma.sql`FALSE`)
    if (q.status !== undefined) conds.push(Prisma.sql`v.status = ${q.status}`)
    if (q.search) conds.push(Prisma.sql`v.stem_ms ILIKE ${like(q.search)}`)
    const where = Prisma.join(conds, ' AND ')
    const offset = (q.page - 1) * q.pageSize
    const [rows, totals] = await Promise.all([
      this.db.$queryRaw<{ id: bigint; stem: string | null; status: string; subject_name: string | null; level_name: string | null; no_scheme: boolean; no_key: boolean }[]>`
        SELECT q.id, v.stem_ms AS stem, v.status, (SELECT s.name FROM subjects s WHERE s.id = v.subject_id) AS subject_name,
               (SELECT l.name FROM education_levels l WHERE l.id = v.education_level_id) AS level_name,
               ${NO_SCHEME_SQL} AS no_scheme, ${NO_KEY_SQL} AS no_key
          ${SUBJEKTIF_LANE_FROM} WHERE ${where} ORDER BY q.id DESC LIMIT ${q.pageSize} OFFSET ${offset}`,
      this.db.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n ${SUBJEKTIF_LANE_FROM} WHERE ${where}`,
    ])
    return {
      rows: rows.map((r) => {
        const id = idToString(r.id)
        const attention = [...(r.no_scheme ? [SERVABILITY_REASON_MS.no_scheme] : []), ...(r.no_key ? [SERVABILITY_REASON_MS.no_key] : [])]
        return { id, title: clip(r.stem), meta: metaLine(`#${id}`, r.subject_name, r.level_name), status: r.status, attention, actions: ['preview', 'edit'] }
      }),
      page: q.page,
      pageSize: q.pageSize,
      total: totals[0]?.n ?? 0,
    }
  }

  private async subjektifFigures(): Promise<SubjektifFigures> {
    const [row] = await this.db.$queryRaw<SubjektifFigures[]>`
      SELECT count(*)::int AS total, (count(*) FILTER (WHERE ${NO_SCHEME_SQL} OR ${NO_KEY_SQL}))::int AS attention,
             (count(*) FILTER (WHERE ${NO_SCHEME_SQL}))::int AS "noScheme", (count(*) FILTER (WHERE ${NO_KEY_SQL}))::int AS "noKey"
        ${SUBJEKTIF_LANE_FROM} WHERE ${Prisma.join(subjektifLaneConds(), ' AND ')}`
    return row ?? { total: 0, attention: 0, noScheme: 0, noKey: 0 }
  }

  /** Lane "Kertas Subjektif": the papers of that surface, newest first; nothing until DM-23 exists. A paper with no placement reads "tiada kandungan" (FR-ADM-Q18.3). */
  async kertasSubjektifLane(q: ServabilityLaneQuery): Promise<Paged<ServabilityLaneRow>> {
    const conds: Prisma.Sql[] = [KERTAS_SUBJEKTIF_COND]
    if (q.status !== undefined) conds.push(Prisma.sql`p.status = ${q.status}`)
    if (q.subjectId !== undefined) conds.push(isIdString(q.subjectId) ? Prisma.sql`p.subject_id = ${idFromString(q.subjectId)}` : Prisma.sql`FALSE`)
    if (q.search) conds.push(Prisma.sql`p.title ILIKE ${like(q.search)}`)
    const where = Prisma.join(conds, ' AND ')
    const offset = (q.page - 1) * q.pageSize
    const [papers, totals] = await Promise.all([
      this.db.$queryRaw<{ id: bigint; title: string; status: string; subject_name: string | null; questions: number }[]>`
        SELECT p.id, p.title, p.status, (SELECT s.name FROM subjects s WHERE s.id = p.subject_id) AS subject_name,
               (SELECT count(*)::int FROM paper_placements pl JOIN paper_sections ps ON ps.id = pl.paper_section_id WHERE ps.paper_id = p.id) AS questions
          FROM papers p WHERE ${where} ORDER BY p.id DESC LIMIT ${q.pageSize} OFFSET ${offset}`,
      this.db.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM papers p WHERE ${where}`,
    ])
    return {
      rows: papers.map((p) => {
        const id = idToString(p.id)
        return { id, title: p.title, meta: metaLine(`#${id}`, p.subject_name, `${String(p.questions)} soalan`), status: p.status, attention: p.questions === 0 ? [SERVABILITY_HUB_CARDS['kertas-subjektif'].attentionLabel] : [], actions: ['preview', 'edit'] }
      }),
      page: q.page,
      pageSize: q.pageSize,
      total: totals[0]?.n ?? 0,
    }
  }

  /** The hub card of that lane, on the same rows: `empty` counts the papers the lane marks "tiada kandungan". */
  private async kertasSubjektifFigures(): Promise<{ total: number; empty: number }> {
    const rows = await this.db.$queryRaw<{ total: number; empty: number }[]>`
      SELECT count(*)::int AS total,
             (count(*) FILTER (WHERE NOT EXISTS (
               SELECT 1 FROM paper_placements pl JOIN paper_sections ps ON ps.id = pl.paper_section_id WHERE ps.paper_id = p.id
             )))::int AS empty
        FROM papers p WHERE ${KERTAS_SUBJEKTIF_COND}`
    return rows[0] ?? { total: 0, empty: 0 }
  }

  // --- helpers -------------------------------------------------------------------------------------

  /** One card failing must not take the hub down (SR-3): the caller shows that card's error, the other cards stay. */
  private async soft<T>(read: () => Promise<T>): Promise<T | null> {
    try {
      return await read()
    } catch (e) {
      this.logger.error(e)
      return null
    }
  }

  /** Subject ids on the Latih Tubi list (any SPM configuration row). */
  private async subjectsListed(): Promise<Set<string>> {
    const rows = await this.db.$queryRaw<{ subject_id: bigint }[]>`SELECT subject_id FROM spm_subject_configs`
    return new Set(rows.map((r) => idToString(r.subject_id)))
  }

  /** Every question on a published curated paper, with its Simulasi (kertas) verdict (the paper it sits on is published by definition). */
  private async evaluatePublishedPaperQuestions(): Promise<PaperQuestionEvaluations> {
    const ids = await this.questionsOnPublishedPapers()
    const results = new Map<string, PaperEvaluation | null>()
    for (const part of chunks(ids)) {
      // onPublishedPaper is forced true: every id here was read from the placements of a PUBLISHED, non-jana paper, which is exactly what
      // the fact tests, so the value is the same (see the REQ-B-022(a) deviation row).
      const facts = await this.servability.factsOf(part, { jana: false })
      for (const id of part) {
        const f = facts.get(id)
        results.set(id, f ? evaluate({ ...f, onPublishedPaper: true }, 'simulasi_paper') : null)
      }
    }
    return { ids, results }
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
