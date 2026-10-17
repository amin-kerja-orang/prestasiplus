import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { z } from '../zod'
import { AuthErrorCodeSchema } from '../auth/errors'
import { LoginRequestSchema, LoginSchoolCandidateSchema } from '../auth/login'
import { ErrorBodySchema } from '../common/error'
import { envelopeOf } from '../common/envelope'
import { CapabilityKeySchema } from '../access/schema'
import {
  ActiveRoleSchema,
  EnterModeRequestSchema,
  ModeKindSchema,
  ModeSchema,
  RoleGrantSchema,
  SessionSchema,
  SessionUserSchema,
  SwitchRoleRequestSchema,
} from './session'
import { ScopeSchema } from './scope'

/** Components contributed by V2-T07 (appended to COMPONENT_SCHEMAS in openapi.ts). */
export const SESSION_COMPONENT_SCHEMAS = {
  Scope: ScopeSchema,
  SessionUser: SessionUserSchema,
  RoleGrant: RoleGrantSchema,
  ActiveRole: ActiveRoleSchema,
  ModeKind: ModeKindSchema,
  Mode: ModeSchema,
  CapabilityKey: CapabilityKeySchema,
  Session: SessionSchema,
  LoginRequest: LoginRequestSchema,
  LoginSchoolCandidate: LoginSchoolCandidateSchema,
  SwitchRoleRequest: SwitchRoleRequestSchema,
  EnterModeRequest: EnterModeRequestSchema,
  AuthErrorCode: AuthErrorCodeSchema,
} as const

const SessionEnvelope = envelopeOf(SessionSchema)

const json = (schema: z.ZodType, description: string) => ({
  description,
  content: { 'application/json': { schema } },
})
const err = (description: string) => json(ErrorBodySchema, description)

/** Registers the six auth/session endpoints. Every response body is `{ data }` or `{ error }`. */
export function registerSessionPaths(registry: OpenAPIRegistry): void {
  const body = (schema: z.ZodType) => ({
    required: true,
    content: { 'application/json': { schema } },
  })
  const unauthorized = err('UNAUTHORIZED: no valid session.')
  const csrfHeaders = z.object({
    'X-CSRF-Token': z.string().min(1).meta({ description: 'Value of Session.csrf; required on authenticated mutating requests.' }),
  })

  registry.registerPath({
    method: 'post',
    path: '/auth/login',
    tags: ['auth'],
    summary: 'Log in with e-mail or username and password',
    description:
      'Regenerates the session id and sets the session cookie. The role, scope and capabilities in the returned Session are decided by the server.',
    request: { body: body(LoginRequestSchema) },
    responses: {
      200: json(SessionEnvelope, 'Logged in.'),
      401: err('INVALID_CREDENTIALS (never reveals which part was wrong).'),
      403: err('ACCOUNT_INACTIVE or SCHOOL_INACTIVE.'),
      422: err('VALIDATION_ERROR, or AMBIGUOUS_USERNAME with details.schools (LoginSchoolCandidate[]).'),
      429: err('RATE_LIMITED, with retryAfter.'),
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/auth/logout',
    tags: ['auth'],
    summary: 'End the session (both portals)',
    description:
      'Idempotent: returns 204 even when there is no session. When a session exists, X-CSRF-Token is checked (403 CSRF_INVALID).',
    request: { headers: [csrfHeaders.partial()] },
    responses: { 204: { description: 'Logged out, or there was no session. No body.' }, 403: err('CSRF_INVALID.') },
  })

  registry.registerPath({
    method: 'get',
    path: '/session',
    tags: ['session'],
    summary: 'Current session',
    description: 'One call resolves roles, active role, scope, capabilities, mode and landing path.',
    responses: { 200: json(SessionEnvelope, 'The current session.'), 401: unauthorized },
  })

  registry.registerPath({
    method: 'post',
    path: '/session/role',
    tags: ['session'],
    summary: 'Switch the active role',
    description: 'The role must be in the account role list. Scope is never accepted from the client.',
    request: { headers: [csrfHeaders], body: body(SwitchRoleRequestSchema) },
    responses: {
      200: json(SessionEnvelope, 'Session with the new active role.'),
      401: unauthorized,
      403: err('ROLE_NOT_ALLOWED (role not in the account list) or CSRF_INVALID.'),
      409: err('MODE_ACTIVE: leave the mode first.'),
      422: err('VALIDATION_ERROR (unknown role, or any unknown key such as scope).'),
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/session/mode',
    tags: ['session'],
    summary: 'Enter a session mode (Mod Pelajar)',
    description: 'Allowed for admin and school_admin only. The session acts as self (student), data is test data.',
    request: { headers: [csrfHeaders], body: body(EnterModeRequestSchema) },
    responses: {
      200: json(SessionEnvelope, 'Session in the mode.'),
      401: unauthorized,
      403: err('MODE_NOT_ALLOWED (active role may not use this mode) or CSRF_INVALID.'),
      409: err('MODE_ALREADY_ACTIVE.'),
      422: err('VALIDATION_ERROR.'),
    },
  })

  registry.registerPath({
    method: 'delete',
    path: '/session/mode',
    tags: ['session'],
    summary: 'Leave the session mode (Keluar Mod Pelajar)',
    request: { headers: [csrfHeaders] },
    responses: {
      200: json(SessionEnvelope, 'Session with the return role active.'),
      401: unauthorized,
      403: err('CSRF_INVALID.'),
      409: err('NO_MODE_ACTIVE.'),
    },
  })
}
