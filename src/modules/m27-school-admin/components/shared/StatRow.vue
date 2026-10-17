<script setup lang="ts">
/**
 * Row of stat tiles of the M27 report screens (restyle spec AS-2, AS-46, AS-48, AS-49, AS-50): a `UCard`
 * per tile with a tinted icon chip, the label, the figure and an optional sub-line. 2 across at 375, 3 or
 * 4 from 768. Test ids are `<prefix>-<key>` with `<prefix>-label|value|sub|pct|of|note` inside.
 */
import { DsIconChip, type DsAccent } from '@/ds'

export interface StatItem {
  key: string
  label: string
  value: string
  /** Phosphor icon class, spelled out by the caller. */
  icon: string
  accent?: DsAccent
  sub?: string
  /** Meaning colour of the figure (risk counts); the figure stays neutral without it. */
  tone?: 'success' | 'warning' | 'error'
}

withDefaults(
  defineProps<{ items: readonly StatItem[]; prefix: string; navId: string; partPrefix?: string }>(),
  { partPrefix: undefined },
)
</script>

<template>
  <ul
    class="grid min-w-0 grid-cols-2 gap-3 md:grid-cols-4"
   
    :data-testid="navId"
  >
    <li v-for="item in items" :key="item.key" class="min-w-0">
      <UCard
        class="h-full"
        :ui="{ body: 'flex min-w-0 flex-col items-start gap-2 p-3 sm:p-4' }"
        :data-testid="`${prefix}-${item.key}`"
      >
        <DsIconChip :icon="item.icon" :accent="item.accent ?? 'action'" />
        <p class="text-caption break-words text-muted" :data-testid="`${partPrefix ?? prefix}-label`">
          {{ item.label }}
        </p>
        <p
          class="tabular text-heading break-words"
          :class="
            item.tone === 'success'
              ? 'text-success'
              : item.tone === 'warning'
                ? 'text-warning'
                : item.tone === 'error'
                  ? 'text-error'
                  : 'text-highlighted'
          "
          :data-testid="`${partPrefix ?? prefix}-value`"
        >
          {{ item.value }}
        </p>
        <p v-if="item.sub" class="text-caption text-muted" :data-testid="`${partPrefix ?? prefix}-sub`">
          {{ item.sub }}
        </p>
      </UCard>
    </li>
  </ul>
</template>
