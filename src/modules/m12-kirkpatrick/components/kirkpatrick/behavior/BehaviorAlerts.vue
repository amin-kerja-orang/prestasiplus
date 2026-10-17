<script setup lang="ts">
/**
 * "Amaran & Pemerhatian" (FN-M12-5.6.1; FR-M12-46; BR-M12-14): the three lists in the order the API gives
 * them (never logged in, teacher logged in without answers, active above 50%). Rendered only when there is at
 * least one item. No item has a button (DV-M12-01). Meaning is carried by icon and words, not colour alone.
 */
import type { BehaviorAlert } from '../../../api/types'
import KirkpatrickPanel from '../common/KirkpatrickPanel.vue'
import { pct, plain } from '../common/kirkpatrick-format'

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
  <KirkpatrickPanel
    v-if="alerts.length > 0"
    title="Amaran & Pemerhatian"
    icon="i-ph-bell"
    data-testid="beh-alerts"
  >
    <ul class="flex flex-col gap-2">
      <li v-for="(a, i) in alerts" :key="`${a.list}-${a.schoolId}-${i}`">
        <UAlert
          :color="a.kind === 'good' ? 'success' : 'error'"
          variant="soft"
          :icon="a.kind === 'good' ? 'i-ph-check-circle' : 'i-ph-warning'"
          :data-kind="a.kind"
          data-testid="beh-alert"
        >
          <template #title>
            <span class="break-words" data-testid="beh-alert-text">{{ text(a) }}</span>
          </template>
        </UAlert>
      </li>
    </ul>
  </KirkpatrickPanel>
</template>
