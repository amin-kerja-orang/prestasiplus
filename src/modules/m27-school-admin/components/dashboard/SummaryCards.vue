<script setup lang="ts">
/**
 * S0 four summary cards (FR-M27-23, 24, 30; restyle spec AS-2): JUMLAH PELAJAR, JUMLAH GURU, KELAS AKTIF
 * and LANGGANAN (a current subscription is highlighted, "Belum Ada" is the quiet neutral tile, DV-M27-04).
 * Stat tiles with a kobalt-tinted icon chip. Not links. 4 per row from `md`, 2 per row below (FR-M27-25).
 *
 * Layout hooks (SW6-02), no `src/ds` change: `DsStatRow :cols="4"` is 3 per row at `md`, which left the fourth tile
 * alone under three, so the row's own class (`md:grid-cols-4!`, `!` beats the row's `md:grid-cols-3` whatever the
 * stylesheet order) makes it 4 from `md`. The subscription value is a word ("Belum Ada", a plan name), not a figure:
 * `valueClass` (the only hook for the number's class) gives it label size and no break inside a word, so it stays
 * whole in the ~78px beside the chip at 375 and 768. `text-highlighted` is the number colour `valueClass` replaces.
 */
import { computed } from 'vue'

import type { SchoolDashboard } from '../../api/dashboard'
import { DsStatRow, type StatItem } from '@/ds'
import { count } from './dashboard-format'

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
    },
    {
      key: 'teachers',
      label: 'Jumlah Guru',
      value: count(props.cards.teachers),
      icon: 'chalkboard-teacher',
      accent: 'friend',
    },
    {
      key: 'classes',
      label: 'Kelas Aktif',
      value: count(props.cards.activeClasses),
      icon: 'door-open',
      accent: 'win',
    },
    {
      key: 'subscription',
      label: 'Langganan',
      value: props.cards.subscription.label,
      icon: 'identification-card',
      accent: subscribed ? 'action' : 'trial',
      valueClass: 'text-highlighted staff:text-label! wrap-normal!',
    },
  ]
})
</script>

<template>
  <DsStatRow
    :items="items"
    prefix="sd-card"
    part-prefix="sd-card"
    data-testid="sd-cards"
    :cols="4"
    class="md:grid-cols-4!"
  />
</template>
