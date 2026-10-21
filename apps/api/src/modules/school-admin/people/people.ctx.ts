import { callerOf } from '../../users/caller'
import { schoolAdminOf, type SchoolAdminReq } from '../school-admin.actor'
import type { PeopleCtx } from './managed-users.service'

/** The school admin of the request: `actor.schoolId` comes from the session only; `caller` scopes every user query to it. */
export function peopleCtxOf(req: SchoolAdminReq): PeopleCtx {
  const { actor } = schoolAdminOf(req)
  return { actor, caller: callerOf(req) }
}
