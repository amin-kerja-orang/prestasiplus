export const INTAKE_ROUTES = {
  list: 'm28.intake.list',
  upload: 'm28.intake.upload',
  manual: 'm28.intake.manual',
  review: 'm28.intake.review',
} as const

export const INTAKE_LIST_PATH = '/admin/spm/soalan/ekstrak'
export const INTAKE_UPLOAD_PATH = '/admin/spm/soalan/muat-naik'
export const INTAKE_MANUAL_PATH = '/admin/spm/soalan/manual'
// Legacy CSV import page (m04); BS-02 "Import & Semakan" includes Import CSV (v2-portals.md BS-02, REQ-B-063).
export const INTAKE_CSV_IMPORT_PATH = '/admin/questions/import'
export const intakeReviewPath = (id: string): string => `/admin/spm/soalan/ekstrak/${id}`
