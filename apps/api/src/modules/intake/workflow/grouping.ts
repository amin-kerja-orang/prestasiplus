/**
 * Stimulus groups (exam schema D6, prototype `admin/intake/domain/grouping.ts`): the items of one group stay
 * contiguous. Pure functions over an ordered list.
 */
export interface Ordered {
  id: string
  stimulusId: string | null
}

export interface GroupInfo {
  stimulusId: string
  itemIds: string[]
  /** Index of the first and last member. */
  contiguous: boolean
}

export function groupsOf(items: readonly Ordered[]): GroupInfo[] {
  const map = new Map<string, number[]>()
  items.forEach((q, i) => {
    if (q.stimulusId !== null) map.set(q.stimulusId, [...(map.get(q.stimulusId) ?? []), i])
  })
  return [...map.entries()].map(([stimulusId, idx]) => ({
    stimulusId,
    itemIds: idx.map((i) => (items[i] as Ordered).id),
    contiguous: idx.every((v, k) => k === 0 || v === (idx[k - 1] as number) + 1),
  }))
}

/**
 * Attaches `ids` to `stimulusId` and gathers the group (old members plus the new ones) into one block at the position
 * of its earliest member. `moved` is true when the order of the list changed.
 */
export function attachToStimulus<T extends Ordered>(items: readonly T[], ids: readonly string[], stimulusId: string): { items: T[]; moved: boolean } {
  const picked = new Set(ids)
  const tagged = items.map((q) => (picked.has(q.id) ? { ...q, stimulusId } : q))
  const members = tagged.filter((q) => q.stimulusId === stimulusId)
  if (members.length === 0) return { items: tagged, moved: false }
  const firstIndex = tagged.findIndex((q) => q.stimulusId === stimulusId)
  const memberIds = new Set(members.map((q) => q.id))
  const rest = tagged.filter((q) => !memberIds.has(q.id))
  const before = tagged.slice(0, firstIndex).filter((q) => !memberIds.has(q.id)).length
  const out = [...rest.slice(0, before), ...members, ...rest.slice(before)]
  return { items: out, moved: out.some((q, i) => q.id !== (tagged[i] as T).id) }
}

export function detachFromStimulus<T extends Ordered>(items: readonly T[], ids: readonly string[]): T[] {
  const drop = new Set(ids)
  return items.map((q) => (drop.has(q.id) ? { ...q, stimulusId: null } : q))
}
