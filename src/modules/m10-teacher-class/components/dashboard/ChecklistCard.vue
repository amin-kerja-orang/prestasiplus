<script setup lang="ts">
/** FN-M10-2.1.2: "Checklist Guru" (FR-M10-09, BR-M10-05). */
import { ClipboardCheck, Laptop, Rocket, Users } from '@lucide/vue'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import type { GuruDashboard } from '../../api/types'
import { DASH_COPY } from './copy'
import { checklistProgress } from './lib'

const props = defineProps<{ checklist: GuruDashboard['checklist'] }>()
const progress = computed(() => checklistProgress(props.checklist))
const ICONS = [Laptop, Users, Rocket]
</script>

<template>
  <section class="min-w-0 rounded-3xl bg-white p-4 shadow-sm sm:p-6" data-testid="checklist-card">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h2 class="flex items-center gap-2 text-sm font-bold text-slate-800">
          <ClipboardCheck class="h-4 w-4 shrink-0 text-emerald-600" />{{ DASH_COPY.checklistTitle }}
        </h2>
        <p class="text-xs text-teal-600" data-testid="checklist-count">
          {{ progress.done }}/3 langkah selesai
        </p>
      </div>
      <p class="font-heading text-lg font-bold text-teal-600" data-testid="checklist-percent">
        {{ progress.percent }}%
      </p>
    </div>
    <div class="mt-3 h-2 overflow-hidden rounded-full bg-emerald-100">
      <div
        class="h-full rounded-full bg-emerald-500 transition-all"
        :style="{ width: `${progress.percent}%` }"
        data-testid="checklist-bar"
      />
    </div>
    <ul class="mt-4 space-y-2">
      <li
        v-for="(row, i) in DASH_COPY.checklistRows"
        :key="row.key"
        class="flex min-w-0 items-center gap-3 rounded-xl p-2"
        :data-done="checklist[row.key]"
        data-testid="checklist-row"
      >
        <span
          :class="[
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
            checklist[row.key] ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400',
          ]"
        >
          <component :is="ICONS[i]" class="h-4 w-4" />
        </span>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold text-slate-800">{{ row.title }}</p>
          <p class="text-xs text-slate-500">{{ row.text }}</p>
        </div>
        <RouterLink
          :to="row.to"
          class="inline-flex min-h-11 shrink-0 items-center rounded-lg bg-teal-600 px-3 text-xs font-bold text-white hover:bg-teal-700"
          data-testid="checklist-link"
          >{{ DASH_COPY.view }}</RouterLink
        >
      </li>
    </ul>
  </section>
</template>
