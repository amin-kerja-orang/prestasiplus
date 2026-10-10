<script setup lang="ts">
/**
 * S5 four cards of the shown month (FR-M27-82, 83; BR-M27-28): "Penglibatan" ("{p}%", "{n} aktif / {n}
 * daftar"), "Soalan Dijawab" ("{n}", "{x} soalan/pelajar"), "Ketepatan" ("{p}%" one decimal or "—"),
 * "Sesi Latihan" ("{n}"). Two per row at 375 and 768, four at 1280. PROPOSED composition (D23).
 */
import type { MonthlyReport } from '../../api/school-admin'
import { count, pct0, pct1 } from './monthly-format'

defineProps<{ cards: MonthlyReport['cards'] }>()

const CARD = 'flex min-w-0 flex-col rounded-2xl bg-white p-4 shadow'
const LABEL = 'text-xs font-bold tracking-wide text-slate-500 uppercase'
const VALUE = 'mt-1 text-2xl font-bold text-slate-800 sm:text-3xl'
const SUB = 'mt-1 text-xs text-slate-500'
</script>

<template>
  <div class="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-4" data-testid="lb-cards">
    <div :class="CARD" data-testid="lb-card-participation">
      <p :class="LABEL">Penglibatan</p>
      <p :class="VALUE" data-testid="lb-card-value">{{ pct0(cards.participationPct) }}</p>
      <p :class="SUB" data-testid="lb-card-sub">
        {{ count(cards.active) }} aktif / {{ count(cards.registered) }} daftar
      </p>
    </div>
    <div :class="CARD" data-testid="lb-card-answers">
      <p :class="LABEL">Soalan Dijawab</p>
      <p :class="VALUE" data-testid="lb-card-value">{{ count(cards.answers) }}</p>
      <p :class="SUB" data-testid="lb-card-sub">{{ count(cards.perPupil) }} soalan/pelajar</p>
    </div>
    <div :class="CARD" data-testid="lb-card-accuracy">
      <p :class="LABEL">Ketepatan</p>
      <p :class="VALUE" data-testid="lb-card-value">{{ pct1(cards.accuracy) }}</p>
    </div>
    <div :class="CARD" data-testid="lb-card-sessions">
      <p :class="LABEL">Sesi Latihan</p>
      <p :class="VALUE" data-testid="lb-card-value">{{ count(cards.sessions) }}</p>
    </div>
  </div>
</template>
