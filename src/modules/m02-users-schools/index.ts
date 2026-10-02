import type { ModuleManifest } from '@/app/modules'

import routes from './routes'

/**
 * M02 public entry (F-01 stub, ADR-0009). Other modules import this module only from here.
 * Public exports are added by the module's mock task (T1) and the tasks named in build-plan §S.3 rule 6.
 */
// Public API of M02 (M01 imports the school lookups from here; ADR-0009, build-plan §S.3 rule 6).
export { searchSchools, type SchoolSummary } from './api/schools'

// L45 Jemput Ibu Bapa: the acceptance page (M01) and the student screen use these (SRS L45 §7).
export {
  acceptParentInvite,
  fetchInvitePreview,
  fetchParentInvite,
  generateParentInvite,
  type AcceptResult,
  type GeneratedParentInvite,
  type InvitePreview,
  type InviteViewer,
  type LinkedParent,
  type ParentInviteView,
} from './api/parent-invite'

export const manifest: ModuleManifest = {
  id: 'M02',
  slug: 'm02-users-schools',
  routes,
}
