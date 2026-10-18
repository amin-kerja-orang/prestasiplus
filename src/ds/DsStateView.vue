<script setup lang="ts">
/**
 * One component per page region for loading / error / empty / ready (v2-ds-hardening 3.9). Replaces
 * the hand-built `v-if loading / v-else-if error / v-else-if empty` chains, so the four states have
 * the same anatomy everywhere. Slots: default (ready), `skeleton` (override), `empty-actions`.
 */
import { computed } from 'vue'

import { dsCopy } from './copy'
import DsEmptyState from './DsEmptyState.vue'
import DsLoadError from './DsLoadError.vue'
import type { DsIconName } from './types'

const props = withDefaults(
  defineProps<{
    status: 'loading' | 'error' | 'empty' | 'ready'
    error?: string
    retryLabel?: string
    filtered?: boolean
    item?: string
    skeleton?: 'list' | 'cards' | 'table' | 'stats' | 'text' | 'chart' | 'none'
    rows?: number
    size?: 'sm' | 'md'
    emptyIcon?: DsIconName
  }>(),
  {
    error: undefined,
    retryLabel: dsCopy.retry,
    filtered: false,
    item: undefined,
    skeleton: 'list',
    rows: 5,
    size: 'md',
    emptyIcon: undefined,
  },
)

const emit = defineEmits<{ retry: []; reset: [] }>()

const rowCount = computed(() => Math.max(1, Math.floor(props.rows)))
const rowsList = computed(() => Array.from({ length: rowCount.value }, (_, i) => i))
</script>

<template>
  <div
    v-if="status === 'loading'"
    class="min-w-0"
    role="status"
    aria-busy="true"
    :aria-label="dsCopy.loading"
    data-ds="state-view"
    data-state="loading"
  >
    <slot name="skeleton">
      <div v-if="skeleton === 'cards'" class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <USkeleton v-for="i in rowsList" :key="i" class="h-32 rounded-card" />
      </div>
      <div v-else-if="skeleton === 'stats'" class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <USkeleton v-for="i in rowsList" :key="i" class="h-24 rounded-card" />
      </div>
      <div v-else-if="skeleton === 'table'" class="flex flex-col gap-2">
        <USkeleton class="h-10 w-full rounded-chip" />
        <USkeleton v-for="i in rowsList" :key="i" class="h-12 w-full rounded-chip" />
      </div>
      <USkeleton v-else-if="skeleton === 'chart'" class="h-64 w-full rounded-card" />
      <div v-else-if="skeleton === 'text'" class="flex flex-col gap-2">
        <USkeleton v-for="i in rowsList" :key="i" class="h-4 w-full" />
      </div>
      <div v-else-if="skeleton === 'list'" class="flex flex-col gap-3">
        <USkeleton v-for="i in rowsList" :key="i" class="h-14 w-full rounded-chip" />
      </div>
    </slot>
  </div>
  <DsLoadError
    v-else-if="status === 'error'"
    :message="error"
    :retry-label="retryLabel"
    :inline="size === 'sm'"
    data-ds="state-view"
    data-state="error"
    @retry="emit('retry')"
  />
  <DsEmptyState
    v-else-if="status === 'empty'"
    :filtered="filtered"
    :item="item"
    :size="size"
    :icon="emptyIcon"
    data-ds="state-view"
    data-state="empty"
    @reset="emit('reset')"
  >
    <template v-if="$slots['empty-actions']" #actions>
      <slot name="empty-actions" />
    </template>
  </DsEmptyState>
  <slot v-else />
</template>
