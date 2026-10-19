<script setup lang="ts">
/**
 * S8 filter bar (FR-M27-114; PROPOSED): select "Tingkatan / Darjah" ("Semua" and the levels the school
 * has) and the search "Cari" ("Cari kelas...", class name). A GET filter: the select applies on change, the
 * search on Enter or after a short pause; both keep the other value and drop the page.
 */
import { computed, ref, watch } from 'vue'

import { useDebounce } from '@/composables'
import { DsFilterBar, DsFormField, DsNativeSelect } from '@/ds'

const props = defineProps<{
  levels: { code: string; label: string }[]
  level: string
  search: string
}>()

const emit = defineEmits<{ apply: [filters: { level: string; search: string }] }>()

const levelValue = ref(props.level)
const searchValue = ref(props.search)
watch(
  () => props.level,
  (v) => (levelValue.value = v),
)
watch(
  () => props.search,
  (v) => (searchValue.value = v),
)

const activeCount = computed(() => (levelValue.value !== '' ? 1 : 0))

function apply() {
  emit('apply', { level: levelValue.value, search: searchValue.value.trim() })
}
const applyLater = useDebounce(apply, 400)

function onSubmit() {
  applyLater.cancel()
  apply()
}

function onReset() {
  applyLater.cancel()
  levelValue.value = ''
  searchValue.value = ''
  apply()
}
</script>

<template>
  <DsFilterBar :active-count="activeCount" data-testid="kl-filters" @apply="onSubmit" @reset="onReset">
    <template #search>
      <DsFormField label="Cari" name="search" class="min-w-0 grow">
        <UInput
          id="kl-search"
          v-model="searchValue"
          type="search"
          name="search"
          icon="i-ph-magnifying-glass"
          placeholder="Cari kelas..."
          autocomplete="off"
          class="w-full"
          data-testid="kl-search"
          @input="applyLater"
        />
      </DsFormField>
    </template>
    <DsFormField label="Tingkatan / Darjah" native for="kl-level" class="min-w-48">
      <DsNativeSelect
        id="kl-level"
        v-model="levelValue"
        name="level"
        data-testid="kl-level"
        @change="onSubmit"
      >
        <option value="">Semua</option>
        <option v-for="l in levels" :key="l.code" :value="l.code">{{ l.label }}</option>
      </DsNativeSelect>
    </DsFormField>
  </DsFilterBar>
</template>
