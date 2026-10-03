<script setup lang="ts">
/**
 * "Amaran & Pemerhatian" (FN-M12-5.6.1; FR-M12-46; BR-M12-14): the three lists in the order the API gives
 * them (never logged in, teacher logged in without answers, active above 50%). Rendered only when there is at
 * least one item. No item has a button (DV-M12-01).
 */
import { AppIcon } from '@/components/icon'

import type { BehaviorAlert } from '../../../api/types'
import { CARD, pct, plain } from '../common/kirkpatrick-format'

defineProps<{ alerts: BehaviorAlert[] }>()

function text(a: BehaviorAlert): string {
  if (a.kind === 'never')
    return `${a.name}: ${plain(a.n ?? 0)} pelajar tidak pernah login langsung.`
  if (a.kind === 'teacher')
    return `${a.name}: ${plain(a.n ?? 0)} guru telah login tetapi tiada pelajar yang menjawab soalan.`
  return `${a.name}: ${pct(a.pct ?? 0)} pelajar aktif menjawab soalan. Tahniah!`
}
</script>

<template>
  <section v-if="alerts.length > 0" :class="[CARD, 'min-w-0 p-4 sm:p-5']" data-testid="beh-alerts">
    <h2 class="mb-3 flex items-center gap-2 font-heading text-base font-bold text-slate-800">
      <AppIcon name="fa-bell" class="h-4 w-4 text-amber-500" />Amaran &amp; Pemerhatian
    </h2>
    <ul class="space-y-2">
      <li
        v-for="(a, i) in alerts"
        :key="`${a.list}-${a.schoolId}-${i}`"
        :class="[
          'flex items-start gap-2 rounded-lg px-3 py-2 text-sm break-words',
          a.kind === 'good' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700',
        ]"
        :data-kind="a.kind"
        data-testid="beh-alert"
      >
        <AppIcon
          :name="a.kind === 'good' ? 'fa-check-circle' : 'fa-exclamation-triangle'"
          class="mt-0.5 h-4 w-4 shrink-0"
        />
        <span class="min-w-0" data-testid="beh-alert-text">{{ text(a) }}</span>
      </li>
    </ul>
  </section>
</template>
