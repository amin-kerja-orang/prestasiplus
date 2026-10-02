<script setup lang="ts">
/**
 * S6 "Peta Aktiviti (90 Hari)" (FR-M08-42): 90 cells, oldest first, coloured by BR-M08-11 buckets.
 * `mouseenter` sets and a mouse leaving clears the active day, `click` toggles it; the active day shows the
 * `bg-slate-800 text-white` tooltip "{dd/mm} ({hari}) — Tiada aktiviti | {n} sesi".
 */
import { CalendarDays, CalendarClock } from '@lucide/vue'
import { computed, ref } from 'vue'

import type { StudentPerformance } from '../../api/types'
import { dayLabel, heatClass } from '../../lib/analitik'

const props = defineProps<{ days: StudentPerformance['heatmap'] }>()

/**
 * `hover` follows the pointer (mouseenter sets, mouseleave clears); `pinned` is the click toggle. A tap on
 * a touch screen fires mouseenter and then click, so on live a single `activeDay` would hide the tooltip
 * the tap just opened; keeping both makes click and hover each work (D9, touch).
 */
const hover = ref('')
const pinned = ref('')
const activeDay = computed(() => hover.value || pinned.value)
const tooltip = computed(() => {
  const d = props.days.find((x) => x.date === activeDay.value)
  return d ? dayLabel(d.date, d.sessions) : ''
})
/** A mouse leaving clears the day as on live (FR-M08-42); a touch tap keeps its pin. */
const leave = (e: PointerEvent): void => {
  hover.value = ''
  if (e.pointerType === 'mouse') pinned.value = ''
}
const toggle = (date: string): void => {
  if (pinned.value === date) {
    pinned.value = ''
    hover.value = ''
  } else {
    pinned.value = date
    hover.value = date
  }
}

const LEGEND = [
  { label: '0', cls: 'bg-slate-100' },
  { label: '1-1', cls: 'bg-green-200' },
  { label: '2-2', cls: 'bg-green-400' },
  { label: '3-3', cls: 'bg-green-600' },
  { label: '4+', cls: 'bg-green-700' },
]
</script>

<template>
  <section class="min-w-0 rounded-2xl bg-white p-5 shadow" data-testid="heatmap-card">
    <h2 class="mb-4 flex items-center gap-2 text-base font-bold text-slate-800">
      <CalendarDays class="h-5 w-5 text-emerald-500" />Peta Aktiviti (90 Hari)
    </h2>
    <div class="flex flex-wrap gap-0.5" data-testid="heatmap">
      <div
        v-for="d in days"
        :key="d.date"
        :class="[
          'h-3.5 w-3.5 cursor-pointer rounded-sm transition',
          heatClass(d.sessions),
          activeDay === d.date ? 'ring-2 ring-slate-800' : '',
        ]"
        :data-date="d.date"
        data-testid="heat-cell"
        @mouseenter="hover = d.date"
        @pointerleave="leave"
        @click="toggle(d.date)"
      ></div>
    </div>
    <p
      v-if="tooltip"
      class="mt-3 inline-flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-white"
      data-testid="heat-tooltip"
    >
      <CalendarClock class="h-3.5 w-3.5" />{{ tooltip }}
    </p>
    <div class="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
      <template v-for="l in LEGEND" :key="l.label">
        <span>{{ l.label }}</span>
        <span :class="['h-3 w-3 rounded-sm', l.cls]"></span>
      </template>
      <span class="ml-1 text-slate-400">sesi/hari</span>
    </div>
  </section>
</template>
