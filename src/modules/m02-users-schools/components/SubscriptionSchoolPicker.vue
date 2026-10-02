<script setup lang="ts">
/**
 * S13 "Sekolah *" picker (FR-M02-84): input "Taip nama atau kod sekolah...", 300 ms debounce, >= 2
 * characters -> `/api/schools/search?q=&limit=15`; focus shows the previous results; a spinner while
 * loading; rows name + "{code} — {district}, {state}"; `Tiada sekolah dijumpai` when a finished search
 * of >= 2 characters finds none; picking hides the input and shows a selected card with a clear button.
 * The chosen school is the v-model.
 */
import { CircleX, LoaderCircle, School, ZoomOut } from '@lucide/vue'
import { computed, ref } from 'vue'

import { useSearchPicker } from '@/composables'

import { searchSchools, type SchoolSummary } from '../api/schools'

const school = defineModel<SchoolSummary | null>({ required: true })

const MIN_CHARS = 2
const root = ref<HTMLElement | null>(null)
const doneTerm = ref('')

const picker = useSearchPicker<SchoolSummary>({
  minChars: MIN_CHARS,
  root,
  search: async (query, signal) => {
    try {
      const rows = await searchSchools({ q: query, limit: 15, signal })
      doneTerm.value = query
      return rows
    } catch (err) {
      if (!signal.aborted) console.error('Search error:', err)
      throw err
    }
  },
  onSelect: (item) => {
    school.value = item
  },
})
const { term, results, open, searching } = picker

const showEmpty = computed(
  () =>
    term.value.length >= MIN_CHARS &&
    !searching.value &&
    doneTerm.value === term.value &&
    results.value.length === 0,
)
const showDropdown = computed(() => open.value && (results.value.length > 0 || showEmpty.value))

function meta(item: SchoolSummary): string {
  const place = [item.district, item.state].filter((v) => v !== null && v !== '').join(', ')
  return `${item.code} — ${place}`
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

const FIELD =
  'min-h-11 w-full rounded-xl border-2 border-slate-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-300'
</script>

<template>
  <div ref="root" data-testid="sub-school">
    <p class="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700">
      <School class="h-4 w-4 text-emerald-500" aria-hidden="true" />
      <label for="sub-school-search">Sekolah <span class="text-red-500">*</span></label>
    </p>

    <div
      v-if="school"
      class="flex min-h-14 items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-2 pr-1"
      data-testid="sub-school-chip"
    >
      <span class="min-w-0 flex-1 pl-1.5">
        <span
          class="block text-sm font-semibold break-words text-slate-800"
          data-testid="sub-school-name"
          >{{ school.name }}</span
        >
        <span class="block text-xs break-words text-slate-500">{{ meta(school) }}</span>
      </span>
      <button
        type="button"
        class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-red-400 transition hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
        data-testid="sub-school-clear"
        @click="clear"
      >
        <CircleX class="h-5 w-5" aria-hidden="true" />
      </button>
    </div>

    <div v-else class="relative">
      <input
        id="sub-school-search"
        type="text"
        autocomplete="off"
        placeholder="Taip nama atau kod sekolah..."
        :value="term"
        :class="[FIELD, 'pr-10']"
        data-testid="sub-school-search"
        @input="onInput"
        @focus="picker.onFocus()"
      />
      <LoaderCircle
        v-if="searching"
        class="absolute top-1/2 right-3.5 h-4 w-4 -translate-y-1/2 animate-spin text-indigo-500"
        aria-hidden="true"
        data-testid="sub-school-loading"
      />
      <div
        v-if="showDropdown"
        class="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg"
        data-testid="sub-school-dropdown"
      >
        <button
          v-for="item in results"
          :key="item.id"
          type="button"
          class="block min-h-11 w-full border-b border-slate-100 px-3 py-2 text-left hover:bg-indigo-50"
          data-testid="sub-school-result"
          @click="picker.select(item)"
        >
          <span class="block text-sm font-semibold text-slate-800">{{ item.name }}</span>
          <span class="block text-xs text-slate-500">{{ meta(item) }}</span>
        </button>
        <p
          v-if="showEmpty"
          class="flex items-center justify-center gap-2 px-3 py-3 text-center text-sm text-slate-500"
          data-testid="sub-school-empty"
        >
          <ZoomOut class="h-4 w-4" aria-hidden="true" />
          Tiada sekolah dijumpai
        </p>
      </div>
    </div>
  </div>
</template>
