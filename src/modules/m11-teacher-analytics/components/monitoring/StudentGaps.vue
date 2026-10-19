<script setup lang="ts">
/**
 * S4 "Gap Analysis & Cadangan Latihan" (FN-M11-4.2.8; FR-M11-69): shown only when its tab is active;
 * gap cards by severity, "Topik Kuat" tiles, the empty state with the live copy, and "Subjek Belum
 * Dicuba" chips.
 */
import type { GapSeverity, StudentDetail } from '../../api/types'
import { count, pct1, type UiColor } from './monitoring-format'
import { DsCluster, DsGrid, DsStack, DsText } from '@/ds'

defineProps<{ gaps: StudentDetail['gaps'] }>()

const SEVERITY: Record<GapSeverity, UiColor> = {
  Kritikal: 'error',
  Lemah: 'error',
  'Perlu Perhatian': 'warning',
}
</script>

<template>
  <UCard data-testid="mon-panel-gaps">
    <DsStack>
      <DsStack gap="2xs">
        <h2 class="flex items-center gap-2 text-label text-highlighted">
          <UIcon name="i-ph-crosshair" class="size-5 text-primary-t" />Gap Analysis &amp; Cadangan
          Latihan
        </h2>
        <DsText variant="caption">
          Topik lemah dikesan automatik berdasarkan jawapan pelajar. Soalan latihan dicadangkan
          untuk isi gap.
        </DsText>
      </DsStack>

      <DsStack v-if="gaps.items.length > 0" gap="sm" data-testid="mon-gap-list">
        <div
          v-for="g in gaps.items"
          :key="`${g.subjectName}-${g.group}`"
          class="flex flex-col gap-2 bg-soft p-3"
          data-testid="mon-gap-card"
        >
          <DsCluster gap="xs" align="start" justify="between">
            <DsStack gap="none">
              <DsText variant="label" as="p" tone="highlighted" wrap="anywhere">{{
                g.group
              }}</DsText>
              <DsText variant="caption">{{ g.subjectName }}</DsText>
            </DsStack>
            <UBadge
              :color="SEVERITY[g.severity]"
              :variant="g.severity === 'Kritikal' ? 'solid' : 'subtle'"
              data-testid="mon-gap-severity"
              :label="g.severity"
            />
          </DsCluster>
          <DsCluster gap="xs" :wrap="false">
            <UProgress
              :model-value="Math.max(g.pct, 3)"
              :color="SEVERITY[g.severity]"
              size="md"
              class="min-w-0 flex-1"
            />
            <DsText variant="label" tabular>{{ pct1(g.pct) }}</DsText>
          </DsCluster>
          <DsText variant="caption" tabular>
            {{ count(g.correct) }}/{{ count(g.total) }} betul
          </DsText>
          <p class="flex items-center gap-1 text-caption text-muted">
            <UIcon name="i-ph-book-open" class="size-4" />{{ count(g.availableQuestions) }} soalan
            tersedia untuk latihan
          </p>
        </div>
      </DsStack>
      <UAlert
        v-else
        color="success"
        variant="subtle"
        icon="i-ph-check-circle"
        title="Tiada topik lemah dikesan!"
        description="Semua topik yang dicuba mempunyai ketepatan melebihi 60%."
        data-testid="mon-gap-empty"
      />

      <DsStack v-if="gaps.strong.length > 0" gap="xs" data-testid="mon-gap-strong">
        <h3 class="flex items-center gap-2 text-label text-highlighted">
          <UIcon name="i-ph-star" class="size-4 text-success" />Topik Kuat
        </h3>
        <DsGrid :cols="{ base: 1, sm: 2 }" gap="xs">
          <div
            v-for="s in gaps.strong"
            :key="`${s.subjectName}-${s.group}`"
            class="flex items-center gap-3 bg-soft p-3"
            data-testid="mon-strong-tile"
          >
            <UBadge color="success" variant="subtle" size="lg" :label="`${Math.round(s.pct)}%`" />
            <DsStack gap="none">
              <DsText variant="label" as="p" tone="highlighted" wrap="anywhere">{{
                s.group
              }}</DsText>
              <DsText variant="caption">
                {{ s.subjectName }} · {{ count(s.answered) }} soalan
              </DsText>
            </DsStack>
          </div>
        </DsGrid>
      </DsStack>

      <DsStack v-if="gaps.untried.length > 0" gap="xs" data-testid="mon-gap-untried">
        <h3 class="flex items-center gap-2 text-label text-highlighted">
          <UIcon name="i-ph-warning-circle" class="size-4 text-muted" />Subjek Belum Dicuba
        </h3>
        <DsCluster gap="xs" align="stretch">
          <UBadge
            v-for="s in gaps.untried"
            :key="s"
            color="neutral"
            variant="subtle"
            data-testid="mon-untried-chip"
            :label="s"
          />
        </DsCluster>
      </DsStack>
    </DsStack>
  </UCard>
</template>
