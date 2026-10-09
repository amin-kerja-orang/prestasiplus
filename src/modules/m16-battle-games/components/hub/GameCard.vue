<script setup lang="ts">
/**
 * One S6 hub card (SRS M16 v1.6 FR-M16-52, FR-M16-53; URS FN-M16-4.1.3): the whole card is clickable
 * (live `onclick`), its button is a real link to the same route. A click on the button link is left to
 * the link (no double navigation). The "Belum ..." chips show only while the #22 chip flag is false
 * (DV-M16-14). Visual: a gradient banner with the banner emoji and the corner badge, then the title, text,
 * chips and a solid button in the card colour (live screenshots; colours in `HUB_THEME`).
 */
import { computed } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import { AppIcon } from '@/components/icon'

import type { GamesHub } from '../../api'
import { HUB_THEME, type HubCard } from './hub-cards'

const props = defineProps<{ card: HubCard; chips: GamesHub['chips'] }>()

const router = useRouter()

const theme = computed(
  () =>
    HUB_THEME[props.card.id] ?? {
      banner: 'from-violet-600 to-violet-300',
      button: 'bg-violet-600 hover:bg-violet-700',
    },
)

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
    class="relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg"
    :data-testid="`hub-card-${card.id}`"
    @click="go"
  >
    <div
      class="relative flex h-28 items-center justify-center bg-linear-to-br sm:h-24"
      :class="theme.banner"
      data-testid="hub-card-banner"
    >
      <span
        v-if="card.badge"
        class="absolute top-3 right-3 rounded-full px-2.5 py-0.5 text-xs font-bold shadow-sm"
        :class="card.badgeClass"
        data-testid="hub-card-badge"
        >{{ card.badge }}</span
      >
      <span class="text-5xl drop-shadow-md" data-testid="hub-card-emoji">{{ card.emoji }}</span>
    </div>
    <div class="flex flex-1 flex-col p-5">
      <h3 class="font-heading text-lg font-bold text-slate-800">{{ card.title }}</h3>
      <p class="mt-1 text-sm text-slate-500">{{ card.text }}</p>
      <div v-if="visibleChips.length > 0" class="mt-3 flex flex-wrap gap-2">
        <span
          v-for="chip in visibleChips"
          :key="chip.text"
          class="rounded-lg bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-500"
          data-testid="hub-card-chip"
          >{{ chip.text }}</span
        >
      </div>
      <div class="mt-auto pt-4">
        <RouterLink
          :to="card.to"
          class="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow transition hover:-translate-y-0.5"
          :class="theme.button"
          data-testid="hub-card-button"
        >
          <AppIcon :name="card.icon" class="h-4 w-4" :class="{ 'fill-current': theme.solid }" />
          {{ card.button }}
        </RouterLink>
      </div>
    </div>
  </div>
</template>
