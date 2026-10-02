<script setup lang="ts">
/**
 * S4 "Sekolah * (taip untuk cari)" picker (FR-M02-52; live `schoolSearch()`): input with the placeholder
 * "-- Cari nama atau kod sekolah..." (the chosen school's name once chosen); focus opens the list; >= 2
 * characters -> school search (300 ms, no `limit`, so up to 20); the dropdown box shows a spinner while
 * loading, rows "{name} ({code})" + state, and "Tiada sekolah dijumpai" (query >= 2, finished, none).
 * Picking clears the text and shows "Dipilih: {name} ({code})" with a clear button. Request errors show
 * nothing (console only). The chosen school is the v-model.
 */
import { LoaderCircle, School, Search, X } from '@lucide/vue'
import { computed, ref } from 'vue'

import { FORM_INPUT_CLASS } from '@/components/form'
import { useSearchPicker } from '@/composables'

import { searchSchools, type SchoolSummary } from '../api/schools'
import { SEARCH_MIN_CHARS } from '../lib/user-form-options'

const school = defineModel<SchoolSummary | null>({ required: true })

const root = ref<HTMLElement | null>(null)
const doneTerm = ref('')

const picker = useSearchPicker<SchoolSummary>({
  minChars: SEARCH_MIN_CHARS,
  root,
  search: async (query, signal) => {
    try {
      const rows = await searchSchools({ q: query, signal })
      doneTerm.value = query
      return rows
    } catch (err) {
      if (!signal.aborted) console.error('Search error:', err)
      throw err
    }
  },
  onSelect: (item) => {
    school.value = item
    picker.setTerm('')
  },
})
const { term, results, open, searching } = picker

const showEmpty = computed(
  () =>
    term.value.length >= SEARCH_MIN_CHARS &&
    !searching.value &&
    doneTerm.value === term.value &&
    results.value.length === 0,
)
const showDropdown = computed(
  () =>
    open.value &&
    term.value.length >= SEARCH_MIN_CHARS &&
    (searching.value || results.value.length > 0 || showEmpty.value),
)

function label(s: SchoolSummary): string {
  return s.code === '' ? s.name : `${s.name} (${s.code})`
}

function onInput(event: Event): void {
  picker.setTerm((event.target as HTMLInputElement).value)
  picker.onFocus()
}

function clear(): void {
  school.value = null
  picker.reset()
  doneTerm.value = ''
}
</script>

<template>
  <div ref="root" data-testid="bulk-school">
    <label
      for="bulk-school-search"
      class="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700"
    >
      <School class="h-4 w-4 text-emerald-500" aria-hidden="true" />
      <span>Sekolah <span class="text-red-500">*</span></span>
      <span class="text-xs font-normal text-slate-400">(taip untuk cari)</span>
    </label>
    <div class="relative">
      <Search
        class="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
        aria-hidden="true"
      />
      <input
        id="bulk-school-search"
        type="text"
        autocomplete="off"
        :placeholder="school ? school.name : '-- Cari nama atau kod sekolah...'"
        :value="term"
        :class="[FORM_INPUT_CLASS, 'min-h-11 pl-10']"
        data-testid="bulk-school-search"
        @input="onInput"
        @focus="picker.onFocus()"
      />
      <div
        v-if="showDropdown"
        class="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg"
        data-testid="bulk-school-dropdown"
      >
        <p
          v-if="searching"
          class="flex items-center justify-center gap-2 px-3 py-3 text-sm text-slate-500"
          data-testid="bulk-school-loading"
        >
          <LoaderCircle class="h-4 w-4 animate-spin text-indigo-500" aria-hidden="true" />
        </p>
        <template v-else>
          <button
            v-for="item in results"
            :key="item.id"
            type="button"
            class="block min-h-11 w-full border-b border-slate-100 px-3 py-2 text-left hover:bg-indigo-50"
            data-testid="bulk-school-result"
            @click="picker.select(item)"
          >
            <span class="block text-sm font-semibold text-slate-800">{{ label(item) }}</span>
            <span class="block text-xs text-slate-500">{{ item.state }}</span>
          </button>
          <p
            v-if="showEmpty"
            class="px-3 py-3 text-center text-sm text-slate-500"
            data-testid="bulk-school-empty"
          >
            Tiada sekolah dijumpai
          </p>
        </template>
      </div>
    </div>
    <p
      v-if="school"
      class="mt-2 flex items-center gap-2 text-sm font-medium text-emerald-700"
      data-testid="bulk-school-chosen"
    >
      <span class="min-w-0 break-words">Dipilih: {{ label(school) }}</span>
      <button
        type="button"
        class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-red-400 transition hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
        data-testid="bulk-school-clear"
        @click="clear"
      >
        <X class="h-4 w-4" aria-hidden="true" />
      </button>
    </p>
  </div>
</template>
