<script setup lang="ts">
/**
 * S0 four summary cards (FR-M27-23, 24, 30): JUMLAH PELAJAR (blue), JUMLAH GURU (teal), KELAS AKTIF (pink),
 * LANGGANAN (green with a current subscription, grey for "Belum Ada", DV-M27-04). Tinted card, icon tile at
 * the top-left, upper-case label (CSS only), large value, foot bar. Not links. 4 per row from `md`, 2 per
 * row below (FR-M27-25).
 */
import { DoorOpen, GraduationCap, IdCard, Presentation } from '@lucide/vue'
import { computed, type Component } from 'vue'

import type { SchoolDashboard } from '../../api/dashboard'
import { count } from './dashboard-format'

const props = defineProps<{ cards: SchoolDashboard['cards'] }>()

interface Card {
  key: string
  label: string
  value: string
  icon: Component
  box: string
  tile: string
  labelClass: string
  valueClass: string
  bar: string
  valueSize: string
}

const cards = computed<Card[]>(() => {
  const subscribed = props.cards.subscription.status !== 'none'
  return [
    {
      key: 'pupils',
      label: 'Jumlah Pelajar',
      value: count(props.cards.pupils),
      icon: GraduationCap,
      box: 'border-blue-200 bg-gradient-to-br from-blue-50 to-sky-100',
      tile: 'bg-blue-600',
      labelClass: 'text-blue-600',
      valueClass: 'text-blue-900',
      bar: 'bg-blue-600',
      valueSize: 'text-3xl',
    },
    {
      key: 'teachers',
      label: 'Jumlah Guru',
      value: count(props.cards.teachers),
      icon: Presentation,
      box: 'border-teal-200 bg-gradient-to-br from-teal-50 to-emerald-100',
      tile: 'bg-teal-600',
      labelClass: 'text-teal-600',
      valueClass: 'text-teal-900',
      bar: 'bg-teal-500',
      valueSize: 'text-3xl',
    },
    {
      key: 'classes',
      label: 'Kelas Aktif',
      value: count(props.cards.activeClasses),
      icon: DoorOpen,
      box: 'border-rose-200 bg-gradient-to-br from-rose-50 to-red-100',
      tile: 'bg-rose-600',
      labelClass: 'text-rose-600',
      valueClass: 'text-rose-900',
      bar: 'bg-rose-600',
      valueSize: 'text-3xl',
    },
    {
      key: 'subscription',
      label: 'Langganan',
      value: props.cards.subscription.label,
      icon: IdCard,
      box: subscribed
        ? 'border-green-200 bg-gradient-to-br from-green-50 to-emerald-100'
        : 'border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100',
      tile: subscribed ? 'bg-green-600' : 'bg-slate-500',
      labelClass: subscribed ? 'text-green-600' : 'text-slate-500',
      valueClass: subscribed ? 'text-green-900' : 'text-slate-500',
      bar: subscribed ? 'bg-green-600' : 'bg-slate-400',
      valueSize: 'text-xl',
    },
  ]
})
</script>

<template>
  <div class="grid min-w-0 grid-cols-2 gap-3 md:grid-cols-4 md:gap-4" data-testid="sd-cards">
    <div
      v-for="card in cards"
      :key="card.key"
      :class="['min-w-0 rounded-2xl border p-3 shadow-sm sm:p-5', card.box]"
      :data-testid="`sd-card-${card.key}`"
    >
      <span
        :class="[
          'flex h-10 w-10 items-center justify-center rounded-xl text-white sm:h-11 sm:w-11',
          card.tile,
        ]"
        data-testid="sd-card-tile"
      >
        <component :is="card.icon" class="h-5 w-5" data-testid="sd-card-icon" />
      </span>
      <p
        :class="['mt-3 text-xs font-bold tracking-wide uppercase', card.labelClass]"
        data-testid="sd-card-label"
      >
        {{ card.label }}
      </p>
      <p
        :class="['mt-1 font-bold break-words', card.valueSize, card.valueClass]"
        data-testid="sd-card-value"
      >
        {{ card.value }}
      </p>
      <div :class="['mt-3 h-1 rounded-full', card.bar]" data-testid="sd-card-bar"></div>
    </div>
  </div>
</template>
