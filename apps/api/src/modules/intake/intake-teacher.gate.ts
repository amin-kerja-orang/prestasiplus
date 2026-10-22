import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { ApiError } from '../../common/errors/api-error'
import { AUTH_CONTEXT_KEY, type RequestWithAuth } from '../../common/scope/auth-context'

/** `true`/`1` (any case) turn the flag on; anything else, unset included, is off. */
export function intakeTeacherEnabled(value: unknown): boolean {
  return value === true || (typeof value === 'string' && ['true', '1'].includes(value.trim().toLowerCase()))
}

/**
 * AZ-35 (LEAD decision AZ-29 item 7 = ADMIN): intake is Admin Pusat only until ClamAV scans uploads (#78).
 * `INTAKE_TEACHER_ENABLED` (default off) re-opens the intake files and workflow routes to the teacher role; while it is
 * off a teacher gets 403 `FORBIDDEN` on every one of them, before any body is read or any row is touched. The role
 * comes from the session only. Admin is never affected.
 */
@Injectable()
export class IntakeTeacherGate implements CanActivate {
  private readonly teacherEnabled: boolean

  constructor(@Inject(ConfigService) config: Pick<ConfigService, 'get'>) {
    this.teacherEnabled = intakeTeacherEnabled(config.get<unknown>('INTAKE_TEACHER_ENABLED'))
  }

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<RequestWithAuth>()
    const role = req[AUTH_CONTEXT_KEY]?.active.role
    if (role === 'teacher' && !this.teacherEnabled) throw ApiError.of('FORBIDDEN')
    return true
  }
}
