<script setup lang="ts">
/**
 * S15 search form and category pills (FR-M09-24, FR-M09-30; URS FN-M09-2.1.3, 2.1.4, 2.2.4).
 * GET form on `/artikel` (`search`, plus a hidden `category` while a category is active). Pill
 * links keep `search`; "Semua" drops `category`. The guest variant uses its own placeholder, the
 * "Pilih Kategori:" label and a sparkle before each category.
 */
import { ref, watch } from 'vue'

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

function to(category: string) {
  return { path: ARTIKEL_PATH, query: listQuery({ search: props.search, category }) }
}
</script>

<template>
  <div class="flex flex-col gap-4" data-testid="artikel-filters">
    <form
      class="w-full max-w-xl self-center"
      method="get"
      :action="ARTIKEL_PATH"
      role="search"
      data-testid="artikel-search-form"
      @submit.prevent="emit('submit', draft.trim())"
    >
      <UInput
        v-model="draft"
        type="text"
        name="search"
        size="xl"
        icon="i-ph-magnifying-glass-duotone"
        :placeholder="guest ? ARTIKEL_COPY.guestSearchPlaceholder : ARTIKEL_COPY.searchPlaceholder"
        :aria-label="ARTIKEL_COPY.searchPlaceholder"
        class="w-full"
        data-testid="artikel-search-input"
      />
    </form>

    <p v-if="guest" class="text-label text-default">{{ ARTIKEL_COPY.pickCategory }}</p>
    <nav class="flex flex-wrap gap-2" data-testid="artikel-pills">
      <UButton
        :to="to('')"
        :color="category === '' ? 'primary' : 'neutral'"
        :variant="category === '' ? 'solid' : 'soft'"
        class="rounded-full"
        data-testid="artikel-pill"
        data-category=""
        :data-active="category === ''"
        >{{ ARTIKEL_COPY.all }}</UButton
      >
      <UButton
        v-for="option in ARTIKEL_CATEGORIES"
        :key="option.value"
        :to="to(option.value)"
        :color="category === option.value ? 'primary' : 'neutral'"
        :variant="category === option.value ? 'solid' : 'soft'"
        :icon="guest ? 'i-ph-sparkle-duotone' : undefined"
        class="rounded-full"
        data-testid="artikel-pill"
        :data-category="option.value"
        :data-active="category === option.value"
        >{{ option.label }}</UButton
      >
    </nav>
  </div>
</template>
