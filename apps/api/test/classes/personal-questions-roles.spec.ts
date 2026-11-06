import type { ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { describe, expect, it } from 'vitest'

import { RolesGuard } from '../../src/common/guards/guards'
import { AUTH_CONTEXT_KEY } from '../../src/common/scope/auth-context'
import { PersonalQuestionsController } from '../../src/modules/classes/teacher-tools/personal-questions.controller'

/** S6-T16: every route of /api/guru/personal-questions is for the ACTIVE role teacher; the real RolesGuard refuses the others with 403. */
const handlers = ['list', 'create', 'get', 'update', 'remove'] as const
const contextOf = (handler: (typeof handlers)[number], role: string): ExecutionContext =>
  ({
    getHandler: () => PersonalQuestionsController.prototype[handler],
    getClass: () => PersonalQuestionsController,
    switchToHttp: () => ({ getRequest: () => ({ [AUTH_CONTEXT_KEY]: { active: { role } } }) }),
  }) as unknown as ExecutionContext

describe('RolesGuard on /api/guru/personal-questions', () => {
  const guard = new RolesGuard(new Reflector())

  it.each(handlers)('%s: a teacher passes', (h) => {
    expect(guard.canActivate(contextOf(h, 'teacher'))).toBe(true)
  })

  it.each(handlers.flatMap((h) => ['student', 'school_admin', 'admin'].map((r) => [h, r] as const)))('%s: %s gets 403', (h, role) => {
    expect(() => guard.canActivate(contextOf(h, role))).toThrowError(expect.objectContaining({ status: 403 }) as never)
  })
})
