import { describe, expect, it, vi } from 'vitest'

const mode = vi.hoisted(() => ({ http: false }))
const client = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/api', () => ({ api: client }))
vi.mock('@/api/mode', () => ({ isHttpMode: () => mode.http }))

import {
  ALL_SESSIONS_MAX_DAYS,
  ALL_SESSIONS_RANGE,
  allSessionsRange,
  fetchCcStudentAllSessions,
} from '../api/command-center'

const NOW = Date.parse('2026-10-22T04:00:00+08:00')
const spanDays = (r: { start: string; end: string }) =>
  (Date.parse(`${r.end}T00:00:00Z`) - Date.parse(`${r.start}T00:00:00Z`)) / 86_400_000 + 1

describe('"Semua Sesi Latihan" range', () => {
  it('keeps the fixed wide range in mock mode', () => {
    mode.http = false
    expect(allSessionsRange(NOW)).toEqual(ALL_SESSIONS_RANGE)
  })
  it('asks BE-22 for the last 366 days (MYT dates) in http mode', () => {
    mode.http = true
    const r = allSessionsRange(NOW)
    expect(r.end).toBe('2026-10-22')
    expect(r.start).toBe('2025-10-22')
    expect(spanDays(r)).toBe(ALL_SESSIONS_MAX_DAYS)
  })
  it('fetchCcStudentAllSessions sends that range as start/end in http mode', async () => {
    mode.http = true
    client.get.mockResolvedValue({})
    await fetchCcStudentAllSessions('77')
    const [path, opts] = client.get.mock.calls[0] as [string, { query: { start: string; end: string } }]
    const expected = allSessionsRange()
    expect(path).toBe('/api/command-center/student/77/week')
    expect(opts.query).toEqual(expected)
    expect(spanDays(opts.query)).toBe(ALL_SESSIONS_MAX_DAYS)
  })
})
