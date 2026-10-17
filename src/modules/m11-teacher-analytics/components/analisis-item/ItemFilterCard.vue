<script setup lang="ts">
/**
 * FN-M11-5.1.1 / 5.1.2: "Tapis:" card with "Mata Pelajaran" and "Kelas" selects (each submits on change,
 * keeping the other) and the "Reset" link, shown when either query value is non-empty.
 */
import type { ItemAnalysis } from '../../api/types'
import NativeSelect from '../native/NativeSelect.vue'
import { ITEM_COPY } from './copy'

defineProps<{
  options: ItemAnalysis['options']
  subjectId: number | null
  classroomId: number | null
  showReset: boolean
}>()
defineEmits<{ change: [field: 'subject_id' | 'classroom_id', value: string] }>()
</script>

<template>
  <UCard data-testid="filter-card">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div class="flex items-center gap-2 text-label text-highlighted sm:pb-3">
        <UIcon name="i-ph-funnel" class="size-4" />{{ ITEM_COPY.filterLabel }}
      </div>
      <div class="flex min-w-0 flex-1 flex-col gap-1">
        <label for="filter-subject" class="text-caption text-muted">{{
          ITEM_COPY.subjectLabel
        }}</label>
        <NativeSelect
          id="filter-subject"
          name="subject_id"
          :model-value="subjectId === null ? '' : String(subjectId)"
          data-testid="filter-subject"
          @update:model-value="$emit('change', 'subject_id', $event)"
        >
          <option value="">{{ ITEM_COPY.allSubjects }}</option>
          <option v-for="s in options.subjects" :key="s.id" :value="String(s.id)">
            {{ s.name }}
          </option>
        </NativeSelect>
      </div>
      <div class="flex min-w-0 flex-1 flex-col gap-1">
        <label for="filter-classroom" class="text-caption text-muted">{{
          ITEM_COPY.classLabel
        }}</label>
        <NativeSelect
          id="filter-classroom"
          name="classroom_id"
          :model-value="classroomId === null ? '' : String(classroomId)"
          data-testid="filter-classroom"
          @update:model-value="$emit('change', 'classroom_id', $event)"
        >
          <option value="">{{ ITEM_COPY.allClasses }}</option>
          <option v-for="c in options.classes" :key="c.id" :value="String(c.id)">
            {{ c.name }}
          </option>
        </NativeSelect>
      </div>
      <UButton
        v-if="showReset"
        to="/guru/analisis-item"
        color="neutral"
        variant="ghost"
        size="lg"
        icon="i-ph-x"
        :label="ITEM_COPY.reset"
        data-testid="filter-reset"
      />
    </div>
  </UCard>
</template>
