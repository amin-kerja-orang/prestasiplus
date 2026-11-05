import type { HttpClient, HttpResponse, ScenarioContext } from '@pp/contract-tests'

/** The scenarios below run on the API only: they need a cookie session with CSRF, a file part or seeded data. */
export const API_ONLY = ['api'] as const

type Json = Record<string, unknown>

/** `body.data` as an object (or `{}`), for reading ids and fields out of a response. */
export function dataOf(res: HttpResponse): Json {
  const data = (res.body as { data?: unknown } | null)?.data
  return data !== null && typeof data === 'object' && !Array.isArray(data) ? (data as Json) : {}
}

/** `body.data` as an array (or `[]`). */
export function listOf(res: HttpResponse): Json[] {
  const data = (res.body as { data?: unknown } | null)?.data
  return Array.isArray(data) ? (data as Json[]) : []
}

/** `body.error` (or `{}`). */
export function errorOf(res: HttpResponse): Json {
  const error = (res.body as { error?: unknown } | null)?.error
  return error !== null && typeof error === 'object' ? (error as Json) : {}
}

/** Asserts an error response: status and `error.code`. */
export function expectError(ctx: ScenarioContext, res: HttpResponse, status: number, code: string): void {
  ctx.expectStatus(res, status)
  ctx.check(errorOf(res).code === code, `expected error.code ${code}, got ${String(errorOf(res).code)}`)
}

/** A value unique inside one run, stable across runs of the same scenario order (no clock, no random). */
let sequence = 0
export function nextTag(prefix: string): string {
  sequence += 1
  return `${prefix}${String(sequence).padStart(4, '0')}`
}

/**
 * The teacher puts the pupil into the class through `PUT /guru/students/:id` (same school), so no scenario depends on
 * the pupil-side join route. The pupil id is read from the pupil's own `GET /me`.
 */
export async function enrolPupil(ctx: ScenarioContext, teacher: HttpClient, student: HttpClient, classroomId: unknown): Promise<void> {
  const studentId = String(dataOf(await student.request('GET', '/me')).id)
  ctx.expectStatus(await teacher.request('PUT', `/guru/students/${studentId}`, { body: { classroomId: String(classroomId) } }), 200)
}
