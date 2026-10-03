<script setup lang="ts">
/**
 * FN-M10-2.1.4: "Tindakan Hari Ini". The prototype returns no priority student, topic or action,
 * so the counters are 0, the empty texts and the single live action card always show (FR-M10-11;
 * populated rows UNVERIFIED, L-M10-01).
 */
import { Laptop } from '@lucide/vue'
import { RouterLink } from 'vue-router'

import type { GuruDashboard } from '../../api/types'
import { DASH_COPY } from './copy'

defineProps<{ today: GuruDashboard['today'] }>()
const BOX = 'rounded-2xl border border-slate-200 bg-white p-4'
const EMPTY = 'mt-3 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500'
</script>

<template>
  <section
    class="min-w-0 rounded-3xl bg-linear-to-br from-white to-indigo-50 p-4 shadow-sm sm:p-6"
    data-testid="today-panel"
  >
    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div class="min-w-0">
        <p class="text-xs font-bold tracking-wide text-indigo-600 uppercase">
          {{ DASH_COPY.todayLabel }}
        </p>
        <h2 class="font-heading text-xl font-bold text-slate-800">{{ DASH_COPY.todayTitle }}</h2>
        <p class="mt-1 text-sm text-slate-600">{{ DASH_COPY.todayText }}</p>
      </div>
      <div class="grid shrink-0 grid-cols-3 gap-2" data-testid="today-counters">
        <div
          v-for="[label, n] in [
            [DASH_COPY.counterStudents, today.students.length],
            [DASH_COPY.counterTopics, today.topics.length],
            [DASH_COPY.counterActions, today.actions.length],
          ]"
          :key="label"
          class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-center sm:min-w-20"
        >
          <p class="text-xs text-slate-500 uppercase">{{ label }}</p>
          <p class="font-heading text-xl font-bold text-slate-800">{{ n }}</p>
        </div>
      </div>
    </div>

    <div class="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
      <div :class="BOX" data-testid="today-students">
        <div class="flex items-center justify-between gap-2">
          <h3 class="text-sm font-bold text-slate-800">{{ DASH_COPY.colStudents }}</h3>
          <span class="text-xs text-slate-400">{{ DASH_COPY.top3 }}</span>
        </div>
        <p :class="EMPTY">{{ DASH_COPY.emptyStudents }}</p>
      </div>
      <div :class="BOX" data-testid="today-topics">
        <div class="flex items-center justify-between gap-2">
          <h3 class="text-sm font-bold text-slate-800">{{ DASH_COPY.colTopics }}</h3>
          <RouterLink
            to="/analitik/kelas"
            class="inline-flex min-h-11 items-center text-xs font-semibold text-indigo-600"
            data-testid="today-analytics"
            >{{ DASH_COPY.analytics }}</RouterLink
          >
        </div>
        <p :class="EMPTY">{{ DASH_COPY.emptyTopics }}</p>
      </div>
      <div :class="BOX" data-testid="today-actions">
        <div class="flex items-center justify-between gap-2">
          <h3 class="text-sm font-bold text-slate-800">{{ DASH_COPY.colActions }}</h3>
          <span class="text-xs text-slate-400">{{ DASH_COPY.ruleBased }}</span>
        </div>
        <div
          class="mt-3 flex gap-3 rounded-xl border border-slate-200 p-3"
          data-testid="today-action"
        >
          <span
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600"
            ><Laptop class="h-4 w-4"
          /></span>
          <div class="min-w-0">
            <p class="text-sm font-bold text-slate-800">{{ DASH_COPY.actionTitle }}</p>
            <span
              class="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600"
              >{{ DASH_COPY.actionBadge }}</span
            >
            <p class="mt-1 text-sm text-slate-500">{{ DASH_COPY.actionText }}</p>
            <RouterLink
              to="/guru/kelas"
              class="inline-flex min-h-11 items-center text-sm font-semibold text-indigo-600"
              data-testid="today-action-link"
              >{{ DASH_COPY.actionLink }}</RouterLink
            >
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
