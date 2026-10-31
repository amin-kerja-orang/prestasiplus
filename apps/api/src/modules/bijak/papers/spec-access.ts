import type { AuthContext } from '../../../common/scope'

/**
 * Who may generate from a Spec (not yet Disahkan) blueprint head: Admin Pusat while in Mod Pelajar (test data, O-6).
 * The test is the role the session returns to (`mode.returnRole`), not the roles the account holds: an account that
 * also holds the admin role but entered Mod Pelajar from Admin Sekolah (or any other role) gets no extra access
 * (REQ-B-005, T06 intent).
 */
export function canUseSpecBlueprints(auth: Pick<AuthContext, 'mode'>): boolean {
  return auth.mode !== null && auth.mode.returnRole === 'admin'
}
