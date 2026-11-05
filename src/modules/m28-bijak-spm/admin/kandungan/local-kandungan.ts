/**
 * In-browser mock of the Kandungan SPM reads. It derives from the mock admin bank and the mock papers, so the hub and the
 * lanes agree with the Bank Soalan and Pembina Kertas screens of the same tab. Reason sentences come from the contract's one
 * copy table (D94), exactly as the API sends them. Lives apart from `client.ts`'s http path so the http build drops it.
 */
import {
  SERVABILITY_ACTIVITY_LABELS,
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
import type { KandunganApi, LanePage, LaneQuery, LaneSubject } from './api'

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

export function createMockKandungan(): KandunganApi {
  const admin = bijakAdminServer()
  const bank = async (): Promise<BankRow[]> => admin.listBank({ status: 'semua' })

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
      /** Lanes the mock has rows for; Tracking A and Kertas Subjektif have none. */
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
          cardOf(lane, cardRows[lane] ?? [], lane === 'latih-tubi' ? cells.reduce((sum, c) => sum + c.total, 0) : undefined),
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
  }
  return api
}
