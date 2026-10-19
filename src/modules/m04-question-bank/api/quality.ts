/**
 * M04 question-quality endpoints (SRS §7 #12–#13; build-plan M04-T2): the S6 dashboard and the
 * "Jalankan Audit Semula" action. Every call needs an admin session. UI tasks read this file and do
 * not change it (build-plan §S.3 rule 5).
 */

import { api } from '@/api'

/** `{id, name}` of an M03 subject or education level. */
export interface QualityRef {
  id: number
  name: string
}

/** A row of "Soalan Untuk Semakan Aktif" (non-legacy, score ≤ 50, id descending). */
export interface QualityActionRow {
  id: number
  questionText: string
  subject: QualityRef | null
  level: QualityRef | null
  /** "Sumber" column: the source set, `null` when none. */
  sourceSet: string | null
  qualityScore: number
}

/** DATA-M04-08 (response only). Percentages have one decimal; averages have one decimal. */
export interface QualitySummary {
  /** KPI "Jumlah Soalan" = Q-ALL (BR-M04-20). */
  total: number
  /** KPI "Purata Skor": mean over the scored questions; `0` when none is scored. */
  average: number
  /** Number of scored questions (Q-SCORED). */
  scoredCount: number
  /** KPI "Cemerlang (76-100)". */
  excellentCount: number
  /** KPI "Perlu Tindakan Aktif (≤ 50)" = the "Skor ≤ 50" card = the action list length. */
  activeActionCount: number
  buckets: {
    /** Card "Skor 51-75". */
    baik: number
    /** Card "Skor ≤ 50" (non-legacy). */
    lemahKritikal: number
    /** Card "Legacy Generic". */
    legacyGeneric: number
  }
  /** "Taburan Kualiti": share of the scored questions per band, in percent. */
  distribution: { cemerlang: number; baik: number; lemah: number; kritikal: number }
  /** "Mengikut Subjek": subjects with at least one scored question, average descending. */
  bySubject: {
    subjectId: number
    name: string
    count: number
    average: number
    /** Share of the subject's scored questions with a score ≥ 76, rounded. */
    excellentPct: number
  }[]
  /** "Mengikut Tingkatan": every level in order (`count` 0 and `average` 0 when none scored). */
  byLevel: { levelId: number; name: string; count: number; average: number }[]
  actionList: QualityActionRow[]
  /** ISO timestamp of the last "Jalankan Audit Semula"; `null` before the first run. */
  lastAuditAt: string | null
}

/** #13 result: `data.lastAuditAt` plus the flash text "Audit kualiti selesai.". */
export interface QualityAuditResponse {
  data: { lastAuditAt: string }
  status: string
}

/** #12 `GET /api/question-quality`. */
export function fetchQualitySummary(
  options: { signal?: AbortSignal } = {},
): Promise<QualitySummary> {
  return api.get<QualitySummary>(
    '/api/question-quality',
    options.signal ? { signal: options.signal } : {},
  )
}

/** #13 `POST /api/question-quality/audit` (no confirm, no body). */
export function runQualityAudit(): Promise<QualityAuditResponse> {
  return api.post<QualityAuditResponse>('/api/question-quality/audit', { raw: true })
}
