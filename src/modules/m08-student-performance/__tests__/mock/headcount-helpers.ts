/**
 * Helpers of the M08-T1b tests: a request as a canonical account with any HTTP method (the T1 boot
 * helper only sends GET and POST; the headcount routes also use DELETE).
 */

import type { HttpMethod, TransportResponse } from '@/api/transport'
import { setUser } from '@/mock/core-data/set-user'
import type { MockRuntime } from '@/mock/index'

export const ADMIN = 1
export const PELAJAR = 2
export const IBU_BAPA = 6
export const PPD = 9
export const GURU = 5
export const ADMIN_SEKOLAH = 8

export interface Reply<T = unknown> {
  status: number
  body: T
  headers: Record<string, string>
}

export async function call<T = unknown>(
  runtime: MockRuntime,
  userId: number | null,
  method: HttpMethod,
  url: string,
  body?: unknown,
): Promise<Reply<T>> {
  const headers: Record<string, string> = { accept: 'application/json' }
  if (userId !== null) headers.authorization = `Bearer ${setUser(userId).token}`
  if (body !== undefined) headers['content-type'] = 'application/json'
  const res: TransportResponse = await runtime.transport.request({
    method,
    url,
    headers,
    ...(body !== undefined ? { body } : {}),
  })
  return { status: res.status, body: res.body as T, headers: res.headers ?? {} }
}

/** The `data` of a 2xx reply (throws with the body otherwise). */
export async function data<T>(
  runtime: MockRuntime,
  userId: number | null,
  method: HttpMethod,
  url: string,
  body?: unknown,
): Promise<T> {
  const r = await call<{ data: T }>(runtime, userId, method, url, body)
  if (r.status < 200 || r.status > 299) {
    throw new Error(
      `${method} ${url} as ${String(userId)} → ${String(r.status)} ${JSON.stringify(r.body)}`,
    )
  }
  return r.body.data
}

/** The `error` of a failed reply. */
export interface ErrorBody {
  error: { code: string; message: string; fields?: Record<string, string> }
}
