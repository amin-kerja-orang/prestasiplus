import type { Request } from 'express'

import { ScopeContext, type RequestWithAuth } from '../../../common/scope'

/**
 * Who a battle write acts as. A caller whose ACTIVE role is not `student` (staff, or Mod Pelajar, which acts as
 * `student` with the test flag) writes `is_test` rows, so staff battles never reach real standings or real pupils.
 */
export function battleCaller(req: Request & RequestWithAuth): { userId: string; isTest: boolean } {
  const s = ScopeContext.fromRequest(req)
  return { userId: s.userId, isTest: s.isTest || s.role !== 'student' }
}
