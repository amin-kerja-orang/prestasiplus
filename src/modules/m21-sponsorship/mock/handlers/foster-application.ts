/**
 * M21 endpoint #15 (SRS M21 v1.2 §7, BR-M21-13, V-M21-03; any signed-in role: guest 401).
 *
 * `POST /api/mohon-keluarga-angkat` `{studentEmail, studentCategory, familyIncomeRange?, reason}`
 * answers `201 {id}`. `studentEmail` must resolve to a `student` user through M01 `users.findByEmail`
 * (422 "Email pelajar tidak dijumpai dalam PrestasiPlus."); `applicantUserId` and `applicantRole` are
 * the viewer's; the status is `pending`; no duplicate check. 422 carries the `fields` map.
 */

import {
  created,
  requireAuth,
  route,
  unauthorized,
  validationError,
  type MockRequest,
  type MockResponse,
  type RouteDef,
} from '@/mock/define'
import { users } from '@/modules/m01-authentication/mock'

import {
  APPLICATION_CATEGORIES,
  FAMILY_INCOME_RANGES,
  FOSTER_APPLICATION_MESSAGES as MSG,
  type ApplicationCategory,
  type FamilyIncomeRange,
} from '../../api/types'
import { fosterApplicationsRepo } from '../repository/foster-applications'

const signedIn = requireAuth()

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const asText = (v: unknown): string => (typeof v === 'string' ? v : '')

// #15
function submit(req: MockRequest): MockResponse {
  const body = (
    typeof req.body === 'object' && req.body !== null && !Array.isArray(req.body) ? req.body : {}
  ) as Record<string, unknown>
  const fields: Record<string, string> = {}

  const email = asText(body.studentEmail).trim()
  let studentId = 0
  if (email === '') fields.studentEmail = MSG.required
  else if (!EMAIL_SHAPE.test(email)) fields.studentEmail = MSG.invalidEmail
  else {
    const student = users.findByEmail(email)
    if (student?.role === 'student') studentId = student.id
    else fields.studentEmail = MSG.studentNotFound
  }

  const category = asText(body.studentCategory)
  if (category === '') fields.studentCategory = MSG.required
  else if (!(APPLICATION_CATEGORIES as readonly string[]).includes(category)) {
    fields.studentCategory = MSG.invalidChoice
  }

  const income = body.familyIncomeRange
  const incomeText = typeof income === 'string' ? income : ''
  if (income !== undefined && income !== null && incomeText !== '') {
    if (!(FAMILY_INCOME_RANGES as readonly string[]).includes(incomeText)) {
      fields.familyIncomeRange = MSG.invalidChoice
    }
  }

  const reason = asText(body.reason)
  if (reason.trim() === '') fields.reason = MSG.required

  if (Object.keys(fields).length > 0) return validationError(fields)

  const viewer = req.session
  if (!viewer) return unauthorized() // unreachable behind `requireAuth`; same 401 as the guard
  const row = fosterApplicationsRepo.submit({
    studentId,
    applicantUserId: viewer.userId,
    applicantRole: viewer.role,
    studentCategory: category as ApplicationCategory,
    familyIncomeRange: incomeText === '' ? null : (incomeText as FamilyIncomeRange),
    reason,
  })
  return created({ id: row.id })
}

export const fosterApplicationRoutes: RouteDef[] = [
  route('POST', '/api/mohon-keluarga-angkat', [signedIn], submit),
]
