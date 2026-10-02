<script setup lang="ts">
/** Summary tiles of the S7 modals ("Jawapan", "Sesi", ...): value over label. */
export interface CcModalStat {
  label: string
  value: string
  /** Tailwind text colour of the value. */
  tone?: string
}
defineProps<{ stats: CcModalStat[] }>()
</script>

<template>
  <div class="grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="cc-modal-stats">
    <div
      v-for="s in stats"
      :key="s.label"
      class="min-w-0 rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2"
      data-testid="cc-modal-stat"
    >
      <div :class="['font-mono text-xl font-bold break-words', s.tone ?? 'text-slate-50']">
        {{ s.value }}
      </div>
      <div class="text-xs tracking-wide text-slate-400 uppercase">{{ s.label }}</div>
    </div>
  </div>
</template>
