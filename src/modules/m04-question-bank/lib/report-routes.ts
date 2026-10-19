/** Route names and paths of the report screens (S7 and S13, SRS §2). */

export const REPORT_ROUTES = {
  admin: 'm04.reports.admin',
  mine: 'm04.reports.mine',
  harness: 'm04.reports.harness',
} as const

export const REPORTS_PATH = '/admin/question-reports'
export const MY_REPORTS_PATH = '/laporan-soalan'
