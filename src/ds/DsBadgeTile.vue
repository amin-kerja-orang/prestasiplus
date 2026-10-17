<script setup lang="ts">
/**
 * Achievement tile. `earned`: 3D medal, title and date. `locked`: duotone glyph on `bg-elevated`
 * plus the word "Terkunci". `progress`: glyph plus a progress bar. `isNew` adds the "BARU" chip.
 * State is always carried by a word as well as the visual.
 */
import type { Art3DName } from './assets'
import DsArt3D from './DsArt3D.vue'

type BadgeState = 'earned' | 'locked' | 'progress'

withDefaults(
  defineProps<{
    state?: BadgeState
    title: string
    /** Earned date (BM text from the caller). */
    date?: string
    art?: Art3DName
    /** Glyph for locked / progress (Phosphor duotone class). */
    icon?: string
    /** 0-100 for `progress`. */
    progress?: number
    isNew?: boolean
    newLabel?: string
    lockedLabel?: string
    progressLabel?: string
  }>(),
  {
    state: 'earned',
    date: undefined,
    art: 'trophy',
    icon: 'i-ph-medal-duotone',
    progress: 0,
    isNew: false,
    newLabel: 'BARU',
    lockedLabel: 'Terkunci',
    progressLabel: 'Kemajuan',
  },
)
</script>

<template>
  <UCard class="relative h-full" :data-state="state" data-ds="badge-tile">
    <div class="flex flex-col items-center gap-2 text-center">
      <UBadge
        v-if="isNew"
        class="absolute end-2 top-2"
        color="primary"
        variant="solid"
        size="sm"
        :label="newLabel"
        data-ds="badge-new"
      />
      <DsArt3D v-if="state === 'earned'" :name="art" size="xl" />
      <span v-else class="grid size-19 place-items-center rounded-full bg-elevated text-muted" aria-hidden="true">
        <UIcon :name="icon" class="size-10" />
      </span>
      <h3 class="text-label text-highlighted">{{ title }}</h3>
      <p v-if="state === 'earned' && date" class="text-caption text-muted">{{ date }}</p>
      <p v-else-if="state === 'locked'" class="flex items-center gap-1 text-caption text-muted">
        <UIcon name="i-ph-lock-simple" class="size-4" aria-hidden="true" />{{ lockedLabel }}
      </p>
      <UProgress
        v-else-if="state === 'progress'"
        class="w-full"
        size="sm"
        :model-value="progress"
        :aria-label="`${progressLabel} ${title}`"
      />
    </div>
  </UCard>
</template>
