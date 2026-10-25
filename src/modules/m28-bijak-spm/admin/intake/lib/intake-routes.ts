export const INTAKE_ROUTES = {
  list: 'm28.intake.list',
  upload: 'm28.intake.upload',
  manual: 'm28.intake.manual',
  manualEdit: 'm28.intake.manual.edit',
  review: 'm28.intake.review',
} as const

export const INTAKE_LIST_PATH = '/admin/spm/soalan/ekstrak'
export const INTAKE_UPLOAD_PATH = '/admin/spm/soalan/muat-naik'
export const INTAKE_MANUAL_PATH = '/admin/spm/soalan/manual'
export const intakeReviewPath = (id: string): string => `/admin/spm/soalan/ekstrak/${id}`
/**
 * The editor of a batch typed by hand lives under Tulis Soalan Manual, so the menu keeps that item
 * active and the URL does not read as the extract screen (UAT A-KS16).
 */
export const intakeManualEditPath = (id: string): string => `${INTAKE_MANUAL_PATH}/${id}`
