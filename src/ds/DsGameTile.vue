<script setup lang="ts">
/**
 * Game hub tile: 3D art or glyph at 64px on a solid chip, the name, a mode chip and an optional
 * live badge. The whole tile is one button (target at least 56px).
 */
import type { Art3DName } from './assets'
import DsArt3D from './DsArt3D.vue'
import DsIconChip from './DsIconChip.vue'
import DsLiveBadge from './DsLiveBadge.vue'
import type { DsAccent } from './types'

withDefaults(
  defineProps<{
    name: string
    art?: Art3DName
    icon?: string
    accent?: DsAccent
    /** Mode chip text, e.g. "Berkumpulan". */
    mode?: string
    /** Live badge text; the badge shows when set. */
    liveLabel?: string
  }>(),
  { art: undefined, icon: 'i-ph-game-controller-duotone', accent: 'action', mode: undefined, liveLabel: undefined },
)

defineEmits<{ select: [] }>()
</script>

<template>
  <UButton
    type="button"
    color="neutral"
    variant="soft"
    class="h-auto min-h-16 w-full justify-start gap-3 rounded-card p-3 text-start"
    data-ds="game-tile"
    @click="$emit('select')"
  >
    <DsArt3D v-if="art" :name="art" size="lg" />
    <DsIconChip v-else :icon="icon" :accent="accent" size="lg" />
    <span class="flex min-w-0 grow flex-col gap-1">
      <span class="truncate text-label text-highlighted">{{ name }}</span>
      <span class="flex flex-wrap items-center gap-1">
        <UBadge v-if="mode" color="neutral" variant="outline" size="sm" :label="mode" />
        <DsLiveBadge v-if="liveLabel" :label="liveLabel" />
      </span>
    </span>
  </UButton>
</template>
