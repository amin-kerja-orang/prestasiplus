/**
 * Shared helpers of the M04-T1 handler tests: boots the real core with the plugins the question
 * handlers need (M01 users and sessions, M02 for the M04 dependency, M03 curriculum, M04, and M10 for
 * the DSKP store) at the project clock, and calls endpoints as a user.
 */

import type { TransportResponse } from '@/api/transport'
import { createClock } from '@/lib/time'
import { issueSession } from '@/mock/core-data'
import { bootMock, type MockRuntime } from '@/mock/index'
import m01, { users } from '@/modules/m01-authentication/mock'
import m02 from '@/modules/m02-users-schools/mock'
import m03 from '@/modules/m03-curriculum/mock'
import m10 from '@/modules/m10-teacher-class/mock'

import m04 from '../../mock'
import { AI_LATENCY_KEY } from '../../mock/handlers/ai-explanation'

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

export interface ListBody<T> {
  data: T[]
  meta: {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
    from: number | null
    to: number | null
  }
}

export async function bootM04(): Promise<MockRuntime> {
  const runtime = await bootMock({
    mode: 'test',
    plugins: [m01, m02, m03, m04, m10],
    clock: createClock({ at: NOW }),
    latencyMs: 0,
    onWarn: null,
  })
  // The AI endpoint waits 1.5 s by default (FR-M04-45); tests do not.
  runtime.config.set(AI_LATENCY_KEY, 0)
  return runtime
}

export type Method = 'GET' | 'POST' | 'PUT' | 'DELETE'

export function callAs(runtime: MockRuntime) {
  return async function call<T = unknown>(
    method: Method,
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

/** A multipart form from plain fields (`File`/`Blob` values stay files). */
export function form(
  fields: Record<string, string | number | boolean | Blob | undefined>,
): FormData {
  const f = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue
    if (typeof value === 'object') f.append(key, value)
    else f.append(key, String(value))
  }
  return f
}

/** The REAL registry (every module): a duplicate route or a broken dependency stops the boot. */
export async function bootRegistry(): Promise<MockRuntime> {
  const runtime = await bootMock({
    mode: 'test',
    clock: createClock({ at: NOW }),
    latencyMs: 0,
    onWarn: null,
  })
  runtime.config.set(AI_LATENCY_KEY, 0)
  return runtime
}
