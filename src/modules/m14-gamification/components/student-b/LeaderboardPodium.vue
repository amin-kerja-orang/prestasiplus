<script setup lang="ts">
/**
 * S14 podium (FR-M14-40, FN-M14-5.1.2): three narrow cards in the order silver, gold (raised),
 * bronze. The cards share the row width and never push the page wider (DV-M14-07, 320–1280).
 * v2: the gold card carries the 3D trophy.
 */
import { computed } from 'vue'

import { DsArt3D } from '@/ds'
import { formatNumber } from '@/lib/number'

import type { PodiumEntry } from '../../api'
import { LEADERBOARD_COPY, leaderboardKey, podiumSlots } from '../../lib/student/leaderboard-lib'

const props = defineProps<{ podium: readonly PodiumEntry[] }>()

const slots = computed(() => podiumSlots(props.podium))
</script>

<template>
  <div class="grid grid-cols-3 items-end gap-2 sm:gap-4" data-testid="lb-podium">
    <UCard
      v-for="(slot, i) in slots"
      :key="leaderboardKey(slot.entry, i)"
      class="min-w-0"
      :class="slot.raised ? 'bg-highlight-soft' : ''"
      :data-rank="slot.entry.rank"
      data-testid="lb-podium-card"
    >
      <div class="flex flex-col items-center gap-1 text-center">
        <DsArt3D v-if="slot.raised" name="trophy" size="lg" float />
        <span v-else class="text-title" aria-hidden="true">{{ slot.medal }}</span>
        <UAvatar :text="slot.entry.initials" size="xl" data-testid="lb-podium-avatar" />
        <div class="w-full text-label break-words text-highlighted" data-testid="lb-podium-name">
          {{ slot.entry.name }}
        </div>
        <div class="text-caption break-words text-muted" data-testid="lb-podium-score">
          {{ formatNumber(slot.entry.totalSyilingEarned) }} {{ LEADERBOARD_COPY.syiling }}
        </div>
        <div class="flex items-center gap-1 text-caption text-toned" data-testid="lb-podium-tier">
          <span aria-hidden="true">{{ slot.entry.tier.icon }}</span>
          <span>{{ slot.entry.tier.labelMs }}</span>
        </div>
      </div>
    </UCard>
  </div>
</template>
