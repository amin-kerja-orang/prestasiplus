<script setup lang="ts">
/**
 * S8 "Maklumat Sekolah" picker (FR-M01-42, 43). Chip when a school is set (name, then
 * "{type} · {state} · {district}", each part only when present) with a clear button; otherwise a
 * state select ("Semua Negeri" + 16 full names) and a search input (`limit=20`, debounce 300 ms,
 * from 2 characters or a state). No loading indicator, and a failed search shows nothing (not even
 * the empty state). The result list opens in the page flow under the input (no overlay).
 */
import { ref, watch } from 'vue'

import { DsIconChip } from '@/ds'

import type { SchoolSummary } from '../../api'
import { SCHOOL_MIN_QUERY, useSchoolSearch } from '../../composables/useSchoolSearch'
import { PROFILE_STATE_OPTIONS } from '../../lib/lookups'

const props = defineProps<{ modelValue: SchoolSummary | null }>()
const emit = defineEmits<{ 'update:modelValue': [school: SchoolSummary | null] }>()

const root = ref<HTMLElement | null>(null)
const { picker, state, setState } = useSchoolSearch({ limit: 20, root })

/** Reka selects reject an empty item value, so "Semua Negeri" uses a sentinel. */
const ALL_STATES = '__semua'
const STATE_ITEMS = [
  { label: 'Semua Negeri', value: ALL_STATES },
  ...PROFILE_STATE_OPTIONS.map((o) => ({ label: o.label, value: o.value })),
]

watch(
  () => props.modelValue,
  (school) => {
    picker.selected.value = school
  },
  { immediate: true },
)
// Only a change made inside the picker is emitted (not the echo of a parent update).
watch(picker.selected, (school) => {
  if (school !== props.modelValue) emit('update:modelValue', school)
})

function detail(school: SchoolSummary): string {
  return [school.type, school.state, school.district].filter(Boolean).join(' · ')
}
</script>

<template>
  <div ref="root" class="flex flex-col gap-3" data-testid="profile-school">
    <div
      v-if="picker.selected.value"
      class="flex items-center gap-3 bg-elevated p-3"
      data-testid="school-chip"
    >
      <DsIconChip icon="buildings" accent="win" />
      <div class="min-w-0 flex-1">
        <div class="text-label break-words text-highlighted" data-testid="school-chip-name">
          {{ picker.selected.value.name }}
        </div>
        <div class="text-caption text-muted" data-testid="school-chip-detail">
          {{ detail(picker.selected.value) }}
        </div>
      </div>
      <UButton
        type="button"
        color="neutral"
        variant="ghost"
        icon="i-ph-x-circle"
        aria-label="Buang sekolah"
        class="size-11 shrink-0"
        data-testid="school-clear"
        @click="picker.selected.value = null"
      />
    </div>

    <template v-else>
      <USelect
        :model-value="state === '' ? ALL_STATES : state"
        :items="STATE_ITEMS"
        size="lg"
        class="w-full"
        data-testid="profile-state"
        @update:model-value="setState($event === ALL_STATES ? '' : String($event ?? ''))"
      />
      <UInput
        type="text"
        autocomplete="off"
        placeholder="Taip nama sekolah (min. 2 huruf)..."
        icon="i-ph-magnifying-glass"
        size="lg"
        class="w-full"
        :model-value="picker.term.value"
        data-testid="profile-school-search"
        @focus="picker.onFocus"
        @update:model-value="picker.setTerm(String($event ?? ''))"
      />

      <UCard
        v-if="
          picker.open.value &&
          (picker.results.value.length > 0 || picker.term.value.length >= SCHOOL_MIN_QUERY)
        "
        data-testid="school-dropdown"
      >
        <ul class="flex max-h-72 flex-col gap-1 overflow-y-auto">
          <li v-for="school in picker.results.value" :key="school.id">
            <UButton
              type="button"
              color="neutral"
              variant="ghost"
              block
              class="min-h-11 justify-start text-start"
              data-testid="school-option"
              @click="picker.select(school)"
            >
              <DsIconChip icon="buildings" size="sm" />
              <span class="min-w-0 flex-1">
                <span class="block text-label break-words text-highlighted">{{ school.name }}</span>
                <span class="block text-caption text-muted">{{ detail(school) }}</span>
              </span>
            </UButton>
          </li>
        </ul>
        <div
          v-if="
            picker.results.value.length === 0 &&
            picker.term.value.length >= SCHOOL_MIN_QUERY &&
            !picker.searching.value &&
            !picker.error.value
          "
          class="flex flex-col items-center gap-1 px-4 py-6 text-center"
          data-testid="school-empty"
        >
          <UIcon name="i-ph-magnifying-glass" class="size-6 text-muted" aria-hidden="true" />
          <p class="text-label text-default">Tiada sekolah dijumpai</p>
          <p class="text-caption text-muted">Cuba tukar negeri atau kata kunci lain</p>
        </div>
      </UCard>
    </template>
  </div>
</template>
