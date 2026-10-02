/**
 * M04 teacher question papers (SRS §7 #20–#22, BR-M04-18, FR-M04-91…94). Admin-only (SEC-M04-07:
 * teachers' name, e-mail and school are personal data).
 *
 * | # | Route | Notes |
 * |---|---|---|
 * | 20 | `GET /api/question-submissions` | `status`; id descending, not paged; `meta.counts` over all papers |
 * | 21 | `PATCH /api/question-submissions/:id/status` | `{status, adminNotes?}`; 404, 422 |
 * | 22 | `GET /api/question-submissions/:id/files/:index` | placeholder text file with the file name; 404 |
 *
 * INFERRED (URS: POST outcome not observed): the 422 messages, the flash copy (§8 UNVERIFIED), that
 * an unknown `status` filter is an empty list, and that an omitted `adminNotes` keeps the note.
 */

import {
  blob,
  int,
  notFound,
  ok,
  queryString,
  route,
  unpaged,
  validationError,
  type RouteDef,
} from '@/mock/define'
import { users } from '@/modules/m01-authentication/mock'

import type { QuestionSubmission as ApiSubmission } from '../../api/submissions'
import {
  SUBMISSION_NOTES_MAX,
  SUBMISSION_STATUSES,
  submissionsRepo,
  type QuestionSubmission,
  type SubmissionStatus,
} from '../repository/submissions'
import { adminOnly, bodyOf, schoolNameOf } from './workflow-common'

export const SUBMISSION_SAVED_TEXT = 'Status kertas soalan berjaya dikemaskini.'
export const SUBMISSION_STATUS_MESSAGE = 'Status tidak sah.'
export const SUBMISSION_NOTES_MESSAGE = 'Nota admin tidak boleh melebihi 1000 aksara.'

function toApi(s: QuestionSubmission): ApiSubmission {
  const teacher = users.get(s.teacherId)
  return {
    ...s,
    files: s.files.map((f) => ({ ...f })),
    teacher: {
      id: s.teacherId,
      name: teacher?.name ?? null,
      email: teacher?.email ?? null,
      school: schoolNameOf(s.teacherId),
    },
  }
}

export const submissionRoutes: RouteDef[] = [
  route('GET', '/api/question-submissions', [adminOnly], (req) => {
    const status = queryString(req.query, 'status')
    // "Semua Status" = no `status`; an unknown value lists nothing (as live, an unknown filter).
    const rows =
      status === undefined || status === '' ? submissionsRepo.list() : submissionsRepo.list(status)
    return unpaged(rows.map(toApi), { counts: submissionsRepo.counts() })
  }),
  route(
    'PATCH',
    '/api/question-submissions/:id/status',
    [adminOnly],
    (req) => {
      const id = req.params.id as number
      if (!submissionsRepo.get(id)) return notFound()
      const b = bodyOf(req)
      const fields: Record<string, string> = {}
      const status = typeof b.status === 'string' ? b.status.trim() : ''
      if (!(SUBMISSION_STATUSES as readonly string[]).includes(status)) {
        fields.status = SUBMISSION_STATUS_MESSAGE
      }
      let adminNotes: string | null | undefined
      if (b.adminNotes !== undefined && b.adminNotes !== null) {
        if (typeof b.adminNotes !== 'string' || b.adminNotes.length > SUBMISSION_NOTES_MAX) {
          fields.adminNotes = SUBMISSION_NOTES_MESSAGE
        } else {
          adminNotes = b.adminNotes.trim() === '' ? null : b.adminNotes
        }
      } else if (b.adminNotes === null) {
        adminNotes = null
      }
      if (Object.keys(fields).length > 0) return validationError(fields)
      const row = submissionsRepo.updateStatus(id, {
        status: status as SubmissionStatus,
        ...(adminNotes !== undefined ? { adminNotes } : {}),
      })
      return row ? ok(toApi(row), { status: SUBMISSION_SAVED_TEXT }) : notFound()
    },
    { params: { id: int() } },
  ),
  route(
    'GET',
    '/api/question-submissions/:id/files/:index',
    [adminOnly],
    (req) => {
      const row = submissionsRepo.get(req.params.id as number)
      const file = row?.files.find((f) => f.index === (req.params.index as number))
      if (!row || !file) return notFound()
      // Simulated download (NFR-M04-03): a placeholder text with the file name, no real file.
      const text = `Fail contoh (mock) untuk kertas soalan #${String(row.id)}\nNama fail: ${file.name}\n`
      return blob(new Blob([text], { type: 'text/plain' }), file.name)
    },
    { params: { id: int(), index: int() } },
  ),
]
