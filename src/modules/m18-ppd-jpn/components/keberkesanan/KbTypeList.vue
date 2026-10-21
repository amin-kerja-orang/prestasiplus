<script setup lang="ts">
/** S21 card "Intervensi Mengikut Jenis": one row per type in the order returned (copy row 35). */
import { DsPanel } from '@/ds'

import type { AmaranEffectivenessReportView } from '../../api/amaran'
import { count } from './kb-format'

defineProps<{ rows: AmaranEffectivenessReportView['byType'] }>()
</script>

<template>
  <DsPanel title="Intervensi Mengikut Jenis" data-testid="kb-types">
    <ul class="flex min-w-0 flex-col divide-y divide-default">
      <li
        v-for="r in rows"
        :key="r.type"
        class="flex min-h-11 items-center justify-between gap-3 py-2"
        data-testid="kb-type-row"
      >
        <span class="min-w-0 text-body text-highlighted">{{ r.label }}</span>
        <span class="tabular shrink-0 text-body text-muted">{{ count(r.count) }} kali</span>
      </li>
    </ul>
  </DsPanel>
</template>
