/**
 * M18 Amaran Awal client for the two report screens: S23 Ringkasan Eksekutif (#22 `GET /api/amaran/summary`)
 * and S21 Keberkesanan Intervensi (#24 `GET /api/amaran/effectiveness`). One code path for the mock and the
 * http transport (the shared `api` client picks the transport). Types come from the contract
 * (`packages/contract/src/school-admin/amaran.ts`). Failures reject with `ApiError` (401 guest, 403, 404, 422).
 */

import type {
  AmaranEffectivenessResult,
  AmaranKombo,
  AmaranSubjectRisk,
  AmaranSummary,
  AmaranSummaryQuery,
  AmaranTally,
} from '@pp/contract'

import { api } from '@/api'

export type AmaranSummaryResponse = AmaranSummary
export type AmaranEffectivenessResponse = AmaranEffectivenessResult
export type AmaranEffectivenessReportView = AmaranEffectivenessResult['report']
export type { AmaranKombo, AmaranSubjectRisk, AmaranSummaryQuery, AmaranTally }

export interface AmaranFetchParams {
  signal?: AbortSignal
}

/** #22. No query = the viewer's default scope (the school admin's own school). */
export const fetchAmaranSummary = (
  params: AmaranSummaryQuery & AmaranFetchParams = {},
): Promise<AmaranSummaryResponse> => {
  const { signal, scope, schoolId, district, state } = params
  return api.get<AmaranSummaryResponse>('/api/amaran/summary', {
    query: { scope, schoolId, district, state },
    ...(signal ? { signal } : {}),
  })
}

/** #24. No parameters: the report is for the viewer's own school. */
export const fetchAmaranEffectiveness = (
  params: AmaranFetchParams = {},
): Promise<AmaranEffectivenessResponse> =>
  api.get<AmaranEffectivenessResponse>('/api/amaran/effectiveness', {
    ...(params.signal ? { signal: params.signal } : {}),
  })
