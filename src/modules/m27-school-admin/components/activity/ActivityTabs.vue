<script setup lang="ts">
/**
 * S3 tabs (restyle spec AS-48, second segmented row): "Overview", "Guru ({n})" and "Murid ({n})". Buttons,
 * not links: the tab is local state of the page.
 */
import { computed } from 'vue'

import PillNav, { type PillItem } from '../shared/PillNav.vue'

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
  <PillNav
    :items="items"
    :active="active"
    nav-id="la-tabs"
    prefix="la-tab"
    label="Bahagian laporan"
    @select="emit('select', $event)"
  />
</template>
