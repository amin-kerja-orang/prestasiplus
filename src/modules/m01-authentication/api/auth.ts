/**
 * M01 auth client functions (SRS M01 v1.12 §7 #1–#6). All are public or session-independent; the
 * `/api/auth/*` paths handle their own 401 (no global redirect, `isAuthPath`).
 *
 * Failures reject with `ApiError` (`src/api/errors.ts`):
 * - #1 credentials: 422 `VALIDATION_ERROR`, message "Email atau kata laluan tidak sah.";
 * - #1 inactive account (BR-23): 403 `ACCOUNT_INACTIVE`;
 * - #1 and #3 throttled: 429 `RATE_LIMITED` with `retryAfter` (seconds);
 * - others: 422 `VALIDATION_ERROR` with `fields`.
 */

import { api, isHttpMode } from '@/api'
import { isApiSession, toClientSessionFromApi } from '@/stores/http-session'

import type {
  ClientSession,
  LoginRequest,
  RegisterPending,
  RegisterRequest,
  RegisterResult,
  ResetByIcPayload,
  ResetPasswordPayload,
  ResetPasswordRequest,
  SessionPayload,
  StatusPayload,
} from './types'

/**
 * Fallback for a pending notice without a usable message: the contract text
 * `ACCOUNT_REGISTER_PENDING_MESSAGE` (a test asserts they are equal). It is a local copy because a
 * runtime import of `@pp/contract` pulls the whole zod contract into the entry bundle (+0.77 MB).
 */
export const REGISTER_PENDING_FALLBACK_MESSAGE =
  'Pendaftaran diterima. Akaun guru anda akan diaktifkan selepas disahkan oleh pentadbir sekolah.'

function toClientSession(payload: SessionPayload, remember: boolean): ClientSession {
  // Real API (V2-T31): the body is the contract `Session` (cookie session + csrf), not a bearer payload.
  if (isApiSession(payload)) return toClientSessionFromApi(payload, remember)
  return { token: payload.token, remember, expiresAt: payload.expiresAt, user: payload.user }
}

/** #1 `POST /api/auth/login`. Resolves to the session to store in `pp.auth` (FR-M01-07, 12). */
export async function login(request: LoginRequest): Promise<ClientSession> {
  // The contract names the field `identifier` (e-mail or username); the mock still reads `email`.
  const credentials = isHttpMode()
    ? { identifier: request.email, password: request.password, remember: request.remember }
    : { email: request.email, password: request.password, remember: request.remember }
  const payload = await api.post<SessionPayload>('/api/auth/login', { body: credentials })
  return toClientSession(payload, request.remember)
}

/** The 201 body of a teacher registration: the pending notice, never a session (AM2-N1). */
export function isRegisterPending(result: unknown): result is RegisterPending {
  return (
    typeof result === 'object' &&
    result !== null &&
    'status' in result &&
    result.status === 'pending_verification'
  )
}

/**
 * #2 `POST /api/auth/register` (201). Student and parent: logs the new user in, not remembered
 * (FR-M01-25). Teacher: resolves to the pending notice `{status: 'pending_verification', message}`
 * and creates no session (the caller must not store one).
 */
export async function register(request: RegisterRequest): Promise<RegisterResult> {
  const payload = await api.post<SessionPayload | RegisterPending>('/api/auth/register', {
    body: request,
  })
  if (isRegisterPending(payload)) {
    // The server copy is shown as is; a missing or blank message falls back to the contract text.
    const { message } = payload as { message?: unknown }
    return {
      status: payload.status,
      message:
        typeof message === 'string' && message.trim() !== ''
          ? message
          : REGISTER_PENDING_FALLBACK_MESSAGE,
    }
  }
  return toClientSession(payload, false)
}

/**
 * `GET /api/session` (real API only; contract `Session`): the session the cookie now belongs to.
 * The profile password change needs it because `PUT /api/me/password` rotates the session, so the
 * CSRF token changes (DV-27). Resolves to `null` only outside http mode (the mock session needs no refresh). In
 * http mode a 200 body that is not the API session throws, as does any API error (a 401 is also
 * handled by the 401 policy), so the caller's failure path runs.
 */
export async function getSession(remember: boolean): Promise<ClientSession | null> {
  if (!isHttpMode()) return null
  const body = await api.get<unknown>('/api/session')
  if (!isApiSession(body)) throw new Error('GET /api/session: unexpected response body')
  return toClientSessionFromApi(body, remember)
}

/** #3 `POST /api/auth/password/email`. Resolves to the status text (green box, FR-M01-29). */
export async function sendPasswordResetLink(email: string): Promise<string> {
  const { status } = await api.post<StatusPayload>('/api/auth/password/email', {
    body: { email },
  })
  return status
}

/** #4 `POST /api/auth/password/reset`: the new session and the flash text for the landing page. */
export async function resetPassword(
  request: ResetPasswordRequest,
): Promise<{ session: ClientSession; status: string }> {
  const { status, ...payload } = await api.post<ResetPasswordPayload>('/api/auth/password/reset', {
    body: request,
  })
  return { session: toClientSession(payload, false), status }
}

/** #5 `POST /api/auth/password/reset-ic`: the broker token, then S4 (`FR-M01-35`). */
export function resetByIc(email: string, icNumber: string): Promise<ResetByIcPayload> {
  return api.post<ResetByIcPayload>('/api/auth/password/reset-ic', { body: { email, icNumber } })
}

/** #6 `POST /api/auth/logout` (204). Never fails on a dead session; callers clear the client session anyway. */
export async function logout(): Promise<void> {
  await api.post<void>('/api/auth/logout')
}
