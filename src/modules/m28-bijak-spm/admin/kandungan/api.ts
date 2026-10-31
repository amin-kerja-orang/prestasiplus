/**
 * Kandungan SPM (R1-F-hub, AC-R1-21.1 / 21.2): the hub and the two R1 lane lists, read from the admin servability reads
 * (`GET /api/admin/servability/overview | lanes/databank | lanes/bijak-spm`, T30). Read only. The pages depend on this
 * interface; the HTTP client and the in-browser mock implement it.
 */
import type { ServabilityDatabankRow, ServabilityOverview, ServabilityPaperRow } from '@pp/contract'

export interface LaneQuery {
  /** Subject id (HTTP: the bank subject id; mock: the Bijak subject code). */
  subjectId?: string
  status?: string
  search?: string
  page?: number
  pageSize?: number
}

export interface LanePage<T> {
  rows: T[]
  page: number
  pageSize: number
  total: number
}

export interface LaneSubject {
  id: string
  name: string
}

export interface KandunganApi {
  overview(): Promise<ServabilityOverview>
  subjects(): Promise<LaneSubject[]>
  databankLane(q: LaneQuery): Promise<LanePage<ServabilityDatabankRow>>
  paperLane(q: LaneQuery): Promise<LanePage<ServabilityPaperRow>>
}

export const KANDUNGAN_ROUTES = {
  hub: 'm28.admin.kandungan',
  databank: 'm28.admin.kandungan.databank',
  simulasi: 'm28.admin.kandungan.simulasi',
} as const

/** The V2 hub path (`/admin/spm`, DISC A1/P1). Lane pages: `/admin/spm/{lane}` (DISC A2/P2). */
export const KANDUNGAN_PATH = '/admin/spm'
