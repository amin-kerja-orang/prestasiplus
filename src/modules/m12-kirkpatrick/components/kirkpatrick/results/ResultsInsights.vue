<script setup lang="ts">
/**
 * "Pemerhatian & Insight" (FN-M12-6.9.1; FR-M12-59; BR-M12-24; DV-M12-13): three info rows (the GPS sentence is omitted
 * when the scope has no SPM history) and the disclaimer.
 */
import { DsPanel, DsStack } from '@/ds'

import type { Results } from '../../../api/types'
import { gps, pct, plain } from '../common/kirkpatrick-format'

defineProps<{ insights: Results['insights'] }>()
</script>

<template>
  <DsStack as="section" gap="sm" data-testid="res-insights">
    <DsPanel title="Pemerhatian & Insight" icon="i-ph-lightbulb">
      <ul class="flex flex-col gap-2 text-body text-default">
        <li class="flex items-start gap-3 bg-muted p-3" data-testid="insight-row">
          <UIcon name="i-ph-info" class="mt-1 size-4 shrink-0 text-info" />
          <span
            >Hanya {{ plain(insights.active) }} daripada {{ plain(insights.t4t5) }} pelajar T4/T5
            ({{ pct(insights.pct) }}) menggunakan platform. Data perbandingan terhad kepada pelajar
            aktif sahaja.</span
          >
        </li>
        <li class="flex items-start gap-3 bg-muted p-3" data-testid="insight-row">
          <UIcon name="i-ph-info" class="mt-1 size-4 shrink-0 text-info" />
          <span
            >Purata ketepatan pelajar aktif dalam platform: {{ pct(insights.accuracy) }}. Ini
            bersamaan anggaran gred {{ insights.grade }}.</span
          >
        </li>
        <li
          v-if="insights.gps !== null && insights.year !== null"
          class="flex items-start gap-3 bg-muted p-3"
          data-testid="insight-row"
        >
          <UIcon name="i-ph-info" class="mt-1 size-4 shrink-0 text-info" />
          <span
            >GPS keseluruhan dari headcount (tahun {{ insights.year }}): {{ gps(insights.gps) }}.
            Trend menunjukkan peningkatan dari tahun ke tahun.</span
          >
        </li>
      </ul>
    </DsPanel>
    <UAlert
      color="neutral"
      variant="soft"
      icon="i-ph-warning"
      description="Disclaimer: Data GPS Anggaran berdasarkan markah OTR headcount, bukan keputusan SPM sebenar."
      data-testid="insight-disclaimer"
    />
  </DsStack>
</template>
