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

import { api } from '@/api'

import type {
  ClientSession,
  LoginRequest,
  RegisterRequest,
  ResetByIcPayload,
  ResetPasswordPayload,
  ResetPasswordRequest,
  SessionPayload,
  StatusPayload,
} from './types'

function toClientSession(payload: SessionPayload, remember: boolean): ClientSession {
  return { token: payload.token, remember, expiresAt: payload.expiresAt, user: payload.user }
}

/** #1 `POST /api/auth/login`. Resolves to the session to store in `pp.auth` (FR-M01-07, 12). */
export async function login(request: LoginRequest): Promise<ClientSession> {
  const payload = await api.post<SessionPayload>('/api/auth/login', {
    body: { email: request.email, password: request.password, remember: request.remember },
  })
  return toClientSession(payload, request.remember)
}

/** #2 `POST /api/auth/register` (201): logs the new user in, not remembered (FR-M01-25). */
export async function register(request: RegisterRequest): Promise<ClientSession> {
  const payload = await api.post<SessionPayload>('/api/auth/register', { body: request })
  return toClientSession(payload, false)
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
