/**
 * SRS M12 v1.6 §7 #8 `GET /api/kirkpatrick/interventions` (S7) and #9 `POST /api/kirkpatrick/interventions`.
 * Admin and teacher (provisional). The KPIs count the whole store (BR-M12-26); the student must be a user with
 * role `student` ("Pelajar tidak dijumpai.", PROPOSED COPY, BR-M12-27). Both camelCase and the form's snake_case
 * field names are accepted; a malformed body answers 422, never a crash.
 */

import { created, ok, route, validationError, type RouteDef } from '@/mock/define'

import type { InterventionInput } from '../../api/types'
import { interventionsRepo } from '../repository'
import { ALERT_TYPES, MOODS } from '../data/rules-data'
import { FIELD_INVALID, FIELD_REQUIRED, refusal, staffRoles, viewerOf } from './common'

/** Maximum length of the two free texts (INFERRED hardening, not observed on live). */
const MAX_TEXT = 2000

const pick = (body: Record<string, unknown>, ...keys: string[]): unknown => {
  for (const key of keys) if (key in body) return body[key]
  return undefined
}

const blank = (v: unknown): boolean => v === undefined || v === null || v === ''

function wholeNumber(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isInteger(v) ? v : undefined
  if (typeof v === 'string' && /^\d+$/.test(v.trim())) return Number(v.trim())
  return undefined
}

/** A number or numeric text; `undefined` when it is neither (a blank value is `null`). */
function decimalOrNull(v: unknown): number | null | undefined {
  if (blank(v)) return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined
  if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v.trim())) return Number(v.trim())
  return undefined
}

function text(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined
}

export const interventionRoutes: RouteDef[] = [
  route('GET', '/api/kirkpatrick/interventions', [staffRoles], () => ok(interventionsRepo.list())),

  route('POST', '/api/kirkpatrick/interventions', [staffRoles], (req) => {
    const body =
      typeof req.body === 'object' && req.body !== null && !Array.isArray(req.body)
        ? (req.body as Record<string, unknown>)
        : {}
    const fields: Record<string, string> = {}

    const studentRaw = pick(body, 'studentId', 'student_id')
    const studentId = wholeNumber(studentRaw)
    if (blank(studentRaw)) fields.studentId = FIELD_REQUIRED
    else if (studentId === undefined) fields.studentId = FIELD_INVALID

    const alertType = pick(body, 'alertType', 'alert_type')
    if (blank(alertType)) fields.alertType = FIELD_REQUIRED
    else if (
      typeof alertType !== 'string' ||
      !(ALERT_TYPES as readonly string[]).includes(alertType)
    ) {
      fields.alertType = FIELD_INVALID
    }

    const actionDate = pick(body, 'actionDate', 'action_date')
    if (blank(actionDate)) fields.actionDate = FIELD_REQUIRED
    else if (typeof actionDate !== 'string') fields.actionDate = FIELD_INVALID

    const description = pick(body, 'alertDescription', 'alert_description')
    const action = pick(body, 'actionTaken', 'action_taken')
    for (const [name, value] of [
      ['alertDescription', description],
      ['actionTaken', action],
    ] as const) {
      if (blank(value) || (typeof value === 'string' && value.trim() === '')) {
        fields[name] = FIELD_REQUIRED
      } else if (typeof value !== 'string' || value.length > MAX_TEXT) fields[name] = FIELD_INVALID
    }

    const before = decimalOrNull(pick(body, 'beforeAccuracy', 'before_accuracy'))
    const after = decimalOrNull(pick(body, 'afterAccuracy', 'after_accuracy'))
    const outOfRange = (v: number | null | undefined): boolean =>
      v === undefined || (v !== null && (v < 0 || v > 100))
    if (outOfRange(before)) fields.beforeAccuracy = FIELD_INVALID
    if (outOfRange(after)) fields.afterAccuracy = FIELD_INVALID

    const moods: [string, unknown][] = [
      ['beforeMood', pick(body, 'beforeMood', 'before_mood')],
      ['afterMood', pick(body, 'afterMood', 'after_mood')],
    ]
    for (const [name, value] of moods) {
      if (
        !blank(value) &&
        !(typeof value === 'string' && (MOODS as readonly string[]).includes(value))
      ) {
        fields[name] = FIELD_INVALID
      }
    }
    if (Object.keys(fields).length > 0) return validationError(fields)

    const input: InterventionInput = {
      studentId: studentId as number,
      alertType: alertType as InterventionInput['alertType'],
      actionDate: actionDate as string,
      alertDescription: text(description) as string,
      actionTaken: text(action) as string,
      beforeAccuracy: before,
      afterAccuracy: after,
      beforeMood: blank(moods[0]?.[1]) ? null : (moods[0]?.[1] as InterventionInput['beforeMood']),
      afterMood: blank(moods[1]?.[1]) ? null : (moods[1]?.[1] as InterventionInput['afterMood']),
    }
    try {
      return created(interventionsRepo.create(input, viewerOf(req).id))
    } catch (error) {
      return refusal(error)
    }
  }),
]
