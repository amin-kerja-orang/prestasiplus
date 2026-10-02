// Chart.js registration (F-17, ADR-0012). Only the pieces used by the SRS chart
// configs are registered, so the rest of Chart.js is tree-shaken:
// - M05 FR-M05-101 "Trend Ketepatan": line, dual linear y axes, category x axis,
//   fill, legend (point style), index-mode tooltip.
// - M08 FR-M08-16 "Trend GPS": line, reversed linear y axis, legend, tooltip
//   callbacks; its band shading is an inline plugin passed through `plugins`.
// Add a controller/element here when a new SRS config needs one (e.g. BarController
// + BarElement for a bar chart, DoughnutController + ArcElement for a doughnut).
import {
  CategoryScale,
  Chart,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js'

let registered = false

/** Registers the used Chart.js components once. Safe to call repeatedly. */
export function registerChartComponents(): void {
  if (registered) return
  Chart.register(
    LineController,
    LineElement,
    PointElement,
    CategoryScale,
    LinearScale,
    Filler,
    Legend,
    Tooltip,
  )
  registered = true
}

export { Chart }
