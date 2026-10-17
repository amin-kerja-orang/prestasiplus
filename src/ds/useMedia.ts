/** Reactive `matchMedia` for composites that must render one tree per breakpoint (no duplicate ids). */
import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'

export function useMedia(query: string, fallback = true): Ref<boolean> {
  const matches = ref(fallback)
  let mql: MediaQueryList | undefined
  const update = (): void => {
    matches.value = mql?.matches ?? fallback
  }
  onMounted(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    mql = window.matchMedia(query)
    update()
    mql.addEventListener?.('change', update)
  })
  onBeforeUnmount(() => mql?.removeEventListener?.('change', update))
  return matches
}
