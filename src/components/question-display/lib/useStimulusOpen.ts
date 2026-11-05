/**
 * Open state of a stimulus panel per group id for the session (FR-X6-6, 46 section 2.4): TRUE the first time
 * a group id appears, afterwards whatever the pupil left. Memory only (module-level Map, no storage), so it
 * survives a remount (rotation, moving between member screens) and is gone with the page.
 */
import { inject, ref, type InjectionKey, type Ref } from 'vue'

/** What a group offers to the questions in its slot: its stimuli and a way to open one (or 'all') of them (FR-PA-37). */
export interface StimulusGroupContext {
  stimuli: () => readonly { id: string; label?: string }[]
  open: (id: string) => void
}
export const STIMULUS_GROUP_KEY: InjectionKey<StimulusGroupContext> = Symbol('stimulus-group')
export const useStimulusGroup = (): StimulusGroupContext | undefined => inject(STIMULUS_GROUP_KEY, undefined)

const states = new Map<string, Ref<boolean>>()

export function useStimulusOpen(groupId: string): Ref<boolean> {
  let state = states.get(groupId)
  if (!state) {
    state = ref(true)
    states.set(groupId, state)
  }
  return state
}

/** TESTS ONLY: clears the session map. Not wired to sign-out (another module). */
export function resetStimulusOpen(): void {
  states.clear()
}
