import type { RoleCode } from '@pp/contract'
import type { Request } from 'express'

import { type RequestWithAuth, ScopeContext } from '../../common/scope'

export interface GamesCaller {
  userId: string
  /** Mod Pelajar is on: rows are stamped `is_test`, the actor never earns coins, boards exclude the row. */
  isTest: boolean
  /** The ACTIVE role. */
  role: RoleCode
}

/** Who is calling, from the request's AuthContext only (never the query or body). */
export function callerOf(req: Request & RequestWithAuth): GamesCaller {
  const scope = ScopeContext.fromRequest(req)
  return { userId: scope.userId, isTest: scope.isTest, role: scope.role }
}
