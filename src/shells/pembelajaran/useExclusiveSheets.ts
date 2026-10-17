/**
 * Modal surfaces of the Pembelajaran shell never stack: the "Lagi" slide-over and the friend
 * picker sheet are mutually exclusive, and the slide-over is closed whenever the static sidebar
 * (>= lg) is on screen. Opening one closes the other.
 */
import { watch, type Ref } from 'vue'

export function useExclusiveSheets(
  lagiOpen: Ref<boolean>,
  pickerOpen: Ref<boolean>,
  isLg: Ref<boolean>,
): void {
  watch(pickerOpen, (open) => {
    if (open) lagiOpen.value = false
  })
  watch(lagiOpen, (open) => {
    if (open) pickerOpen.value = false
  })
  watch(
    isLg,
    (wide) => {
      if (wide) lagiOpen.value = false
    },
    { immediate: true },
  )
}
