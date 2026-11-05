/**
 * In-browser mock of the Kandungan SPM reads. It derives from the mock admin bank and the mock papers, so the hub and the
 * lanes agree with the Bank Soalan and Pembina Kertas screens of the same tab. Reason sentences come from the contract's one
 * copy table (D94), exactly as the API sends them. Lives apart from `client.ts`'s http path so the http build drops it.
 */
import {
  SERVABILITY_ACTIVITY_LABELS,
  TRACKING_A_KIND,
  TRACKING_A_MESSAGES,
  TRACKING_A_PROPOSED_COPY,
  TRACKING_A_YEAR_MIN,
  trackingSetAttentionMs,
  type SpmAdminTrackingACandidate,
  type SpmAdminTrackingASet,
  SERVABILITY_HUB_CARDS,
  SERVABILITY_HUB_LANES,
  servabilityReasonMs,
  type ServabilityActivity,
  type ServabilityDatabankRow,
  type ServabilityHubCard,
  type ServabilityHubLane,
  type ServabilityLaneRow,
  type ServabilityLatihTubiCell,
  type ServabilityOverview,
  type ServabilityPaperRow,
  type ServabilityReason,
} from '@pp/contract'

import { toIsoMyt } from '@/lib/time/zone'

import type { AdminPaperSummary, BankRow } from '../../domain/admin-types'
import { bijakAdminServer } from '../../server/client'
import { BijakError } from '../../server/errors'
import { KANDUNGAN_ROUTES, TrackingRefusal, laneRouteOf, type KandunganApi, type LanePage, type LaneQuery, type LaneSubject, type TrackingLanePage } from './api'

const ACTIVITIES: ServabilityActivity[] = [
  'databank',
  'latih_tubi_spm',
  'bab',
  'simulasi_paper',
  'simulasi_kuiz',
  'jana_kertas',
]

/** Lifecycle code of the API for a mock bank status. */
const WIRE_STATUS: Record<BankRow['status'], string> = {
  terbit: 'approved',
  semakan: 'review',
  draf: 'draft',
  ditolak: 'archived',
}

function reasonsOf(status: BankRow['status']): ServabilityReason[] {
  if (status === 'terbit') return []
  const code = status === 'ditolak' ? 'archived' : 'not_approved'
  return [{ code, message: servabilityReasonMs(code, 'databank') }]
}

/** Lane status of a mock paper: the store only has draf and terbit, so only draft and published are ever returned. */
const laneStatusOf = (p: AdminPaperSummary): ServabilityPaperRow['status'] => (p.status === 'terbit' ? 'published' : 'draft')

function page<T>(all: T[], q: LaneQuery, subjects: LaneSubject[], count = all.length): LanePage<T> {
  const pageSize = q.pageSize ?? 25
  const p = q.page ?? 1
  return { rows: all.slice((p - 1) * pageSize, p * pageSize), page: p, pageSize, total: all.length, subjects, count }
}

/** The mock bank has no `spm_subject_configs`: one small target, so a set can be filled on screen. */
const MOCK_TRACKING_TARGET = 6
const BAHASA_CODES: readonly string[] = ['BM', 'BI']

interface MockTrackingSet {
  id: string
  subject: string
  subjectName: string
  year: number
  setNo: number
  /** Units in set order, by key `kind:id`. */
  units: { kind: 'question' | 'group'; id: string }[]
}

export function createMockKandungan(): KandunganApi {
  const admin = bijakAdminServer()
  const bank = async (): Promise<BankRow[]> => admin.listBank({ status: 'semua' })

  const trackingSets: MockTrackingSet[] = []
  /** The servable units of a subject: the published objective questions of the bank, a group once (D-10, D90). */
  const trackingUnits = async (subject: string): Promise<SpmAdminTrackingACandidate[]> => {
    const rows = (await bank()).filter((r) => r.subject === subject && r.kind === 'objektif' && r.status === 'terbit')
    const member = (r: BankRow) => ({ id: r.id, stem: r.previewPlain.slice(0, 200), servable: true, statusWord: null })
    const out: SpmAdminTrackingACandidate[] = []
    const seen = new Set<string>()
    for (const r of rows) {
      if (r.groupId === undefined) {
        out.push({ kind: 'question', id: r.id, questions: 1, label: r.previewPlain.slice(0, 200), members: [member(r)] })
      } else if (!seen.has(r.groupId)) {
        seen.add(r.groupId)
        const all = rows.filter((x) => x.groupId === r.groupId)
        out.push({ kind: 'group', id: r.groupId, questions: all.length, label: r.groupId, members: all.map(member) })
      }
    }
    return out
  }
  const trackingKey = (u: { kind: string; id: string }): string => `${u.kind}:${u.id}`
  const trackingView = async (set: MockTrackingSet): Promise<SpmAdminTrackingASet> => {
    const units = await trackingUnits(set.subject)
    const byKey = new Map(units.map((u) => [trackingKey(u), u]))
    const held = new Set(trackingSets.filter((s) => s !== set && s.subject === set.subject && s.year === set.year).flatMap((s) => s.units.map(trackingKey)))
    let position = 1
    const items = set.units.flatMap((u) => {
      const unit = byKey.get(trackingKey(u))
      if (!unit) return []
      const item = { ...unit, position }
      position += unit.questions
      return [item]
    })
    const filled = position - 1
    return {
      id: set.id,
      subjectId: set.subject,
      subject: set.subjectName,
      year: set.year,
      setNo: set.setNo,
      kind: TRACKING_A_KIND,
      targetCount: MOCK_TRACKING_TARGET,
      filled,
      attention: filled >= MOCK_TRACKING_TARGET ? [] : [trackingSetAttentionMs(filled, MOCK_TRACKING_TARGET)],
      items,
      candidates: units.length,
      candidateItems: units.filter((u) => !held.has(trackingKey(u))).slice(0, 200),
    }
  }
  const trackingSubjects = (): LaneSubject[] => admin.subjects().map((s) => ({ id: s.code, name: s.name }))
  const trackingOptions = (): LaneSubject[] => trackingSubjects().filter((s) => !BAHASA_CODES.includes(s.id))
  const trackingRows = async (q: LaneQuery): Promise<ServabilityLaneRow[]> => {
    const views = await Promise.all(trackingSets.map(trackingView))
    const term = q.search?.trim().toLowerCase() ?? ''
    return views
      .map((v) => ({
        id: v.id,
        title: `${v.subject} · ${String(v.year)} Set ${String(v.setNo)}`,
        meta: `#${v.id} · ${TRACKING_A_KIND} · ${String(v.filled)} soalan`,
        status: v.attention.length > 0 ? 'belum_cukup' : 'bersih',
        attention: v.attention,
        actions: ['edit' as const],
        subjectId: v.subjectId,
      }))
      .filter((r) => !q.subjectId || r.subjectId === q.subjectId)
      .filter((r) => !term || r.title.toLowerCase().includes(term))
      .sort((a, b) => a.title.localeCompare(b.title, 'ms', { numeric: true }))
      .map((r) => ({ id: r.id, title: r.title, meta: r.meta, status: r.status, attention: r.attention, actions: r.actions }))
  }

  /** Hub card measured on its unfiltered lane: total = rows, attention = rows with a reason (as the API). */
  const cardOf = (
    lane: ServabilityHubLane,
    rows: { attention: readonly unknown[] }[],
    total = rows.length,
  ): ServabilityHubCard => {
    const attention = rows.filter((r) => r.attention.length > 0).length
    const { title, description, attentionLabel } = SERVABILITY_HUB_CARDS[lane]
    return {
      lane,
      title,
      description,
      attentionLabel,
      total,
      attention,
      attentionLines: attention > 0 ? [{ count: attention, text: `${String(attention)} ${attentionLabel}` }] : [],
    }
  }

  /** Rows of a bank read under the filters of `q`; `status` is left to the caller's lane. */
  const matching = (rows: BankRow[], q: LaneQuery): BankRow[] => {
    const term = q.search?.trim().toLowerCase() ?? ''
    return rows
      .filter((r) => !q.subjectId || r.subject === q.subjectId)
      .filter(
        (r) =>
          !term || r.previewPlain.toLowerCase().includes(term) || r.id.toLowerCase().includes(term),
      )
  }
  /** Subjektif lane rows: the structured and essay questions of the bank. The mock bank holds no answer keys, so no attention. */
  const subjektifRows = (rows: BankRow[], q: LaneQuery): ServabilityLaneRow[] =>
    matching(rows, q)
      .filter((r) => r.kind !== 'objektif')
      .filter((r) => !q.status || WIRE_STATUS[r.status] === q.status)
      .map((r) => ({
        id: r.id,
        title: r.previewPlain.slice(0, 120),
        meta: `#${r.id} · ${r.subjectName}`,
        status: WIRE_STATUS[r.status],
        attention: [],
        actions: ['preview', 'edit'],
      }))
  /** Latih Tubi lane cells: the mock bank has subjects but no Tingkatan, so one cell per subject, every approved question servable. */
  const latihTubiCells = (rows: BankRow[], q: LaneQuery): ServabilityLatihTubiCell[] => {
    const totals = new Map<string, { name: string; n: number }>()
    for (const r of matching(rows, { subjectId: q.subjectId }).filter((x) => x.status === 'terbit')) {
      const cell = totals.get(r.subject) ?? { name: r.subjectName, n: 0 }
      cell.n += 1
      totals.set(r.subject, cell)
    }
    const term = q.search?.trim().toLowerCase() ?? ''
    return [...totals.entries()]
      .filter(([, c]) => !term || c.name.toLowerCase().includes(term))
      .map(([id, c]) => ({
        id: `${id}:`,
        title: c.name,
        meta: `#${id} · ${String(c.n)} soalan`,
        status: 'open' as const,
        attention: [],
        actions: [],
        subject: { id, name: c.name },
        level: null,
        servable: c.n,
        total: c.n,
      }))
  }

  /** Databank lane rows (filtered by `q`) from one bank read. */
  const databankRows = (rows: BankRow[], q: LaneQuery): ServabilityDatabankRow[] => {
    return matching(rows, q)
      .filter((r) => r.kind === 'objektif')
      .filter((r) => !q.status || WIRE_STATUS[r.status] === q.status)
      .map<ServabilityDatabankRow>((r) => ({
        questionId: r.id,
        title: r.previewPlain.slice(0, 120),
        meta: `#${r.id} · ${r.subjectName}`,
        subject: { id: r.subject, name: r.subjectName },
        status: WIRE_STATUS[r.status],
        attention: reasonsOf(r.status),
      }))
  }
  /** Bijak SPM lane rows (filtered by `q`) from one paper read. */
  const paperRows = (papers: AdminPaperSummary[], q: LaneQuery): ServabilityPaperRow[] => {
    const term = q.search?.trim().toLowerCase() ?? ''
    return papers
      .filter((p) => !q.subjectId || p.subject === q.subjectId)
      .filter((p) => !q.status || laneStatusOf(p) === q.status)
      .filter((p) => !term || p.title.toLowerCase().includes(term))
      .map<ServabilityPaperRow>((p) => {
        const published = p.status === 'terbit'
        const bad = published && !p.ok ? 1 : 0
        return {
          paperId: p.id,
          title: p.title,
          subject: { id: p.subject, name: p.subjectName },
          status: laneStatusOf(p),
          questionCount: p.questionCount,
          attentionCount: bad,
          attention: bad
            ? [
                {
                  code: 'no_scheme',
                  message: servabilityReasonMs('no_scheme', 'simulasi_paper'),
                  count: bad,
                },
              ]
            : [],
        }
      })
  }

  const api: KandunganApi = {
    async overview(): Promise<ServabilityOverview> {
      const [rows, allPapers] = await Promise.all([bank(), admin.listAdminPapers()])
      const approved = rows.filter((r) => r.status === 'terbit').length
      const papers = allPapers.filter((p) => p.status === 'terbit')
      const cells = latihTubiCells(rows, {})
      const tracking = await trackingRows({})
      /** Lanes the mock has rows for, Tracking A aside; Kertas Subjektif has none. */
      const cardRows: Partial<Record<ServabilityHubLane, { attention: readonly unknown[] }[]>> = {
        databank: databankRows(rows, {}),
        subjektif: subjektifRows(rows, {}),
        'bijak-spm': paperRows(allPapers, {}),
        'latih-tubi': cells,
      }
      const broken = papers.filter((p) => !p.ok).length
      const count = (a: ServabilityActivity): { served: number; total: number } => {
        if (a === 'simulasi_paper') return { served: papers.length - broken, total: papers.length }
        return { served: approved, total: rows.length }
      }
      return {
        bank: rows.length,
        computedAt: toIsoMyt(Date.now()),
        activities: ACTIVITIES.map((activity) => {
          const { served, total } = count(activity)
          return {
            activity,
            label: SERVABILITY_ACTIVITY_LABELS[activity],
            served,
            total,
            attention: total - served,
            basis: 'evaluated' as const,
          }
        }),
        cards: SERVABILITY_HUB_LANES.map((lane) =>
          cardOf(lane, laneRouteOf(lane) === KANDUNGAN_ROUTES.trackingA ? tracking : (cardRows[lane] ?? []), lane === 'latih-tubi' ? cells.reduce((sum, c) => sum + c.total, 0) : undefined),
        ),
      }
    },

    async databankLane(q: LaneQuery): Promise<LanePage<ServabilityDatabankRow>> {
      const all = databankRows(await bank(), q)
      return page(all, q, admin.subjects().map((s) => ({ id: s.code, name: s.name })))
    },

    async paperLane(q: LaneQuery): Promise<LanePage<ServabilityPaperRow>> {
      const papers = await admin.listAdminPapers()
      /** The subjects that have a paper, whatever the filters are (as the API). */
      const seen = new Map<string, LaneSubject>()
      for (const p of papers) if (!seen.has(p.subject)) seen.set(p.subject, { id: p.subject, name: p.subjectName })
      return page(paperRows(papers, q), q, [...seen.values()])
    },

    async subjektifLane(q: LaneQuery): Promise<LanePage<ServabilityLaneRow>> {
      return page(subjektifRows(await bank(), q), q, admin.subjects().map((s) => ({ id: s.code, name: s.name })))
    },

    async latihTubiLane(q: LaneQuery): Promise<LanePage<ServabilityLatihTubiCell>> {
      const cells = latihTubiCells(await bank(), q)
      return page(cells, q, admin.subjects().map((s) => ({ id: s.code, name: s.name })), cells.reduce((sum, c) => sum + c.total, 0))
    },

    async trackingLane(q: LaneQuery): Promise<TrackingLanePage> {
      return { ...page(await trackingRows(q), q, trackingSubjects()), setSubjects: trackingOptions() }
    },

    async trackingSet(id) {
      const set = trackingSets.find((s) => s.id === id)
      if (!set) throw new BijakError('not_found', 'Tidak dijumpai')
      return trackingView(set)
    },

    async createTrackingSet(body) {
      const subject = trackingOptions().find((s) => s.id === body.subjectId)
      if (!subject) throw new TrackingRefusal({ subjectId: TRACKING_A_MESSAGES.subjectRequired })
      const maxYear = new Date().getFullYear() + 1
      if (body.year < TRACKING_A_YEAR_MIN || body.year > maxYear) throw new TrackingRefusal({ year: TRACKING_A_PROPOSED_COPY.yearRange(maxYear) })
      if (trackingSets.some((s) => s.subject === subject.id && s.year === body.year && s.setNo === body.setNo)) {
        throw new TrackingRefusal({ setNo: TRACKING_A_MESSAGES.setExists(body.setNo) })
      }
      const set: MockTrackingSet = { id: String(trackingSets.length + 1), subject: subject.id, subjectName: subject.name, year: body.year, setNo: body.setNo, units: [] }
      trackingSets.push(set)
      return trackingView(set)
    },

    async saveTrackingSet(id, body) {
      const set = trackingSets.find((s) => s.id === id)
      if (!set) throw new BijakError('not_found', 'Tidak dijumpai')
      if (body.items.length === 0) throw new TrackingRefusal({ items: TRACKING_A_MESSAGES.saveEmpty })
      const byKey = new Map((await trackingUnits(set.subject)).map((u) => [trackingKey(u), u]))
      const siblings = trackingSets.filter((s) => s !== set && s.subject === set.subject && s.year === set.year)
      let position = 1
      for (const item of body.items) {
        const unit = byKey.get(trackingKey(item))
        if (!unit) throw new TrackingRefusal({ items: TRACKING_A_PROPOSED_COPY.notServable(position) })
        const sibling = siblings.find((s) => s.units.some((u) => trackingKey(u) === trackingKey(item)))
        if (sibling) throw new TrackingRefusal({ items: TRACKING_A_MESSAGES.siblingClash(position, sibling.setNo) })
        const free = MOCK_TRACKING_TARGET - position + 1
        if (unit.questions > free) {
          throw new TrackingRefusal({
            items: unit.kind === 'group' ? TRACKING_A_MESSAGES.groupNoFit(unit.label, unit.questions, free) : TRACKING_A_PROPOSED_COPY.overTarget(MOCK_TRACKING_TARGET, 1),
          })
        }
        position += unit.questions
      }
      set.units = body.items.map((i) => ({ kind: i.kind, id: i.id }))
      return trackingView(set)
    },
  }
  return api
}
