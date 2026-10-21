/**
 * Registry of the activity groups (BE-29). Part A (wallet, activity) and Part B (catalogue, content, ops) each
 * add ONE import and ONE array entry here; nothing else in `load/activity` changes when a group is added.
 * The run order is fixed by `ACTIVITY_GROUP_NAMES` (catalogue, wallet, activity, content, ops), not by the
 * order of this array.
 */
import type { ActivityGroup } from './context'

export const ACTIVITY_GROUPS: ActivityGroup[] = []
