/**
 * L45 "Jemput Ibu Bapa" (SRS L45 §7 #1–#4, BR-L45-01…12; owner M02, `parentInvites` store; reuses the
 * M02 `parentLinks` store, no second link store, D12).
 *
 * | # | Route | Guard | Notes |
 * |---|---|---|---|
 * | 1 | `GET /api/me/parent-invite` | student | token (created at first call) + linked parents by name |
 * | 2 | `POST /api/me/parent-invite/generate` | student | replaces the token; the old one is unknown at once |
 * | 3 | `GET /api/parent-invites/:token` | public | preview; `viewer` from the bearer token; 404 for any unknown token |
 * | 4 | `POST /api/parent-invites/:token/accept` | parent | idempotent link; 404 for any unknown token |
 *
 * A token is valid only while its student is `role = student` and `isActive` (BR-L45-04). Any string is a
 * token as far as routing goes (AUD-L45-01: no hex-only rule; FR-L45-21 is withdrawn). No time expiry.
 * Guard order for #4: 401 / 403 before the token is looked up. INFERRED: the refusal texts are the core
 * defaults (no live copy exists); the page chooses its copy by status.
 */

import {
  int,
  noContent,
  ok,
  notFound,
  paginate,
  queryInt,
  requireRole,
  route,
  str,
  type MockContext,
  type MockRequest,
  type MockResponse,
  type RouteDef,
} from '@/mock/define'
import { users, type UserRow } from '@/modules/m01-authentication/mock'

import type {
  AcceptResult,
  AdminParentLink,
  GeneratedParentInvite,
  InvitePreview,
  LinkedParent,
  ParentInviteView,
} from '../../api/parent-invite'
import { schoolsRepo } from '../repository/schools'
import { parentInvitesRepo } from './parent-invites-store'
import { parentLinksRepo } from './parent-links-store'

/** FR-L45-11 (reference text). */
export const MSG_INVITE_REGENERATED = 'Link jemputan baru telah dijana!'

const studentOnly = requireRole('student')
const parentOnly = requireRole('parent')

const sessionUserId = (req: MockRequest): number => {
  if (!req.session) throw new Error('parent invite: no session (guard missing)')
  return req.session.userId
}

function schoolNameOf(user: UserRow): string | null {
  return user.schoolId === null ? null : (schoolsRepo.get(user.schoolId)?.name ?? null)
}

/** FR-L45-22: the first letter of the first two words, upper case; "?" when empty. */
export function initialsOf(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .filter((w) => w !== '')
    .slice(0, 2)
    .map((w) => Array.from(w)[0]?.toUpperCase() ?? '')
    .join('')
  return letters === '' ? '?' : letters
}

/** BR-L45-04: the student behind `token`, only while an active `student`; otherwise `undefined`. */
export function resolveInviteStudent(token: string): UserRow | undefined {
  const invite = parentInvitesRepo.resolve(token)
  if (!invite) return undefined
  const student = users.get(invite.id)
  return student?.role === 'student' && student.isActive ? student : undefined
}

/** BR-L45-08: the student's links joined to their parent users, by name (`ms`, case-insensitive). */
export function linkedParentsOf(studentId: number): LinkedParent[] {
  const out: LinkedParent[] = []
  for (const link of parentLinksRepo.listParentsOfStudent(studentId)) {
    const parent = users.get(link.parentId)
    if (parent?.role !== 'parent') continue
    out.push({
      id: parent.id,
      name: parent.name,
      email: parent.email,
      linkedAt: link.createdAt,
      linkId: link.id,
    })
  }
  return out.sort(
    (a, b) => a.name.localeCompare(b.name, 'ms', { sensitivity: 'base' }) || a.id - b.id,
  )
}

// --- #1, #2 ----------------------------------------------------------------------------------------

function getInvite(req: MockRequest, ctx: MockContext): MockResponse {
  const studentId = sessionUserId(req)
  const invite = parentInvitesRepo.getOrCreate(studentId, ctx.clock.now())
  const view: ParentInviteView = {
    token: invite.token,
    createdAt: invite.createdAt,
    parents: linkedParentsOf(studentId),
  }
  return ok(view)
}

function generateInvite(req: MockRequest, ctx: MockContext): MockResponse {
  const invite = parentInvitesRepo.rotate(sessionUserId(req), ctx.clock.now())
  const data: GeneratedParentInvite = {
    token: invite.token,
    createdAt: invite.createdAt,
    status: MSG_INVITE_REGENERATED,
  }
  return ok(data)
}

// --- #3, #4 ----------------------------------------------------------------------------------------

function previewInvite(req: MockRequest): MockResponse {
  const student = resolveInviteStudent(String(req.params.token))
  if (!student) return notFound()
  const role = req.session?.role
  const data: InvitePreview = {
    valid: true,
    student: {
      name: student.name,
      initials: initialsOf(student.name),
      schoolName: schoolNameOf(student),
    },
    viewer: role === undefined ? 'guest' : role === 'parent' ? 'parent' : 'other',
  }
  return ok(data)
}

function acceptInvite(req: MockRequest, ctx: MockContext): MockResponse {
  const student = resolveInviteStudent(String(req.params.token))
  if (!student) return notFound()
  const parent = users.get(sessionUserId(req))
  if (parent?.role !== 'parent') return notFound()
  const { created } = parentLinksRepo.createIfAbsent(parent.id, student.id, ctx.clock.now())
  const data: AcceptResult = {
    linked: true,
    created,
    student: { id: student.id, name: student.name, schoolName: schoolNameOf(student) },
    parent: { name: parent.name },
  }
  return ok(data)
}

// --- admin / own links -------------------------------------------------------------------------------

const adminOrSchoolAdmin = requireRole('admin', 'school_admin')
const linkParam = { linkId: int() }
/** Contract: "Fixed page size 50". */
const LINK_PAGE_SIZE = 50

/** `x***@domain`: the first character, `***`, then the domain (contract `ParentEmailMasked`). */
function maskEmail(email: string): string {
  const at = email.indexOf('@')
  return `${Array.from(email)[0] ?? '?'}***${at >= 0 ? email.slice(at) : '@'}`
}

/** A school_admin sees only pupils of the own school; `admin` sees all. */
function inScope(req: MockRequest, student: UserRow): boolean {
  if (req.session?.role !== 'school_admin') return true
  const own = users.get(sessionUserId(req))
  return own?.schoolId != null && own.schoolId === student.schoolId
}

function toAdminLink(
  link: { id: number; createdAt: string },
  parent: UserRow,
  student: UserRow,
): AdminParentLink {
  return {
    linkId: link.id,
    parent: { id: parent.id, name: parent.name, emailMasked: maskEmail(parent.email) },
    student: { id: student.id, name: student.name, schoolName: schoolNameOf(student) },
    relationship: null,
    linkedAt: link.createdAt,
  }
}

function listAdminLinks(req: MockRequest): MockResponse {
  const parentId = queryInt(req.query, 'parentId')
  const studentId = queryInt(req.query, 'studentId')
  const page = Math.max(1, queryInt(req.query, 'page') ?? 1)
  const rows: AdminParentLink[] = []
  for (const link of parentLinksRepo.all()) {
    if (parentId !== undefined && link.parentId !== parentId) continue
    if (studentId !== undefined && link.studentId !== studentId) continue
    const parent = users.get(link.parentId)
    const student = users.get(link.studentId)
    if (parent?.role !== 'parent' || student?.role !== 'student') continue
    if (!inScope(req, student)) continue
    rows.push(toAdminLink(link, parent, student))
  }
  return paginate(rows, { page, pageSize: LINK_PAGE_SIZE })
}

function deleteAdminLink(req: MockRequest): MockResponse {
  const link = parentLinksRepo.all().find((l) => l.id === Number(req.params.linkId))
  const student = link ? users.get(link.studentId) : undefined
  if (!link || !student || !inScope(req, student)) return notFound()
  parentLinksRepo.removeById(link.id)
  return noContent()
}

/** The caller (pupil or parent) removes one of the own links; any other id is 404. */
function deleteMyLink(req: MockRequest): MockResponse {
  const me = sessionUserId(req)
  const link = parentLinksRepo.all().find((l) => l.id === Number(req.params.linkId))
  if (!link || (link.studentId !== me && link.parentId !== me)) return notFound()
  parentLinksRepo.removeById(link.id)
  return noContent()
}

const tokenParam = { token: str() }

export const parentInviteRoutes: RouteDef[] = [
  route('GET', '/api/me/parent-invite', [studentOnly], getInvite),
  route('POST', '/api/me/parent-invite/generate', [studentOnly], generateInvite),
  route('GET', '/api/parent-invites/:token', previewInvite, { params: tokenParam }),
  route('POST', '/api/parent-invites/:token/accept', [parentOnly], acceptInvite, {
    params: tokenParam,
  }),
  route('GET', '/api/admin/parent-links', [adminOrSchoolAdmin], listAdminLinks),
  route('DELETE', '/api/admin/parent-links/:linkId', [adminOrSchoolAdmin], deleteAdminLink, {
    params: linkParam,
  }),
  route('DELETE', '/api/me/parent-links/:linkId', [requireRole('student', 'parent')], deleteMyLink, {
    params: linkParam,
  }),
]
