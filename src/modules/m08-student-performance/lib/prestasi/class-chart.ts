/**
 * S5 "Trend Aktiviti Kelas (30 Hari)" series for `DsChart` (FR-M08-35): labels MM-DD. The accuracy
 * ("Purata Ketepatan (%)", 0–100) and the sessions ("Sesi") have different scales, so each gets its own chart.
 */

import type { ClassDashboard } from '../../api/types'

import type { ChartInput } from './gps-chart'

type Point = ClassDashboard['trend'][number]

export function classAccuracySeries(points: readonly Point[]): ChartInput {
  return {
    labels: points.map((p) => p.date.slice(5)),
    series: [{ label: 'Purata Ketepatan (%)', data: points.map((p) => p.avgAccuracy), slot: 1 }],
  }
}

export function classSessionSeries(points: readonly Point[]): ChartInput {
  return {
    labels: points.map((p) => p.date.slice(5)),
    series: [{ label: 'Sesi', data: points.map((p) => p.sessions), slot: 2 }],
  }
}
