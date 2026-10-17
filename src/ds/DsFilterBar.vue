<script setup lang="ts">
/**
 * Filter bar (restyle spec 1.3). From `md` the fields sit inline (staff: inside one raised card;
 * learner: directly on the page). Below `md` the `search` slot stays inline and the other fields
 * move into a bottom-sheet `UDrawer` behind a "Penapis" button with an active-count chip.
 * Callers own the fields (and bind them to query params); the bar emits `apply` and `reset`.
 */
import { ref } from 'vue'

import { usePersonality } from './personality'
import { useMedia } from './useMedia'

const props = withDefaults(
  defineProps<{
    /** Number of active filters (chip on the mobile button). */
    activeCount?: number
    applyLabel?: string
    resetLabel?: string
    filterLabel?: string
    sheetApplyLabel?: string
    sheetTitle?: string
  }>(),
  {
    activeCount: 0,
    applyLabel: 'Cari',
    resetLabel: 'Set Semula',
    filterLabel: 'Penapis',
    sheetApplyLabel: 'Guna',
    sheetTitle: 'Penapis',
  },
)

const emit = defineEmits<{ apply: []; reset: [] }>()

const personality = usePersonality()
const wide = useMedia('(min-width: 768px)')
const sheet = ref(false)

function apply(): void {
  sheet.value = false
  emit('apply')
}
function reset(): void {
  emit('reset')
}
</script>

<template>
  <form
    class="flex flex-wrap items-end gap-3 learner:gap-2"
    :class="personality === 'staff' ? 'rounded-card bg-default p-3 shadow-card sm:p-4' : ''"
    role="search"
    data-ds="filter-bar"
    @submit.prevent="apply"
  >
    <template v-if="wide">
      <slot name="search" />
      <slot />
      <div class="flex flex-wrap items-center gap-2">
        <UButton type="submit" :label="props.applyLabel" />
        <UButton
          type="button"
          color="neutral"
          variant="ghost"
          :label="props.resetLabel"
          @click="reset"
        />
        <slot name="actions" />
      </div>
    </template>
    <template v-else>
      <div class="min-w-0 grow"><slot name="search" /></div>
      <UChip :show="props.activeCount > 0" :text="props.activeCount" color="primary">
        <UButton
          type="button"
          color="neutral"
          variant="soft"
          icon="i-ph-funnel"
          :label="props.filterLabel"
          data-ds="filter-open"
          @click="sheet = true"
        />
      </UChip>
      <UDrawer v-model:open="sheet" :title="props.sheetTitle" description=" ">
        <template #body>
          <div class="flex max-h-dvh flex-col gap-3 overflow-y-auto" data-ds="filter-sheet">
            <slot />
            <UButton type="button" block :label="props.sheetApplyLabel" @click="apply" />
            <UButton
              type="button"
              block
              color="neutral"
              variant="ghost"
              :label="props.resetLabel"
              @click="reset"
            />
          </div>
        </template>
      </UDrawer>
    </template>
  </form>
</template>
