/**
 * L45 "Jemput Ibu Bapa" endpoints (SRS L45 §7 #1–#4; owner M02 for #1–#2, M01's acceptance page uses #3–#4).
 * UI tasks read this file and do not change it. Errors reach the caller as `ApiError` (`401`, `403`
 * `FORBIDDEN`, `404` `NOT_FOUND`, 5xx).
 */

import { api } from '@/api'

/** §6.3 `LinkedParent`. */
export interface LinkedParent {
  id: number
  name: string
  email: string
  /** ISO 8601 (+08:00): the link's `createdAt`. */
  linkedAt: string
}

/** §6.3 `ParentInviteView`: the student's current token (created on the first call) and the linked parents. */
export interface ParentInviteView {
  /** 64 lowercase hex characters. */
  token: string
  /** ISO 8601 (+08:00). */
  createdAt: string
  /** By parent name ascending (`ms` collation). */
  parents: LinkedParent[]
}

/** #2 data. `status` = "Pautan jemputan baharu telah dijana!". */
export interface GeneratedParentInvite {
  token: string
  createdAt: string
  status: string
}

/** What the acceptance page may be told about the viewer (from the bearer token, if any). */
export type InviteViewer = 'guest' | 'parent' | 'other'

/** §6.3 `InvitePreview`. */
export interface InvitePreview {
  valid: true
  student: {
    name: string
    /** First letter of the first two words, upper case; "?" when the name is empty. */
    initials: string
    schoolName: string | null
  }
  viewer: InviteViewer
}

/** §6.3 `AcceptResult`. */
export interface AcceptResult {
  linked: true
  /** `false` when the pair was already linked. */
  created: boolean
  student: { id: number; name: string; schoolName: string | null }
  parent: { name: string }
}

const inviteAt = (token: string): string => `/api/parent-invites/${encodeURIComponent(token)}`

/** #1 `GET /api/me/parent-invite` (student only; creates the token the first time). */
export function fetchParentInvite(
  options: { signal?: AbortSignal } = {},
): Promise<ParentInviteView> {
  return api.get<ParentInviteView>(
    '/api/me/parent-invite',
    options.signal ? { signal: options.signal } : {},
  )
}

/** #2 `POST /api/me/parent-invite/generate` (student only): replaces the token; the old one stops working. */
export function generateParentInvite(): Promise<GeneratedParentInvite> {
  return api.post<GeneratedParentInvite>('/api/me/parent-invite/generate')
}

/** #3 `GET /api/parent-invites/:token` (public; 404 `NOT_FOUND` for any unknown token). */
export function fetchInvitePreview(
  token: string,
  options: { signal?: AbortSignal } = {},
): Promise<InvitePreview> {
  return api.get<InvitePreview>(inviteAt(token), options.signal ? { signal: options.signal } : {})
}

/** #4 `POST /api/parent-invites/:token/accept` (parent only; idempotent; 401 / 403 / 404). */
export function acceptParentInvite(token: string): Promise<AcceptResult> {
  return api.post<AcceptResult>(`${inviteAt(token)}/accept`)
}
