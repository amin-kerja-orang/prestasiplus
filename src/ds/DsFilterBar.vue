<script setup lang="ts">
/**
 * Filter bar (restyle spec 1.3, design language 9.2). From `md` the fields sit inline (staff: inside
 * one raised card; learner: directly on the page) and the `more` slot opens in a "Lagi Penapis"
 * popover. Below `md` the `search` slot stays inline and the other fields (default and `more`) move
 * into a bottom-sheet `UDrawer` behind a "Penapis" button with an active-count chip. Applied filters
 * can be passed as `chips` and show under the bar. Callers own the fields (and bind them to query
 * params); the bar emits `apply`, `reset` and `remove-chip`.
 */
import { computed, ref } from 'vue'

import { dsCopy } from './copy'
import { warnDeprecated } from './deprecate'
import DsActiveFilters from './DsActiveFilters.vue'
import { usePersonality } from './personality'
import { useMedia } from './useMedia'

const props = withDefaults(
  defineProps<{
    /** Number of active filters (chip on the mobile button). */
    activeCount?: number
    /** Applied filters, shown as removable chips under the bar. */
    chips?: { key: string; label: string }[]
    /** Count badge on the "Lagi Penapis" button. */
    moreCount?: number
    /** `panel` = own raised card (staff default); `plain` = on the page (learner default). */
    surface?: 'panel' | 'plain'
    /** @deprecated use `surface`. */
    tone?: 'panel' | 'plain'
    /**
     * Reset button. `auto` shows it when a filter is active; when the caller passes neither
     * `activeCount` nor `chips` it stays visible (older callers).
     */
    showReset?: 'auto' | boolean
    loading?: boolean
    applyLabel?: string
    resetLabel?: string
    filterLabel?: string
    moreLabel?: string
    sheetApplyLabel?: string
    sheetTitle?: string
  }>(),
  {
    activeCount: undefined,
    chips: undefined,
    moreCount: 0,
    surface: undefined,
    tone: undefined,
    showReset: 'auto',
    loading: false,
    applyLabel: dsCopy.filterSearch,
    resetLabel: dsCopy.filterReset,
    filterLabel: dsCopy.filterOpen,
    moreLabel: dsCopy.filterMore,
    sheetApplyLabel: dsCopy.filterSheetApply,
    sheetTitle: dsCopy.filterSheetTitle,
  },
)

const emit = defineEmits<{ apply: []; reset: []; 'remove-chip': [key: string] }>()

const personality = usePersonality()
const wide = useMedia('(min-width: 768px)')
const sheet = ref(false)

if (props.tone) warnDeprecated('DsFilterBar', 'tone', 'surface')
const panel = computed(
  () => (props.surface ?? props.tone ?? (personality.value === 'staff' ? 'panel' : 'plain')) === 'panel',
)
const count = computed(() => props.activeCount ?? props.chips?.length ?? 0)
const resetVisible = computed(() => {
  if (props.showReset !== 'auto') return props.showReset
  return props.activeCount === undefined && props.chips === undefined ? true : count.value > 0
})

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
    class="flex flex-wrap items-end gap-x-3 gap-y-3 learner:gap-2"
    :class="panel ? 'rounded-card bg-default p-3 shadow-card sm:p-4' : ''"
    role="search"
    data-ds="filter-bar"
    @submit.prevent="apply"
  >
    <template v-if="wide">
      <slot name="search" />
      <slot />
      <UPopover v-if="$slots.more" :content="{ align: 'start' }">
        <UChip :show="moreCount > 0" :text="moreCount" color="primary">
          <UButton
            type="button"
            color="neutral"
            variant="soft"
            class="min-h-11"
            icon="i-ph-funnel"
            trailing-icon="i-ph-caret-down"
            :label="moreLabel"
            data-ds="filter-more"
          />
        </UChip>
        <template #content>
          <div class="flex w-80 max-w-dvw flex-col gap-3 p-4" data-ds="filter-more-panel">
            <slot name="more" />
          </div>
        </template>
      </UPopover>
      <div class="flex shrink-0 items-center gap-2">
        <UButton type="submit" class="min-h-11" :label="applyLabel" :loading="loading" />
        <UButton
          v-if="resetVisible"
          type="button"
          color="neutral"
          variant="link"
          class="min-h-11"
          :label="resetLabel"
          @click="reset"
        />
        <slot name="actions" />
      </div>
    </template>
    <template v-else>
      <div class="min-w-0 grow"><slot name="search" /></div>
      <UChip :show="count > 0" :text="count" color="primary">
        <UButton
          type="button"
          color="neutral"
          variant="soft"
          class="min-h-11"
          icon="i-ph-funnel"
          :label="filterLabel"
          data-ds="filter-open"
          @click="sheet = true"
        />
      </UChip>
      <UDrawer v-model:open="sheet" :title="sheetTitle" description=" ">
        <template #body>
          <div class="flex max-h-dvh flex-col gap-3 overflow-y-auto" data-ds="filter-sheet">
            <slot />
            <slot name="more" />
            <UButton
              type="button"
              block
              class="min-h-11"
              :label="sheetApplyLabel"
              :loading="loading"
              @click="apply"
            />
            <UButton
              v-if="resetVisible"
              type="button"
              block
              color="neutral"
              variant="ghost"
              class="min-h-11"
              :label="resetLabel"
              @click="reset"
            />
          </div>
        </template>
      </UDrawer>
    </template>
    <DsActiveFilters
      v-if="chips && chips.length"
      class="w-full basis-full max-w-none!"
      :chips="chips"
      :reset-label="resetLabel"
      @remove="(k: string) => emit('remove-chip', k)"
      @reset="reset"
    />
  </form>
</template>
