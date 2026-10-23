<script setup lang="ts">
/**
 * S21 chart cards (design section 5.1 item 3): "Pecahan Keberkesanan" doughnut with a legend that repeats
 * the counts as text, and "Trend Bulanan (6 Bulan)" line. A chart with nothing to plot shows the DS empty
 * state with the SRS text.
 */
import { computed } from 'vue'

import { DsChart, DsCluster, DsGrid, DsPanel, DsStack, DsText } from '@/ds'

import type { AmaranEffectivenessReportView } from '../../api/amaran'
import { count, KB_DOUGHNUT_LABELS } from './kb-format'

const props = defineProps<{
  doughnut: AmaranEffectivenessReportView['doughnut']
  trend: AmaranEffectivenessReportView['trend']
}>()

const doughnutEmpty = computed(() => props.doughnut.every((n) => n === 0))
const trendEmpty = computed(() => props.trend.data.every((n) => n === 0))
const legend = computed(() => KB_DOUGHNUT_LABELS.map((label, i) => ({ label, n: props.doughnut[i] ?? 0 })))
</script>

<template>
  <DsGrid :cols="{ base: 1, lg: 2 }">
    <DsPanel>
      <DsStack gap="sm" :data-testid="doughnutEmpty ? 'kb-doughnut-empty' : 'kb-doughnut'">
        <DsChart
          type="doughnut"
          title="Pecahan Keberkesanan"
          :heading-level="2"
          :labels="KB_DOUGHNUT_LABELS"
          :series="doughnutEmpty ? [] : [{ label: 'Intervensi', data: [...doughnut] }]"
          table-label="Keberkesanan intervensi"
          empty-label="Tiada data intervensi lagi."
        />
        <DsCluster v-if="!doughnutEmpty" as="ul" gap="md" row-gap="2xs" data-testid="kb-doughnut-legend">
          <DsText
            v-for="l in legend"
            :key="l.label"
            as="li"
            variant="caption"
            data-testid="kb-doughnut-legend-item"
          >
            {{ l.label }}: {{ count(l.n) }}
          </DsText>
        </DsCluster>
      </DsStack>
    </DsPanel>
    <DsPanel>
      <div :data-testid="trendEmpty ? 'kb-trend-empty' : 'kb-trend'">
        <DsChart
          type="line"
          title="Trend Bulanan (6 Bulan)"
          :heading-level="2"
          :labels="trend.labels"
          :series="trendEmpty ? [] : [{ label: 'Intervensi', data: [...trend.data] }]"
          table-label="Trend intervensi 6 bulan"
          empty-label="Tiada data trend lagi."
        />
      </div>
    </DsPanel>
  </DsGrid>
</template>
