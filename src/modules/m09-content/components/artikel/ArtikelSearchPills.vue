<script setup lang="ts">
/**
 * S15 search form and category pills (FR-M09-24, FR-M09-30; URS FN-M09-2.1.3, 2.1.4, 2.2.4).
 * GET form on `/artikel` (`search`, plus a hidden `category` while a category is active). Pill
 * links keep `search`; "Semua" drops `category`. The guest variant uses its own placeholder, the
 * "Pilih Kategori:" label and a "✨" before each category.
 */
import { Search } from '@lucide/vue'
import { ref, watch } from 'vue'
import { RouterLink } from 'vue-router'

import {
  ARTIKEL_CATEGORIES,
  ARTIKEL_COPY,
  ARTIKEL_PATH,
  listQuery,
} from '../../lib/artikel/artikel'

const props = defineProps<{ search: string; category: string; guest?: boolean }>()
const emit = defineEmits<{ submit: [search: string] }>()

const draft = ref(props.search)
watch(
  () => props.search,
  (value) => {
    draft.value = value
  },
)

const PILL =
  'inline-flex min-h-11 items-center rounded-full px-4 py-2 text-sm font-semibold shadow-sm transition'
const ACTIVE = 'bg-linear-to-br from-blue-500 via-violet-500 to-pink-500 text-white'
const INACTIVE = 'bg-white text-gray-600 hover:bg-gray-50'

function to(category: string) {
  return { path: ARTIKEL_PATH, query: listQuery({ search: props.search, category }) }
}
</script>

<template>
  <div class="space-y-4" data-testid="artikel-filters">
    <form
      class="mx-auto flex max-w-xl items-center gap-2 rounded-xl bg-white px-4 shadow-md"
      method="get"
      :action="ARTIKEL_PATH"
      data-testid="artikel-search-form"
      @submit.prevent="emit('submit', draft.trim())"
    >
      <span v-if="guest" aria-hidden="true">🔍</span>
      <Search v-else class="h-5 w-5 shrink-0 text-gray-400" aria-hidden="true" />
      <input
        v-model="draft"
        type="text"
        name="search"
        :placeholder="guest ? ARTIKEL_COPY.guestSearchPlaceholder : ARTIKEL_COPY.searchPlaceholder"
        class="min-h-12 min-w-0 flex-1 bg-transparent text-sm text-gray-800 outline-none placeholder:text-gray-400"
        data-testid="artikel-search-input"
      />
      <input v-if="category" type="hidden" name="category" :value="category" />
    </form>

    <p v-if="guest" class="text-center text-sm font-semibold text-gray-700">
      {{ ARTIKEL_COPY.pickCategory }}
    </p>
    <nav class="flex flex-wrap justify-center gap-2" data-testid="artikel-pills">
      <RouterLink
        :to="to('')"
        :class="[PILL, category === '' ? ACTIVE : INACTIVE]"
        data-testid="artikel-pill"
        data-category=""
        :data-active="category === ''"
        >{{ ARTIKEL_COPY.all }}</RouterLink
      >
      <RouterLink
        v-for="option in ARTIKEL_CATEGORIES"
        :key="option.value"
        :to="to(option.value)"
        :class="[PILL, category === option.value ? ACTIVE : INACTIVE]"
        data-testid="artikel-pill"
        :data-category="option.value"
        :data-active="category === option.value"
        >{{ guest ? '✨ ' : '' }}{{ option.label }}</RouterLink
      >
    </nav>
  </div>
</template>
