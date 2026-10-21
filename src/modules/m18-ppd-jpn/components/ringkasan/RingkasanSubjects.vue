<script setup lang="ts">
/** S23 card "Analisis Risiko Mengikut Subjek" (design 4.1 item 5): name, "{w}/{m} lemah ({p}%)" and a progress bar. */
import { DsPanel } from '@/ds'
import { formatCount } from '@/lib/number'

import type { AmaranSubjectRisk } from '../../api/amaran'

defineProps<{ rows: AmaranSubjectRisk[] }>()
</script>

<template>
  <DsPanel class="break-inside-avoid" data-testid="rk-subjects">
    <h2 class="text-subheading text-highlighted">Analisis Risiko Mengikut Subjek</h2>
    <ul class="mt-3 flex flex-col gap-3">
      <li
        v-for="r in rows"
        :key="r.subjectId"
        class="flex min-w-0 flex-col gap-2"
        data-testid="rk-subject-row"
      >
        <div class="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <span class="min-w-0 text-label break-words text-highlighted" data-testid="rk-subject-name">{{
            r.subjectName
          }}</span>
          <span class="tabular text-body text-muted" data-testid="rk-subject-weak"
            >{{ formatCount(r.weak) }}/{{ formatCount(r.total) }} lemah ({{ r.pct }}%)</span
          >
        </div>
        <UProgress
          :model-value="Math.min(100, Math.max(0, r.pct))"
          :max="100"
          size="sm"
          color="warning"
          :aria-label="`Pelajar lemah ${r.subjectName}`"
        />
      </li>
    </ul>
  </DsPanel>
</template>
