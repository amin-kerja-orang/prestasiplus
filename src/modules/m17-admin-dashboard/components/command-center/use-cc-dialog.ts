/**
 * Open state of a Command Center dialog (S7 drill). The parent mounts the dialog with `v-if`, so it is
 * open from the start; closing it (Tutup, the close icon, Esc, the backdrop; FR-M17-56) emits `close`
 * for the parent to unmount it.
 */
import { ref, watch } from 'vue'

export function useCcDialog(onClose: () => void) {
  const open = ref(true)
  watch(open, (value) => {
    if (!value) onClose()
  })
  return open
}
