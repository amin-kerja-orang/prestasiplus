/**
 * M27 S4 client (SRS M27 Part B FR-M27-80, M27-T5): thin wrappers over the M18 endpoints #21
 * `GET /api/amaran/schools/:id?tingkatan=` and #30 `GET /api/amaran/export/school/:id`, called with the
 * SESSION school id. M18 has no public frontend client yet, so the shapes (M18 SRS §6.7) are typed here;
 * S4 adds no M27 endpoint (D12). Failures reject with `ApiError` (401 guest, 403 outside the scope, 404).
 */

import { api } from '@/api'

export type RiskStatus = 'on_track' | 'watch' | 'high'
export type LevelFilter = 'T4' | 'T5'

export interface RiskTallyView {
  green: number
  yellow: number
  red: number
  total: number
  /** Integer percentages. */
  pct: { green: number; yellow: number; red: number }
}

export interface SubjectRiskRow {
  subjectId: number
  subjectName: string
  weak: number
  total: number
  pct: number
}

export interface PupilRiskView {
  rank: number
  userId: number
  name: string
  /** "Tingkatan n {kelas}" or "-". */
  classLabel: string
  score: number
  status: RiskStatus
  accuracyText: string
  engagementText: string
  masteryText: string
}

export interface SchoolRiskData {
  school: { id: number; name: string }
  levelFilter: LevelFilter | null
  /** `''` or `' — Tingkatan {n}'`. */
  levelSuffix: string
  tally: RiskTallyView
  weakness: SubjectRiskRow[]
  pupils: PupilRiskView[]
}

/** #21 (S4 data). */
export const fetchSchoolRisk = (
  schoolId: number,
  o: { tingkatan?: LevelFilter | null; signal?: AbortSignal } = {},
) =>
  api.get<SchoolRiskData>(`/api/amaran/schools/${String(schoolId)}`, {
    query: { tingkatan: o.tingkatan ?? undefined },
    ...(o.signal ? { signal: o.signal } : {}),
  })

/** #30 ("Muat Turun CSV"): `amaran-sekolah-{id}-{yyyymmdd}.csv`. */
export const downloadSchoolRiskCsv = (schoolId: number) =>
  api.blob(`/api/amaran/export/school/${String(schoolId)}`)
