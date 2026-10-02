<script setup lang="ts">
/**
 * S1 card "Ringkasan Bank Soalan" (FR-M04-02..04): "Jumlah: {n} soalan" and the subject tiles in
 * two groups ("Subjek Teras", "Subjek Elektif"), 4 tiles per row at every width (as live). Each tile
 * links `?subject_id={id}`; the active one is indigo, with the link that clears the subject filter.
 */
import { CircleX } from '@lucide/vue'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import { AppIcon } from '@/components/icon'
import { formatCount } from '@/lib/number'

import type { QuestionSummary, QuestionSummarySubject } from '../api/questions'
import { QUESTIONS_LIST_PATH, tileName } from '../lib/question-list'

const props = defineProps<{
  summary: QuestionSummary | null
  /** Subject id -> M03 colour (data, applied to the tile icon and total as on live). */
  colors: Record<number, string>
  activeSubjectId: number | null
}>()

const teras = computed<QuestionSummarySubject[]>(
  () => props.summary?.subjects.filter((s) => s.group === 'teras') ?? [],
)
const elektif = computed<QuestionSummarySubject[]>(
  () => props.summary?.subjects.filter((s) => s.group === 'elektif') ?? [],
)

const GROUPS = computed(() => [
  {
    key: 'teras',
    label: 'Subjek Teras',
    badge: 'bg-purple-100 text-purple-700',
    tiles: teras.value,
  },
  {
    key: 'elektif',
    label: 'Subjek Elektif',
    badge: 'bg-amber-100 text-amber-700',
    tiles: elektif.value,
  },
])

const TILE =
  'flex min-h-11 min-w-0 flex-col items-center gap-0.5 overflow-hidden rounded-xl border p-1.5 text-center transition hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 sm:p-2'
</script>

<template>
  <section class="rounded-2xl bg-white p-4 shadow sm:p-5" data-testid="questions-summary">
    <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 class="text-sm font-bold text-slate-800 sm:text-base">Ringkasan Bank Soalan</h2>
      <p class="text-sm text-slate-500" data-testid="questions-total">
        Jumlah:
        <strong class="font-bold text-indigo-600">{{
          summary ? formatCount(summary.total) : '-'
        }}</strong>
        soalan
      </p>
    </div>

    <div v-if="activeSubjectId !== null" class="mb-3">
      <RouterLink
        :to="QUESTIONS_LIST_PATH"
        class="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-red-600 transition hover:text-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
        data-testid="questions-clear-subject"
      >
        <CircleX class="h-4 w-4" aria-hidden="true" />
        Padam filter subjek — tunjuk semua
      </RouterLink>
    </div>

    <div
      v-if="summary === null"
      class="grid grid-cols-4 gap-2"
      data-testid="questions-tiles-skeleton"
    >
      <div
        v-for="n in 8"
        :key="n"
        class="h-20 animate-pulse rounded-xl border border-slate-100 bg-slate-50"
      ></div>
    </div>

    <template v-else>
      <div v-for="group in GROUPS" :key="group.key" class="mb-4 last:mb-0">
        <span
          class="mb-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold"
          :class="group.badge"
          :data-testid="`questions-group-${group.key}`"
          >{{ group.label }}</span
        >
        <div class="grid grid-cols-4 gap-2">
          <RouterLink
            v-for="tile in group.tiles"
            :key="tile.id"
            :to="{ path: QUESTIONS_LIST_PATH, query: { subject_id: String(tile.id) } }"
            :class="[
              TILE,
              tile.id === activeSubjectId
                ? 'border-indigo-400 bg-indigo-50 shadow-md'
                : 'border-slate-200 bg-white',
            ]"
            :style="colors[tile.id] ? { color: colors[tile.id] } : undefined"
            data-testid="questions-tile"
            :data-subject-id="tile.id"
          >
            <AppIcon :name="tile.icon" class="h-5 w-5 shrink-0" />
            <span class="w-full text-xs leading-tight break-words text-slate-500">{{
              tileName(tile.name)
            }}</span>
            <span class="text-sm font-bold" data-testid="questions-tile-total">{{
              formatCount(tile.total)
            }}</span>
            <span
              v-if="tile.approved > 0"
              class="text-xs leading-tight text-slate-400"
              data-testid="questions-tile-approved"
              >{{ formatCount(tile.approved) }} lulus</span
            >
          </RouterLink>
        </div>
      </div>
    </template>
  </section>
</template>
