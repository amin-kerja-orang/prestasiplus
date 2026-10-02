<script setup lang="ts">
/**
 * S1 card "Ibu Bapa Dihubungkan" (L45 FR-L45-14..16). One row per linked parent: icon tile (never an
 * image, D22), name and email, both truncated. No relationship chip (DV-L45-02) and no remove control
 * (BR-L45-09). Empty state with plain emoji text.
 */
import { User, Users } from '@lucide/vue'

import type { LinkedParent } from '../../api/parent-invite'

defineProps<{ parents: readonly LinkedParent[] }>()
</script>

<template>
  <section
    class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
    data-testid="jemput-parents-card"
  >
    <h2 class="flex items-center gap-2 font-heading text-lg font-bold text-slate-900">
      <Users class="h-5 w-5 text-pink-500" />
      Ibu Bapa Dihubungkan
    </h2>

    <ul v-if="parents.length > 0" class="mt-4" data-testid="jemput-parents">
      <li
        v-for="parent in parents"
        :key="parent.id"
        class="flex items-center gap-3 border-b border-slate-100 py-3 first:pt-0 last:border-b-0 last:pb-0"
        data-testid="jemput-parent"
      >
        <span
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pink-100 text-pink-600"
        >
          <User class="h-5 w-5" />
        </span>
        <div class="min-w-0 flex-1">
          <p class="truncate font-semibold text-slate-900" data-testid="jemput-parent-name">
            {{ parent.name }}
          </p>
          <p class="truncate text-sm text-slate-500" data-testid="jemput-parent-email">
            {{ parent.email }}
          </p>
        </div>
      </li>
    </ul>

    <div v-else class="py-6 text-center" data-testid="jemput-empty">
      <div class="text-4xl leading-none">👨‍👩‍👧</div>
      <p class="mt-3 font-semibold text-slate-700">Belum ada ibu bapa dihubungkan</p>
      <p class="mt-1 text-sm text-slate-500">Hantar link jemputan di atas</p>
    </div>
  </section>
</template>
