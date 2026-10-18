<script setup lang="ts">
/**
 * S6 search bar (FN-M20-4.1.1, FR-M20-49): `q`, `category` (by slug), `condition` and `sort`; the
 * four current values stay selected after a search. Applying navigates with a query of the
 * non-empty values (the pager resets to page 1).
 */
import { computed, ref, watch } from 'vue'

import { DsFilterBar } from '@/ds'

import type { MarketplaceCategory } from '../../api'
import { MARKETPLACE_COPY, SORT_OPTIONS, CONDITION_OPTIONS, type BuyerQuery } from './copy'

const props = defineProps<{ categories: readonly MarketplaceCategory[]; query: BuyerQuery }>()
const emit = defineEmits<{ search: [query: BuyerQuery] }>()

/** The select keeps "no filter" as this value, because the select cannot hold an empty string. */
const ANY = '__any'

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

const categoryItems = computed(() => [
  { value: ANY, label: MARKETPLACE_COPY.allCategories },
  ...props.categories.map((c) => ({ value: c.slug, label: c.name })),
])
const conditionItems = [
  { value: ANY, label: MARKETPLACE_COPY.allConditions },
  ...CONDITION_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
]
const sortItems: { value: string; label: string }[] = SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))

const activeCount = computed(() => [category.value, condition.value].filter((v) => v !== '').length)

/** The applied category and condition as removable chips under the bar. */
const chips = computed(() => {
  const out: { key: string; label: string }[] = []
  const cat = props.categories.find((c) => c.slug === props.query.category)
  if (cat) out.push({ key: 'category', label: cat.name })
  const cond = CONDITION_OPTIONS.find((o) => o.value === props.query.condition)
  if (cond) out.push({ key: 'condition', label: cond.label })
  return out
})

function removeChip(key: string): void {
  if (key === 'category') category.value = ''
  if (key === 'condition') condition.value = ''
  submit()
}

function submit(): void {
  emit('search', {
    q: q.value,
    category: category.value,
    condition: condition.value,
    sort: sort.value,
  })
}
function reset(): void {
  q.value = ''
  category.value = ''
  condition.value = ''
  sort.value = 'latest'
  submit()
}
</script>

<template>
  <div data-testid="marketplace-search">
    <DsFilterBar
      :active-count="activeCount"
      :chips="chips"
      @apply="submit"
      @reset="reset"
      @remove-chip="removeChip"
    >
      <template #search>
        <UInput
          v-model="q"
          type="text"
          name="q"
          size="lg"
          icon="i-ph-magnifying-glass-duotone"
          class="w-full md:w-72"
          :placeholder="MARKETPLACE_COPY.searchPlaceholder"
          :aria-label="MARKETPLACE_COPY.searchPlaceholder"
          data-testid="marketplace-q"
        />
      </template>
      <USelect
        :model-value="category === '' ? ANY : category"
        :items="categoryItems"
        size="lg"
        class="w-full md:w-48"
        data-testid="marketplace-category"
        @update:model-value="category = $event === ANY ? '' : String($event)"
      />
      <USelect
        :model-value="condition === '' ? ANY : condition"
        :items="conditionItems"
        size="lg"
        class="w-full md:w-40"
        data-testid="marketplace-condition"
        @update:model-value="condition = $event === ANY ? '' : String($event)"
      />
      <USelect
        :model-value="sort"
        :items="sortItems"
        size="lg"
        class="w-full md:w-48"
        data-testid="marketplace-sort"
        @update:model-value="sort = String($event)"
      />
    </DsFilterBar>
  </div>
</template>
