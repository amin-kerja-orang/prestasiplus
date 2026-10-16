<script setup lang="ts">
/**
 * "Belum tersedia dalam prototaip" (TRACKER D43): shown in place of any route outside the
 * prototype scope (`src/app/prototype-scope.ts`). `LayoutHost` renders it inside the role's shell
 * (menus stay usable) or, for a guest, on its own. The tab title comes from the router.
 */
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import {
  isPrototypeRole,
  SCOPE_PAGE_HEADING,
  SCOPE_PAGE_MESSAGE,
  scopeHomePath,
} from '@/app/prototype-scope'
import { useSessionStore } from '@/stores/session'

const session = useSessionStore()

const home = computed(() => {
  // A role outside the prototype has no dashboard to go back to: offer to sign out.
  if (session.isLoggedIn && !isPrototypeRole(session.role)) {
    return { to: '/logout', label: 'Log Keluar' }
  }
  if (!session.isLoggedIn) return { to: '/login', label: 'Ke Halaman Log Masuk' }
  return { to: scopeHomePath(session.role), label: 'Kembali ke Dashboard' }
})
</script>

<template>
  <main
    class="flex min-h-[60vh] items-center justify-center px-4 py-10"
    data-page="prototype-unavailable"
    data-testid="prototype-unavailable"
  >
    <div class="mx-auto max-w-md text-center">
      <div class="mb-4 text-6xl leading-none" aria-hidden="true">🚧</div>
      <h1 class="mb-2 text-2xl font-bold text-slate-800">{{ SCOPE_PAGE_HEADING }}</h1>
      <p class="mb-8 text-[15px] leading-relaxed text-slate-600">{{ SCOPE_PAGE_MESSAGE }}</p>
      <RouterLink
        :to="home.to"
        class="inline-flex min-h-11 items-center justify-center rounded-full bg-indigo-600 px-8 py-3 font-semibold text-white hover:bg-indigo-700"
        data-testid="prototype-unavailable-home"
      >
        {{ home.label }}
      </RouterLink>
    </div>
  </main>
</template>
