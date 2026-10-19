import { api } from '@/api'

import type { VideoDetail } from '../api/types'

/**
 * #28 `GET /api/videos/:id?for=edit` (S19 form load): the same body as the detail read, including
 * `canManage`, but opening the edit page does not count a view (live does not either).
 */
export function fetchVideoForEdit(
  id: number,
  options: { signal?: AbortSignal } = {},
): Promise<VideoDetail> {
  return api.get<VideoDetail>(`/api/videos/${String(id)}`, {
    query: { for: 'edit' },
    ...(options.signal ? { signal: options.signal } : {}),
  })
}
