<script setup lang="ts">
/**
 * "Tahap 2 — Prestasi Platform" (FN-M12-9.4.1; FR-M12-83; BR-M12-28): one row per practised subject by accuracy descending,
 * "{x}% ({n})" with a bar of width x (`bg-green-500` >= 70, `bg-yellow-500` 50 to < 70, `bg-red-400` below).
 */
import { computed } from 'vue'

import type { StudentKirkpatrick } from '../../../api/types'
import { pct1 } from '../common/kirkpatrick-format'
import { barFill } from './pelajar-format'

const props = defineProps<{ platform: StudentKirkpatrick['platform'] }>()

const rows = computed(() => [...props.platform].sort((a, b) => b.accuracy - a.accuracy))
</script>

<template>
  <section
    class="min-w-0 rounded-2xl border-2 border-gray-200 bg-white p-4"
    data-testid="pel-platform"
  >
    <h2 class="mb-3 font-heading text-sm font-bold text-gray-800">Tahap 2 — Prestasi Platform</h2>
    <ul class="space-y-3 text-sm">
      <li v-for="r in rows" :key="r.subjectName" data-testid="pel-plat-row">
        <div class="flex items-baseline justify-between gap-3">
          <span class="min-w-0 text-gray-600">{{ r.subjectName }}</span>
          <span class="shrink-0 text-xs font-medium text-gray-700" data-testid="pel-plat-value"
            >{{ pct1(r.accuracy) }} ({{ r.answers }})</span
          >
        </div>
        <div class="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            :class="['h-2 rounded-full', barFill(r.accuracy)]"
            :style="{ width: `${r.accuracy}%` }"
            data-testid="pel-plat-bar"
          />
        </div>
      </li>
    </ul>
  </section>
</template>
