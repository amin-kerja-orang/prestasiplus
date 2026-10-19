<script setup lang="ts">
/**
 * S8 "Tahap" radio cards (FR-M01-40). One group only: Darjah 1-6 (grade null or 1-6) or Ting. 1-5
 * (grade 7-11, INFERRED, OQ-5). A card-variant `URadioGroup` (indicator hidden): the checked card
 * carries the primary tone. Shown for every role, as live. Darjah is 6 columns from sm, 3
 * columns below it so the 44px targets fit at 320px (D9 deviation candidate).
 */
import { computed } from 'vue'

import { DARJAH_GRADES, TINGKATAN_GRADES } from '../../lib/lookups'
import { DsStack } from '@/ds'

const props = defineProps<{
  modelValue: number | null
  /** The group of the saved grade (7-11 = secondary); it does not switch while the user edits. */
  secondary: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [grade: number] }>()

const items = computed(() =>
  props.secondary
    ? TINGKATAN_GRADES.map((n) => ({ value: n + 6, label: `Ting. ${String(n)}` }))
    : DARJAH_GRADES.map((n) => ({ value: n, label: `Darjah ${String(n)}` })),
)

function onChange(value: unknown): void {
  if (typeof value === 'number') emit('update:modelValue', value)
}
</script>

<template>
  <DsStack gap="xs" data-testid="grade-picker">
    <p class="flex items-center gap-2 text-label text-highlighted">
      <UIcon name="i-ph-graduation-cap" class="size-4" aria-hidden="true" />
      Tahap
    </p>
    <p class="flex items-center gap-2 text-overline text-muted" data-testid="grade-group">
      <UIcon
        :name="secondary ? 'i-ph-buildings' : 'i-ph-student'"
        class="size-4"
        aria-hidden="true"
      />
      {{ secondary ? 'Sekolah Menengah' : 'Sekolah Rendah' }}
    </p>
    <URadioGroup
      :model-value="modelValue ?? undefined"
      :items="items"
      legend="Tahap"
      variant="card"
      indicator="hidden"
      orientation="horizontal"
      :ui="{
        fieldset: secondary ? 'grid grid-cols-5 gap-2' : 'grid grid-cols-3 gap-2 sm:grid-cols-6',
        item: 'min-h-11 items-center justify-center p-2 text-center',
        wrapper: 'w-full text-center',
        legend: 'sr-only',
      }"
      data-testid="grade-grid"
      @update:model-value="onChange"
    />
  </DsStack>
</template>
