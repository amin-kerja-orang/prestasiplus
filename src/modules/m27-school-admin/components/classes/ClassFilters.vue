<script setup lang="ts">
/**
 * S8 filter card (FR-M27-114; PROPOSED): select "Tingkatan / Darjah" ("Semua" and the levels the school
 * has) and the search "Cari" ("Cari kelas...", class name). A GET filter: the select applies on change, the
 * search on Enter or after a short pause; both keep the other value and drop the page.
 */
import { ref, watch } from 'vue'

import { FORM_INPUT_CLASS, FORM_SELECT_CLASS } from '@/components/form'
import { useDebounce } from '@/composables'

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

function apply() {
  emit('apply', { level: levelValue.value, search: searchValue.value.trim() })
}
const applyLater = useDebounce(apply, 400)

function onSubmit() {
  applyLater.cancel()
  apply()
}
</script>

<template>
  <form
    class="grid min-w-0 grid-cols-1 gap-3 rounded-2xl bg-white p-4 shadow sm:grid-cols-2"
    data-testid="kl-filters"
    @submit.prevent="onSubmit"
  >
    <div class="min-w-0">
      <label for="kl-level" class="mb-1 block text-xs font-bold text-slate-500 uppercase"
        >Tingkatan / Darjah</label
      >
      <select
        id="kl-level"
        v-model="levelValue"
        name="level"
        :class="FORM_SELECT_CLASS"
        class="min-h-11"
        data-testid="kl-level"
        @change="onSubmit"
      >
        <option value="">Semua</option>
        <option v-for="l in levels" :key="l.code" :value="l.code">{{ l.label }}</option>
      </select>
    </div>
    <div class="min-w-0">
      <label for="kl-search" class="mb-1 block text-xs font-bold text-slate-500 uppercase"
        >Cari</label
      >
      <input
        id="kl-search"
        v-model="searchValue"
        type="search"
        name="search"
        placeholder="Cari kelas..."
        autocomplete="off"
        :class="FORM_INPUT_CLASS"
        class="min-h-11"
        data-testid="kl-search"
        @input="applyLater"
      />
    </div>
  </form>
</template>
