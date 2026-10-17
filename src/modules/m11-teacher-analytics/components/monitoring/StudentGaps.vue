<script setup lang="ts">
/**
 * S4 "Gap Analysis & Cadangan Latihan" (FN-M11-4.2.8; FR-M11-69): shown only when its tab is active;
 * gap cards by severity, "Topik Kuat" tiles, the empty state with the live copy, and "Subjek Belum
 * Dicuba" chips.
 */
import type { GapSeverity, StudentDetail } from '../../api/types'
import { count, pct1, type UiColor } from './monitoring-format'

defineProps<{ gaps: StudentDetail['gaps'] }>()

const SEVERITY: Record<GapSeverity, UiColor> = {
  Kritikal: 'error',
  Lemah: 'error',
  'Perlu Perhatian': 'warning',
}
</script>

<template>
  <UCard data-testid="mon-panel-gaps">
    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-1">
        <h2 class="flex items-center gap-2 text-label text-highlighted">
          <UIcon name="i-ph-crosshair" class="size-5 text-primary" />Gap Analysis &amp; Cadangan
          Latihan
        </h2>
        <p class="text-caption text-muted">
          Topik lemah dikesan automatik berdasarkan jawapan pelajar. Soalan latihan dicadangkan
          untuk isi gap.
        </p>
      </div>

      <div v-if="gaps.items.length > 0" class="flex flex-col gap-3" data-testid="mon-gap-list">
        <div
          v-for="g in gaps.items"
          :key="`${g.subjectName}-${g.group}`"
          class="flex flex-col gap-2 bg-soft p-3"
          data-testid="mon-gap-card"
        >
          <div class="flex flex-wrap items-start justify-between gap-2">
            <div class="flex min-w-0 flex-col">
              <p class="text-label break-words text-highlighted">{{ g.group }}</p>
              <p class="text-caption text-muted">{{ g.subjectName }}</p>
            </div>
            <UBadge
              :color="SEVERITY[g.severity]"
              :variant="g.severity === 'Kritikal' ? 'solid' : 'subtle'"
              data-testid="mon-gap-severity"
              :label="g.severity"
            />
          </div>
          <div class="flex items-center gap-2">
            <UProgress
              :model-value="Math.max(g.pct, 3)"
              :color="SEVERITY[g.severity]"
              size="md"
              class="min-w-0 flex-1"
            />
            <span class="tabular text-label text-default">{{ pct1(g.pct) }}</span>
          </div>
          <p class="tabular text-caption text-muted">
            {{ count(g.correct) }}/{{ count(g.total) }} betul
          </p>
          <p class="flex items-center gap-1 text-caption text-muted">
            <UIcon name="i-ph-book-open" class="size-4" />{{ count(g.availableQuestions) }} soalan
            tersedia untuk latihan
          </p>
        </div>
      </div>
      <UAlert
        v-else
        color="success"
        variant="subtle"
        icon="i-ph-check-circle"
        title="Tiada topik lemah dikesan!"
        description="Semua topik yang dicuba mempunyai ketepatan melebihi 60%."
        data-testid="mon-gap-empty"
      />

      <div v-if="gaps.strong.length > 0" class="flex flex-col gap-2" data-testid="mon-gap-strong">
        <h3 class="flex items-center gap-2 text-label text-highlighted">
          <UIcon name="i-ph-star" class="size-4 text-success" />Topik Kuat
        </h3>
        <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div
            v-for="s in gaps.strong"
            :key="`${s.subjectName}-${s.group}`"
            class="flex items-center gap-3 bg-soft p-3"
            data-testid="mon-strong-tile"
          >
            <UBadge color="success" variant="subtle" size="lg" :label="`${Math.round(s.pct)}%`" />
            <div class="flex min-w-0 flex-col">
              <p class="text-label break-words text-highlighted">{{ s.group }}</p>
              <p class="text-caption text-muted">
                {{ s.subjectName }} · {{ count(s.answered) }} soalan
              </p>
            </div>
          </div>
        </div>
      </div>

      <div v-if="gaps.untried.length > 0" class="flex flex-col gap-2" data-testid="mon-gap-untried">
        <h3 class="flex items-center gap-2 text-label text-highlighted">
          <UIcon name="i-ph-warning-circle" class="size-4 text-muted" />Subjek Belum Dicuba
        </h3>
        <div class="flex flex-wrap gap-2">
          <UBadge
            v-for="s in gaps.untried"
            :key="s"
            color="neutral"
            variant="subtle"
            data-testid="mon-untried-chip"
            :label="s"
          />
        </div>
      </div>
    </div>
  </UCard>
</template>
