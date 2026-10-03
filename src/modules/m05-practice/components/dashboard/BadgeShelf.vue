<script setup lang="ts">
/**
 * FR-M05-16: the recent-badges shelf. The empty state is the live copy; the populated layout (a row
 * of badge emoji + name cards) is PROPOSED (SRS §8.3, LS-9), the data is M14's `learnerBadges`.
 */
import type { DashboardBadge } from '../../api/types'

defineProps<{ badges: DashboardBadge[] }>()
</script>

<template>
  <div v-if="badges.length === 0" class="empty-state" data-testid="dash-badges-empty">
    <div class="icon-sparkle mb-5 text-7xl opacity-70 md:text-8xl">🏆</div>
    <p
      class="mb-3 text-xl font-black text-slate-800 md:text-2xl"
      style="font-family: 'Outfit', sans-serif"
    >
      Belum Ada Lencana Lagi!
    </p>
    <p class="text-base font-semibold text-slate-600 md:text-lg">
      Jom kumpul lencana pertama dengan menjawab soalan! 🚀
    </p>
  </div>
  <div v-else class="card" data-testid="dash-badges">
    <div class="scrollbar-hide flex gap-5 overflow-x-auto pb-3">
      <div
        v-for="b in badges"
        :key="b.id"
        class="badge-card flex-shrink-0"
        data-testid="dash-badge"
      >
        <div class="badge-icon-wrapper border-amber-300 bg-amber-50">{{ b.icon }}</div>
        <p class="text-sm font-black text-slate-700" style="font-family: 'Outfit', sans-serif">
          {{ b.name }}
        </p>
      </div>
    </div>
  </div>
</template>
