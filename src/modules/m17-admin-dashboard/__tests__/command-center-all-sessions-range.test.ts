import { describe, expect, it, vi } from 'vitest'

const mode = vi.hoisted(() => ({ http: false }))
vi.mock('@/api/mode', () => ({ isHttpMode: () => mode.http }))

import { ALL_SESSIONS_MAX_DAYS, ALL_SESSIONS_RANGE, allSessionsRange } from '../api/command-center'

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
})
