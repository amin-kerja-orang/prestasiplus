<script setup lang="ts">
/**
 * Filter toolbar: ONE row from `md` (the `search` slot grows, the filters sit next to it, then "Cari"
 * and "Set Semula"); below `md` the search stays inline and the filters move into a "Penapis" bottom
 * sheet. Active filters show as removable chips under the row. Callers own the fields (bound to query
 * params); the toolbar emits `apply`, `reset` and `remove` (chip key).
 */
import { ref } from 'vue'

import { useMedia } from '../useMedia'

export interface ToolbarChip {
  key: string
  label: string
}

const props = withDefaults(
  defineProps<{
    chips?: ToolbarChip[]
    applyLabel?: string
    resetLabel?: string
  }>(),
  { chips: () => [], applyLabel: 'Cari', resetLabel: 'Set Semula' },
)
const emit = defineEmits<{ apply: []; reset: []; remove: [key: string] }>()

const wide = useMedia('(min-width: 768px)')
const sheet = ref(false)

function apply(): void {
  sheet.value = false
  emit('apply')
}
</script>

<template>
  <form
    class="flex flex-col gap-4 rounded-lg bg-default p-4 shadow-card"
    role="search"
    data-ds="admin-toolbar"
    @submit.prevent="apply"
  >
    <div v-if="wide" class="flex items-center gap-3">
      <div class="min-w-0 grow"><slot name="search" /></div>
      <slot />
      <UButton type="submit" size="md" :label="props.applyLabel" />
      <UButton
        type="button"
        size="md"
        color="neutral"
        variant="ghost"
        :label="props.resetLabel"
        @click="emit('reset')"
      />
    </div>
    <div v-else class="flex items-center gap-3">
      <div class="min-w-0 grow"><slot name="search" /></div>
      <UChip :show="props.chips.length > 0" :text="props.chips.length" color="primary">
        <UButton
          type="button"
          size="md"
          color="neutral"
          variant="soft"
          icon="i-ph-funnel"
          label="Penapis"
          data-ds="filter-open"
          @click="sheet = true"
        />
      </UChip>
      <UDrawer v-model:open="sheet" title="Penapis" description=" ">
        <template #body>
          <div class="flex max-h-dvh flex-col gap-4 overflow-y-auto" data-ds="filter-sheet">
            <slot />
            <UButton type="button" block size="md" label="Guna" @click="apply" />
            <UButton
              type="button"
              block
              size="md"
              color="neutral"
              variant="ghost"
              :label="props.resetLabel"
              @click="emit('reset')"
            />
          </div>
        </template>
      </UDrawer>
    </div>
    <div
      v-if="props.chips.length > 0"
      class="flex flex-wrap items-center gap-2"
      data-ds="admin-chips"
    >
      <UButton
        v-for="c in props.chips"
        :key="c.key"
        type="button"
        size="md"
        color="neutral"
        variant="soft"
        trailing-icon="i-ph-x"
        :label="c.label"
        :aria-label="`Buang penapis ${c.label}`"
        :data-chip="c.key"
        @click="emit('remove', c.key)"
      />
    </div>
  </form>
</template>
