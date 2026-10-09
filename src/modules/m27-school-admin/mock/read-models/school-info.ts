/** `SchoolInfo` / `SchoolRef` of the viewer's school (M02 `schools`, D12). */

import type { SchoolInfo, SchoolRef } from '../../api/school-admin'
import { schoolRowOf, type SchoolViewer } from './school-scope'

export function schoolRefOf(viewer: SchoolViewer): SchoolRef {
  const s = schoolRowOf(viewer)
  return { id: s.id, name: s.name }
}

export function schoolInfoOf(viewer: SchoolViewer): SchoolInfo {
  const s = schoolRowOf(viewer)
  return {
    id: s.id,
    name: s.name,
    code: s.code === '' ? null : s.code,
    district: s.district === null || s.district === '' ? null : s.district,
    state: s.state,
  }
}
