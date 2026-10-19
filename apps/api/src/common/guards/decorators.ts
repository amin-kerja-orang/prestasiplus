import { SetMetadata } from '@nestjs/common'
import type { RoleCode } from '@pp/contract'

export const IS_PUBLIC_KEY = 'pp:public'
export const ROLES_KEY = 'pp:roles'
export const CAPABILITY_KEY = 'pp:capability'

/** The route needs no session (login, health). */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true)

/** The ACTIVE role of the session must be one of `roles` (not just any role on the account). */
export const Roles = (...roles: RoleCode[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles)

/** The session's capability list (from `capabilitiesFor(activeRole, scope)`) must contain `key`. */
export const Capability = (key: string): MethodDecorator & ClassDecorator =>
  SetMetadata(CAPABILITY_KEY, key)
