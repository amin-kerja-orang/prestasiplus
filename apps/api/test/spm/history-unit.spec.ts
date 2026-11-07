import { describe, expect, it } from 'vitest'

import { SpmHistoryService, chipOf } from '../../src/modules/spm/history.service'
import { SpmPorts, type SpmHistoryPageQuery, type SpmHistoryRowData } from '../../src/modules/spm'
import { compareIds, compareNewestFirst, isPastEnd, rowModeOfKind, rowModeOfSession, sittingSeconds } from '../../src/modules/practice/reads/spm'

const caller = { userId: '12', role: 'student', isTest: false }

describe('chipOf: the legacy values read as their lane', () => {
  it('maps past_year to databank and ramalan to tracking_a; the others stay', () => {
    expect(chipOf('past_year')).toBe('databank')
    expect(chipOf('ramalan')).toBe('tracking_a')
    for (const m of ['all', 'databank', 'latih_tubi', 'tracking_a'] as const) expect(chipOf(m)).toBe(m)
  })
})

describe('row modes (OPT-MODE-SESI)', () => {
  it('paper_kind: pilihan and jana are Bijak SPM (simulasi), subjektif and structured keep their name', () => {
    expect(rowModeOfKind('pilihan')).toBe('simulasi')
    expect(rowModeOfKind('jana')).toBe('simulasi')
    expect(rowModeOfKind('subjektif')).toBe('subjektif')
    expect(rowModeOfKind('structured')).toBe('structured')
  })

  it('session mode: legacy values read as the lane, a Kuiz session is kuiz, a plain Latih Tubi session is not', () => {
    expect(rowModeOfSession('past_year', null)).toBe('databank')
    expect(rowModeOfSession('databank', null)).toBe('databank')
    expect(rowModeOfSession('ramalan', null)).toBe('tracking_a')
    expect(rowModeOfSession('tracking_a', null)).toBe('tracking_a')
    expect(rowModeOfSession('latih_tubi', null)).toBe('latih_tubi')
    expect(rowModeOfSession('latih_tubi', 'paper1')).toBe('latih_tubi')
    expect(rowModeOfSession('latih_tubi', 'bijak_kuiz')).toBe('kuiz')
  })
})

describe('sittingSeconds: elapsed time capped at the deadline', () => {
  const at = (m: number) => new Date(Date.UTC(2026, 9, 10, 0, m))
  it('is the elapsed time without a deadline', () => {
    expect(sittingSeconds({ startedAt: at(0), deadlineAt: null, completedAt: at(10) })).toBe(600)
  })
  it('is capped at a deadline that passed before the submit', () => {
    expect(sittingSeconds({ startedAt: at(0), deadlineAt: at(5), completedAt: at(10) })).toBe(300)
  })
  it('uses the submit when it is before the deadline, and never goes negative', () => {
    expect(sittingSeconds({ startedAt: at(0), deadlineAt: at(60), completedAt: at(10) })).toBe(600)
    expect(sittingSeconds({ startedAt: at(10), deadlineAt: null, completedAt: at(0) })).toBe(0)
  })
})

describe('compareIds and compareNewestFirst', () => {
  const row = (id: string, iso: string) => ({ id, completedAt: new Date(iso) }) as SpmHistoryRowData
  it('compares numeric ids numerically, so 10 is after 9', () => {
    expect(compareIds('10', '9')).toBe(1)
    expect(compareIds('9', '10')).toBe(-1)
    expect(compareIds('7', '7')).toBe(0)
    expect(compareIds('12345678901234567890', '12345678901234567891')).toBe(-1)
  })
  it('compares uuids as text (the database order of a uuid), and mixed ids as text', () => {
    expect(compareIds('4b1f6c1e-2c4e-4d7e-9a3b-0f5e1c2d3a4b', '4b1f6c1e-2c4e-4d7e-9a3b-0f5e1c2d3a4c')).toBe(-1)
    expect(compareIds('10', 'a')).toBe(-1)
  })
  it('sorts newest first, ties by id descending, numerically', () => {
    const same = '2026-10-10T00:00:00Z'
    const rows = [row('9', same), row('10', same), row('2', '2026-10-11T00:00:00Z'), row('1', '2026-10-09T00:00:00Z')]
    expect([...rows].sort(compareNewestFirst).map((r) => r.id)).toEqual(['2', '10', '9', '1'])
  })
})

describe('isPastEnd: a page that starts after the last row reads nothing', () => {
  it('is false inside the history and true from the first page past it', () => {
    expect(isPastEnd(1, 15, 23)).toBe(false)
    expect(isPastEnd(2, 15, 23)).toBe(false)
    expect(isPastEnd(3, 15, 23)).toBe(true)
    expect(isPastEnd(2, 15, 15)).toBe(true)
    expect(isPastEnd(1, 15, 0)).toBe(true)
  })
  it('treats a huge or unsafe page as past the end', () => {
    expect(isPastEnd(99999999999, 15, 23)).toBe(true)
    expect(isPastEnd(1e20, 15, 23)).toBe(true)
    expect(isPastEnd(Number.NaN, 15, 23)).toBe(true)
    expect(isPastEnd(0, 15, 23)).toBe(true)
  })
})

describe('SpmHistoryService over fake ports', () => {
  const row: SpmHistoryRowData = {
    id: '4b1f6c1e-2c4e-4d7e-9a3b-0f5e1c2d3a4b',
    mode: 'databank',
    subject: { code: 'MATH', name: 'Matematik' },
    correct: 7,
    total: 10,
    percent: 70,
    coins: 7,
    durationSeconds: 120,
    completedAt: new Date('2026-10-10T00:18:00Z'),
  }

  function build() {
    const ports = new SpmPorts()
    const seen: SpmHistoryPageQuery[] = []
    ports.provideAnswerStats({ statsFor: async (_u, o) => ({ answered: o.includeTest ? 17 : 8, correct: o.includeTest ? 10 : 4, sessions: 5 }) })
    ports.provideCoins({ earnedCoins: async (_u, o) => (o.includeTest ? 40 : 25) })
    ports.provideHistory({
      page: async (q) => {
        seen.push(q)
        return { rows: [row], total: 31 }
      },
    })
    return { service: new SpmHistoryService(ports), seen }
  }

  it('stats: whole-number half-up accuracy, coins from the coin port, Mod Pelajar widens both', async () => {
    const { service } = build()
    expect(await service.stats(caller)).toEqual({ sessions: 5, avgAccuracy: 50, coins: 25, answered: 8 })
    expect(await service.stats({ ...caller, isTest: true })).toEqual({ sessions: 5, avgAccuracy: 59, coins: 40, answered: 17 })
  })

  it('stats: null accuracy with 0 answers', async () => {
    const ports = new SpmPorts()
    expect(await new SpmHistoryService(ports).stats(caller)).toEqual({ sessions: 0, avgAccuracy: null, coins: 0, answered: 0 })
  })

  it('history: defaults to all, page 1, 15 per page; the pager meta follows the total; completedAt is +08:00', async () => {
    const { service, seen } = build()
    const r = await service.history(caller, {})
    expect(seen[0]).toEqual({ userId: '12', includeTest: false, chip: 'all', page: 1, pageSize: 15 })
    expect(r.meta).toMatchObject({ page: 1, pageSize: 15, pageCount: 3, total: 31, mod: 'all' })
    expect(r.data[0]?.completedAt).toBe('2026-10-10T08:18:00.000+08:00')
  })

  it('history: completedAt is Malaysia time across the midnight boundary', async () => {
    const ports = new SpmPorts()
    ports.provideHistory({ page: async () => ({ rows: [{ ...row, completedAt: new Date('2026-01-01T16:30:00Z') }, { ...row, completedAt: new Date('2026-01-01T15:59:59Z') }], total: 2 }) })
    const r = await new SpmHistoryService(ports).history(caller, {})
    expect(r.data.map((x) => x.completedAt)).toEqual(['2026-01-02T00:30:00.000+08:00', '2026-01-01T23:59:59.000+08:00'])
  })

  it('history: mod wins over type, legacy values resolve, halaman is passed through, the pager has at least one page', async () => {
    const { service, seen } = build()
    expect((await service.history(caller, { mod: 'latih_tubi', type: 'databank', halaman: 2 })).meta).toMatchObject({ mod: 'latih_tubi', page: 2 })
    expect(seen[0]).toMatchObject({ chip: 'latih_tubi', page: 2 })
    expect((await service.history(caller, { type: 'ramalan' })).meta.mod).toBe('tracking_a')
    const empty = new SpmPorts()
    expect((await new SpmHistoryService(empty).history(caller, {})).meta).toMatchObject({ pageCount: 1, total: 0 })
  })
})
