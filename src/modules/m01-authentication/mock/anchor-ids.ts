/**
 * Public anchor-id helpers (M01 mock entry). Consumers (M10, M05, …) ask the users store which ids
 * are literal anchors of the users dataset instead of copying id blocks. Both read
 * `USER_ANCHOR_ROWS`, the source F-23 builds the dataset anchors from.
 */

import { USER_ANCHOR_ROWS } from './datasets/users-anchors'

const ANCHOR_IDS: ReadonlySet<number> = new Set(USER_ANCHOR_ROWS.map((row) => row.id))
const ANCHOR_ID_LIST: readonly number[] = Object.freeze(USER_ANCHOR_ROWS.map((row) => row.id))

/** `true` when `id` is a literal anchor row of the users dataset (canonical, fixtures, pins). */
export function isAnchorUser(id: number): boolean {
  return ANCHOR_IDS.has(id)
}

/** Every anchor user id, ascending. The same array on every call. */
export function anchorUserIds(): readonly number[] {
  return ANCHOR_ID_LIST
}
