/**
 * Kawalan Ciri client (S0-T10, API-ADM-09): `GET /api/admin/feature-toggles` (ordered by sort_order) and
 * `PUT /api/admin/feature-toggles/:key` `{enabled}`. A `PUT {enabled:true}` on a locked key is refused with
 * the standard error envelope (409).
 */

import type { FeatureToggle } from '@pp/contract'

import { api } from '@/api'

export type { FeatureToggle }

const BASE = '/api/admin/feature-toggles'

/** All rows, in server order (`sort_order`). */
export const fetchFeatureToggles = (signal?: AbortSignal) =>
  api.get<FeatureToggle[]>(BASE, signal ? { signal } : {})

/** Switches one key; resolves to the saved row. */
export const setFeatureToggle = (key: string, enabled: boolean) =>
  api.put<FeatureToggle>(`${BASE}/${encodeURIComponent(key)}`, { body: { enabled } })
