<script setup lang="ts">
/**
 * "Corak Masa Aktiviti" (FN-M12-5.5.1; FR-M12-45; BR-M12-13): a 7 x 18 heat grid (Isnin ... Ahad x 06 ... 23).
 * The grid scrolls inside its card. α = max(0.15, n ÷ max) picks a step of a single kobalt ramp; a zero
 * cell is a flat layer with no number.
 */
import { DsPanel, DsText } from '@/ds'

import type { Behavior } from '../../../api/types'
import { HEAT_DAYS, HEAT_HOURS, heatClass, heatTitle } from './behavior-format'

defineProps<{ heat: Behavior['heat'] }>()
</script>

<template>
  <DsPanel
    title="Corak Masa Aktiviti"
    description="Bilangan soalan dijawab mengikut jam dan hari"
    icon="i-ph-clock"
    data-testid="beh-heat"
  >
    <div
      class="max-w-full overflow-x-auto"
      role="group"
      aria-label="Corak masa aktiviti"
      data-testid="beh-heat-table"
    >
      <div class="grid w-max grid-cols-19 gap-1">
        <span aria-hidden="true" />
        <DsText
          v-for="h in HEAT_HOURS"
          :key="h"
          variant="body"
          as="span"
          tone="muted"
          align="center"
          >{{ h }}</DsText
        >
        <template v-for="(day, d) in HEAT_DAYS" :key="day">
          <span class="pe-2 text-body whitespace-nowrap text-muted">{{ day }}</span>
          <span
            v-for="(hour, c) in HEAT_HOURS"
            :key="hour"
            :class="[
              'tabular flex size-6 items-center justify-center text-body sm:size-8',
              heatClass(heat.cells[d]?.[c] ?? 0, heat.max),
            ]"
            :title="heatTitle(day, hour, heat.cells[d]?.[c] ?? 0)"
            data-testid="beh-heat-cell"
            >{{ (heat.cells[d]?.[c] ?? 0) === 0 ? '' : heat.cells[d]?.[c] }}</span
          >
        </template>
      </div>
    </div>
  </DsPanel>
</template>
