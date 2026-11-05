/**
 * Route names and paths of the M04-T7 screens (S8 to S12, SRS §2). The route fragments and the pages
 * share them so no path string is typed twice.
 */

export const AUDIT_ROUTES = {
  structuredList: 'm04.structured.list',
  structuredDetail: 'm04.structured.detail',
  submissions: 'm04.submissions.list',
  diagrams: 'm04.diagrams',
  masterNotes: 'm04.master-notes',
} as const

export const STRUCTURED_LIST_PATH = '/admin/structured-questions'
export const SUBMISSIONS_PATH = '/admin/question-submissions'
export const DIAGRAMS_PATH = '/admin/soalan-gambar'
export const MASTER_NOTES_PATH = '/admin/master-notes'

/** S8 "Tambah Soalan" and S9 "Edit Soalan" open the M10 teacher-portal forms (FN-M04-4.1.1, 4.2.6). */
export const STRUCTURED_CREATE_PATH = '/guru/soalan-berstruktur/cipta'
export const structuredEditPath = (id: number): string =>
  `/guru/soalan-berstruktur/${String(id)}/edit`

/** The teacher mount of the same two pages (S6-T17, R1-GUR-44b); the M10 route fragment registers them. */
export const GURU_STRUCTURED_ROUTES = {
  list: 'm10.soalan.berstruktur',
  detail: 'm10.soalan.berstruktur.detail',
} as const
export const GURU_STRUCTURED_LIST_PATH = '/guru/soalan-berstruktur'
