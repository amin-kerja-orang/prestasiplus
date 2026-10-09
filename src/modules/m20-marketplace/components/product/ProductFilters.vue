<script setup lang="ts">
/**
 * S6 search card (FN-M20-4.1.1, FR-M20-49): a GET form to `/marketplace` with `q`, `category` (by slug),
 * `condition` and `sort`; the four current values stay selected after a search. Submitting navigates
 * with a query of the non-empty values (the pager resets to page 1, as a live GET form does).
 */
import { Search } from '@lucide/vue'
import { ref, watch } from 'vue'

import type { MarketplaceCategory } from '../../api'
import { MARKETPLACE_COPY, SORT_OPTIONS, CONDITION_OPTIONS, type BuyerQuery } from './copy'

const props = defineProps<{ categories: readonly MarketplaceCategory[]; query: BuyerQuery }>()
const emit = defineEmits<{ search: [query: BuyerQuery] }>()

const q = ref(props.query.q)
const category = ref(props.query.category)
const condition = ref(props.query.condition)
const sort = ref(props.query.sort === '' ? 'latest' : props.query.sort)

watch(
  () => props.query,
  (next) => {
    q.value = next.q
    category.value = next.category
    condition.value = next.condition
    sort.value = next.sort === '' ? 'latest' : next.sort
  },
)

const FIELD =
  'min-h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none'

function submit(): void {
  emit('search', {
    q: q.value,
    category: category.value,
    condition: condition.value,
    sort: sort.value,
  })
}
</script>

<template>
  <form
    action="/marketplace"
    method="get"
    class="grid grid-cols-2 gap-3 rounded-2xl bg-white p-4 shadow-md lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto]"
    data-testid="marketplace-search"
    @submit.prevent="submit"
  >
    <div class="relative col-span-2 min-w-0 lg:col-span-1">
      <Search
        class="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
        aria-hidden="true"
      />
      <input
        v-model="q"
        type="text"
        name="q"
        :placeholder="MARKETPLACE_COPY.searchPlaceholder"
        :class="[FIELD, 'pl-9']"
        data-testid="marketplace-q"
      />
    </div>
    <select
      v-model="category"
      name="category"
      :class="[FIELD, 'col-span-2 sm:col-span-1']"
      data-testid="marketplace-category"
    >
      <option value="">{{ MARKETPLACE_COPY.allCategories }}</option>
      <option v-for="c in categories" :key="c.id" :value="c.slug">{{ c.name }}</option>
    </select>
    <select v-model="condition" name="condition" :class="FIELD" data-testid="marketplace-condition">
      <option value="">{{ MARKETPLACE_COPY.allConditions }}</option>
      <option v-for="o in CONDITION_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
    </select>
    <select v-model="sort" name="sort" :class="FIELD" data-testid="marketplace-sort">
      <option v-for="o in SORT_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
    </select>
    <button
      type="submit"
      class="col-span-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-500 px-6 text-sm font-semibold text-white hover:bg-indigo-600 lg:col-span-1"
      data-testid="marketplace-submit"
    >
      <Search class="h-4 w-4" aria-hidden="true" />
      {{ MARKETPLACE_COPY.submit }}
    </button>
  </form>
</template>
