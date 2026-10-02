/**
 * S5 "Trend Aktiviti Kelas (30 Hari)" Chart.js config (FR-M08-35): labels MM-DD, tooltip title = the
 * full date, "Purata Ketepatan (%)" on y 0–100 and "Sesi" on the right y1 from 0 step 1.
 */

import type { ChartData, ChartOptions } from 'chart.js'

import type { ClassDashboard } from '../../api/types'

type Point = ClassDashboard['trend'][number]

export function classTrendData(points: readonly Point[]): ChartData<'line'> {
  return {
    labels: points.map((p) => p.date.slice(5)),
    datasets: [
      {
        label: 'Purata Ketepatan (%)',
        data: points.map((p) => p.avgAccuracy),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16,185,129,0.08)',
        fill: true,
        borderWidth: 2.5,
        tension: 0.4,
        pointRadius: 3,
        yAxisID: 'y',
      },
      {
        label: 'Sesi',
        data: points.map((p) => p.sessions),
        borderColor: '#6366f1',
        backgroundColor: '#6366f1',
        borderWidth: 2,
        tension: 0.4,
        pointRadius: 3,
        yAxisID: 'y1',
      },
    ],
  }
}

export function classTrendOptions(points: readonly Point[]): ChartOptions<'line'> {
  return {
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'bottom', labels: { usePointStyle: true, font: { size: 11 } } },
      tooltip: { callbacks: { title: (items) => points[items[0]?.dataIndex ?? 0]?.date ?? '' } },
    },
    scales: {
      x: { grid: { display: false }, ticks: { maxTicksLimit: 10, font: { size: 10 } } },
      y: {
        min: 0,
        max: 100,
        position: 'left',
        title: { display: true, text: 'Ketepatan (%)', font: { size: 10 } },
        ticks: { font: { size: 10 } },
      },
      y1: {
        min: 0,
        position: 'right',
        grid: { drawOnChartArea: false },
        title: { display: true, text: 'Sesi', font: { size: 10 } },
        ticks: { stepSize: 1, font: { size: 10 } },
      },
    },
  }
}
