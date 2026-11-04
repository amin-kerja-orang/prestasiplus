/** Support contact settings client (API-ADM-10). Failures reject with `ApiError` (401, 403, 422 `fields`). */

import { api } from '@/api'

import type { SupportSettings } from './types'

export const fetchSupportSettings = (o: { signal?: AbortSignal } = {}) =>
  api.get<SupportSettings>('/api/admin/settings/support', o.signal ? { signal: o.signal } : {})

export const saveSupportSettings = (input: { email: string; whatsapp: string }) =>
  api.put<SupportSettings>('/api/admin/settings/support', { body: input })
