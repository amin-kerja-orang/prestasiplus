<script setup lang="ts">
/**
 * Common frame of a Kandungan SPM lane (V2 A2/P2, AC-R1-21.2): "Kandungan SPM" title, "Kembali" to the hub, the filters
 * Subjek ("Semua Subjek"), Status ("Semua Status"), Cari, and the buttons Tapis / Set Semula. The table goes in the slot.
 */
import { reactive } from 'vue'

import { DsFilterBar, DsNativeSelect, DsPage } from '@/ds'

import type { LaneSubject } from '../api'
import { laneCopy } from '../lanes'

defineProps<{
  heading: string
  subjects: LaneSubject[]
  statuses: { value: string; label: string }[]
  chips: { key: string; label: string }[]
  testid: string
}>()
const filters = defineModel<{ subjectId: string; status: string; search: string }>('filters', { required: true })
const emit = defineEmits<{ apply: []; reset: []; 'remove-chip': [key: string] }>()
const draft = reactive({ subjectId: '', status: '', search: '' })

function apply(): void {
  filters.value = { ...draft }
  emit('apply')
}
function reset(): void {
  Object.assign(draft, { subjectId: '', status: '', search: '' })
  filters.value = { subjectId: '', status: '', search: '' }
  emit('reset')
}
</script>

<template>
  <DsPage :title="laneCopy.title" back-to="/admin/spm" :back-label="laneCopy.back" layout="list" :data-testid="testid">
    <template #subtitle>
      <p class="text-body text-muted">{{ heading }}</p>
    </template>
    <DsFilterBar
      :chips="chips"
      :active-count="chips.length"
      :apply-label="laneCopy.apply"
      :reset-label="laneCopy.reset"
      data-testid="lane-filter"
      @apply="apply"
      @reset="reset"
      @remove-chip="(k: string) => emit('remove-chip', k)"
    >
      <template #search>
        <UInput
          v-model="draft.search"
          type="text"
          :aria-label="laneCopy.search"
          :placeholder="`${laneCopy.search}...`"
          icon="i-ph-magnifying-glass"
          class="w-full md:min-w-64 md:flex-1"
          data-testid="lane-search"
        />
      </template>
      <DsNativeSelect v-model="draft.subjectId" aria-label="Subjek" class="md:w-44" data-testid="lane-subject">
        <option value="">{{ laneCopy.allSubjects }}</option>
        <option v-for="s in subjects" :key="s.id" :value="s.id">{{ s.name }}</option>
      </DsNativeSelect>
      <DsNativeSelect v-model="draft.status" aria-label="Status" class="md:w-44" data-testid="lane-status">
        <option value="">{{ laneCopy.allStatuses }}</option>
        <option v-for="s in statuses" :key="s.value" :value="s.value">{{ s.label }}</option>
      </DsNativeSelect>
    </DsFilterBar>
    <slot />
  </DsPage>
</template>
