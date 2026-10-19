/**
 * S1 "Trend GPS (5 Tahun)" series for `DsChart` (FR-M08-16): the overall line plus one line per subject.
 * `DsChart` takes plain numbers, so only the years that have an overall value are plotted and a subject
 * is kept when it has a value for each of those years. S9 uses {@link sparklineSeries}.
 */

import type { ChartSeries } from '@/ds'

import type { SchoolPerformance } from '../../api/types'

type TrendChart = SchoolPerformance['trend']['chart']

export interface ChartInput {
  labels: string[]
  series: ChartSeries[]
}

export function trendSeries(chart: TrendChart): ChartInput {
  const keep = chart.overall.map((v) => v !== null)
  const pick = <T>(values: readonly T[]): T[] => values.filter((_, i) => keep[i])
  const labels = pick(chart.labels).map(String)
  const series: ChartSeries[] = [
    { label: 'GPS Keseluruhan', data: pick(chart.overall).map(Number), slot: 1 },
  ]
  for (const s of chart.subjects) {
    const data = pick(s.data)
    if (data.length > 0 && data.every((v) => v !== null)) {
      series.push({ label: s.name, data: data.map(Number), slot: (series.length % 8) + 1 })
    }
  }
  return { labels, series }
}

/** S9 sparkline (FR-M08-141): the yearly GPS of the school. */
export function sparklineSeries(years: { year: number; gps: number }[]): ChartInput {
  return {
    labels: years.map((y) => String(y.year)),
    series: [{ label: 'GPS', data: years.map((y) => y.gps), slot: 1 }],
  }
}
