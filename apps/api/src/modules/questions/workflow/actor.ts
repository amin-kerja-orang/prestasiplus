import { createParamDecorator, type ExecutionContext } from '@nestjs/common'
import type { QuestionWorkflowActor, RoleCode } from '@pp/contract'
import type { Request } from 'express'

import { Roles } from '../../../common/guards'
import { ApiError } from '../../../common/errors/api-error'
import { requestIdOf } from '../../../common/request/request-id'
import { type RequestWithAuth, ScopeContext } from '../../../common/scope'

/** Who performs a workflow call: what status events and audit rows record (BE-NFR-08). */
export interface WorkflowActor {
  userId: string
  /** The ACTIVE role code of the session (`admin` = Admin Pusat, `teacher` = Guru, ...). */
  role: RoleCode
  requestId: string | null
  ip: string | null
  /** True while an admin is in Mod Pelajar (rows written are test data, G-07). */
  isTest: boolean
}

export function actorOf(req: Request & RequestWithAuth): WorkflowActor {
  const scope = ScopeContext.fromRequest(req)
  return {
    userId: scope.userId,
    role: scope.role,
    requestId: requestIdOf(req) ?? null,
    ip: req.ip ?? req.socket.remoteAddress ?? null,
    isTest: scope.isTest,
  }
}

/** `@Actor()` hands the caller to a controller method. */
export const Actor = createParamDecorator((_data: unknown, ctx: ExecutionContext): WorkflowActor =>
  actorOf(ctx.switchToHttp().getRequest<Request & RequestWithAuth>()),
)

/**
 * Role decorators for the controllers of this module (BE-10 AC 2 and 9). Admin Sekolah, PPD
 * officer, parent and sponsor are 403 everywhere; the active role decides, not the account's roles.
 *  - `@AdminOnly()`     Admin Pusat (`admin`): reports admin side, imports, quality, diagram audit,
 *                       master notes, source takedown, approve and publish.
 *  - `@GuruOnly()`      Guru (`teacher`): `/guru/**` routes.
 *  - `@AdminOrGuru()`   lifecycle submit / archive (a Guru only on an own question, see `isOwner`).
 *  - no decorator       any signed-in user: `POST /question-reports`, `GET /question-reports/mine`.
 */
export const AdminOnly = (): MethodDecorator & ClassDecorator => Roles('admin')
export const GuruOnly = (): MethodDecorator & ClassDecorator => Roles('teacher')
export const AdminOrGuru = (): MethodDecorator & ClassDecorator => Roles('admin', 'teacher')

export const isAdminPusat = (actor: Pick<WorkflowActor, 'role'>): boolean => actor.role === 'admin'
export const isGuru = (actor: Pick<WorkflowActor, 'role'>): boolean => actor.role === 'teacher'

/** The contract actor kind of the transition table: Admin Pusat or the owning Guru. */
export function transitionActorOf(actor: Pick<WorkflowActor, 'role'>): QuestionWorkflowActor {
  if (isAdminPusat(actor)) return 'admin'
  if (isGuru(actor)) return 'owner_teacher'
  throw ApiError.of('FORBIDDEN')
}

/**
 * Guru ownership (BE-10 AC 2): a Guru acting on a question they did not create gets 404, as if it
 * did not exist. Admin Pusat is never limited. Call after loading the status facts.
 */
export function assertCanActOn(actor: Pick<WorkflowActor, 'role' | 'userId'>, createdById: string | null): void {
  if (isAdminPusat(actor)) return
  if (isGuru(actor) && createdById !== null && createdById === actor.userId) return
  if (isGuru(actor)) throw ApiError.of('NOT_FOUND')
  throw ApiError.of('FORBIDDEN')
}
