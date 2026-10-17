/**
 * Which personality (staff / learner) a composite is rendered in. A `DsThemeScope` provides its own
 * (gallery panels); otherwise the portal layout's active personality on <html> is used, and `staff`
 * when no layout is mounted.
 */
import { computed, inject, provide, type ComputedRef, type InjectionKey, type Ref } from 'vue'

import { activePersonality, type Personality } from '@/theme/color-mode'

const personalityKey: InjectionKey<Ref<Personality>> = Symbol('ds-personality')

export function providePersonality(value: Ref<Personality>): void {
  provide(personalityKey, value)
}

export function usePersonality(): ComputedRef<Personality> {
  const scoped = inject(personalityKey, null)
  return computed(() => scoped?.value ?? activePersonality.value ?? 'staff')
}
