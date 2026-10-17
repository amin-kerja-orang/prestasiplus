import type { ChartSeries } from '@/ds'

import type { TeacherReport } from '../../api/types'

/** FN-M11-2.3.1 trend line: one label (date) and one count per day, a single "Aktiviti" series. */
export function trendChart(trend: TeacherReport['trend']): {
  labels: string[]
  series: ChartSeries[]
} {
  return {
    labels: trend.map((d) => d.date),
    series: [{ label: 'Aktiviti', data: trend.map((d) => d.count) }],
  }
}
