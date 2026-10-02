/**
 * Shared helpers of the M04-T2 workflow handler tests: boots the real core with M01, M02, M03 and M04
 * at the project clock and calls endpoints as a user (JSON or multipart).
 */

import type { TransportResponse } from '@/api/transport'
import { createClock } from '@/lib/time'
import { issueSession } from '@/mock/core-data'
import { bootMock, type MockRuntime } from '@/mock/index'
import m01, { users } from '@/modules/m01-authentication/mock'
import m02 from '@/modules/m02-users-schools/mock'
import m03 from '@/modules/m03-curriculum/mock'

import m04 from '../../mock'

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
  headers: Record<string, string>
}

export interface ErrorBody {
  error: { code: string; message: string; fields?: Record<string, string> }
}

export async function bootM04(
  init: { overrides?: Record<string, unknown> } = {},
): Promise<MockRuntime> {
  return bootMock({
    mode: 'test',
    plugins: [m01, m02, m03, m04],
    clock: createClock({ at: NOW }),
    latencyMs: 0,
    onWarn: null,
    init,
  })
}

export type Call = ReturnType<typeof callAs>

export function callAs(runtime: MockRuntime) {
  return async function call<T = unknown>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
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
    return { status: res.status, body: res.body as T, headers: res.headers }
  }
}

/** A multipart body from text fields and files. */
export function form(fields: Record<string, string | number>, files: Record<string, File> = {}) {
  const f = new FormData()
  for (const [k, v] of Object.entries(fields)) f.append(k, String(v))
  for (const [k, v] of Object.entries(files)) f.append(k, v)
  return f
}

export const csvFile = (text: string, name = 'soalan.csv', type = 'text/csv') =>
  new File([text], name, { type })

export const pngFile = (name = 'rajah.png', type = 'image/png', size = 64) =>
  new File([new Uint8Array(size)], name, { type })
