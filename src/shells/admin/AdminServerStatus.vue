<script setup lang="ts">
/**
 * Server-status pill (admin header, ≥ lg only; shells.md §2.3): CPU, RAM, Disk and Uptime,
 * `bg-slate-50 border border-slate-200 rounded-xl`, 11px text, polled every 30 s. Before the
 * first answer (and when no poll has succeeded) each value is "--" in `slate-400`.
 */
import { computed } from 'vue'

import NavIcon from '@/shells/shared/NavIcon.vue'

import { statusTone, TONE_CLASS, useServerStatus } from './server-status'

const { status } = useServerStatus()

const GB = (n: number | undefined): string => (n === undefined ? '--' : `${n}GB`)

const cells = computed(() => {
  const s = status.value
  return [
    {
      id: 'cpu',
      fa: 'fa-microchip',
      value: s ? `${s.cpuPct}%` : '--',
      cls: s ? TONE_CLASS[statusTone('cpu', s.cpuPct)] : 'text-slate-400',
      title: s ? `Load: ${s.load} / ${s.cores} cores` : 'Load',
    },
    {
      id: 'ram',
      fa: 'fa-memory',
      value: s ? `${s.ramPct}%` : '--',
      cls: s ? TONE_CLASS[statusTone('ram', s.ramPct)] : 'text-slate-400',
      title: s ? `${GB(s.ramUsedGb)} / ${GB(s.ramTotalGb)}` : 'RAM',
    },
    {
      id: 'disk',
      fa: 'fa-hard-drive',
      value: s ? `${s.diskPct}%` : '--',
      cls: s ? TONE_CLASS[statusTone('disk', s.diskPct)] : 'text-slate-400',
      title: s ? `${GB(s.diskUsedGb)} / ${GB(s.diskTotalGb)}` : 'Disk',
    },
    {
      id: 'uptime',
      fa: 'fa-clock',
      value: s ? s.uptime : '--',
      cls: s ? 'text-slate-500' : 'text-slate-400',
      title: 'Uptime',
    },
  ]
})
</script>

<template>
  <div
    class="hidden items-center divide-x divide-slate-200 rounded-xl border border-slate-200 bg-slate-50 text-[11px] font-medium lg:flex"
    data-testid="admin-server-status"
  >
    <span
      v-for="cell in cells"
      :key="cell.id"
      class="flex items-center gap-1 px-3 py-1.5"
      :title="cell.title"
      :data-status="cell.id"
    >
      <NavIcon :fa="cell.fa" class="w-3 text-slate-400" />
      <span :class="cell.cls">{{ cell.value }}</span>
    </span>
  </div>
</template>
