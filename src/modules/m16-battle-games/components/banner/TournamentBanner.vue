<script setup lang="ts">
/**
 * S30 tournament banner (SRS M16 v1.6 §6.13, FR-M16-08..11; URS FN-M16-1.3.1 ... 1.3.5). Mounted by the
 * user shell as the first child of `<main>`; on mount it calls `GET /api/tournament/active` once (no
 * polling) and renders nothing while loading, on any failure, or with an empty list.
 *
 * A live match (red card, "LIVE: {a} vs {b}" + "MAIN") takes precedence over the status; otherwise a
 * `registration` item shows "Pendaftaran dibuka" + "DAFTAR" and any other item "Sedang berlangsung".
 * Several items stack in response order.
 */
import { Circle, RadioTower, Trophy } from '@lucide/vue'
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'

import { fetchActiveTournaments, type TournamentActive } from '../../api'

const items = ref<TournamentActive[]>([])

onMounted(async () => {
  // `fetchActiveTournaments` resolves to [] on any failure (§6.13).
  items.value = await fetchActiveTournaments()
})
</script>

<template>
  <div v-if="items.length > 0" class="mb-4" data-testid="tournament-banner">
    <RouterLink
      v-for="t in items"
      :key="t.uuid"
      :to="`/tournament/${t.uuid}`"
      class="mb-2 flex min-h-11 items-center gap-3 rounded-xl border p-4 shadow-sm hover:shadow-md"
      :class="
        t.live_match
          ? 'border-red-200 bg-linear-to-r from-red-50 to-orange-50'
          : 'border-indigo-200 bg-linear-to-r from-indigo-50 to-purple-50'
      "
      :data-testid="t.live_match ? 'tournament-banner-live' : 'tournament-banner-item'"
    >
      <span
        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
        :class="t.live_match ? 'bg-red-100 text-red-500' : 'bg-indigo-100 text-indigo-500'"
      >
        <RadioTower v-if="t.live_match" class="h-5 w-5" />
        <Trophy v-else class="h-5 w-5" />
      </span>
      <span class="min-w-0 flex-1">
        <span class="block truncate text-sm font-bold text-gray-800">{{ t.title }}</span>
        <span
          v-if="t.live_match"
          class="flex items-center gap-1.5 text-xs font-bold text-red-600"
          data-testid="tournament-banner-line"
        >
          <Circle class="h-1.5 w-1.5 shrink-0 animate-pulse fill-current" />
          <span class="min-w-0 break-words">
            LIVE: {{ t.live_match.school_a }} vs {{ t.live_match.school_b }}
          </span>
        </span>
        <span
          v-else-if="t.status === 'registration'"
          class="block text-xs text-gray-600"
          data-testid="tournament-banner-line"
        >
          Pendaftaran dibuka
        </span>
        <span v-else class="block text-xs text-gray-600" data-testid="tournament-banner-line">
          Sedang berlangsung
        </span>
      </span>
      <span
        v-if="t.live_match"
        class="shrink-0 animate-pulse rounded-lg bg-red-600 px-3 py-1 text-xs font-bold text-white"
      >
        MAIN
      </span>
      <span
        v-else-if="t.status === 'registration'"
        class="shrink-0 rounded-lg bg-indigo-600 px-3 py-1 text-xs font-bold text-white"
      >
        DAFTAR
      </span>
    </RouterLink>
  </div>
</template>
