<script setup lang="ts">
/**
 * S30 tournament banner (SRS M16 v1.6 §6.13, FR-M16-08..11; URS FN-M16-1.3.1 ... 1.3.5). Mounted by the
 * user shell as the first child of `<main>`; on mount it calls `GET /api/tournament/active` once (no
 * polling) and renders nothing while loading, on any failure, or with an empty list.
 *
 * A live match (red-tinted card, "LIVE: {a} vs {b}" + "MAIN") takes precedence over the status;
 * otherwise a `registration` item shows "Pendaftaran dibuka" + "DAFTAR" and any other item "Sedang
 * berlangsung". Several items stack in response order.
 */
import { onMounted, ref } from 'vue'

import { DsIconChip, DsLiveBadge, DsPanel } from '@/ds'

import { fetchActiveTournaments, type TournamentActive } from '../../api'

const items = ref<TournamentActive[]>([])

onMounted(async () => {
  // `fetchActiveTournaments` resolves to [] on any failure (§6.13).
  items.value = await fetchActiveTournaments()
})
</script>

<template>
  <div v-if="items.length > 0" class="mb-4 flex flex-col gap-2" data-testid="tournament-banner">
    <ULink
      v-for="t in items"
      :key="t.uuid"
      :to="`/tournament/${t.uuid}`"
      class="block min-h-11 min-w-0"
      :data-testid="t.live_match ? 'tournament-banner-live' : 'tournament-banner-item'"
    >
      <DsPanel :tone="t.live_match ? 'tint' : 'raised'" class="flex items-center gap-3">
        <DsIconChip
          :icon="t.live_match ? 'broadcast' : 'trophy'"
          :accent="t.live_match ? 'heat' : 'trial'"
          size="lg"
        />
        <span class="flex min-w-0 flex-1 flex-col">
          <span class="text-label break-words text-highlighted">{{ t.title }}</span>
          <span
            v-if="t.live_match"
            class="text-caption break-words text-error"
            data-testid="tournament-banner-line"
          >
            LIVE: {{ t.live_match.school_a }} vs {{ t.live_match.school_b }}
          </span>
          <span
            v-else-if="t.status === 'registration'"
            class="text-caption text-muted"
            data-testid="tournament-banner-line"
          >
            Pendaftaran dibuka
          </span>
          <span v-else class="text-caption text-muted" data-testid="tournament-banner-line">
            Sedang berlangsung
          </span>
        </span>
        <DsLiveBadge v-if="t.live_match" label="MAIN" class="shrink-0" />
        <UBadge v-else-if="t.status === 'registration'" color="primary" variant="solid" class="shrink-0"
          >DAFTAR</UBadge
        >
      </DsPanel>
    </ULink>
  </div>
</template>
