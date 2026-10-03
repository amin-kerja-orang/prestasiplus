<script setup lang="ts">
/**
 * S14 podium (FR-M14-40, FN-M14-5.1.2): three narrow cards in the order silver, gold (raised),
 * bronze. The cards share the row width and never push the page wider (DV-M14-07, 320–1280).
 */
import { computed } from 'vue'

import { formatNumber } from '@/lib/number'

import type { PodiumEntry } from '../../api'
import { LEADERBOARD_COPY, PODIUM_CARD_CLASS, podiumSlots } from '../../lib/student/leaderboard-lib'

const props = defineProps<{ podium: readonly PodiumEntry[] }>()

const slots = computed(() => podiumSlots(props.podium))
</script>

<template>
  <div class="flex items-end justify-center gap-2 sm:gap-4" data-testid="lb-podium">
    <div
      v-for="slot in slots"
      :key="slot.entry.rank"
      :class="[
        'lb-top-card flex max-w-40 min-w-0 flex-1 flex-col items-center rounded-2xl px-2 pb-4 text-center shadow-sm',
        slot.raised ? 'pt-6' : 'pt-4',
        PODIUM_CARD_CLASS[slot.entry.rank],
      ]"
      :data-rank="slot.entry.rank"
      data-testid="lb-podium-card"
    >
      <div class="text-2xl" aria-hidden="true">{{ slot.medal }}</div>
      <div
        class="mt-2 flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-white bg-white font-heading text-lg font-bold text-indigo-600"
        data-testid="lb-podium-avatar"
      >
        {{ slot.entry.initials }}
      </div>
      <div
        class="mt-2 w-full text-sm font-bold wrap-anywhere text-slate-800"
        data-testid="lb-podium-name"
      >
        {{ slot.entry.name }}
      </div>
      <div class="mt-0.5 text-xs wrap-anywhere text-slate-500" data-testid="lb-podium-score">
        {{ formatNumber(slot.entry.totalSyilingEarned) }} {{ LEADERBOARD_COPY.syiling }}
      </div>
      <div
        class="mt-1 flex items-center gap-1 text-xs font-medium text-slate-700"
        data-testid="lb-podium-tier"
      >
        <span aria-hidden="true">{{ slot.entry.tier.icon }}</span>
        <span>{{ slot.entry.tier.labelMs }}</span>
      </div>
    </div>
  </div>
</template>
