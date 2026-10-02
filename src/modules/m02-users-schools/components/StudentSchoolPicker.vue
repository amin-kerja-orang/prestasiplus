<script setup lang="ts">
/**
 * S2 "Sekolah" picker of the `student` and `teacher` roles (FR-M02-25): input "Cari nama sekolah...",
 * 300 ms debounce, >= 2 characters -> `GET /api/schools/search?q=` (no limit, server default 20). As live:
 * no loading indicator, no empty text, no clear button; focus opens the list and a click outside closes
 * it; rows read "{name} ({type}, {state})"; the chosen name shows under the input. The chosen school
 * is the v-model, kept by the page so it survives a role change.
 */
import { School, Search } from '@lucide/vue'
import { computed, ref } from 'vue'

import { useSearchPicker } from '@/composables'

import { searchSchools, type SchoolSummary } from '../api/schools'
import { SEARCH_MIN_CHARS } from '../lib/user-form-options'

const school = defineModel<SchoolSummary | null>({ required: true })

const root = ref<HTMLElement | null>(null)

const picker = useSearchPicker<SchoolSummary>({
  minChars: SEARCH_MIN_CHARS,
  root,
  search: (term, signal) => searchSchools({ q: term, signal }),
  onSelect: (item) => {
    school.value = item
  },
})
const { term, results, open } = picker

const showDropdown = computed(() => open.value && results.value.length > 0)

function onInput(event: Event): void {
  picker.setTerm((event.target as HTMLInputElement).value)
  picker.onFocus() // typing means the box has focus: a list closed by a pick opens again
}
</script>

<template>
  <div ref="root" data-testid="std-school">
    <label
      for="std-school-search"
      class="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700"
    >
      <School class="h-4 w-4 text-emerald-500" aria-hidden="true" />
      Sekolah
    </label>
    <div class="relative">
      <Search
        class="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
        aria-hidden="true"
      />
      <input
        id="std-school-search"
        type="text"
        autocomplete="off"
        placeholder="Cari nama sekolah..."
        :value="term"
        class="min-h-11 w-full rounded-xl border-2 border-slate-200 py-2.5 pr-3.5 pl-10 text-sm transition outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-300"
        data-testid="std-school-search"
        @input="onInput"
        @focus="picker.onFocus()"
      />
      <ul
        v-if="showDropdown"
        class="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg"
        data-testid="std-school-dropdown"
      >
        <li v-for="item in results" :key="item.id">
          <button
            type="button"
            class="min-h-11 w-full border-b border-slate-100 px-3 py-2 text-left text-sm text-slate-800 hover:bg-indigo-50"
            data-testid="std-school-result"
            @click="picker.select(item)"
          >
            {{ item.name }} ({{ item.type }}, {{ item.state }})
          </button>
        </li>
      </ul>
    </div>
    <p
      v-if="school"
      class="mt-1.5 text-xs font-medium text-emerald-700"
      data-testid="std-school-chosen"
    >
      {{ school.name }}
    </p>
  </div>
</template>
