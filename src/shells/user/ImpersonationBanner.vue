<script setup lang="ts">
/**
 * Impersonation banner (M27 XR-M27-11(e), FR-M27-122, SEC-M27-12; live `impersonation-banner.blade.php`).
 * A sticky amber bar above the shell, shown on every page while the session carries an impersonator
 * (`session.impersonator`, set by "Menyamar", XR-M27-21). It is not dismissible. "Kembali ke Admin" calls
 * `POST /api/admin-sekolah/impersonate/leave` (#21), swaps the stored session for the school admin's own,
 * flashes the returned status and opens the return path (S6 or S7). A 403 (no impersonation in progress,
 * i.e. the parked session has gone) clears the session and opens /login.
 *
 * Boundary: the shell calls the M27 public entry `@/modules/m27-school-admin` (allowed by the UI boundary
 * rule: only deep imports are banned), so the endpoint stays owned by M27.
 *
 * The bar is one fixed-height line (h-11) with truncating text so the button always stays visible; the
 * style block below moves the sticky topbar and the fixed sidebar down by that height.
 */
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import { isApiError } from '@/api'
import { useFlash } from '@/composables/useFlash'
import { AppIcon } from '@/components/icon'
import { leaveImpersonation } from '@/modules/m27-school-admin'
import { useSessionStore } from '@/stores/session'

const GENERIC_ERROR = 'Ralat berlaku. Sila cuba lagi.'

const session = useSessionStore()
const router = useRouter()
const flash = useFlash()

const impersonator = computed(() => session.impersonator)
const targetName = computed(() => session.user?.name ?? '')
const leaving = ref(false)

async function leave(): Promise<void> {
  if (leaving.value) return
  leaving.value = true
  try {
    const result = await leaveImpersonation()
    const { token, expiresAt, user, returnTo } = result.data
    // The school admin's own session replaces the target's; `impersonator` is dropped with it.
    // `remember` is an optional field of #21 (the admin's own session flag); absent means false.
    const remember = (result.data as { remember?: boolean }).remember === true
    session.setSession({ token, remember, expiresAt, user })
    flash.success(result.status)
    await router.push(returnTo)
  } catch (err) {
    if (isApiError(err) && err.status === 403) {
      session.clear()
      await router.replace('/login')
    } else if (
      isApiError(err) &&
      err.status !== 0 &&
      !/^HTTP \d+$/.test(err.message) &&
      err.message !== ''
    ) {
      flash.show({ type: 'error', message: err.message })
    } else {
      flash.show({ type: 'error', message: GENERIC_ERROR })
    }
  } finally {
    leaving.value = false
  }
}
</script>

<template>
  <div
    v-if="impersonator"
    class="impersonation-banner sticky top-0 z-[45] flex h-11 items-center gap-3 bg-amber-400 px-3 text-sm font-semibold text-amber-950 sm:px-6"
    data-testid="impersonation-banner"
  >
    <AppIcon name="fa-user-secret" class="h-4 w-4 shrink-0" />
    <p class="min-w-0 flex-1 truncate" data-testid="impersonation-text">
      Mod menyamar — anda melihat sebagai {{ targetName }}
    </p>
    <button
      type="button"
      :disabled="leaving"
      class="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-amber-950 px-3 text-xs font-semibold text-amber-50 transition hover:bg-amber-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-950 focus-visible:ring-offset-2 focus-visible:ring-offset-amber-400 disabled:cursor-wait disabled:opacity-70"
      data-testid="impersonation-leave"
      @click="leave"
    >
      Kembali ke Admin
    </button>
  </div>
</template>

<style>
/* The banner is 2.75rem (h-11) tall; the sticky topbar and the fixed sidebar start below it. */
.user-shell:has(.impersonation-banner) .topbar.sticky {
  top: 2.75rem;
}
.user-shell:has(.impersonation-banner) .sidebar {
  top: 2.75rem;
  height: calc(100vh - 2.75rem);
}
</style>
