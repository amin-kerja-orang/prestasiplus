<script setup lang="ts">
/**
 * Stat tile of S1, S2, S3 and the level screens: coloured icon chip + label on top, an accent number, an
 * optional small suffix and caption. Roomy: 24px padding, number in the title size.
 */
import { DsIconChip } from '@/ds'
import type { DsAccent } from '@/ds/types'

withDefaults(
  defineProps<{
    label: string
    value: string
    /** Muted suffix after the value ("/5", "/522"). */
    suffix?: string
    caption?: string
    /** A value that stands for "no data" (shown dimmed). */
    muted?: boolean
    icon?: string
    accent?: DsAccent
  }>(),
  {
    suffix: undefined,
    caption: undefined,
    muted: false,
    icon: 'i-ph-chart-bar',
    accent: 'action',
  },
)

/** Accent number colours as literals (token text colours). */
const NUMBER: Record<DsAccent, string> = {
  action: 'text-primary',
  win: 'text-success',
  heat: 'text-warning',
  friend: 'text-highlighted',
  trial: 'text-info',
}
</script>

<template>
  <UCard class="h-full min-w-0" data-testid="kirk-stat">
    <div class="flex min-w-0 flex-col gap-3">
      <div class="flex min-w-0 items-center gap-3">
        <DsIconChip :icon="icon" :accent="accent" size="sm" />
        <p class="min-w-0 text-body text-muted" data-testid="kirk-stat-label">{{ label }}</p>
      </div>
      <p :class="['tabular text-title', muted ? 'text-dimmed' : NUMBER[accent]]">
        <span data-testid="kirk-stat-value">{{ value }}</span
        ><span v-if="suffix" class="text-body text-muted" data-testid="kirk-stat-suffix">{{
          suffix
        }}</span>
      </p>
      <p v-if="caption" class="text-body text-muted" data-testid="kirk-stat-caption">
        {{ caption }}
      </p>
    </div>
  </UCard>
</template>
