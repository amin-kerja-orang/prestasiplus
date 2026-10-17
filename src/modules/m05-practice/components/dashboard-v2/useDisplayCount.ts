/**
 * The live count-up (FR-M05-11) as a number, except that a visitor who prefers reduced motion sees
 * the final value at once.
 */
import { ref, toValue, type MaybeRefOrGetter, type Ref } from 'vue'

import type { CountUpRule } from '../dashboard/dashboard-lib'
import { useCountUp } from '../dashboard/useCountUp'

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export function useDisplayCount(target: MaybeRefOrGetter<number>, rule: CountUpRule): Ref<number> {
  if (prefersReducedMotion()) return ref(toValue(target))
  return useCountUp(target, rule)
}
