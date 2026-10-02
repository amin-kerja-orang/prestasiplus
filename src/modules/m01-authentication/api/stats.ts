/** M01 #21 `GET /api/public/stats` (public): the derived numbers of the login page (FR-M01-11). */

import { api } from '@/api'

import type { PlatformStats } from './types'

export function getPlatformStats(): Promise<PlatformStats> {
  return api.get<PlatformStats>('/api/public/stats')
}
