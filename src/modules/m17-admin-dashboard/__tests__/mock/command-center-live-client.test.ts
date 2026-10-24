/**
 * M17-T1b: the board client (`api/command-center-board.ts`): the three request functions (path, query,
 * unwrapped body, errors) and the pure display rules the S2 / S3 pages share (FR-M17-23…32, FR-M17-37…40,
 * BR-M17-07, BR-M17-08, FN-M17-3.3.3, DV-M17-08, DV-M17-09, DV-M17-10).
 */

import { afterEach, describe, expect, it, vi } from 'vitest'

import { installTransport } from '@/api'
import type { Transport, TransportRequest, TransportResponse } from '@/api/transport'

import {
  CC_LOGIN_LABEL,
  ccAccuracyLabel,
  ccAlesaSentence,
  ccAvgSessionLabel,
  ccChangeLine,
  ccDailyTitle,
  ccDailyTrendHeights,
  ccEngagementWidths,
  ccKirkpatrickBars,
  ccLoginRoleLine,
  ccStars,
  ccTodayBarPercent,
  ccTrendWord,
  fetchCcDailyActivity,
  fetchCcLiveData,
  fetchCcSchoolDrill,
  type CcLiveData,
} from '../../api/command-center-board'

function live(patch: Partial<CcLiveData> = {}): CcLiveData {
  return {
    generatedAt: '2026-09-25T15:40:00+08:00',
    scope: 'platform',
    school: null,
    totalSchools: 9,
    totalStudents: 3152,
    activeStudents: 1563,
    totalAnswered: 477_743,
    answeredToday: 340,
    answeredWeek: 2508,
    answeredLastWeek: 7571,
    weekChange: -67,
    accuracy: 82.9,
    topSchools: [],
    topStudents: [],
    gpsOverall: 2.88,
    kirk: { t1: { value: 4.6, scale: 5, count: 336 }, t2Accuracy: 82.9, t3Active: 91, t4Gps: 2.88 },
    engagement: { champion: 29, consistent: 11, developing: 43, minimum: 3, disengaged: 2229 },
    dailyTrend: [],
    mood: { happy: 307, okay: 280, sad: 72, stressed: 91 },
    recentFeed: [],
    correction: { total: 899, avgImprovement: 0, improvedCount: 0, topImprovers: [] },
    ...patch,
  }
}

function recorder(body: unknown = { data: { ok: true } }, status = 200) {
  const requests: TransportRequest[] = []
  const request = vi.fn((req: TransportRequest): Promise<TransportResponse> => {
    requests.push(req)
    return Promise.resolve({ status, headers: {}, body })
  })
  const transport: Transport = { request }
  installTransport(transport)
  return requests
}

afterEach(() => {
  installTransport({
    request: () => Promise.reject(new Error('no transport installed by this test')),
  })
})

describe('requests', () => {
  it('#3 GETs the live-data path and unwraps the envelope', async () => {
    const requests = recorder({ data: live() })
    const d = await fetchCcLiveData()
    expect(d.totalAnswered).toBe(477_743)
    expect(requests).toHaveLength(1)
    expect(requests[0]?.method).toBe('GET')
    expect(requests[0]?.url).toBe('/api/admin/command-center/live-data')
  })

  it('#4 sends the period as the only query and #5 the school id in the path', async () => {
    const requests = recorder()
    await fetchCcDailyActivity('week')
    await fetchCcSchoolDrill(8106, 'month')
    expect(requests[0]?.url).toBe('/api/command-center/daily-activity')
    expect(requests[0]?.query).toEqual({ period: 'week' })
    expect(requests[1]?.url).toBe('/api/command-center/daily-activity/school/8106')
    expect(requests[1]?.query).toEqual({ period: 'month' })
  })

  it('never sends a school id the server could honour (FR-M17-105)', async () => {
    const requests = recorder()
    await fetchCcLiveData()
    await fetchCcDailyActivity('today')
    for (const r of requests) {
      expect(JSON.stringify(r.query ?? {})).not.toMatch(/school/i)
      expect(r.url).not.toMatch(/school_id|schoolId/)
    }
  })

  it('rejects with the server error (403 for a role the guard refuses)', async () => {
    recorder({ error: { code: 'FORBIDDEN', message: 'Akses ditolak.' } }, 403)
    await expect(fetchCcLiveData()).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' })
  })
})

describe('trend word and change line (BR-M17-07)', () => {
  it('"penurunan" below 0, "peningkatan" above, "stabil" at 0', () => {
    expect(ccTrendWord(-67)).toBe('penurunan')
    expect(ccTrendWord(12)).toBe('peningkatan')
    expect(ccTrendWord(0)).toBe('stabil')
  })

  it('the three change lines', () => {
    expect(ccChangeLine(-65)).toEqual({ tone: 'down', text: '▼ -65% vs minggu lepas' })
    expect(ccChangeLine(8)).toEqual({ tone: 'up', text: '▲ +8% vs minggu lepas' })
    expect(ccChangeLine(0)).toEqual({ tone: 'same', text: 'Sama dengan minggu lepas' })
  })

  it('the "Aktiviti Hari Ini" bar is today ÷ max(today, week ÷ 5, 100)', () => {
    expect(ccTodayBarPercent(live({ answeredToday: 60, answeredWeek: 2653 }))).toBeCloseTo(
      (60 / 530.6) * 100,
      6,
    )
    expect(ccTodayBarPercent(live({ answeredToday: 340, answeredWeek: 2508 }))).toBeCloseTo(
      (340 / 501.6) * 100,
      6,
    )
    expect(ccTodayBarPercent(live({ answeredToday: 900, answeredWeek: 100 }))).toBe(100)
    expect(ccTodayBarPercent(live({ answeredToday: 0, answeredWeek: 0 }))).toBe(0)
  })
})

describe('ALESA AI sentence (FN-M17-3.3.3, DV-M17-09)', () => {
  it('platform: the template with the DC-M17-05 ratio (29 + 11 + 43) ÷ 2,315 and the T4 GPS', () => {
    const s = ccAlesaSentence(live({ weekChange: -65, accuracy: 82.9, totalSchools: 9 }))
    expect(s.before).toBe('Platform menunjukkan ')
    expect(s.trend).toBe('penurunan')
    expect(s.text).toBe(
      'Platform menunjukkan penurunan 65% minggu ini. 3.6% pelajar terlibat aktif. ' +
        'Ketepatan purata 82.9% dengan 9 sekolah aktif. GPS keseluruhan: 2.88.',
    )
  })

  it('school: names "Sekolah anda", never "platform", and uses engaged ÷ registered pupils', () => {
    const s = ccAlesaSentence(
      live({
        scope: 'school',
        school: { id: 8078, name: 'SMK Contoh' },
        weekChange: 168,
        totalStudents: 400,
        activeStudents: 100,
        engagement: { champion: 0, consistent: 0, developing: 0, minimum: 0, disengaged: 0 },
        totalSchools: 1,
        gpsOverall: 0,
      }),
    )
    expect(s.text).toBe(
      'Sekolah anda menunjukkan peningkatan 168% minggu ini. 25.0% pelajar terlibat aktif. ' +
        'Ketepatan purata 82.9% dengan 1 sekolah aktif. GPS keseluruhan: 0.00.',
    )
    expect(s.text.toLowerCase()).not.toContain('platform')
  })

  it('a school without pupils or buckets gives 0.0%, not NaN', () => {
    const s = ccAlesaSentence(live({ scope: 'school', totalStudents: 0, activeStudents: 0 }))
    expect(s.text).toContain('0.0% pelajar terlibat aktif')
    const p = ccAlesaSentence(
      live({
        engagement: { champion: 0, consistent: 0, developing: 0, minimum: 0, disengaged: 0 },
      }),
    )
    expect(p.text).toContain('0.0% pelajar terlibat aktif')
  })
})

describe('Kirkpatrick and engagement panels', () => {
  it('T1 stars: round(v ÷ 5 × 5) of 5 (DV-M17-08)', () => {
    expect(ccStars(4.6)).toBe('★★★★★')
    expect(ccStars(4.4)).toBe('★★★★☆')
    expect(ccStars(0)).toBe('☆☆☆☆☆')
    expect(ccStars(9)).toBe('★★★★★')
  })

  it('bars: T1 v ÷ 5, T2 accuracy, T3 min(n ÷ 500, 1), T4 min(gps ÷ 5, 1) (BR-M17-08)', () => {
    const b = ccKirkpatrickBars(live())
    expect(b.t1).toBeCloseTo(0.92, 6)
    expect(b.t2).toBeCloseTo(0.829, 6)
    expect(b.t3).toBeCloseTo(0.182, 6)
    expect(b.t4).toBeCloseTo(0.576, 6)
    const capped = ccKirkpatrickBars(
      live({
        kirk: { t1: { value: 5, scale: 5, count: 1 }, t2Accuracy: 100, t3Active: 900, t4Gps: 7 },
      }),
    )
    expect([capped.t3, capped.t4]).toEqual([1, 1])
  })

  it('engagement bars are n ÷ max × 100 (the Disengaged bar is full width)', () => {
    const w = ccEngagementWidths(live())
    expect(w.disengaged).toBe(100)
    expect(w.champion).toBeCloseTo((29 / 2229) * 100, 6)
    const zero = ccEngagementWidths(
      live({
        engagement: { champion: 0, consistent: 0, developing: 0, minimum: 0, disengaged: 0 },
      }),
    )
    expect(Object.values(zero).every((n) => n === 0)).toBe(true)
  })

  it('the school 7-day bars scale to the maximum with a 4 % minimum height (OQ-M17-12)', () => {
    const trend = [0, 5, 10, 2, 0, 1, 10].map((count, i) => ({
      date: `2026-09-${String(19 + i)}`,
      label: 'X',
      count,
    }))
    expect(ccDailyTrendHeights(live({ dailyTrend: trend }))).toEqual([4, 50, 100, 20, 4, 10, 100])
    expect(
      ccDailyTrendHeights(live({ dailyTrend: trend.map((p) => ({ ...p, count: 0 })) })),
    ).toEqual([4, 4, 4, 4, 4, 4, 4])
  })
})

describe('S3 card texts (FR-M17-37…40, DV-M17-10)', () => {
  it('login card label per tab', () => {
    expect(CC_LOGIN_LABEL).toEqual({
      today: 'Log Masuk Hari Ini',
      week: 'Log Masuk Minggu Ini',
      month: 'Log Masuk Bulan Ini',
    })
  })

  it('role line "{role}: {n} · …" in the response order', () => {
    expect(ccLoginRoleLine({ student: 9, teacher: 1, admin: 1, school_admin: 2 })).toBe(
      'student: 9 · teacher: 1 · admin: 1 · school_admin: 2',
    )
    expect(ccLoginRoleLine({})).toBe('')
  })

  it('"Purata: {m}m {s}s" and "Ketepatan: {n}%" with the ".0" dropped', () => {
    expect(ccAvgSessionLabel(168)).toBe('Purata: 2m 48s')
    expect(ccAvgSessionLabel(0)).toBe('Purata: 0m 0s')
    expect(ccAvgSessionLabel(114)).toBe('Purata: 1m 54s')
    expect(ccAccuracyLabel(95)).toBe('Ketepatan: 95%')
    expect(ccAccuracyLabel(84.6)).toBe('Ketepatan: 84.6%')
  })

  it('the S3 title swaps "PLATFORM" for "SEKOLAH" on the school view (FR-M17-116)', () => {
    expect(ccDailyTitle('platform')).toBe('AKTIVITI PLATFORM')
    expect(ccDailyTitle('school')).toBe('AKTIVITI SEKOLAH')
  })
})
