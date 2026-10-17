<script setup lang="ts">
/**
 * FN-M11-2.1.1 / 2.1.2: "Tapis:" card. The class select submits on change and keeps `range`; the range
 * pills link to `?range=N` only, so they drop `classroom_id` (live behaviour, replicated).
 */
import type { ReportClassOption } from '../../api/types'
import NativeSelect from '../native/NativeSelect.vue'
import { LAPORAN_COPY, RANGE_PILLS } from './copy'

defineProps<{
  range: number
  classes: ReportClassOption[]
  /** The selected own class, or null for "Semua Kelas". */
  classroomId: number | null
}>()
defineEmits<{ 'update:classroom': [value: string] }>()
</script>

<template>
  <UCard data-testid="filter-card">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div class="flex items-center gap-2 text-label text-highlighted">
        <UIcon name="i-ph-funnel" class="size-4" />{{ LAPORAN_COPY.filterLabel }}
      </div>
      <NativeSelect
        class="sm:w-64"
        name="classroom_id"
        aria-label="Kelas"
        :model-value="classroomId === null ? '' : String(classroomId)"
        data-testid="filter-classroom"
        @update:model-value="$emit('update:classroom', $event)"
      >
        <option value="">{{ LAPORAN_COPY.allClasses }}</option>
        <option v-for="c in classes" :key="c.id" :value="String(c.id)">
          {{ c.name }}
        </option>
      </NativeSelect>
      <div class="flex w-fit gap-1" data-testid="range-pills">
        <UButton
          v-for="p in RANGE_PILLS"
          :key="p.range"
          :to="{ path: '/guru/laporan', query: { range: String(p.range) } }"
          size="lg"
          :color="p.range === range ? 'primary' : 'neutral'"
          :variant="p.range === range ? 'soft' : 'ghost'"
          :label="p.label"
          :data-testid="`range-${p.range}`"
          :data-active="p.range === range ? 'true' : 'false'"
        />
      </div>
    </div>
  </UCard>
</template>
