/**
 * Kiriman Guru (R1-ADM-Q-12, FR-ADM-Q12.1, FR-ADM-Q12.5): a teacher submission is an intake item of a
 * `source=guru` batch, read from `GET /api/intake/items` (API-Q-15). No separate submissions route exists.
 * The server owns the OPT-KIRIMAN-STATUS mapping, so the tiles and the filter both send its display keys.
 */

import type { IntakeFileSummary, IntakeItemRow, IntakeKirimanStatus } from '@pp/contract'

import { api, type BlobResult, type ListResult } from '@/api'

const ITEMS_URL = '/api/intake/items'

export const SUBMISSION_PAGE_SIZE = 20

/** Tile totals of FR-ADM-Q12.1, over every item whatever the filter. */
export interface SubmissionCounts {
  all: number
  pending: number
  processing: number
  done: number
}

export function fetchSubmissionItems(
  query: { status?: string | null; page?: number; signal?: AbortSignal } = {},
): Promise<ListResult<IntakeItemRow>> {
  return api.list<IntakeItemRow>(ITEMS_URL, {
    query: {
      source: 'guru',
      kirimanStatus: query.status ?? null,
      page: query.page ?? 1,
      pageSize: SUBMISSION_PAGE_SIZE,
    },
    ...(query.signal ? { signal: query.signal } : {}),
  })
}

export async function fetchSubmissionCounts(signal?: AbortSignal): Promise<SubmissionCounts> {
  const total = async (kirimanStatus: IntakeKirimanStatus): Promise<number> => {
    const result = await api.list<IntakeItemRow>(ITEMS_URL, {
      query: { source: 'guru', kirimanStatus, pageSize: 1 },
      ...(signal ? { signal } : {}),
    })
    return result.meta.totalItems
  }
  const [all, pending, processing, done] = await Promise.all([
    total('Jumlah'),
    total('Pending'),
    total('Processing'),
    total('Selesai'),
  ])
  return { all, pending, processing, done }
}

/**
 * The files of the batches on a page (`GET /api/intake/batches/:id`, API-Q-14): an item row names no file.
 * A batch that cannot be read only leaves its `Fail` cell empty.
 */
export async function fetchBatchFiles(
  batchIds: string[],
  signal?: AbortSignal,
): Promise<Map<string, IntakeFileSummary[]>> {
  const ids = [...new Set(batchIds)]
  const results = await Promise.allSettled(
    ids.map((id) =>
      api.get<{ files: IntakeFileSummary[] }>(`/api/intake/batches/${id}`, signal ? { signal } : {}),
    ),
  )
  const files = new Map<string, IntakeFileSummary[]>()
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') files.set(ids[index] as string, result.value.files)
  })
  return files
}

/** `GET /api/intake/files/:id/original` (API-Q-14). */
export function downloadSubmissionFile(fileId: string): Promise<BlobResult> {
  return api.blob(`/api/intake/files/${fileId}/original`)
}
