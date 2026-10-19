/**
 * Boot helper for the M12 mock tests: the real core with the owners M12 reads (M01 users, M02 schools, M03
 * subjects, M04 questions, M05 practice, M08 SPM history and headcount, M10 classes, which the M05 Kirkpatrick
 * prime and the M08 headcount read) and the M12 plugin, at the project clock (2026-09-25 15:40 MYT).
 */

import { vi } from 'vitest'

import type { TransportResponse } from '@/api/transport'
import { CLOCK_ANCHOR_ISO, createClock, type Clock } from '@/lib/time'
import { setUser } from '@/mock/core-data/set-user'
import { bootMock, type MockRuntime } from '@/mock/index'
import m01 from '@/modules/m01-authentication/mock'
import m02 from '@/modules/m02-users-schools/mock'
import m03 from '@/modules/m03-curriculum/mock'
import m04 from '@/modules/m04-question-bank/mock'
import m05 from '@/modules/m05-practice/mock'
import m08 from '@/modules/m08-student-performance/mock'
import m10 from '@/modules/m10-teacher-class/mock'

import m12 from '../../mock'

class MemoryStorage {
  private readonly items = new Map<string, string>()
  getItem(key: string) {
    return this.items.get(key) ?? null
  }
  setItem(key: string, value: string) {
    this.items.set(key, value)
  }
  removeItem(key: string) {
    this.items.delete(key)
  }
}

export interface Answer<T = unknown> {
  status: number
  body: T
  headers: Record<string, string>
}

export interface ErrorBody {
  error: { code: string; message: string; fields?: Record<string, string> }
}

export interface DataBody<T> {
  data: T
}

export const ADMIN = 1
export const PELAJAR = 2
export const GURU = 5
export const IBU_BAPA = 6
export const ADMIN_SEKOLAH = 8
export const PPD = 9

export interface M12Harness {
  runtime: MockRuntime
  clock: Clock
  call: <T = unknown>(
    method: 'GET' | 'POST',
    url: string,
    as: number | null,
    body?: unknown,
  ) => Promise<Answer<T>>
  get: <T = unknown>(url: string, as: number | null) => Promise<Answer<T>>
  post: <T = unknown>(url: string, as: number | null, body?: unknown) => Promise<Answer<T>>
}

export async function bootM12(at: string = CLOCK_ANCHOR_ISO): Promise<M12Harness> {
  vi.stubGlobal('localStorage', new MemoryStorage())
  const clock = createClock({ at })
  const runtime = await bootMock({
    mode: 'test',
    plugins: [m01, m02, m03, m04, m05, m08, m10, m12],
    clock,
    latencyMs: 0,
    onWarn: null,
  })
  const call: M12Harness['call'] = async (method, url, as, body) => {
    const headers: Record<string, string> = { accept: 'application/json' }
    if (as !== null) headers.authorization = `Bearer ${setUser(as).token}`
    if (body !== undefined) headers['content-type'] = 'application/json'
    const res: TransportResponse = await runtime.transport.request({
      method,
      url,
      headers,
      ...(body !== undefined ? { body } : {}),
    })
    return { status: res.status, body: res.body as never, headers: res.headers }
  }
  return {
    runtime,
    clock,
    call,
    get: (url, as) => call('GET', url, as),
    post: (url, as, body) => call('POST', url, as, body),
  }
}

export function shutdownM12(): void {
  vi.unstubAllGlobals()
}
