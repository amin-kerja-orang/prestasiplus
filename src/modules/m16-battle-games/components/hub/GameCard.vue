<script setup lang="ts">
/**
 * One S6 hub card (SRS M16 v1.6 FR-M16-52, FR-M16-53; URS FN-M16-4.1.3): the whole card is clickable
 * (live `onclick`), its button is a real link to the same route. A click on the button link is left to
 * the link (no double navigation). The "Belum ..." chips show only while the #22 chip flag is false
 * (DV-M16-14). v2 learner look: 3D art, the corner badge, title, text, chips and an A1 button.
 */
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import { DsArt3D } from '@/ds'

import type { GamesHub } from '../../api'
import type { HubCard } from './hub-cards'
import { HUB_ART } from './hub-art'

const props = defineProps<{ card: HubCard; chips: GamesHub['chips'] }>()

const router = useRouter()

const art = computed(() => HUB_ART[props.card.id] ?? 'rocket')
const badgeColor = computed(() => {
  const b = props.card.badge ?? ''
  if (b.includes('HOT')) return 'error' as const
  if (b.includes('MULTIPLAYER')) return 'primary' as const
  return 'warning' as const
})

const visibleChips = computed(() =>
  props.card.chips.filter((c) => c.unlessFlag === undefined || !props.chips[c.unlessFlag]),
)

function go(e: MouseEvent): void {
  if ((e.target as HTMLElement | null)?.closest('a')) return
  void router.push(props.card.to)
}
</script>

<template>
  <UCard
    class="h-full cursor-pointer"
    :ui="{ root: 'h-full', body: 'flex h-full flex-col gap-3 p-4 sm:p-4' }"
    :data-testid="`hub-card-${card.id}`"
    @click="go"
  >
    <div class="flex items-start justify-between gap-3" data-testid="hub-card-banner">
      <DsArt3D :name="art" size="xl" float data-testid="hub-card-emoji" />
      <UBadge
        v-if="card.badge"
        :color="badgeColor"
        variant="soft"
        size="md"
        data-testid="hub-card-badge"
        >{{ card.badge }}</UBadge
      >
    </div>
    <h3 class="text-subheading text-highlighted">{{ card.title }}</h3>
    <p class="text-body text-muted">{{ card.text }}</p>
    <div v-if="visibleChips.length > 0" class="flex flex-wrap gap-2">
      <UBadge
        v-for="chip in visibleChips"
        :key="chip.text"
        color="neutral"
        variant="soft"
        size="md"
        data-testid="hub-card-chip"
        >{{ chip.text }}</UBadge
      >
    </div>
    <div class="mt-auto pt-2">
      <UButton
        :to="card.to"
        size="xl"
        color="primary"
        variant="solid"
        trailing-icon="i-ph-arrow-right-bold"
        class="min-h-12 w-full justify-center"
        data-testid="hub-card-button"
      >
        {{ card.button }}
      </UButton>
    </div>
  </UCard>
</template>
