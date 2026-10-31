/**
 * Members of a stimulus group (D90, T13). A group is ONE unit around a shared stimulus: its member questions are added,
 * removed and reordered here and saved together. Pure functions over an ordered list; the page owns the state.
 */

/** D90: a stimulus with fewer members than this is not a group yet. */
export const MIN_GROUP_MEMBERS = 2
/** The stimulus API takes at most 40 member questions per group (`STIMULUS_LIMITS.groupQuestions`). */
export const MAX_GROUP_MEMBERS = 40

import type { WireStimulus } from './stimulus'

/** A group as the Studio shows it: stimuli, ordered members (stem, number) and whether a member is being served. */
export interface GroupView {
  id: string
  stimuli: WireStimulus[]
  members: GroupMember[]
  /** A member is being served: pupils see the group, so its structure is read-only. */
  locked: boolean
  /** D93: the server's BM warning while the group has fewer than 2 questions. */
  warning: string | null
}

export interface GroupMember {
  id: string
  /** The question number the author sees ("1", "2(a)"), or '' when none. */
  numberLabel: string
  /** A short preview of the stem. */
  stem: string
}

export const GROUP_MEMBER_MESSAGES = {
  needsTwo: 'Kumpulan perlu sekurang-kurangnya 2 soalan.',
  duplicate: 'Soalan ini sudah ada dalam kumpulan.',
  full: 'Satu kumpulan boleh mempunyai paling banyak 40 soalan.',
} as const

export function isComplete(members: readonly GroupMember[]): boolean {
  return members.length >= MIN_GROUP_MEMBERS
}

/** Messages that stop the group counting as complete; empty when it is fine. */
export function memberIssues(members: readonly GroupMember[]): string[] {
  return isComplete(members) ? [] : [GROUP_MEMBER_MESSAGES.needsTwo]
}

export type AddResult = { ok: true; members: GroupMember[] } | { ok: false; message: string }

/** Adds a question at a 0-based place (the end by default). A question is listed once. */
export function addMember(members: readonly GroupMember[], member: GroupMember, at?: number): AddResult {
  if (members.some((m) => m.id === member.id)) return { ok: false, message: GROUP_MEMBER_MESSAGES.duplicate }
  if (members.length >= MAX_GROUP_MEMBERS) return { ok: false, message: GROUP_MEMBER_MESSAGES.full }
  const place = at === undefined ? members.length : Math.max(0, Math.min(at, members.length))
  return { ok: true, members: [...members.slice(0, place), member, ...members.slice(place)] }
}

export function removeMember(members: readonly GroupMember[], id: string): GroupMember[] {
  return members.filter((m) => m.id !== id)
}

/** Moves a member by `delta` places (negative = up), stopping at the ends. */
export function moveMember(members: readonly GroupMember[], id: string, delta: number): GroupMember[] {
  const from = members.findIndex((m) => m.id === id)
  if (from < 0) return [...members]
  const to = Math.max(0, Math.min(members.length - 1, from + delta))
  if (to === from) return [...members]
  const next = [...members]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved as GroupMember)
  return next
}

export const memberIds = (members: readonly GroupMember[]): string[] => members.map((m) => m.id)

/** True when the saved and the edited lists differ in membership or order. */
export function membersChanged(saved: readonly GroupMember[], edited: readonly GroupMember[]): boolean {
  return saved.length !== edited.length || saved.some((m, i) => m.id !== edited[i]?.id)
}

export interface MemberPlan {
  /** Members to take out of the group, then to put in (in the final order), then the final order. */
  remove: string[]
  add: string[]
  order: string[]
}

/**
 * The calls that turn the saved member list into the edited one on the stimulus API (T32): `DELETE` each removed member,
 * `POST` each new one (appended), then `PUT .../members/order` with the final order. Empty when nothing changed.
 */
export function planMembers(saved: readonly GroupMember[], edited: readonly GroupMember[]): MemberPlan | null {
  if (!membersChanged(saved, edited)) return null
  const had = new Set(saved.map((m) => m.id))
  const want = new Set(edited.map((m) => m.id))
  return { remove: saved.filter((m) => !want.has(m.id)).map((m) => m.id), add: edited.filter((m) => !had.has(m.id)).map((m) => m.id), order: edited.map((m) => m.id) }
}
