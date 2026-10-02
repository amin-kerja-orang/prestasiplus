import type { ReportTint } from '../../lib/report-reasons'

/**
 * S14 ticked-card colours by tint (FR-M04-65, M05 FR-M05-88 "red-300/red-50"): full class strings so
 * Tailwind sees them. `default` = the neutral ticked style of `missing_options` and `duplicate`
 * (INFERRED).
 */
export const REPORT_TINT_CLASS: Record<ReportTint, string> = {
  default: 'border-blue-300 bg-blue-50',
  red: 'border-red-300 bg-red-50',
  amber: 'border-amber-300 bg-amber-50',
  orange: 'border-orange-300 bg-orange-50',
  yellow: 'border-yellow-300 bg-yellow-50',
  blue: 'border-blue-300 bg-blue-50',
  indigo: 'border-indigo-300 bg-indigo-50',
  slate: 'border-slate-400 bg-slate-50',
}

/** An unticked reason card (the lavender outline of the live modal). */
export const REPORT_TINT_IDLE_CLASS = 'border-indigo-100 bg-white hover:border-indigo-200'
