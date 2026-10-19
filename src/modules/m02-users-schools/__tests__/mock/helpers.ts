/**
 * Shared test helpers of the M02-T2 handler tests: boots the real core with M01 and M02 (the
 * plugins the schools handlers depend on) at the project clock, and calls endpoints as a user.
 */

import type { TransportResponse } from '@/api/transport'
import { createClock } from '@/lib/time'
import { issueSession } from '@/mock/core-data'
import { bootMock, type MockRuntime } from '@/mock/index'
import m01, { users } from '@/modules/m01-authentication/mock'

import m02 from '../../mock'

/** The project clock (2026-09-25 15:40 MYT). */
export const NOW = '2026-09-25T15:40:00+08:00'

/** Canonical accounts (M01 §6.8). */
export const ADMIN = 1
export const PELAJAR = 2
export const GURU = 5
export const IBU_BAPA = 6
export const ADMIN_SEKOLAH = 8

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

export async function bootM02(): Promise<MockRuntime> {
  return bootMock({
    mode: 'test',
    plugins: [m01, m02],
    clock: createClock({ at: NOW }),
    latencyMs: 0,
    onWarn: null,
  })
}

export function callAs(runtime: MockRuntime) {
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
    const multipart = typeof FormData !== 'undefined' && body instanceof FormData
    if (body !== undefined && !multipart) headers['content-type'] = 'application/json'
    const res: TransportResponse = await runtime.transport.request({
      method,
      url,
      headers,
      ...(body !== undefined ? { body } : {}),
    })
    return { status: res.status, body: res.body as T }
  }
}
