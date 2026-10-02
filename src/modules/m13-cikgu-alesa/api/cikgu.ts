/**
 * M13 client functions (SRS M13 v1.1 §7 #1–#12; build-plan M13-T1). UI tasks import these and do not
 * change this file (build-plan §S.3 rule 5).
 *
 * `sendChat` (#1) goes through `api.raw`: the live body is read as it is, for any HTTP status
 * (SQ-M13-01). It resolves to `{status, body}` and rejects only on a network failure or abort; a
 * non-JSON body arrives as whatever the transport parsed (the screen treats it as the network branch).
 * The other functions use the shared client (envelope unwrapped, errors as `ApiError`).
 */

import { api, type ListResult } from '@/api'

import type {
  BulkApproveResult,
  ChatErrorBody,
  ChatSendRequest,
  ChatSendResponse,
  CikguClassOption,
  CikguSubjectOption,
  EssayListItem,
  EssayMarking,
  PbdQueueItem,
  Rph,
  RphCreateRequest,
  RphListItem,
  RollupResult,
} from './types'

interface Signal {
  signal?: AbortSignal
}

const withSignal = (o: Signal) => (o.signal ? { signal: o.signal } : {})

export interface ChatSendResult {
  status: number
  body: ChatSendResponse | ChatErrorBody | null
}

/** #1 `POST /api/cikgu/send`. */
export async function sendChat(
  request: ChatSendRequest,
  options: Signal = {},
): Promise<ChatSendResult> {
  const res = await api.raw<ChatSendResponse | ChatErrorBody | null>(
    'POST',
    '/api/cikgu/send',
    request,
    withSignal(options),
  )
  return { status: res.status, body: res.body }
}

/** #2 `GET /api/cikgu/rph`. */
export function fetchRphList(page = 1, options: Signal = {}): Promise<ListResult<RphListItem>> {
  return api.list<RphListItem>('/api/cikgu/rph', { query: { page }, ...withSignal(options) })
}

/** #3 `POST /api/cikgu/rph`. */
export function createRph(body: RphCreateRequest, options: Signal = {}): Promise<Rph> {
  return api.post<Rph>('/api/cikgu/rph', { body, ...withSignal(options) })
}

/** #4 `GET /api/cikgu/rph/:id`. */
export function fetchRph(id: number, options: Signal = {}): Promise<Rph> {
  return api.get<Rph>(`/api/cikgu/rph/${String(id)}`, withSignal(options))
}

/** #5 `GET /api/cikgu/essays`. */
export function fetchEssayList(page = 1, options: Signal = {}): Promise<ListResult<EssayListItem>> {
  return api.list<EssayListItem>('/api/cikgu/essays', { query: { page }, ...withSignal(options) })
}

/** #6 `GET /api/cikgu/essays/:id`. */
export function fetchEssay(id: number, options: Signal = {}): Promise<EssayMarking> {
  return api.get<EssayMarking>(`/api/cikgu/essays/${String(id)}`, withSignal(options))
}

/** #7 `GET /api/cikgu/pbd`. */
export function fetchPbdQueue(page = 1, options: Signal = {}): Promise<ListResult<PbdQueueItem>> {
  return api.list<PbdQueueItem>('/api/cikgu/pbd', { query: { page }, ...withSignal(options) })
}

/** #8 `POST /api/cikgu/pbd/rollup`. */
export function rollupPbd(classroomId: number | null, options: Signal = {}): Promise<RollupResult> {
  return api.post<RollupResult>('/api/cikgu/pbd/rollup', {
    body: { classroomId },
    ...withSignal(options),
  })
}

/** #9 `POST /api/cikgu/pbd/bulk-approve`. */
export function bulkApprovePbd(
  ids: readonly number[],
  options: Signal = {},
): Promise<BulkApproveResult> {
  return api.post<BulkApproveResult>('/api/cikgu/pbd/bulk-approve', {
    body: { ids: [...ids] },
    ...withSignal(options),
  })
}

/** #10 `GET /api/cikgu/pbd/export.csv` (a download). */
export function downloadPbdCsv(options: Signal = {}) {
  return api.blob('/api/cikgu/pbd/export.csv', withSignal(options))
}

/** #11 (M10 #12) `GET /api/guru/classes`: the teacher's own classes (admin: none). */
export async function fetchCikguClasses(options: Signal = {}): Promise<CikguClassOption[]> {
  const res = await api.list<CikguClassOption>('/api/guru/classes', withSignal(options))
  return res.data
}

/** #12 (M03 #28) `GET /api/subjects`: the active subjects (the S3 datalist). */
export async function fetchCikguSubjects(options: Signal = {}): Promise<CikguSubjectOption[]> {
  const res = await api.list<CikguSubjectOption>('/api/subjects', withSignal(options))
  return res.data
}
