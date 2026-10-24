<script setup lang="ts">
/**
 * "Belum tersedia dalam prototaip" (TRACKER D43): shown in place of any route outside the
 * prototype scope (`src/app/prototype-scope.ts`). `LayoutHost` renders it inside the role's shell
 * (menus stay usable) or, for a guest, on its own. The tab title comes from the router.
 */
import { computed } from 'vue'

import { DsEmptyState, usePersonality } from '@/ds'

import {
  isPrototypeRole,
  SCOPE_PAGE_HEADING,
  SCOPE_PAGE_MESSAGE,
  scopeHomePath,
} from '@/app/prototype-scope'
import { useSessionStore } from '@/stores/session'

const session = useSessionStore()
const personality = usePersonality()

const home = computed(() => {
  // A role outside the prototype has no dashboard to go back to: offer to sign out.
  if (session.isLoggedIn && !isPrototypeRole(session.role)) {
    return { to: '/logout', label: 'Log Keluar' }
  }
  if (!session.isLoggedIn) return { to: '/login', label: 'Ke Halaman Log Masuk' }
  return { to: scopeHomePath(session.role), label: 'Kembali ke Papan Pemuka' }
})
</script>

<template>
  <main
    class="flex min-h-[60vh] items-center justify-center px-4 py-8"
    data-page="prototype-unavailable"
    data-testid="prototype-unavailable"
  >
    <div class="flex max-w-md flex-col items-center text-center">
      <DsEmptyState
        :title="SCOPE_PAGE_HEADING"
        :description="SCOPE_PAGE_MESSAGE"
        icon="flask"
        :friend="personality === 'learner' ? 'aiman' : undefined"
      >
        <template #actions>
          <UButton
            :to="home.to"
            size="lg"
            :label="home.label"
            data-testid="prototype-unavailable-home"
          />
        </template>
      </DsEmptyState>
    </div>
  </main>
</template>
