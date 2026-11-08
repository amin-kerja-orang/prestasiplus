/**
 * HTTP implementation of `KandunganApi`: the reads of `/api/admin/servability/*` (T30) and Tracking A, API-BIJAK-13 (the `api` client adds
 * the CSRF header to its writes). Reasons arrive as BM sentences from the API's one copy table (D94); this client never rewrites them.
 */
import type {
  SpmAdminTrackingASet,
  SpmAdminTrackingASetCreate,
  SpmAdminTrackingASetSave,
  ServabilityDatabankRow,
  ServabilityLaneRow,
  ServabilityLatihTubiCell,
  ServabilityOverview,
  ServabilityPaperRow,
} from '@pp/contract'

import { api, ApiError } from '@/api'

import { toBijakError } from '../../server/http'
import { TrackingRefusal, type KandunganApi, type LanePage, type LaneQuery, type TrackingLanePage } from './api'

const enc = encodeURIComponent

interface ListBody<T> {
  data?: T[]
  meta?: { page?: number; pageSize?: number; totalItems?: number }
  subjects?: { id: string; name: string }[]
  setSubjects?: { id: string; name: string }[]
  count?: number
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
  private async list<T>(url: string, q: LaneQuery): Promise<LanePage<T> & { setSubjects: { id: string; name: string }[] }> {
    try {
      const res = await api.request<ListBody<T>>('GET', `${url}?${qs(q)}`, { raw: true })
      const total = res?.meta?.totalItems ?? res?.data?.length ?? 0
      return {
        setSubjects: res?.setSubjects ?? [],
        rows: res?.data ?? [],
        page: res?.meta?.page ?? q.page ?? 1,
        pageSize: res?.meta?.pageSize ?? q.pageSize ?? 25,
        total,
        count: res?.count ?? total,
        subjects: (res?.subjects ?? []).map((s) => ({ id: s.id, name: s.name })),
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

  databankLane(q: LaneQuery): Promise<LanePage<ServabilityDatabankRow>> {
    return this.list('/api/admin/servability/lanes/databank', q)
  }

  paperLane(q: LaneQuery): Promise<LanePage<ServabilityPaperRow>> {
    return this.list('/api/admin/servability/lanes/bijak-spm', q)
  }

  subjektifLane(q: LaneQuery): Promise<LanePage<ServabilityLaneRow>> {
    return this.list('/api/admin/servability/lanes/subjektif', q)
  }

  latihTubiLane(q: LaneQuery): Promise<LanePage<ServabilityLatihTubiCell>> {
    return this.list('/api/admin/servability/lanes/latih-tubi', q)
  }

  trackingLane(q: LaneQuery): Promise<TrackingLanePage> {
    return this.list<ServabilityLaneRow>('/api/admin/servability/lanes/tracking-a', q)
  }

  private async tracking(method: 'GET' | 'POST' | 'PUT', url: string, body?: unknown): Promise<SpmAdminTrackingASet> {
    try {
      return await api.request<SpmAdminTrackingASet>(method, url, body === undefined ? {} : { body })
    } catch (e) {
      if (e instanceof ApiError && e.status === 422 && e.fields) throw new TrackingRefusal(e.fields)
      throw toBijakError(e)
    }
  }

  trackingSet(id: string): Promise<SpmAdminTrackingASet> {
    return this.tracking('GET', `/api/admin/spm/tracking-a/${enc(id)}`)
  }

  createTrackingSet(body: SpmAdminTrackingASetCreate): Promise<SpmAdminTrackingASet> {
    return this.tracking('POST', '/api/admin/spm/tracking-a', body)
  }

  saveTrackingSet(id: string, body: SpmAdminTrackingASetSave): Promise<SpmAdminTrackingASet> {
    return this.tracking('PUT', `/api/admin/spm/tracking-a/${enc(id)}`, body)
  }
}
