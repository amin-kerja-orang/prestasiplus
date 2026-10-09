<script setup lang="ts">
/**
 * One S6 hub card (SRS M16 v1.6 FR-M16-52, FR-M16-53; URS FN-M16-4.1.3): the whole card is clickable
 * (live `onclick`), its button is a real link to the same route. A click on the button link is left to
 * the link (no double navigation). The "Belum ..." chips show only while the #22 chip flag is false
 * (DV-M16-14).
 */
import { computed } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import { AppIcon } from '@/components/icon'

import type { GamesHub } from '../../api'
import type { HubCard } from './hub-cards'

const props = defineProps<{ card: HubCard; chips: GamesHub['chips'] }>()

const router = useRouter()

const visibleChips = computed(() =>
  props.card.chips.filter((c) => c.unlessFlag === undefined || !props.chips[c.unlessFlag]),
)

function go(e: MouseEvent): void {
  if ((e.target as HTMLElement | null)?.closest('a')) return
  void router.push(props.card.to)
}
</script>

<template>
  <div
    class="relative flex cursor-pointer flex-col rounded-2xl bg-white p-5 shadow transition hover:-translate-y-0.5 hover:shadow-md"
    :data-testid="`hub-card-${card.id}`"
    @click="go"
  >
    <span
      v-if="card.badge"
      class="absolute top-3 right-3 rounded-full px-2.5 py-0.5 text-xs font-bold"
      :class="card.badgeClass"
      data-testid="hub-card-badge"
      >{{ card.badge }}</span
    >
    <div class="text-4xl" data-testid="hub-card-emoji">{{ card.emoji }}</div>
    <h3 class="font-heading mt-2 text-lg font-bold text-slate-800">{{ card.title }}</h3>
    <p class="mt-1 text-sm text-slate-500">{{ card.text }}</p>
    <div v-if="visibleChips.length > 0" class="mt-3 flex flex-wrap gap-2">
      <span
        v-for="chip in visibleChips"
        :key="chip.text"
        class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600"
        data-testid="hub-card-chip"
        >{{ chip.text }}</span
      >
    </div>
    <div class="mt-auto pt-4">
      <RouterLink
        :to="card.to"
        class="bg-primary-gradient inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition hover:-translate-y-0.5"
        data-testid="hub-card-button"
      >
        <AppIcon :name="card.icon" class="h-4 w-4" />
        {{ card.button }}
      </RouterLink>
    </div>
  </div>
</template>
