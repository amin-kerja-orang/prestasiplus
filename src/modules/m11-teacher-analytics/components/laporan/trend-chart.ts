import type { ChartData, ChartOptions, TooltipItem } from 'chart.js'

import type { TeacherReport } from '../../api/types'

/** FN-M11-2.3.1 trend line (config of the live page; tick fonts 12, DV-M11-23). */
export function trendData(trend: TeacherReport['trend']): ChartData<'line'> {
  return {
    labels: trend.map((d) => d.date),
    datasets: [
      {
        label: 'Aktiviti',
        data: trend.map((d) => d.count),
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        fill: true,
        tension: 0.3,
        pointRadius: 2,
        pointHoverRadius: 5,
        borderWidth: 2,
      },
    ],
  }
}

export const trendOptions: ChartOptions<'line'> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#1e293b',
      titleFont: { size: 12 },
      bodyFont: { size: 12 },
      callbacks: { label: (ctx: TooltipItem<'line'>) => `${ctx.parsed.y} aktiviti` },
    },
  },
  scales: {
    x: { grid: { display: false }, ticks: { font: { size: 12 }, maxTicksLimit: 15 } },
    y: { beginAtZero: true, ticks: { font: { size: 12 }, stepSize: 1 } },
  },
}
