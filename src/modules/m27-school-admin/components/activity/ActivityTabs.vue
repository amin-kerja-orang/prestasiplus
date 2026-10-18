<script setup lang="ts">
/**
 * S3 tabs (restyle spec AS-48, second segmented row): "Overview", "Guru ({n})" and "Murid ({n})". Buttons,
 * not links: the tab is local state of the page.
 */
import { computed } from 'vue'

import { DsPillNav, type PillItem } from '@/ds'
export type ActivityTab = 'overview' | 'guru' | 'murid'

const props = defineProps<{ active: ActivityTab; teachers: number; pupils: number }>()
const emit = defineEmits<{ select: [tab: ActivityTab] }>()

const items = computed<PillItem<ActivityTab>[]>(() => [
  { key: 'overview', label: 'Overview', icon: 'i-ph-chart-pie' },
  {
    key: 'guru',
    label: `Guru (${props.teachers.toLocaleString('en-US')})`,
    icon: 'i-ph-chalkboard-teacher',
  },
  {
    key: 'murid',
    label: `Murid (${props.pupils.toLocaleString('en-US')})`,
    icon: 'i-ph-graduation-cap',
  },
])
</script>

<template>
  <DsPillNav
    :items="items"
    :active="active"
    testid-prefix="la-tab" data-testid="la-tabs"
    label="Bahagian laporan"
    @select="emit('select', $event)"
  />
</template>
