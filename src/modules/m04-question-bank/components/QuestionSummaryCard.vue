<script setup lang="ts">
/**
 * S1 card "Ringkasan Bank Soalan" (FR-M04-02..04): "Jumlah: {n} soalan" and the subject tiles in
 * two groups ("Subjek Teras", "Subjek Elektif"), 4 tiles per row at every width (as live). Each tile
 * links `?subject_id={id}`; the active one is raised, with the link that clears the subject filter.
 * v2: staff theme, one neutral icon for every subject (the per-subject colour is dropped).
 */
import { computed } from 'vue'

import { formatCount } from '@/lib/number'

import type { QuestionSummary, QuestionSummarySubject } from '../api/questions'
import { QUESTIONS_LIST_PATH, tileName } from '../lib/question-list'

const props = defineProps<{
  summary: QuestionSummary | null
  /** Subject id -> M03 colour (kept in the contract; the staff theme does not use it). */
  colors?: Record<number, string>
  activeSubjectId: number | null
}>()

const teras = computed<QuestionSummarySubject[]>(
  () => props.summary?.subjects.filter((s) => s.group === 'teras') ?? [],
)
const elektif = computed<QuestionSummarySubject[]>(
  () => props.summary?.subjects.filter((s) => s.group === 'elektif') ?? [],
)

const GROUPS = computed(() => [
  { key: 'teras', label: 'Subjek Teras', tiles: teras.value },
  { key: 'elektif', label: 'Subjek Elektif', tiles: elektif.value },
])
</script>

<template>
  <UCard data-testid="questions-summary">
    <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
      <h2 class="text-subheading text-highlighted">Ringkasan Bank Soalan</h2>
      <p class="text-body text-muted" data-testid="questions-total">
        Jumlah:
        <strong class="tabular text-label text-highlighted">{{
          summary ? formatCount(summary.total) : '-'
        }}</strong>
        soalan
      </p>
    </div>

    <div v-if="activeSubjectId !== null" class="mb-4">
      <UButton
        :to="QUESTIONS_LIST_PATH"
        color="error"
        variant="link"
        icon="i-ph-x-circle"
        class="min-h-11"
        data-testid="questions-clear-subject"
        >Padam filter subjek — tunjuk semua</UButton
      >
    </div>

    <div
      v-if="summary === null"
      class="grid grid-cols-4 gap-2"
      data-testid="questions-tiles-skeleton"
    >
      <USkeleton v-for="n in 8" :key="n" class="h-16 w-full" />
    </div>

    <div v-else class="flex flex-col gap-4">
      <div v-for="group in GROUPS" :key="group.key" class="flex flex-col gap-2">
        <div>
          <UBadge
            color="neutral"
            variant="soft"
            :label="group.label"
            :data-testid="`questions-group-${group.key}`"
          />
        </div>
        <div class="grid grid-cols-4 gap-2">
          <UButton
            v-for="tile in group.tiles"
            :key="tile.id"
            :to="{ path: QUESTIONS_LIST_PATH, query: { subject_id: String(tile.id) } }"
            :color="tile.id === activeSubjectId ? 'primary' : 'neutral'"
            :variant="tile.id === activeSubjectId ? 'subtle' : 'soft'"
            class="h-auto min-h-11 min-w-0 flex-col items-center gap-1 overflow-hidden p-2 text-center"
            :aria-current="tile.id === activeSubjectId ? 'true' : undefined"
            data-testid="questions-tile"
            :data-subject-id="tile.id"
          >
            <UIcon name="i-ph-book-open" class="size-5 shrink-0 text-primary" />
            <span class="w-full text-caption break-words text-muted">{{ tileName(tile.name) }}</span>
            <span class="tabular text-label text-highlighted" data-testid="questions-tile-total">{{
              formatCount(tile.total)
            }}</span>
            <span
              v-if="tile.approved > 0"
              class="tabular text-caption text-dimmed"
              data-testid="questions-tile-approved"
              >{{ formatCount(tile.approved) }} lulus</span
            >
          </UButton>
        </div>
      </div>
    </div>
  </UCard>
</template>
