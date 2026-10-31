/**
 * In-browser mock of the Kandungan SPM reads. It derives from the mock admin bank and the mock papers, so the hub and the
 * lanes agree with the Bank Soalan and Pembina Kertas screens of the same tab. Reason sentences come from the contract's one
 * copy table (D94), exactly as the API sends them. Lives apart from `client.ts`'s http path so the http build drops it.
 */
import {
  SERVABILITY_ACTIVITY_LABELS,
  servabilityReasonMs,
  type ServabilityActivity,
  type ServabilityDatabankRow,
  type ServabilityOverview,
  type ServabilityPaperRow,
  type ServabilityReason,
} from '@pp/contract'

import type { BankRow } from '../../domain/admin-types'
import { bijakAdminServer } from '../../server/client'
import type { KandunganApi, LanePage, LaneQuery, LaneSubject } from './api'

const ACTIVITIES: ServabilityActivity[] = ['databank', 'latih_tubi_spm', 'bab', 'simulasi_paper', 'simulasi_kuiz', 'jana_kertas']

/** Lifecycle code of the API for a mock bank status. */
const WIRE_STATUS: Record<BankRow['status'], string> = { terbit: 'approved', semakan: 'review', draf: 'draft', ditolak: 'archived' }

function reasonsOf(status: BankRow['status']): ServabilityReason[] {
  if (status === 'terbit') return []
  const code = status === 'ditolak' ? 'archived' : 'not_approved'
  return [{ code, message: servabilityReasonMs(code, 'databank') }]
}

function page<T>(all: T[], q: LaneQuery): LanePage<T> {
  const pageSize = q.pageSize ?? 25
  const p = q.page ?? 1
  return { rows: all.slice((p - 1) * pageSize, p * pageSize), page: p, pageSize, total: all.length }
}

export function createMockKandungan(): KandunganApi {
  const admin = bijakAdminServer()
  const bank = async (): Promise<BankRow[]> => admin.listBank({ status: 'semua' })

  return {
    async overview(): Promise<ServabilityOverview> {
      const rows = await bank()
      const approved = rows.filter((r) => r.status === 'terbit').length
      const papers = (await admin.listAdminPapers()).filter((p) => p.status === 'terbit')
      const broken = papers.filter((p) => !p.ok).length
      const count = (a: ServabilityActivity): { served: number; total: number } => {
        if (a === 'simulasi_paper') return { served: papers.length - broken, total: papers.length }
        return { served: approved, total: rows.length }
      }
      return {
        bank: rows.length,
        activities: ACTIVITIES.map((activity) => {
          const { served, total } = count(activity)
          return { activity, label: SERVABILITY_ACTIVITY_LABELS[activity], served, total, attention: total - served, basis: 'evaluated' as const }
        }),
      }
    },

    async subjects(): Promise<LaneSubject[]> {
      return admin.subjects().map((s) => ({ id: s.code, name: s.name }))
    },

    async databankLane(q: LaneQuery): Promise<LanePage<ServabilityDatabankRow>> {
      const term = q.search?.trim().toLowerCase() ?? ''
      const all = (await bank())
        .filter((r) => !q.subjectId || r.subject === q.subjectId)
        .filter((r) => !q.status || WIRE_STATUS[r.status] === q.status)
        .filter((r) => !term || r.previewPlain.toLowerCase().includes(term) || r.id.toLowerCase().includes(term))
        .map<ServabilityDatabankRow>((r) => ({
          questionId: r.id,
          title: r.previewPlain.slice(0, 90),
          subject: { id: r.subject, name: r.subjectName },
          status: WIRE_STATUS[r.status],
          attention: reasonsOf(r.status),
        }))
      return page(all, q)
    },

    async paperLane(q: LaneQuery): Promise<LanePage<ServabilityPaperRow>> {
      const term = q.search?.trim().toLowerCase() ?? ''
      const all = (await admin.listAdminPapers())
        .filter((p) => !q.subjectId || p.subject === q.subjectId)
        .filter((p) => !q.status || (q.status === 'published' ? p.status === 'terbit' : p.status !== 'terbit'))
        .filter((p) => !term || p.title.toLowerCase().includes(term))
        .map<ServabilityPaperRow>((p) => {
          const published = p.status === 'terbit'
          const bad = published && !p.ok ? 1 : 0
          return {
            paperId: p.id,
            title: p.title,
            subject: { id: p.subject, name: p.subjectName },
            status: published ? 'published' : 'draft',
            questionCount: p.questionCount,
            attentionCount: bad,
            attention: bad ? [{ code: 'no_scheme', message: servabilityReasonMs('no_scheme', 'simulasi_paper'), count: bad }] : [],
          }
        })
      return page(all, q)
    },
  }
}
