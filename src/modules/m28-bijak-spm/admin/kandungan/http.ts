/**
 * HTTP implementation of `KandunganApi` (`/api/admin/servability/*`, T30): GETs only, so no CSRF. Reasons arrive as BM
 * sentences from the API's one copy table (D94); this client never rewrites them.
 */
import type { ServabilityDatabankRow, ServabilityOverview, ServabilityPaperRow } from '@pp/contract'

import { api } from '@/api'

import { toBijakError } from '../../server/http'
import type { KandunganApi, LanePage, LaneQuery, LaneSubject } from './api'

const enc = encodeURIComponent

interface ListBody<T> {
  data?: T[]
  meta?: { page?: number; pageSize?: number; totalItems?: number }
}

function qs(q: LaneQuery): string {
  const p: string[] = []
  if (q.subjectId) p.push(`subjectId=${enc(q.subjectId)}`)
  if (q.status) p.push(`status=${enc(q.status)}`)
  if (q.search?.trim()) p.push(`search=${enc(q.search.trim())}`)
  p.push(`page=${String(q.page ?? 1)}`)
  p.push(`pageSize=${String(q.pageSize ?? 25)}`)
  return p.join('&')
}

export class HttpKandunganServer implements KandunganApi {
  private async list<T>(url: string, q: LaneQuery): Promise<LanePage<T>> {
    try {
      const res = await api.request<ListBody<T>>('GET', `${url}?${qs(q)}`, { raw: true })
      return {
        rows: res?.data ?? [],
        page: res?.meta?.page ?? q.page ?? 1,
        pageSize: res?.meta?.pageSize ?? q.pageSize ?? 25,
        total: res?.meta?.totalItems ?? res?.data?.length ?? 0,
      }
    } catch (e) {
      throw toBijakError(e)
    }
  }

  async overview(): Promise<ServabilityOverview> {
    try {
      return await api.request<ServabilityOverview>('GET', '/api/admin/servability/overview')
    } catch (e) {
      throw toBijakError(e)
    }
  }

  /** The Subjek filter: the bank subjects with their ids (`GET /api/questions/summary`, the same read as the Bank page). */
  async subjects(): Promise<LaneSubject[]> {
    try {
      const res = await api.request<{ subjects?: { id: string; name: string }[] }>('GET', '/api/questions/summary')
      return (res?.subjects ?? []).map((s) => ({ id: s.id, name: s.name }))
    } catch (e) {
      throw toBijakError(e)
    }
  }

  databankLane(q: LaneQuery): Promise<LanePage<ServabilityDatabankRow>> {
    return this.list('/api/admin/servability/lanes/databank', q)
  }

  paperLane(q: LaneQuery): Promise<LanePage<ServabilityPaperRow>> {
    return this.list('/api/admin/servability/lanes/bijak-spm', q)
  }
}
