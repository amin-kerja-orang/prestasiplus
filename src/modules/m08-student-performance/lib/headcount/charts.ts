/**
 * Chart.js configs of the Headcount screens: the small S13 per-config chart (FR-M08-86, discovery §6.4)
 * and the S15 section chart (FR-M08-95, discovery §6.3).
 */

import type { ChartData, ChartOptions } from 'chart.js'

import type { HeadcountDashboardConfig, HeadcountSection } from '../../api/headcount-types'

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
