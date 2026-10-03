<script setup lang="ts">
/**
 * FN-M11-5.1.1 / 5.1.2: "Tapis:" card with "Mata Pelajaran" and "Kelas" selects (each submits on change,
 * keeping the other) and the "Reset" link, shown when either query value is non-empty.
 */
import { Funnel, X } from '@lucide/vue'
import { RouterLink } from 'vue-router'

import { FORM_SELECT_CLASS } from '@/components/form'

import type { ItemAnalysis } from '../../api/types'
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
  <section
    class="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow sm:flex-row sm:items-end sm:p-5"
    data-testid="filter-card"
  >
    <div class="flex items-center gap-2 text-sm font-semibold text-slate-700 sm:pb-3">
      <Funnel class="h-4 w-4 text-indigo-500" />{{ ITEM_COPY.filterLabel }}
    </div>
    <div class="min-w-0 flex-1">
      <label for="filter-subject" class="mb-1 block text-xs text-slate-500">{{
        ITEM_COPY.subjectLabel
      }}</label>
      <select
        id="filter-subject"
        :class="[FORM_SELECT_CLASS, 'min-h-11 lg:min-h-0']"
        name="subject_id"
        data-testid="filter-subject"
        @change="$emit('change', 'subject_id', ($event.target as HTMLSelectElement).value)"
      >
        <option value="" :selected="subjectId === null">{{ ITEM_COPY.allSubjects }}</option>
        <option
          v-for="s in options.subjects"
          :key="s.id"
          :value="String(s.id)"
          :selected="s.id === subjectId"
        >
          {{ s.name }}
        </option>
      </select>
    </div>
    <div class="min-w-0 flex-1">
      <label for="filter-classroom" class="mb-1 block text-xs text-slate-500">{{
        ITEM_COPY.classLabel
      }}</label>
      <select
        id="filter-classroom"
        :class="[FORM_SELECT_CLASS, 'min-h-11 lg:min-h-0']"
        name="classroom_id"
        data-testid="filter-classroom"
        @change="$emit('change', 'classroom_id', ($event.target as HTMLSelectElement).value)"
      >
        <option value="" :selected="classroomId === null">{{ ITEM_COPY.allClasses }}</option>
        <option
          v-for="c in options.classes"
          :key="c.id"
          :value="String(c.id)"
          :selected="c.id === classroomId"
        >
          {{ c.name }}
        </option>
      </select>
    </div>
    <RouterLink v-if="showReset" v-slot="{ href, navigate }" custom to="/guru/analisis-item">
      <a
        :href="href"
        class="inline-flex min-h-11 items-center gap-1.5 px-2 text-sm text-slate-500 hover:text-slate-700 lg:min-h-0"
        data-testid="filter-reset"
        @click="navigate"
      >
        <X class="h-4 w-4" />{{ ITEM_COPY.reset }}
      </a>
    </RouterLink>
  </section>
</template>
