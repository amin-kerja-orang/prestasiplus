<script setup lang="ts">
/**
 * One S11 stat card: 3D reward art or accent chip, display numeral, label, a note line and an
 * optional progress bar. Mirrors `DsStatTile` and adds the note and bar the dashboard needs.
 */
import { DsArt3D, DsIconChip, type Art3DName, type DsAccent } from '@/ds'

withDefaults(
  defineProps<{
    value: string | number
    label: string
    note: string
    art?: Art3DName
    icon?: string
    accent?: DsAccent
    /** 0-100; omit for no bar. */
    progress?: number
    valueTestid: string
    noteTestid: string
    barTestid?: string
  }>(),
  { art: undefined, icon: undefined, accent: 'action', progress: undefined, barTestid: undefined },
)
</script>

<template>
  <div
    class="flex min-w-0 flex-col items-start gap-2 rounded-card bg-default px-3 pt-4 pb-3 shadow-ds-xs learner:shadow-lift"
  >
    <DsArt3D v-if="art" :name="art" size="md" />
    <DsIconChip v-else-if="icon" :icon="icon" :accent="accent" />
    <span
      class="tabular font-display text-heading font-extrabold text-highlighted"
      :data-testid="valueTestid"
      >{{ value }}</span
    >
    <span class="-mt-1 text-caption font-semibold text-muted">{{ label }}</span>
    <span class="text-caption font-semibold text-toned" :data-testid="noteTestid">{{ note }}</span>
    <UProgress
      v-if="progress !== undefined"
      :model-value="progress"
      :max="100"
      size="sm"
      :aria-label="label"
      :data-value="progress"
      :data-testid="barTestid"
    />
  </div>
</template>
