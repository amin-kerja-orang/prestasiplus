<script setup lang="ts">
/**
 * FN-M11-2.1.1 / 2.1.2: "Tapis:" card. The class select submits on change and keeps `range`; the range
 * pills link to `?range=N` only, so they drop `classroom_id` (live behaviour, replicated).
 */
import { Funnel } from '@lucide/vue'
import { RouterLink } from 'vue-router'

import { FORM_SELECT_CLASS } from '@/components/form'

import type { ReportClassOption } from '../../api/types'
import { LAPORAN_COPY, RANGE_PILLS } from './copy'

defineProps<{
  range: number
  classes: ReportClassOption[]
  /** The selected own class, or null for "Semua Kelas". */
  classroomId: number | null
}>()
defineEmits<{ 'update:classroom': [value: string] }>()

const PILL = 'inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold transition'
</script>

<template>
  <section
    class="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow sm:flex-row sm:items-center sm:p-5"
    data-testid="filter-card"
  >
    <div class="flex items-center gap-2 text-sm font-semibold text-slate-700">
      <Funnel class="h-4 w-4 text-indigo-500" />{{ LAPORAN_COPY.filterLabel }}
    </div>
    <select
      :class="[FORM_SELECT_CLASS, 'min-h-11 sm:w-64']"
      name="classroom_id"
      data-testid="filter-classroom"
      @change="$emit('update:classroom', ($event.target as HTMLSelectElement).value)"
    >
      <option value="" :selected="classroomId === null">{{ LAPORAN_COPY.allClasses }}</option>
      <option
        v-for="c in classes"
        :key="c.id"
        :value="String(c.id)"
        :selected="c.id === classroomId"
      >
        {{ c.name }}
      </option>
    </select>
    <div class="flex w-fit gap-0.5 rounded-xl bg-slate-100 p-1" data-testid="range-pills">
      <RouterLink
        v-for="p in RANGE_PILLS"
        :key="p.range"
        v-slot="{ href, navigate }"
        custom
        :to="{ path: '/guru/laporan', query: { range: String(p.range) } }"
      >
        <a
          :href="href"
          :class="[
            PILL,
            p.range === range
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-700',
          ]"
          :data-testid="`range-${p.range}`"
          :data-active="p.range === range ? 'true' : 'false'"
          @click="navigate"
          >{{ p.label }}</a
        >
      </RouterLink>
    </div>
  </section>
</template>
