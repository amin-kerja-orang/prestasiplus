/**
 * Open state of a stimulus panel per group id for the session (FR-X6-6, 46 section 2.4): TRUE the first time
 * a group id appears, afterwards whatever the pupil left. Memory only (module-level Map, no storage), so it
 * survives a remount (rotation, moving between member screens) and is gone with the page.
 */
import { ref, type Ref } from 'vue'

const states = new Map<string, Ref<boolean>>()

export function useStimulusOpen(groupId: string): Ref<boolean> {
  let state = states.get(groupId)
  if (!state) {
    state = ref(true)
    states.set(groupId, state)
  }
  return state
}

/** New session (sign-out) and tests. */
export function resetStimulusOpen(): void {
  states.clear()
}
