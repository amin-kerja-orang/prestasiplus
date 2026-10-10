<script setup lang="ts">
/**
 * S2 filter card (FR-M27-59; PROPOSED, pattern of M08 S8 and the M18 level pills). A GET filter: the select
 * "Subjek" submits on change; the level pills "Tingkatan 4" (default) and "Tingkatan 5" are links that keep
 * the chosen subject. The select lists only the subjects with at least one SP at the level; there is no
 * "all" option.
 */
import { RouterLink } from 'vue-router'

import { FORM_SELECT_CLASS } from '@/components/form'

import type { HeatmapLevelCode } from '../../api/school-admin'

const props = defineProps<{
  subjects: { id: number; name: string }[]
  /** The subject id the select shows ('' when the requested id has no SP at the level). */
  subjectId: number | ''
  level: HeatmapLevelCode
}>()

const emit = defineEmits<{ subject: [id: number] }>()

const LEVELS = [
  { code: 't4', query: 'T4', label: 'Tingkatan 4' },
  { code: 't5', query: 'T5', label: 'Tingkatan 5' },
] as const

const PILL =
  'inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold transition-colors'

function pillTo(query: string) {
  return {
    query: {
      ...(props.subjectId === '' ? {} : { subjectId: String(props.subjectId) }),
      tingkatan: query,
    },
  }
}

function onChange(event: Event) {
  const value = Number((event.target as HTMLSelectElement).value)
  if (Number.isInteger(value) && value > 0) emit('subject', value)
}
</script>

<template>
  <form
    class="flex min-w-0 flex-col gap-3 rounded-2xl bg-white p-4 shadow sm:flex-row sm:items-end sm:justify-between"
    data-testid="dh-filters"
    @submit.prevent
  >
    <div class="min-w-0 sm:w-72">
      <label for="dh-subject" class="mb-1 block text-xs font-bold text-slate-500 uppercase"
        >Subjek</label
      >
      <select
        id="dh-subject"
        name="subjectId"
        :value="subjectId"
        :class="FORM_SELECT_CLASS"
        class="min-h-11"
        data-testid="dh-subject"
        @change="onChange"
      >
        <option v-if="subjectId === ''" value="" disabled></option>
        <option v-for="s in subjects" :key="s.id" :value="s.id">{{ s.name }}</option>
      </select>
    </div>
    <div class="flex flex-wrap gap-2" data-testid="dh-levels">
      <RouterLink
        v-for="l in LEVELS"
        :key="l.code"
        :to="pillTo(l.query)"
        :class="[
          PILL,
          level === l.code
            ? 'bg-blue-700 text-white'
            : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
        ]"
        :data-testid="`dh-level-${l.code}`"
        :data-active="level === l.code"
        >{{ l.label }}</RouterLink
      >
    </div>
  </form>
</template>
