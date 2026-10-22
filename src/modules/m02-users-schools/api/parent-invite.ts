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

/** §6.3 `ParentInviteView` (mock wire): the student's current token (created on the first call) and the linked parents. */
export interface ParentInviteView {
  /** 64 lowercase hex characters. */
  token: string
  /** ISO 8601 (+08:00). */
  createdAt: string
  /** By parent name ascending (`ms` collation). */
  parents: LinkedParent[]
}

/**
 * What the page needs. `token` is `null` when the server holds only a hash (v2 http, D58): the clear
 * token is shown once, by the response that issues it, so a later visit has none until "Jana Link Baru".
 */
export interface ParentInviteState {
  token: string | null
  createdAt: string
  parents: LinkedParent[]
}

/** #2 data. `status` = "Link jemputan baru telah dijana!". */
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

/**
 * Wire of `GET /api/me/parent-invite`. v2 (contract `ParentInviteStatus`, D58): status only, never a
 * token. The mock still answers the old shape with `token`; both are accepted.
 */
interface ParentInviteWire {
  token?: string
  hasToken?: boolean
  createdAt: string | null
  expiresAt?: string | null
  parents: LinkedParent[]
}

/** In-flight auto-issue, shared by concurrent loads in this tab so they cause one POST. */
let issuing: Promise<GeneratedParentInvite> | null = null

function issueFirstToken(signal?: AbortSignal): Promise<GeneratedParentInvite> {
  if (signal?.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'))
  if (!issuing) {
    const request = api
      .post<GeneratedParentInvite>('/api/me/parent-invite/generate', signal ? { signal } : {})
      .finally(() => {
        if (issuing === request) issuing = null
      })
    issuing = request
  }
  return issuing
}

/**
 * #1 `GET /api/me/parent-invite` (student only). Mock: returns the token (created the first time).
 * v2 http: status only; when `hasToken=false` the first visit issues a token (#2) so the page can show a
 * link; when `hasToken=true` the clear token is unavailable (`token: null`).
 */
export async function fetchParentInvite(
  options: { signal?: AbortSignal } = {},
): Promise<ParentInviteState> {
  const wire = await api.get<ParentInviteWire>(
    '/api/me/parent-invite',
    options.signal ? { signal: options.signal } : {},
  )
  if (typeof wire.token === 'string' && wire.token !== '') {
    return { token: wire.token, createdAt: wire.createdAt ?? '', parents: wire.parents }
  }
  if (wire.hasToken === false) {
    const issued = await issueFirstToken(options.signal)
    return { token: issued.token, createdAt: issued.createdAt, parents: wire.parents }
  }
  return { token: null, createdAt: wire.createdAt ?? '', parents: wire.parents }
}

/**
 * #2 `POST /api/me/parent-invite/generate` (student only): replaces the token; the old one stops working.
 * The API serves this path and the contract path `POST /api/me/parent-invite` with one handler (BE-25).
 */
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
