<script setup lang="ts">
/**
 * S1 KPI row (FN-M12-2.5.1; FR-M12-29): four links in a `DsStatRow`. The monitoring links follow the mount
 * (`/admin/monitoring`, `/guru/monitoring`, `/admin-sekolah/monitoring`); the learning links are plain
 * tiles on the alias (`detail` off).
 */
import { computed } from 'vue'

import { DsStatRow, type StatItem } from '@/ds'

import type { Overview } from '../../../api/types'
import { count, pct, plain, type KirkpatrickPaths } from '../common'

const props = defineProps<{ kpi: Overview['kpi']; paths: KirkpatrickPaths; detail: boolean }>()

const items = computed<StatItem[]>(() => {
  const learning = props.detail ? props.paths.learning : undefined
  return [
    {
      key: 'registered',
      label: 'Pelajar Berdaftar (T4/T5)',
      value: count(props.kpi.t4t5),
      icon: 'i-ph-graduation-cap',
      to: props.paths.monitoring,
    },
    {
      key: 'answers',
      label: 'Soalan Dijawab',
      value: count(props.kpi.answers),
      icon: 'i-ph-pencil-simple',
      to: learning,
    },
    {
      key: 'teachers',
      label: 'Guru Aktif',
      value: `${plain(props.kpi.teachersLoggedIn)}/${plain(props.kpi.teachers)}`,
      icon: 'i-ph-chalkboard-teacher',
      to: props.paths.monitoring,
    },
    {
      key: 'accuracy',
      label: 'Ketepatan Keseluruhan',
      value: pct(props.kpi.accuracy),
      icon: 'i-ph-target',
      to: learning,
    },
  ]
})
</script>

<template>
  <DsStatRow :items="items" prefix="kirk-kpi" :cols="4" roomy data-testid="kirk-kpis" />
</template>
