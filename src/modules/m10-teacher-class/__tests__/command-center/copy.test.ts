import { describe, expect, it } from 'vitest'

import type { CcDrillRowMap } from '../../api/command-center-types'
import {
  accuracyTone,
  activityWidth,
  gpsText,
  gpsTone,
  insightText,
  rarityOf,
  riskLabel,
  signedPct,
  stars,
  weekChangeText,
} from '../../components/command-center/copy'
import { drillTable } from '../../components/command-center/drill-table'
import { live } from './fixtures'

describe('rules of S2 (FN-M10-2.2.3-2.2.13)', () => {
  it('shows the GPS with 2 decimals and "--" for null', () => {
    expect(gpsText(4.69)).toBe('4.69')
    expect(gpsText(3)).toBe('3.00')
    expect(gpsText(null)).toBe('--')
  })

  it('draws stars = round(t1 / 10 x 5)', () => {
    expect(stars(0)).toBe('☆☆☆☆☆')
    expect(stars(5)).toBe('★★★☆☆')
    expect(stars(7.5)).toBe('★★★★☆')
    expect(stars(10)).toBe('★★★★★')
  })

  it('builds the insight from the engagement ratio, accuracy and GPS', () => {
    expect(insightText(live({ gpsOverall: 4.69 }))).toBe(
      '"0% pelajar terlibat aktif. Ketepatan purata 0%. GPS sekolah: 4.69."',
    )
    const d = live({
      accuracy: 46,
      gpsOverall: null,
      engagement: { champion: 1, consistent: 0, developing: 1, minimum: 1, disengaged: 0 },
    })
    expect(insightText(d)).toBe(
      '"66.7% pelajar terlibat aktif. Ketepatan purata 46%. GPS sekolah: --."',
    )
  })

  it('computes the activity bar width min(today / max(today, week / 5, 100) x 100, 100)', () => {
    expect(activityWidth(0, 0)).toBe(0)
    expect(activityWidth(50, 0)).toBe(50)
    expect(activityWidth(50, 1000)).toBe(25)
    expect(activityWidth(300, 100)).toBe(100)
  })

  it('words the week change by its sign', () => {
    expect(weekChangeText(0)).toEqual({ text: 'Sama dengan minggu lepas', tone: 'text-slate-400' })
    expect(weekChangeText(12)).toEqual({ text: '▲ +12% vs minggu lepas', tone: 'text-emerald-400' })
    expect(weekChangeText(-23)).toEqual({ text: '▼ 23% vs minggu lepas', tone: 'text-rose-400' })
  })

  it('colours accuracy (>= 70 emerald, < 50 rose, else amber) and GPS (<= 2, <= 3)', () => {
    expect([90, 70, 69, 50, 49].map(accuracyTone)).toEqual([
      'text-emerald-400',
      'text-emerald-400',
      'text-amber-400',
      'text-amber-400',
      'text-rose-400',
    ])
    expect([1.9, 2, 2.5, 3, 3.1].map(gpsTone)).toEqual([
      'text-emerald-400',
      'text-emerald-400',
      'text-amber-400',
      'text-amber-400',
      'text-rose-400',
    ])
  })

  it('labels the rarity by the number of holders', () => {
    expect([25, 20, 10, 5, 1, 0].map((n) => rarityOf(n).label)).toEqual([
      'Common',
      'Common',
      'Uncommon',
      'Rare',
      'Epic',
      'Legendary',
    ])
  })

  it('upper-cases the risk in both vocabularies and signs the trend', () => {
    expect(
      ['kritikal', 'critical', 'tinggi', 'high', 'sederhana', 'medium', 'rendah'].map((r) =>
        riskLabel(r as 'kritikal'),
      ),
    ).toEqual(['KRITIKAL', 'KRITIKAL', 'TINGGI', 'TINGGI', 'SEDERHANA', 'SEDERHANA', 'RENDAH'])
    expect([8, -3, 0, 2.5].map(signedPct)).toEqual(['+8%', '-3%', '0%', '+2.5%'])
  })
})

describe('drill tables (FN-M10-2.2.7)', () => {
  it('lists the gps rows with Subjek · GPS · Gred · Pelajar · Sumber', () => {
    const rows: CcDrillRowMap['gps'][] = [
      { subject: 'Kimia', gps: 4.69, grade: 'D', students: 8, source: 'Anggaran OTR' },
    ]
    const t = drillTable('gps', rows)
    expect(t.headers).toEqual(['Subjek', 'GPS', 'Gred', 'Pelajar', 'Sumber'])
    expect(t.rows[0]!.cells.map((c) => c.text)).toEqual(['Kimia', '4.69', 'D', '8', 'Anggaran OTR'])
    expect(t.rows[0]!.cells[1]!.tone).toBe('text-rose-400')
    expect(t.rows[0]!.studentId).toBeUndefined()
  })

  it('lists subjects, today, kirk t1 and mood rows with their headers', () => {
    expect(drillTable('subjects', []).headers).toEqual([
      'Subjek',
      'Jawapan',
      'Betul',
      'Ketepatan',
      'Pelajar',
    ])
    expect(drillTable('today', []).headers).toEqual([
      'Masa',
      'Pelajar',
      'Subjek',
      'Soalan',
      'Betul',
      'Ketepatan',
    ])
    expect(drillTable('mood', []).headers).toEqual(['Pelajar', 'Tarikh', 'Sebab'])
    const kirk = drillTable('kirk', [
      {
        studentId: 3002,
        name: 'Murid Demo 02',
        average: 7.5,
        satisfaction: 4,
        relevance: null,
        usefulness: null,
        date: '2026-09',
      },
    ])
    expect(kirk.headers).toEqual(['Pelajar', 'Purata', 'Kepuasan', 'Relevan', 'Kegunaan', 'Tarikh'])
    expect(kirk.rows[0]!.cells.map((c) => c.text)).toEqual([
      'Murid Demo 02',
      '7.5',
      '4',
      '-',
      '-',
      '2026-09',
    ])
    expect(kirk.rows[0]!.studentId).toBe(3002)
    const mood = drillTable('mood', [
      { studentId: 3001, name: 'Murid Demo 01', mood: 'sad', date: '2026-09-24', reason: null },
    ])
    expect(mood.rows[0]!.cells.map((c) => c.text)).toEqual(['Murid Demo 01', '2026-09-24', '-'])
  })

  it('lists the engagement rows with the band label', () => {
    const t = drillTable('engagement', [
      {
        studentId: 3002,
        name: 'Murid Demo 02',
        band: 'developing',
        days: 2,
        answeredWeek: 16,
        accuracy: 55,
        lastActiveAt: '2026-09-24T10:00:00+08:00',
      },
    ])
    expect(t.rows[0]!.cells.map((c) => c.text)).toEqual([
      'Murid Demo 02',
      'Berkembang',
      '2',
      '16',
      '55%',
      '24/09/2026 10:00',
    ])
  })
})
