<script setup lang="ts">
/**
 * S6 "Headcount — Prestasi SPM" (FR-M08-39): one card per config, newest update first. The status pill by
 * BR-M08-08 rule (1), the chip row TOV → OTRn (AR chips only) → ETR joined by chevrons; the row wraps
 * below 640px (DV-M08-10; live overflows to 392px). "Lihat Penuh" → `/headcount/student/{id}`.
 */
import { ChartLine, ChevronRight, ExternalLink } from '@lucide/vue'
import { RouterLink } from 'vue-router'

import type { StudentPerformance } from '../../api/types'

defineProps<{ userId: number; cards: StudentPerformance['headcount'] }>()

type Card = StudentPerformance['headcount'][number]
type Chip = Card['chips'][number]

const STATUS: Record<Card['status'], { text: string; cls: string }> = {
  on: { text: 'On Track', cls: 'bg-green-100 text-green-700' },
  below: { text: 'Below', cls: 'bg-red-100 text-red-700' },
  none: { text: '—', cls: 'bg-slate-100 text-slate-500' },
}

/** TOV amber, ETR purple; OTR chips green (AR ≥ target) or red (below, or no target). */
function chipClass(chip: Chip): string {
  if (chip.label === 'TOV') return 'bg-amber-50 text-amber-700'
  if (chip.label === 'ETR') return 'bg-purple-50 text-purple-700'
  return chip.tone === 'on' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
}

const chipText = (chip: Chip): string =>
  `${chip.label}: ${chip.value === null ? '—' : `${String(Math.round(chip.value))}%`}`
</script>

<template>
  <section class="min-w-0 rounded-2xl bg-white p-5 shadow" data-testid="headcount-block">
    <h2 class="mb-4 flex items-center gap-2 text-base font-bold text-slate-800">
      <ChartLine class="h-5 w-5 text-blue-500" />Headcount — Prestasi SPM
    </h2>
    <div class="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <article
        v-for="c in cards"
        :key="c.configId"
        class="min-w-0 rounded-2xl bg-slate-50 p-4"
        :data-testid="`headcount-${c.configId}`"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <h3 class="text-sm font-bold break-words text-slate-800">{{ c.subject }}</h3>
            <p class="text-xs text-slate-400">{{ c.className }} · {{ c.year }}</p>
          </div>
          <span
            :class="['shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold', STATUS[c.status].cls]"
            data-testid="status-pill"
            >{{ STATUS[c.status].text }}</span
          >
        </div>
        <div class="mt-3 flex flex-wrap items-center gap-1" data-testid="chip-row">
          <template v-for="(chip, i) in c.chips" :key="chip.label">
            <ChevronRight v-if="i > 0" class="h-3 w-3 shrink-0 text-slate-300" />
            <span
              :class="['rounded-md px-2 py-1 text-xs font-semibold', chipClass(chip)]"
              data-testid="chip"
              >{{ chipText(chip) }}</span
            >
          </template>
        </div>
        <RouterLink
          :to="`/headcount/student/${String(userId)}`"
          class="mt-2 inline-flex min-h-11 items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
        >
          <ExternalLink class="h-3.5 w-3.5" />Lihat Penuh
        </RouterLink>
      </article>
    </div>
  </section>
</template>
