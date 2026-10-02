/**
 * Reactive `matchMedia(query)`. Where `matchMedia` is missing (tests, SSR) it reports `true`, the
 * desktop answer.
 */
import { onBeforeUnmount, ref, type Ref } from 'vue'

export function useMediaQuery(query: string): Ref<boolean> {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return ref(true)
  const list = window.matchMedia(query)
  const matches = ref(list.matches)
  const onChange = (event: MediaQueryListEvent): void => {
    matches.value = event.matches
  }
  list.addEventListener('change', onChange)
  onBeforeUnmount(() => list.removeEventListener('change', onChange))
  return matches
}

/** The shell's `lg` breakpoint (1024 px). */
export const LG_QUERY = '(min-width: 1024px)'
