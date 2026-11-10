<script setup lang="ts">
/**
 * The filter bar of the Kertas Subjektif list (`Semua Subjek`, `Semua Kertas`, `Semua Status`, `Tapis`). One bar for the question-based papers
 * and the page-image documents on the same page; the page owns the values and applies them.
 */
import { DsFilterBar, DsNativeSelect } from '@/ds'

defineProps<{ subjects: { code: string; name: string }[] }>()
const subject = defineModel<string>('subject', { required: true })
const kertas = defineModel<string>('kertas', { required: true })
const status = defineModel<string>('status', { required: true })
defineEmits<{ apply: []; reset: [] }>()

const KERTAS = [2, 3, 4]
</script>

<template>
  <DsFilterBar :show-reset="false" apply-label="Tapis" data-testid="sj-filters" @apply="$emit('apply')" @reset="$emit('reset')">
    <DsNativeSelect v-model="subject" aria-label="Subjek" data-testid="sj-filter-subject">
      <option value="">Semua Subjek</option>
      <option v-for="s in subjects" :key="s.code" :value="s.code">{{ s.name }}</option>
    </DsNativeSelect>
    <DsNativeSelect v-model="kertas" aria-label="Kertas" data-testid="sj-filter-kertas">
      <option value="">Semua Kertas</option>
      <option v-for="k in KERTAS" :key="k" :value="String(k)">Kertas {{ k }}</option>
    </DsNativeSelect>
    <DsNativeSelect v-model="status" aria-label="Status" data-testid="sj-filter-status">
      <option value="">Semua Status</option>
      <option value="terbit">Terbit</option>
      <option value="draf">Draf</option>
    </DsNativeSelect>
  </DsFilterBar>
</template>
