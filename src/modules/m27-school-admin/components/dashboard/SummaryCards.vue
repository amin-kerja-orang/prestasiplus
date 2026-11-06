<script setup lang="ts">
/**
 * S0 four summary cards (FR-M27-23, 24, 30; restyle spec AS-2): JUMLAH PELAJAR, JUMLAH GURU, KELAS AKTIF
 * and LANGGANAN (a current subscription is highlighted, "Belum Ada" is the quiet neutral tile, DV-M27-04).
 * Stat tiles with a kobalt-tinted icon chip. Pelajar, Guru and Kelas open their lists; Langganan is read-only (AC-AS-2-3). 4 per row from `md`, 2 per row below (FR-M27-25).
 */
import { computed } from 'vue'

import type { SchoolDashboard } from '../../api/dashboard'
import { DsStatRow, type StatItem } from '@/ds'
import { count, PATHS } from './dashboard-format'

const props = defineProps<{ cards: SchoolDashboard['cards'] }>()

const items = computed<StatItem[]>(() => {
  const subscribed = props.cards.subscription.status !== 'none'
  return [
    {
      key: 'pupils',
      label: 'Jumlah Pelajar',
      value: count(props.cards.pupils),
      icon: 'graduation-cap',
      accent: 'action',
      to: PATHS.pupils,
    },
    {
      key: 'teachers',
      label: 'Jumlah Guru',
      value: count(props.cards.teachers),
      icon: 'chalkboard-teacher',
      accent: 'friend',
      to: PATHS.teachers,
    },
    {
      key: 'classes',
      label: 'Kelas Aktif',
      value: count(props.cards.activeClasses),
      icon: 'door-open',
      accent: 'win',
      to: PATHS.kelas,
    },
    {
      key: 'subscription',
      label: 'Langganan',
      value: props.cards.subscription.label,
      icon: 'identification-card',
      accent: subscribed ? 'action' : 'trial',
    },
  ]
})
</script>

<template>
  <DsStatRow :items="items" prefix="sd-card" part-prefix="sd-card" data-testid="sd-cards" :cols="4" />
</template>
