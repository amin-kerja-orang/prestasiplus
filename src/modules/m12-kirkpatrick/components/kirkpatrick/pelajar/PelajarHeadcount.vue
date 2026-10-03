<script setup lang="ts">
/** "Tahap 2 — Head Count" (FN-M12-9.3.1; FR-M12-82; BR-M12-30): "{tahun} — Head Count" and one row per subject, "TOV:{x}" or "-". */
import type { StudentKirkpatrick } from '../../../api/types'
import { gps } from '../common/kirkpatrick-format'

defineProps<{ headcount: StudentKirkpatrick['headcount'] }>()
</script>

<template>
  <section
    class="min-w-0 rounded-2xl border-2 border-gray-200 bg-white p-4"
    data-testid="pel-headcount"
  >
    <h2 class="mb-3 font-heading text-sm font-bold text-gray-800">Tahap 2 — Head Count</h2>
    <p class="mb-2 text-xs font-semibold text-gray-700" data-testid="pel-hc-heading">
      {{ headcount.year }} — Head Count
    </p>
    <ul class="divide-y divide-gray-100 text-sm">
      <li
        v-for="r in headcount.rows"
        :key="r.subjectName"
        class="flex items-baseline justify-between gap-3 py-1.5"
        data-testid="pel-hc-row"
      >
        <span class="min-w-0 text-gray-600">{{ r.subjectName }}</span>
        <span class="shrink-0 font-medium text-gray-800" data-testid="pel-hc-value">{{
          r.tov === null ? '-' : `TOV:${gps(r.tov)}`
        }}</span>
      </li>
    </ul>
  </section>
</template>
