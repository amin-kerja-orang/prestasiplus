<script setup lang="ts">
/**
 * Applied-filter chips (design language 9.2): each chip shows the value and is removable, followed
 * by a "Set Semula" link. Renders nothing without chips. The URL stays the state; the caller removes
 * the query param on `remove` / `reset`. A long chip value truncates so the row never widens the
 * page (UAT T6 BUG-T6-01).
 */
import { dsCopy, fillCopy } from './copy'

withDefaults(
  defineProps<{
    chips: readonly { key: string; label: string }[]
    label?: string
    resetLabel?: string
  }>(),
  { label: dsCopy.filtersActive, resetLabel: dsCopy.filterReset },
)

const emit = defineEmits<{ remove: [key: string]; reset: [] }>()
</script>

<template>
  <div
    v-if="chips.length > 0"
    class="flex flex-wrap items-center gap-2"
    data-ds="active-filters"
    data-testid="active-filters"
  >
    <span class="text-caption text-muted">{{ label }}</span>
    <UButton
      v-for="c in chips"
      :key="c.key"
      type="button"
      color="neutral"
      variant="soft"
      class="min-h-11 max-w-full"
      :ui="{ label: 'truncate min-w-0' }"
      trailing-icon="i-ph-x"
      :label="c.label"
      :aria-label="fillCopy(dsCopy.filterRemove, { name: c.label })"
      data-testid="active-filter"
      @click="emit('remove', c.key)"
    />
    <UButton
      type="button"
      color="neutral"
      variant="link"
      class="min-h-11"
      :label="resetLabel"
      data-testid="active-filters-reset"
      @click="emit('reset')"
    />
  </div>
</template>
