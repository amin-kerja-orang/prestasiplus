<script setup lang="ts">
/**
 * S3 "Sekolah" picker (FR-M02-41; the M01 `adminSchoolPicker` behaviour). With a school it shows a green
 * chip (icon tile, name, "{type} · {state} · {district}") and a clear button. Cleared, it shows a state
 * select (short labels, §6.13) and the input "Taip nama sekolah (min. 2 huruf)...": 300 ms debounce, a search
 * runs when the query has >= 2 characters or a state is chosen (`limit=20`); the dropdown shows when open and
 * there are results or the query has >= 2 characters; `LoaderCircle` spins while searching; the empty result
 * reads "Tiada sekolah dijumpai" (query >= 2, search finished, none). Request errors show nothing (console
 * "Search error:"). The chosen school is the v-model.
 */
import { CircleX, LoaderCircle, School } from '@lucide/vue'
import { computed, ref } from 'vue'

import { useSearchPicker } from '@/composables'

import { searchSchools, type SchoolSummary } from '../api/schools'
import { schoolMeta, SEARCH_MIN_CHARS, STATE_FILTER_OPTIONS } from '../lib/user-form-options'

const school = defineModel<SchoolSummary | null>({ required: true })

const root = ref<HTMLElement | null>(null)
const state = ref('')
const doneTerm = ref('')

const picker = useSearchPicker<SchoolSummary>({
  // The threshold is applied in `search`: a state alone also triggers a search.
  minChars: 0,
  root,
  search: async (query, signal) => {
    if (query.length < SEARCH_MIN_CHARS && state.value === '') {
      doneTerm.value = ''
      return []
    }
    try {
      const rows = await searchSchools({ q: query, state: state.value || null, limit: 20, signal })
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
    term.value.length >= SEARCH_MIN_CHARS &&
    !searching.value &&
    doneTerm.value === term.value &&
    results.value.length === 0,
)
const showDropdown = computed(
  () => open.value && (results.value.length > 0 || term.value.length >= SEARCH_MIN_CHARS),
)

function onInput(event: Event): void {
  picker.setTerm((event.target as HTMLInputElement).value)
  picker.onFocus() // typing means the box has focus: a list closed by a pick opens again
}

function onState(): void {
  picker.setTerm(term.value)
  picker.onFocus()
}

function clear(): void {
  school.value = null
  picker.reset()
  state.value = ''
  doneTerm.value = ''
}

const FIELD =
  'min-h-11 rounded-xl border-2 border-slate-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-300'
</script>

<template>
  <div ref="root" data-testid="admin-school">
    <p class="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700">
      <School class="h-4 w-4 text-emerald-500" aria-hidden="true" />
      <label for="admin-school-search">Sekolah</label>
    </p>

    <div
      v-if="school"
      class="flex min-h-14 items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-2 pr-1"
      data-testid="admin-school-chip"
    >
      <span
        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500 text-white"
      >
        <School class="h-5 w-5" aria-hidden="true" />
      </span>
      <span class="min-w-0 flex-1">
        <span
          class="block truncate text-sm font-semibold text-slate-800"
          data-testid="admin-school-name"
        >
          {{ school.name }}
        </span>
        <span class="block text-xs break-words text-slate-500">{{ schoolMeta(school) }}</span>
      </span>
      <button
        type="button"
        class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-red-400 transition hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
        data-testid="admin-school-clear"
        @click="clear"
      >
        <CircleX class="h-5 w-5" aria-hidden="true" />
      </button>
    </div>

    <div v-else class="flex flex-col gap-2 sm:flex-row">
      <select
        v-model="state"
        :class="[FIELD, 'w-full sm:w-44 sm:shrink-0']"
        data-testid="admin-school-state"
        @change="onState"
      >
        <option v-for="o in STATE_FILTER_OPTIONS" :key="o.value" :value="o.value">
          {{ o.label }}
        </option>
      </select>
      <div class="relative min-w-0 flex-1">
        <input
          id="admin-school-search"
          type="text"
          autocomplete="off"
          placeholder="Taip nama sekolah (min. 2 huruf)..."
          :value="term"
          :class="[FIELD, 'w-full pr-10']"
          data-testid="admin-school-search"
          @input="onInput"
          @focus="picker.onFocus()"
        />
        <LoaderCircle
          v-if="searching"
          class="absolute top-1/2 right-3.5 h-4 w-4 -translate-y-1/2 animate-spin text-indigo-500"
          aria-hidden="true"
          data-testid="admin-school-loading"
        />
        <div
          v-if="showDropdown"
          class="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg"
          data-testid="admin-school-dropdown"
        >
          <button
            v-for="item in results"
            :key="item.id"
            type="button"
            class="block min-h-11 w-full border-b border-slate-100 px-3 py-2 text-left hover:bg-indigo-50"
            data-testid="admin-school-result"
            @click="picker.select(item)"
          >
            <span class="block text-sm font-semibold text-slate-800">{{ item.name }}</span>
            <span class="block text-xs text-slate-500">{{ schoolMeta(item) }}</span>
          </button>
          <p
            v-if="showEmpty"
            class="px-3 py-3 text-center text-sm text-slate-500"
            data-testid="admin-school-empty"
          >
            Tiada sekolah dijumpai
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
