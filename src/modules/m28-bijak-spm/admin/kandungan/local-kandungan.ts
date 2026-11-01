/**
 * In-browser mock of the Kandungan SPM reads. It derives from the mock admin bank and the mock papers, so the hub and the
 * lanes agree with the Bank Soalan and Pembina Kertas screens of the same tab. Reason sentences come from the contract's one
 * copy table (D94), exactly as the API sends them. Lives apart from `client.ts`'s http path so the http build drops it.
 */
import {
  SERVABILITY_ACTIVITY_LABELS,
  SERVABILITY_HUB_CARDS,
  servabilityReasonMs,
  type ServabilityActivity,
  type ServabilityDatabankRow,
  type ServabilityHubCard,
  type ServabilityHubLane,
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

/**
 * Lane status of each mock paper. The mock store only knows draf/terbit, so the unpublished papers take draft, ready,
 * withdrawn in turn (by their order in the store) and the lane shows all four API statuses, deterministically.
 */
export function laneStatusOf(papers: AdminPaperSummary[]): Map<string, ServabilityPaperRow['status']> {
  const out = new Map<string, ServabilityPaperRow['status']>()
  let n = 0
  for (const p of papers) {
    if (p.status === 'terbit') out.set(p.id, 'published')
    else out.set(p.id, (['draft', 'ready', 'withdrawn'] as const)[n++ % 3]!)
  }
  return out
}

function page<T>(all: T[], q: LaneQuery, subjects: LaneSubject[]): LanePage<T> {
  const pageSize = q.pageSize ?? 25
  const p = q.page ?? 1
  return { rows: all.slice((p - 1) * pageSize, p * pageSize), page: p, pageSize, total: all.length, subjects }
}

export function createMockKandungan(): KandunganApi {
  const admin = bijakAdminServer()
  const bank = async (): Promise<BankRow[]> => admin.listBank({ status: 'semua' })

  /** Hub card measured on its unfiltered lane: total = rows, attention = rows with a reason (as the API). */
  const cardOf = (
    lane: ServabilityHubLane,
    rows: { attention: readonly unknown[] }[],
  ): ServabilityHubCard => ({
    lane,
    ...SERVABILITY_HUB_CARDS[lane],
    total: rows.length,
    attention: rows.filter((r) => r.attention.length > 0).length,
  })

  /** Databank lane rows (filtered by `q`) from one bank read. */
  const databankRows = (rows: BankRow[], q: LaneQuery): ServabilityDatabankRow[] => {
    const term = q.search?.trim().toLowerCase() ?? ''
    return rows
      .filter((r) => !q.subjectId || r.subject === q.subjectId)
      .filter((r) => !q.status || WIRE_STATUS[r.status] === q.status)
      .filter(
        (r) =>
          !term || r.previewPlain.toLowerCase().includes(term) || r.id.toLowerCase().includes(term),
      )
      .map<ServabilityDatabankRow>((r) => ({
        questionId: r.id,
        title: r.previewPlain.slice(0, 90),
        subject: { id: r.subject, name: r.subjectName },
        status: WIRE_STATUS[r.status],
        attention: reasonsOf(r.status),
      }))
  }
  /** Bijak SPM lane rows (filtered by `q`) from one paper read. */
  const paperRows = (papers: AdminPaperSummary[], q: LaneQuery): ServabilityPaperRow[] => {
    const term = q.search?.trim().toLowerCase() ?? ''
    const wire = laneStatusOf(papers)
    return papers
      .filter((p) => !q.subjectId || p.subject === q.subjectId)
      .filter((p) => !q.status || wire.get(p.id) === q.status)
      .filter((p) => !term || p.title.toLowerCase().includes(term))
      .map<ServabilityPaperRow>((p) => {
        const published = p.status === 'terbit'
        const bad = published && !p.ok ? 1 : 0
        return {
          paperId: p.id,
          title: p.title,
          subject: { id: p.subject, name: p.subjectName },
          status: wire.get(p.id) ?? 'draft',
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
        cards: [
          cardOf('databank', databankRows(rows, {})),
          cardOf('bijak-spm', paperRows(allPapers, {})),
        ],
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
  }
  return api
}
