/**
 * S1 "Trend GPS (5 Tahun)" Chart.js config (FR-M08-16, discovery §6.1): reversed y 0–9 with the grade
 * ticks, band shading plugin, an overall line (#334155, width 3, points coloured by band) and one dashed
 * line per subject. S9 uses {@link sparklineConfig}.
 */

import type { ChartData, ChartOptions, Plugin, TooltipItem } from 'chart.js'

import type { SchoolPerformance } from '../../api/types'
import { BAND_STYLE, bandOf } from './format'

type TrendChart = SchoolPerformance['trend']['chart']

const GRADE_TICKS = ['A+', 'A', 'A-', 'B+', 'B', 'C+', 'C', 'D', 'E', 'G']
const BANDS: { from: number; to: number; color: string }[] = [
  { from: 0, to: 2, color: 'rgba(16,185,129,0.06)' },
  { from: 2, to: 4, color: 'rgba(59,130,246,0.06)' },
  { from: 4, to: 6, color: 'rgba(245,158,11,0.06)' },
  { from: 6, to: 9, color: 'rgba(239,68,68,0.06)' },
]

/** Plugin `gpsBands`: horizontal band shading behind the datasets. */
export const gpsBands: Plugin<'line'> = {
  id: 'gpsBands',
  beforeDatasetsDraw(chart) {
    const { ctx, chartArea, scales } = chart
    const y = scales.y
    if (!y) return
    ctx.save()
    for (const band of BANDS) {
      const top = y.getPixelForValue(band.from)
      const bottom = y.getPixelForValue(band.to)
      ctx.fillStyle = band.color
      ctx.fillRect(
        chartArea.left,
        Math.min(top, bottom),
        chartArea.right - chartArea.left,
        Math.abs(bottom - top),
      )
    }
    ctx.restore()
  },
}

export function pointColor(value: number | null): string {
  return value === null ? 'transparent' : BAND_STYLE[bandOf(value)].hex
}

export function trendData(chart: TrendChart): ChartData<'line'> {
  return {
    labels: chart.labels,
    datasets: [
      {
        label: 'GPS Keseluruhan',
        data: chart.overall,
        borderColor: '#334155',
        backgroundColor: 'rgba(51,65,85,0.06)',
        fill: true,
        borderWidth: 3,
        pointRadius: 6,
        pointBackgroundColor: chart.overall.map(pointColor),
        pointBorderColor: chart.overall.map(pointColor),
        tension: 0.35,
        spanGaps: false,
      },
      ...chart.subjects.map((s) => ({
        label: s.name,
        data: s.data,
        borderColor: s.color,
        backgroundColor: s.color,
        borderDash: [4, 3],
        borderWidth: 1.5,
        pointRadius: 4,
        fill: false,
        tension: 0.3,
        spanGaps: false,
      })),
    ],
  }
}

export function tooltipLabel(item: TooltipItem<'line'>): string {
  const label = item.dataset.label ?? ''
  const v = item.parsed.y
  return v === null || Number.isNaN(v)
    ? `${label}: Tiada data`
    : `${label}: ${v.toFixed(2)} (${bandOf(v)})`
}

export const trendOptions: ChartOptions<'line'> = {
  interaction: { mode: 'index', intersect: false },
  animation: { duration: 800, easing: 'easeInOutQuart' },
  plugins: {
    legend: {
      position: 'top',
      align: 'start',
      labels: { usePointStyle: true, pointStyle: 'circle', color: '#475569', font: { size: 11 } },
    },
    tooltip: {
      backgroundColor: '#ffffff',
      titleColor: '#1e293b',
      bodyColor: '#475569',
      borderColor: '#e2e8f0',
      borderWidth: 1,
      callbacks: {
        title: (items) => `Tahun ${items[0]?.label ?? ''}`,
        label: tooltipLabel,
      },
    },
  },
  scales: {
    x: { ticks: { color: '#64748b', font: { size: 12, weight: 600 } }, grid: { display: false } },
    y: {
      reverse: true,
      min: 0,
      max: 9,
      ticks: {
        stepSize: 1,
        color: '#64748b',
        font: { size: 12 },
        callback: (v) => `${GRADE_TICKS[Number(v)] ?? ''} (${String(v)})`,
      },
    },
  },
}

/** S9 sparkline (FR-M08-141): labels "yy", tooltips "{yyyy}: {gps}", years 12px. */
export function sparklineConfig(years: { year: number; gps: number }[]): {
  data: ChartData<'line'>
  options: ChartOptions<'line'>
} {
  return {
    data: {
      labels: years.map((y) => String(y.year).slice(-2)),
      datasets: [
        {
          data: years.map((y) => y.gps),
          borderColor: '#4f46e5',
          backgroundColor: 'rgba(79,70,229,0.1)',
          fill: true,
          borderWidth: 2,
          pointRadius: 3,
          tension: 0.3,
        },
      ],
    },
    options: {
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: () => '',
            label: (item) => {
              const y = years[item.dataIndex]
              return `${String(y?.year ?? '')}: ${item.parsed.y === null ? '' : item.parsed.y.toFixed(2)}`
            },
          },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 12 }, color: '#64748b' } },
        y: { display: false, reverse: true, min: 0, max: 9 },
      },
    },
  }
}
