<script setup lang="ts">
/**
 * "Corak Masa Aktiviti" (FN-M12-5.5.1; FR-M12-45; BR-M12-13): a 7 x 18 heat table (Isnin ... Ahad x 06 ... 23).
 * Cells are 20 px below `sm`, 24 px from `sm`; the table scrolls inside its card. α = max(0.15, n ÷ max);
 * a zero cell is flat slate with no number.
 */
import { AppIcon } from '@/components/icon'

import type { Behavior } from '../../../api/types'
import { CARD } from '../common/kirkpatrick-format'
import { HEAT_DAYS, HEAT_HOURS, heatAlpha, heatTitle } from './behavior-format'

defineProps<{ heat: Behavior['heat'] }>()
</script>

<template>
  <section :class="[CARD, 'min-w-0 p-4 sm:p-5']" data-testid="beh-heat">
    <h2 class="flex items-center gap-2 font-heading text-base font-bold text-slate-800">
      <AppIcon name="fa-clock" class="h-4 w-4 text-purple-600" />Corak Masa Aktiviti
    </h2>
    <p class="mb-3 text-xs text-slate-500">Bilangan soalan dijawab mengikut jam dan hari</p>
    <div class="overflow-x-auto">
      <table class="border-separate border-spacing-0.5 text-xs" data-testid="beh-heat-table">
        <thead>
          <tr>
            <th class="w-14 min-w-14"></th>
            <th
              v-for="h in HEAT_HOURS"
              :key="h"
              class="w-5 min-w-5 text-center text-[10px] font-medium text-slate-400 sm:w-6 sm:min-w-6"
            >
              {{ h }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(day, d) in HEAT_DAYS" :key="day">
            <th class="pr-1 text-left text-xs font-medium whitespace-nowrap text-slate-500">
              {{ day }}
            </th>
            <td v-for="(hour, c) in HEAT_HOURS" :key="hour" class="p-0">
              <div
                :class="[
                  'flex h-5 w-5 cursor-default items-center justify-center rounded-sm text-[8px] leading-none sm:h-6 sm:w-6',
                  (heat.cells[d]?.[c] ?? 0) === 0 ? 'bg-slate-100 text-slate-200' : 'text-white',
                ]"
                :style="
                  (heat.cells[d]?.[c] ?? 0) === 0
                    ? undefined
                    : {
                        backgroundColor: `rgba(99,102,241,${heatAlpha(heat.cells[d]?.[c] ?? 0, heat.max)})`,
                      }
                "
                :title="heatTitle(day, hour, heat.cells[d]?.[c] ?? 0)"
                data-testid="beh-heat-cell"
              >
                {{ (heat.cells[d]?.[c] ?? 0) === 0 ? '' : heat.cells[d]?.[c] }}
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
