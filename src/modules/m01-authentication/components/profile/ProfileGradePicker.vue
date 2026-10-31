<script setup lang="ts">
/**
 * S8 "Tahap" radio cards (FR-M01-40). Secondary only (v2): Ting. 1-5 (grade 7-11). A card-variant
 * `URadioGroup` (indicator hidden): the checked card carries the primary tone. Shown for every role.
 */
import { TINGKATAN_GRADES } from '../../lib/lookups'

defineProps<{ modelValue: number | null }>()
const emit = defineEmits<{ 'update:modelValue': [grade: number] }>()

const items = TINGKATAN_GRADES.map((n) => ({ value: n + 6, label: `Ting. ${String(n)}` }))

function onChange(value: unknown): void {
  if (typeof value === 'number') emit('update:modelValue', value)
}
</script>

<template>
  <div class="flex min-w-0 flex-col gap-2" data-testid="grade-picker">
    <p class="flex items-center gap-2 text-label text-highlighted">
      <UIcon name="i-ph-graduation-cap" class="size-4" aria-hidden="true" />
      Tahap
    </p>
    <p class="flex items-center gap-2 text-overline text-muted" data-testid="grade-group">
      <UIcon name="i-ph-buildings" class="size-4" aria-hidden="true" />
      Sekolah Menengah
    </p>
    <URadioGroup
      :model-value="modelValue ?? undefined"
      :items="items"
      legend="Tahap"
      variant="card"
      indicator="hidden"
      orientation="horizontal"
      :ui="{
        fieldset: 'grid grid-cols-5 gap-2',
        item: 'min-h-11 items-center justify-center p-2 text-center',
        wrapper: 'w-full text-center',
        legend: 'sr-only',
      }"
      data-testid="grade-grid"
      @update:model-value="onChange"
    />
  </div>
</template>
