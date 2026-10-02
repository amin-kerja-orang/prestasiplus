<script setup lang="ts">
/**
 * "Pilih Sekolah" card of S5 (FN-M10-3.2.2): 300 ms debounced search from 2 characters
 * (`GET /api/schools/search?q=&limit=15`), spinner, results "{nama}" + "{daerah}, {negeri}",
 * "Tiada sekolah dijumpai", and a selected card with a clear button.
 */
import { Building2, CircleX, Search, SearchX } from '@lucide/vue'
import { ref } from 'vue'

import { LoadingSpinner } from '@/components/feedback'
import { useSearchPicker } from '@/composables'
import { searchSchools, type SchoolSummary } from '@/modules/m02-users-schools'

import { KELAS_COPY, schoolPlace } from './copy'

const emit = defineEmits<{ select: [school: SchoolSummary | null] }>()

const root = ref<HTMLElement | null>(null)
const picker = useSearchPicker<SchoolSummary>({
  search: (term, signal) => searchSchools({ q: term, limit: 15, signal }),
  minChars: 2,
  root,
  onSelect: (school) => emit('select', school),
})
const { term, results, selected, open, searching } = picker

function clear(): void {
  picker.reset()
  emit('select', null)
}
</script>

<template>
  <section class="min-w-0 rounded-2xl bg-white p-4 shadow-sm sm:p-6" data-testid="school-picker">
    <h2 class="mb-3 flex items-center gap-2 font-heading text-lg font-bold text-slate-800">
      <Building2 class="h-5 w-5 text-blue-500" />{{ KELAS_COPY.chooseSchool }}
    </h2>

    <div
      v-if="selected"
      class="flex items-center justify-between gap-3 rounded-xl border-2 border-indigo-200 bg-indigo-50 p-3"
      data-testid="school-selected"
    >
      <div class="min-w-0">
        <p class="font-semibold break-words text-slate-800" data-testid="school-selected-name">
          {{ selected.name }}
        </p>
        <p class="text-sm break-words text-slate-500">{{ schoolPlace(selected) }}</p>
      </div>
      <button
        type="button"
        class="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center text-slate-400 hover:text-red-500"
        data-testid="school-clear"
        @click="clear"
      >
        <CircleX class="h-5 w-5" />
      </button>
    </div>

    <div v-else ref="root" class="relative">
      <Search
        class="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
      />
      <input
        type="text"
        :value="term"
        :placeholder="KELAS_COPY.schoolPlaceholder"
        autocomplete="off"
        class="w-full rounded-xl border-2 border-slate-200 py-3 pr-10 pl-10 text-sm transition outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-300"
        data-testid="school-search"
        @input="picker.setTerm(($event.target as HTMLInputElement).value)"
        @focus="picker.onFocus"
      />
      <span
        v-if="searching"
        class="absolute top-1/2 right-3.5 -translate-y-1/2 text-slate-400"
        data-testid="school-spinner"
      >
        <LoadingSpinner />
      </span>

      <div
        v-if="open && term.length >= 2 && !searching"
        class="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg"
        data-testid="school-results"
      >
        <button
          v-for="school in results"
          :key="school.id"
          type="button"
          class="block min-h-11 w-full px-4 py-2 text-left hover:bg-indigo-50"
          data-testid="school-result"
          @click="picker.select(school)"
        >
          <span class="block text-sm font-semibold break-words text-slate-800">{{
            school.name
          }}</span>
          <span class="block text-xs break-words text-slate-500">{{ schoolPlace(school) }}</span>
        </button>
        <p
          v-if="results.length === 0"
          class="flex items-center justify-center gap-2 px-4 py-4 text-sm text-slate-500"
          data-testid="school-none"
        >
          <SearchX class="h-4 w-4" />{{ KELAS_COPY.schoolNone }}
        </p>
      </div>
    </div>
  </section>
</template>
