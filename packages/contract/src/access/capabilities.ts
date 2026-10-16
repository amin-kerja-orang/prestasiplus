import type { AccessMode, RoleCode } from '../common/enums'
import { ACCESS_GROUPS, ACCESS_MATRIX } from './matrix'
import type { AccessGroup, AccessScope, Capability, MatrixItem } from './schema'

/** Access mode of `role` on `item`, or undefined when hidden. Learner roles have none. */
export function modeFor(role: RoleCode, item: MatrixItem, scope?: AccessScope): AccessMode | undefined {
  if (role !== 'admin' && role !== 'ppd_officer' && role !== 'school_admin') return undefined
  const mode = item.modes[role]
  if (!mode) return undefined
  // PPD-only items are hidden for a JPN (state) officer (AC-03.2); an unknown scope means PPD.
  if (role === 'ppd_officer' && item.ppdOnly && scope?.level === 'state') return undefined
  return mode
}

/** Items visible to the role, in menu order. */
export function visibleItems(role: RoleCode, scope?: AccessScope): MatrixItem[] {
  return ACCESS_MATRIX.filter((item) => modeFor(role, item, scope) !== undefined)
}

/** Groups with at least one visible item for the role, in menu order (AC-03.5). */
export function visibleGroups(role: RoleCode, scope?: AccessScope): AccessGroup[] {
  const ids = new Set(visibleItems(role, scope).map((item) => item.group))
  return ACCESS_GROUPS.filter((group) => ids.has(group.id))
}

/**
 * Capability list of the active role: a `.read` capability per visible item (menu visibility = read)
 * and a `.write` capability where the mode is F or S. R and D never get write (PPD/JPN never write).
 */
export function capabilitiesFor(role: RoleCode, scope?: AccessScope): Capability[] {
  return visibleItems(role, scope).flatMap((item) => {
    const mode = modeFor(role, item, scope) as AccessMode
    const read: Capability = { key: item.capability, itemId: item.id, mode, kind: 'read' }
    if (mode !== 'F' && mode !== 'S') return [read]
    const write: Capability = {
      key: item.capability.replace(/\.read$/, '.write'),
      itemId: item.id,
      mode,
      kind: 'write',
    }
    return [read, write]
  })
}
