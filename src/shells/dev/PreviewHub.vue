<script setup lang="ts">
/**
 * Temporary preview hub (user decision D20). Stands in for `/admin` (M17) and `/dashboard` (M05)
 * until those pages exist; a real module route with the same path wins automatically (see
 * `devRoutes()` in `core-routes.ts`). Links come from `preview-hub-links.ts`.
 */
import { computed } from 'vue'

import { useSessionStore } from '@/stores/session'

import { groupLinksForRole } from './preview-hub-links'

const session = useSessionStore()
const groups = computed(() => groupLinksForRole(session.role))
</script>

<template>
  <div class="mx-auto w-full max-w-5xl min-w-0" data-testid="preview-hub">
    <h1 class="text-2xl font-bold break-words">Pratonton Prototaip</h1>
    <p class="mt-2 max-w-2xl text-slate-600">
      Skrin sebenar halaman ini belum dibina. Di bawah ialah skrin yang sudah siap untuk
      dipratonton.
    </p>

    <template v-if="groups.length > 0">
      <section
        v-for="group in groups"
        :key="group.module"
        class="mt-8"
        :aria-labelledby="`hub-${group.module.slice(0, 3)}`"
      >
        <h2 :id="`hub-${group.module.slice(0, 3)}`" class="text-lg font-semibold">
          {{ group.module }}
        </h2>
        <ul class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <li v-for="link in group.links" :key="link.path" class="min-w-0">
            <RouterLink
              :to="link.path"
              class="flex min-h-11 flex-col justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm hover:border-indigo-400 hover:shadow focus-visible:outline-2 focus-visible:outline-indigo-600"
            >
              <span class="font-semibold break-words">{{ link.label }}</span>
              <span class="text-xs break-all text-slate-500">{{ link.path }}</span>
            </RouterLink>
          </li>
        </ul>
      </section>
    </template>

    <div
      v-else
      class="mt-8 rounded-xl border border-slate-200 bg-white p-6"
      data-testid="hub-empty"
    >
      <p>Belum ada skrin siap untuk peranan ini.</p>
      <RouterLink
        to="/logout"
        class="mt-4 inline-flex min-h-11 items-center font-semibold text-indigo-600 underline"
        >Log keluar</RouterLink
      >
    </div>
  </div>
</template>
