/**
 * Kandungan SPM (R1-ADM-Q-01, Q-02): the hub and the lane lists, read from the admin servability reads
 * (`GET /api/admin/servability/overview | lanes/{lane}`, API-BIJAK-12, API-BIJAK-15). Read only. The pages depend on this
 * interface; the HTTP client and the in-browser mock implement it.
 */
import type {
  SpmAdminTrackingASet,
  SpmAdminTrackingASetCreate,
  SpmAdminTrackingASetSave,
  ServabilityDatabankRow,
  ServabilityHubLane,
  ServabilityLaneRow,
  ServabilityLatihTubiCell,
  ServabilityOverview,
  ServabilityPaperRow,
} from '@pp/contract'

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
  /** The options of the lane's Subjek filter, from the lane response itself (REQ-C-020 `servabilityLaneListOf`). */
  subjects: LaneSubject[]
  /** Items of the lane under the current filters ("{n} item"); on Latih Tubi it counts questions while `total` counts the cells. */
  count: number
}

export interface LaneSubject {
  id: string
  name: string
}

/** The Tracking A lane page (API-BIJAK-12): `setSubjects` are the options of `Subjek` in the editor, field 17-01 (D-11). */
export interface TrackingLanePage extends LanePage<ServabilityLaneRow> {
  setSubjects: LaneSubject[]
}

/** A refusal of API-BIJAK-13: `fields` holds the BM reason per field (`subjectId`, `year`, `setNo`, `items`). */
export class TrackingRefusal extends Error {
  constructor(readonly fields: Record<string, string>) {
    super(Object.values(fields)[0] ?? '')
  }
}

export interface KandunganApi {
  overview(): Promise<ServabilityOverview>
  databankLane(q: LaneQuery): Promise<LanePage<ServabilityDatabankRow>>
  paperLane(q: LaneQuery): Promise<LanePage<ServabilityPaperRow>>
  subjektifLane(q: LaneQuery): Promise<LanePage<ServabilityLaneRow>>
  latihTubiLane(q: LaneQuery): Promise<LanePage<ServabilityLatihTubiCell>>
  trackingLane(q: LaneQuery): Promise<TrackingLanePage>
  trackingSet(id: string): Promise<SpmAdminTrackingASet>
  createTrackingSet(body: SpmAdminTrackingASetCreate): Promise<SpmAdminTrackingASet>
  saveTrackingSet(id: string, body: SpmAdminTrackingASetSave): Promise<SpmAdminTrackingASet>
}

export const KANDUNGAN_ROUTES = {
  hub: 'm28.admin.kandungan',
  databank: 'm28.admin.kandungan.databank',
  simulasi: 'm28.admin.kandungan.simulasi',
  subjektif: 'm28.admin.kandungan.subjektif',
  latihTubi: 'm28.admin.kandungan.latih-tubi',
  trackingA: 'm28.admin.kandungan.tracking-a',
  trackingAEdit: 'm28.admin.kandungan.tracking-a.edit',
  /** Registered by S3-T06 with its screen; the hub card stays hidden until then (FR-ADM-Q01.4). */
  kertasSubjektif: 'm28.admin.kandungan.kertas-subjektif',
} as const

/** The screen of a hub lane; the Bijak SPM lane keeps its V2 route `simulasi`. */
export const laneRouteOf = (lane: ServabilityHubLane): string =>
  lane === 'bijak-spm' ? KANDUNGAN_ROUTES.simulasi : `m28.admin.kandungan.${lane}`

/** The value of `:set` on the editor route before a set exists: the editor opens on `Tambah Set` (D-21). */
export const TRACKING_NEW_SET = 'baharu'

/** The V2 hub path (`/admin/spm`, DISC A1/P1). Lane pages: `/admin/spm/{lane}` (DISC A2/P2). */
export const KANDUNGAN_PATH = '/admin/spm'
