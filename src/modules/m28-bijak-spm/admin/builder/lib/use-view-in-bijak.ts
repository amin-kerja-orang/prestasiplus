/**
 * "Lihat di Bijak SPM" on the admin pages. Bijak SPM is student-only (D43), so an admin first
 * enters Mod Pelajar, then opens the learner Bijak SPM page (same pattern as PentadbiranLayout).
 */
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import { useFlash } from '@/composables/useFlash'
import { enterModPelajar } from '@/shells/shared/mod-pelajar'

export const BIJAK_STUDENT_PATH = '/spm/bijak'

export function useViewInBijak() {
  const router = useRouter()
  const flash = useFlash()
  const switching = ref(false)

  async function viewInBijak(): Promise<void> {
    if (switching.value) return
    switching.value = true
    try {
      await enterModPelajar()
      await router.push(BIJAK_STUDENT_PATH)
    } catch {
      flash.show({ type: 'error', message: 'Mod Pelajar tidak dapat dibuka. Sila cuba lagi.' })
    } finally {
      switching.value = false
    }
  }

  return { switching, viewInBijak }
}
