<script setup lang="ts">
/**
 * S15 badge card (FR-M14-47, FN-M14-6.1.4): icon, name, description, rarity tag (upper case by CSS),
 * reward line "🪙 {syiling} · ⭐ {xp} XP" and, for the five kuiz-count badges, a progress bar with
 * "{n}/{target}". A locked card is greyed with the rarity colour kept in `--rarity-color`; an
 * unlocked card (PROPOSED styling, FN-M14-6.1.5) is full colour, `cursor-pointer`, bordered in the
 * rarity colour, and emits `open` on click. No ARIA beyond live (D10).
 */
import { computed } from 'vue'

import type { AchievementItem } from '../../api'
import { progressPct } from '../../lib/student/achievements-lib'

const props = defineProps<{ item: AchievementItem }>()
const emit = defineEmits<{ open: [item: AchievementItem] }>()

const pct = computed(() => (props.item.progress ? progressPct(props.item.progress) : 0))

function onClick(): void {
  if (props.item.unlocked) emit('open', props.item)
}
</script>

<template>
  <div
    :class="[
      'badge-card flex min-w-0 flex-col items-center rounded-2xl border-2 bg-white p-3 text-center shadow-sm sm:p-4',
      item.unlocked
        ? 'cursor-pointer border-(--rarity-color)'
        : 'locked border-transparent opacity-60 grayscale',
    ]"
    :style="{ '--rarity-color': item.rarityColor }"
    :data-locked="item.unlocked ? 'false' : 'true'"
    data-testid="badge-card"
    @click="onClick"
  >
    <div class="text-4xl" data-testid="badge-icon">{{ item.icon }}</div>
    <div
      class="badge-name mt-2 text-sm font-bold wrap-anywhere text-slate-700"
      data-testid="badge-name"
    >
      {{ item.name }}
    </div>
    <div class="badge-desc mt-1 text-xs wrap-anywhere text-slate-500" data-testid="badge-desc">
      {{ item.description }}
    </div>
    <span
      class="rarity-tag mt-2 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500 uppercase"
      :style="{ color: item.rarityColor }"
      data-testid="badge-rarity"
      >{{ item.rarityLabel }}</span
    >
    <div class="badge-reward mt-2 text-xs font-medium text-slate-600" data-testid="badge-reward">
      🪙 {{ item.rewardSyiling }} · ⭐ {{ item.rewardXp }} XP
    </div>
    <div v-if="item.progress" class="mt-2 w-full" data-testid="badge-progress">
      <div class="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
        <div class="h-full rounded-full bg-violet-500" :style="{ width: `${String(pct)}%` }"></div>
      </div>
      <div class="mt-1 text-xs text-slate-500" data-testid="badge-progress-text">
        {{ item.progress.value }}/{{ item.progress.target }}
      </div>
    </div>
  </div>
</template>
