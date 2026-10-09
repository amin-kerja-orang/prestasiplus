<script setup lang="ts">
/**
 * "🏆 Pendahulu" of the S8–S12 lobbies (SRS M16 v1.6 FR-M16-65; URS FN-M16-5.4.4): up to 10 rows
 * "🥇 / 🥈 / 🥉 / {n}. {name}" and the value ("{n} menang", "{n} kali MVP"). The server orders them
 * (value desc, stable ties, DV-M16-08).
 */
import type { GameLobby } from '../../api'
import { MEDALS } from './lobby-config'

defineProps<{ leaders: NonNullable<GameLobby['leaders']>; unit: string }>()
</script>

<template>
  <section class="rounded-2xl bg-white p-5 shadow sm:p-6" data-testid="leaders-card">
    <h2 class="font-heading text-lg font-bold text-slate-800">🏆 Pendahulu</h2>
    <div class="mt-3 divide-y divide-slate-100" data-testid="leaders-list">
      <div
        v-for="row in leaders"
        :key="row.userId"
        class="flex items-center justify-between gap-3 py-2 text-sm"
        data-testid="leaders-row"
      >
        <span class="min-w-0 font-semibold break-words text-slate-700"
          >{{ MEDALS[row.rank - 1] ?? `${String(row.rank)}.` }} {{ row.name }}</span
        >
        <span class="shrink-0 font-bold text-indigo-600">{{ row.value }} {{ unit }}</span>
      </div>
    </div>
  </section>
</template>
