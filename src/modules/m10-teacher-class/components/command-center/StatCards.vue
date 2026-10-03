<script setup lang="ts">
/** Summary tiles of the S2 modals ("Jumlah Pelajar", "Aktif", ...): value over label. */
export interface StatCard {
  label: string
  value: string
  /** Tailwind text colour of the value. */
  tone?: string
}
defineProps<{ cards: StatCard[]; cols?: string }>()
</script>

<template>
  <div :class="['grid gap-2', cols ?? 'grid-cols-2 sm:grid-cols-4']" data-testid="cc-modal-cards">
    <div
      v-for="c in cards"
      :key="c.label"
      class="min-w-0 rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2"
      data-testid="cc-modal-card"
    >
      <div :class="['font-mono text-xl font-bold break-words', c.tone ?? 'text-slate-50']">
        {{ c.value }}
      </div>
      <div class="text-xs tracking-wide text-slate-400 uppercase">{{ c.label }}</div>
    </div>
  </div>
</template>
