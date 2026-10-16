<script setup lang="ts">
/**
 * Win screen body (design system 6, "Win screen"), in the approved order: 3D achievement hero,
 * title, score ring, friend dialog (slot), reward tiles, stickers, actions (slot). Confetti is not
 * part of this composite. The ring is lime when the score is at least 60% (`>= 3/5`), primary below.
 * All copy comes from the caller.
 */
import { computed, ref } from 'vue'

import type { Art3DName } from './assets'
import DsScoreRing from './DsScoreRing.vue'
import DsStatTile from './DsStatTile.vue'
import DsSticker from './DsSticker.vue'
import DsWinHero from './DsWinHero.vue'

export interface WinReward {
  id: string
  value: string | number
  /** Label under the number, e.g. "Mata". */
  unit: string
  art: Art3DName
}
export interface WinSticker {
  id: string
  text: string
  art?: Art3DName
}

const props = withDefaults(
  defineProps<{
    art: Art3DName
    title: string
    subtitle?: string
    score: number
    max: number
    /** Accessible name of the ring (BM), e.g. "Skor 5 daripada 5". */
    ringLabel: string
    /** Text under the ring number, e.g. "daripada 5". */
    ringUnit?: string
    rewards?: WinReward[]
    stickers?: WinSticker[]
  }>(),
  { subtitle: undefined, ringUnit: undefined, rewards: () => [], stickers: () => [] },
)

const strong = computed(() => props.max > 0 && props.score / props.max >= 0.6)
const hero = ref<{ focus: () => void } | null>(null)
defineExpose({ focus: () => hero.value?.focus() })
</script>

<template>
  <section class="flex flex-col items-center gap-4 text-center" data-ds="win-screen">
    <DsWinHero
      ref="hero"
      :art="art"
      :title="title"
      :subtitle="subtitle"
      :tone="strong ? 'win' : 'keep'"
    />
    <DsScoreRing
      :value="score"
      :max="max"
      size="lg"
      :tone="strong ? 'win' : 'action'"
      :label="ringLabel"
      :unit="ringUnit"
    />
    <div
      v-if="$slots.friend"
      class="flex w-full max-w-sm items-end gap-2.5 text-start"
      data-ds="win-friend"
    >
      <slot name="friend" />
    </div>
    <ul v-if="rewards.length" class="grid w-full max-w-xs grid-cols-2 gap-2.5">
      <li v-for="reward in rewards" :key="reward.id" class="min-w-0">
        <DsStatTile :value="reward.value" :unit="reward.unit" :art="reward.art" />
      </li>
    </ul>
    <ul v-if="stickers.length" class="flex flex-wrap justify-center gap-2">
      <li v-for="sticker in stickers" :key="sticker.id">
        <DsSticker :art="sticker.art">{{ sticker.text }}</DsSticker>
      </li>
    </ul>
    <div v-if="$slots.actions" class="flex w-full max-w-sm flex-col gap-2.5" data-ds="win-actions">
      <slot name="actions" />
    </div>
  </section>
</template>
