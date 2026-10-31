import { onMounted, ref } from 'vue'

const STORE_KEY = 'pp:callout:kirk-info'

/** The open state of the "Tentang Model Kirkpatrick" panel, collapsed by default and remembered per browser. */
export function useInfoOpen() {
  const open = ref(false)
  onMounted(() => {
    try {
      open.value = window.localStorage.getItem(STORE_KEY) === 'open'
    } catch {
      /* storage blocked: the choice lasts for this page view only */
    }
  })
  function toggle(): void {
    open.value = !open.value
    try {
      window.localStorage.setItem(STORE_KEY, open.value ? 'open' : 'collapsed')
    } catch {
      /* storage blocked */
    }
  }
  return { open, toggle }
}
