/**
 * Chart.js configs of the Headcount screens: the small S13 per-config chart (FR-M08-86, discovery §6.4)
 * and the S15 section chart (FR-M08-95, discovery §6.3).
 */

import type { ChartData, ChartOptions } from 'chart.js'

import type {
  HeadcountDashboardConfig,
  HeadcountDetail,
  HeadcountSection,
} from '../../api/headcount-types'

// ---- S13 ----------------------------------------------------------------------------------------

export function dashboardChartData(chart: HeadcountDashboardConfig['chart']): ChartData<'line'> {
  return {
    labels: chart.labels,
    datasets: [
      {
        label: 'Sasaran',
        data: chart.target,
        borderColor: '#94a3b8',
        backgroundColor: '#94a3b8',
        borderDash: [5, 5],
        borderWidth: 2,
        pointRadius: 3,
        tension: 0.3,
        spanGaps: true,
      },
      {
        label: 'Sebenar (AR)',
        data: chart.actual,
        borderColor: '#3b82f6',
        backgroundColor: '#3b82f6',
        borderWidth: 2,
        pointRadius: 3,
        tension: 0.3,
        spanGaps: true,
      },
    ],
  }
}

export const dashboardChartOptions: ChartOptions<'line'> = {
  plugins: { legend: { position: 'bottom', labels: { font: { size: 10 } } } },
  scales: {
    y: { min: 0, max: 100, ticks: { stepSize: 25, font: { size: 10 } } },
    x: { grid: { display: false }, ticks: { font: { size: 10 } } },
  },
}

// ---- S15 ----------------------------------------------------------------------------------------

const GREEN = '#10b981'
const RED = '#ef4444'
const GREY = '#9ca3af'

/** Segment colour of the AR line: green at or above the target, red below, grey when a value is missing. */
export function segmentColor(
  actual: readonly (number | null)[],
  target: readonly (number | null)[],
  to: number,
): string {
  const a = actual[to]
  const t = target[to]
  if (a === null || a === undefined || t === null || t === undefined) return GREY
  return a >= t ? GREEN : RED
}

export function studentChartData(section: HeadcountSection): ChartData<'line'> {
  const { labels, target, actual, projection, rs } = section.chart
  const datasets: ChartData<'line'>['datasets'] = [
    {
      label: 'Target (OTR)',
      data: target,
      borderColor: '#3b82f6',
      backgroundColor: '#3b82f6',
      borderDash: [6, 3],
      borderWidth: 2,
      pointRadius: 4,
      spanGaps: true,
    },
    {
      label: 'Markah Sebenar (AR)',
      data: actual,
      borderColor: GREY,
      backgroundColor: GREY,
      borderWidth: 3,
      pointRadius: 7,
      pointBackgroundColor: actual.map((_, i) => (i === 0 ? '#6b7280' : GREY)),
      pointBorderColor: actual.map((_, i) => (i === 0 ? '#6b7280' : GREY)),
      segment: {
        borderColor: (ctx) => segmentColor(actual, target, ctx.p1DataIndex),
      },
    },
  ]
  if (section.projection !== null) {
    datasets.push({
      label: 'Unjuran (Trend)',
      data: projection,
      borderColor: '#f59e0b',
      backgroundColor: '#f59e0b',
      borderDash: [8, 4],
      borderWidth: 2,
      pointStyle: 'triangle',
      pointRadius: 6,
      spanGaps: true,
    })
  }
  if (rs !== null) {
    datasets.push({
      label: 'RS (SPM Sebenar)',
      data: labels.map((l) => (l === 'RS' ? rs : null)),
      borderColor: '#7c3aed',
      backgroundColor: '#7c3aed',
      pointStyle: 'star',
      pointRadius: 10,
      showLine: false,
    })
  }
  return { labels, datasets }
}

export const studentChartOptions: ChartOptions<'line'> = {
  plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } },
  scales: {
    y: { min: 0, max: 100, title: { display: true, text: 'Markah (%)' } },
    x: { grid: { display: false } },
  },
}

// ---- Unjuran page (S10-T02) ---------------------------------------------------------------------

/** One DsChart line; a missing point is `NaN` (DsChart takes plain numbers, a gap in the line). */
export interface ClassLineSeries {
  label: string
  data: number[]
  slot: number
}

const gap = (v: number | null | undefined): number => (v === null || v === undefined ? Number.NaN : v)

/**
 * The class projection chart of `/headcount/{id}/unjuran`: the class mean target from TOV to OTR{n}
 * ("Sasaran"), the mean AR per checkpoint ("Sebenar (AR)") and "Unjuran" from the latest mean AR to the
 * mean projected end value at the last checkpoint (HC-6). Lines without a point are left out.
 */
export function classProjectionChart(detail: HeadcountDetail): {
  labels: string[]
  series: ClassLineSeries[]
} {
  const n = detail.config.activeOtrs
  const labels = ['TOV', ...Array.from({ length: n }, (_, i) => `OTR${String(i + 1)}`)]
  const target = [gap(detail.averages.tov), ...detail.averages.otrs.map(gap)]
  const actual = [Number.NaN, ...detail.averages.ars.map(gap)]
  const ends = detail.rows
    .filter((r) => !r.dropped && r.projection !== null)
    .map((r) => r.projection?.value as number)
  const projection = labels.map(() => Number.NaN)
  const lastAr = actual.reduce((last, v, i) => (Number.isNaN(v) ? last : i), -1)
  if (lastAr >= 0 && ends.length > 0) {
    projection[lastAr] = actual[lastAr] as number
    projection[labels.length - 1] = Math.round((ends.reduce((a, b) => a + b, 0) / ends.length) * 10) / 10
  }
  const series: ClassLineSeries[] = [
    { label: 'Sasaran (OTR)', data: target, slot: 1 },
    { label: 'Sebenar (AR)', data: actual, slot: 2 },
    { label: 'Unjuran', data: projection, slot: 3 },
  ]
  return {
    labels,
    series: series.filter((s) => s.data.some((v) => !Number.isNaN(v))),
  }
}
