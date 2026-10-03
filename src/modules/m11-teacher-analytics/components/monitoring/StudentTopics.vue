<script setup lang="ts">
/** S4 "Mengikut Tajuk" (FN-M11-4.2.5; FR-M11-66): topics grouped by subject with a Kuat / Sederhana / Lemah badge. */
import { Layers } from '@lucide/vue'

import type { StudentDetail } from '../../api/types'
import {
  ACCURACY_TEXT_600,
  CARD,
  TOPIC_BADGE,
  accuracyBand,
  count,
  pct1,
} from './monitoring-format'

defineProps<{ topics: StudentDetail['topics'] }>()
</script>

<template>
  <section :class="[CARD, 'p-3 sm:p-5']" data-testid="mon-panel-topic">
    <h3 class="mb-3 flex items-center gap-2 font-heading text-base font-bold text-slate-800">
      <Layers class="h-5 w-5 text-indigo-600" />Mengikut Tajuk
    </h3>
    <div
      v-for="g in topics"
      :key="g.subjectId"
      class="mb-4 last:mb-0"
      data-testid="mon-topic-group"
    >
      <h4 class="mb-1 text-xs font-bold text-indigo-600 uppercase">{{ g.subjectName }}</h4>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[420px] text-sm">
          <tbody>
            <tr
              v-for="(r, i) in g.rows"
              :key="i"
              class="border-b border-slate-50"
              data-testid="mon-topic-row"
            >
              <td class="w-16 px-2 py-1.5 text-xs whitespace-nowrap text-slate-400">
                {{ r.bab === null ? '' : `Bab ${String(r.bab)}` }}
              </td>
              <td class="px-2 py-1.5 text-slate-700">{{ r.name }}</td>
              <td
                :class="[
                  'px-2 py-1.5 font-semibold whitespace-nowrap',
                  ACCURACY_TEXT_600[accuracyBand(r.pct)],
                ]"
              >
                {{ pct1(r.pct) }}
              </td>
              <td class="px-2 py-1.5 text-xs whitespace-nowrap text-slate-500">
                {{ count(r.correct) }}/{{ count(r.total) }}
              </td>
              <td class="px-2 py-1.5">
                <span
                  :class="['rounded-full px-2 py-0.5 text-xs font-semibold', TOPIC_BADGE[r.badge]]"
                  >{{ r.badge }}</span
                >
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>
