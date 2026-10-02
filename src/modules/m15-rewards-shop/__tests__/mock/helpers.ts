/**
 * Shared helpers of the M15-T1 handler tests: boots core + M01 + M02 + M14 + M15 at the project clock
 * (latency 0) and calls endpoints as a canonical account.
 */

import type { TransportResponse } from '@/api/transport'
import { createClock } from '@/lib/time'
import { issueSession } from '@/mock/core-data'
import { bootMock, type MockRuntime } from '@/mock/index'
import m01, { users } from '@/modules/m01-authentication/mock'
import m02 from '@/modules/m02-users-schools/mock'
import m14 from '@/modules/m14-gamification/mock'

import m15 from '../../mock'

/** The project clock (2026-09-25 15:40 MYT). */
export const NOW = '2026-09-25T15:40:00+08:00'

/** Canonical accounts (M01 §6.8) and the M02 parent fixture without links. */
export const ADMIN = 1
export const PELAJAR = 2
export const PELAJAR_4 = 4
export const GURU = 5
export const IBU_BAPA = 6
export const IBU_BAPA_TANPA_ANAK = 5401

export interface Answer<T = unknown> {
  status: number
  body: T
}

export interface ErrorBody {
  error: { code: string; message: string; fields?: Record<string, string> }
}

export interface ListBody<T, M extends object = Record<never, never>> {
  data: T[]
  meta: {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
    from: number | null
    to: number | null
  } & M
}

export async function bootM15(): Promise<MockRuntime> {
  return bootMock({
    mode: 'test',
    plugins: [m01, m02, m14, m15],
    clock: createClock({ at: NOW }),
    latencyMs: 0,
    onWarn: null,
  })
}

export type Call = <T = unknown>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  url: string,
  as: number | null,
  body?: unknown,
) => Promise<Answer<T>>

export function callAs(runtime: MockRuntime): Call {
  return async function call<T = unknown>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    url: string,
    as: number | null,
    body?: unknown,
  ): Promise<Answer<T>> {
    const headers: Record<string, string> = { accept: 'application/json' }
    if (as !== null) {
      headers.authorization = `Bearer ${issueSession(users.get(as) as never, false, Date.parse(NOW)).token}`
    }
    if (body !== undefined) headers['content-type'] = 'application/json'
    const res: TransportResponse = await runtime.transport.request({
      method,
      url,
      headers,
      ...(body !== undefined ? { body } : {}),
    })
    return { status: res.status, body: res.body as T }
  }
}

/** The error code of a refused answer. */
export const codeOf = (a: Answer): string => (a.body as ErrorBody).error.code
