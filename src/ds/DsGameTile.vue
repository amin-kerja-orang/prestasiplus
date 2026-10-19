<script setup lang="ts">
/**
 * Game hub tile: 3D art or glyph at 64px on a solid chip, the name, a mode chip and an optional
 * live badge. The whole tile is one button (target at least 56px). States: hover, focus-visible
 * and pressed (UButton), `disabled`, `loading` (the action behind the tile is pending).
 */
import type { Art3DName } from './assets'
import DsArt3D from './DsArt3D.vue'
import DsIconChip from './DsIconChip.vue'
import DsLiveBadge from './DsLiveBadge.vue'
import type { DsAccent, DsIconProp } from './types'

withDefaults(
  defineProps<{
    name: string
    art?: Art3DName
    /** Phosphor base name; the weight follows the personality. */
    icon?: DsIconProp
    accent?: DsAccent
    /** Mode chip text, e.g. "Berkumpulan". */
    mode?: string
    /** Live badge text; the badge shows when set. */
    liveLabel?: string
    disabled?: boolean
    loading?: boolean
  }>(),
  {
    art: undefined,
    icon: 'game-controller',
    accent: 'action',
    mode: undefined,
    liveLabel: undefined,
    disabled: false,
    loading: false,
  },
)

defineEmits<{ select: [] }>()
</script>

<template>
  <UButton
    type="button"
    color="neutral"
    variant="soft"
    class="h-auto min-h-16 w-full justify-start gap-3 rounded-card p-3 text-start"
    :disabled="disabled"
    :loading="loading"
    :aria-busy="loading ? 'true' : undefined"
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
