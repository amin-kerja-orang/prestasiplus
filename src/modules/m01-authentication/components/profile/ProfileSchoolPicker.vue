<script setup lang="ts">
/**
 * S8 "Maklumat Sekolah" picker (FR-M01-42, 43). Chip when a school is set (name, then
 * "{type} · {state} · {district}", each part only when present) with a clear button; otherwise a
 * state select ("Semua Negeri" + 16 full names) and a search input (`limit=20`, debounce 300 ms,
 * from 2 characters or a state). No loading indicator, and a failed search shows nothing (not even
 * the empty state).
 */
import { CircleX, School, Search } from '@lucide/vue'
import { ref, watch } from 'vue'

import type { SchoolSummary } from '../../api'
import { SCHOOL_MIN_QUERY, useSchoolSearch } from '../../composables/useSchoolSearch'
import { PROFILE_STATE_OPTIONS } from '../../lib/lookups'
import { PROFILE_INPUT_CLASS } from './classes'

const props = defineProps<{ modelValue: SchoolSummary | null }>()
const emit = defineEmits<{ 'update:modelValue': [school: SchoolSummary | null] }>()

const root = ref<HTMLElement | null>(null)
const { picker, state, setState } = useSchoolSearch({ limit: 20, root })

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

function onStateChange(event: Event): void {
  setState((event.target as HTMLSelectElement).value)
}

function onInput(event: Event): void {
  picker.setTerm((event.target as HTMLInputElement).value)
}
</script>

<template>
  <div ref="root" class="relative" data-testid="profile-school">
    <div
      v-if="picker.selected.value"
      class="flex items-center gap-3 rounded-xl border-2 border-emerald-200 bg-emerald-50 p-3"
      data-testid="school-chip"
    >
      <span
        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600"
      >
        <School class="h-5 w-5" />
      </span>
      <div class="min-w-0 flex-1">
        <div class="font-semibold break-words text-slate-800" data-testid="school-chip-name">
          {{ picker.selected.value.name }}
        </div>
        <div class="text-xs text-slate-600" data-testid="school-chip-detail">
          {{ detail(picker.selected.value) }}
        </div>
      </div>
      <button
        type="button"
        class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:text-red-500 focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:outline-none"
        data-testid="school-clear"
        @click="picker.selected.value = null"
      >
        <CircleX class="h-5 w-5" />
      </button>
    </div>

    <template v-else>
      <div class="space-y-3">
        <select
          :value="state"
          :class="PROFILE_INPUT_CLASS"
          data-testid="profile-state"
          @change="onStateChange"
        >
          <option value="">Semua Negeri</option>
          <option v-for="option in PROFILE_STATE_OPTIONS" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
        <div class="relative">
          <Search
            class="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            autocomplete="off"
            placeholder="Taip nama sekolah (min. 2 huruf)..."
            :value="picker.term.value"
            :class="[PROFILE_INPUT_CLASS, 'pl-10']"
            data-testid="profile-school-search"
            @focus="picker.onFocus"
            @input="onInput"
          />
        </div>
      </div>

      <div
        v-if="
          picker.open.value &&
          (picker.results.value.length > 0 || picker.term.value.length >= SCHOOL_MIN_QUERY)
        "
        class="absolute right-0 left-0 z-20 mt-2 max-h-72 overflow-y-auto rounded-xl border-2 border-slate-200 bg-white shadow-xl"
        data-testid="school-dropdown"
      >
        <button
          v-for="school in picker.results.value"
          :key="school.id"
          type="button"
          class="flex min-h-11 w-full items-center gap-3 border-b border-slate-100 px-3 py-3 text-left last:border-b-0 hover:bg-indigo-50 focus-visible:bg-indigo-50 focus-visible:outline-none"
          data-testid="school-option"
          @click="picker.select(school)"
        >
          <span
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600"
          >
            <School class="h-4 w-4" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block text-sm font-bold break-words text-slate-800 uppercase">{{
              school.name
            }}</span>
            <span class="block text-xs text-slate-500">{{ detail(school) }}</span>
          </span>
        </button>
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
          <Search class="h-6 w-6 text-slate-300" />
          <p class="text-sm font-medium text-slate-600">Tiada sekolah dijumpai</p>
          <p class="text-xs text-slate-500">Cuba tukar negeri atau kata kunci lain</p>
        </div>
      </div>
    </template>
  </div>
</template>
