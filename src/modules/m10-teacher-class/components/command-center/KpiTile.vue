<script setup lang="ts">
/** One of the four KPI tiles (FR-M10-16, FN-M10-2.2.3): label with "🔍", value, sub text; a click opens its drill. */
type Accent = 'indigo' | 'emerald' | 'amber' | 'rose'

defineProps<{ label: string; value: string; sub: string; accent: Accent; testid: string }>()
defineEmits<{ click: [] }>()

const EDGE: Record<Accent, string> = {
  indigo: 'border-t-indigo-500',
  emerald: 'border-t-emerald-500',
  amber: 'border-t-amber-500',
  rose: 'border-t-rose-500',
}
const TEXT: Record<Accent, string> = {
  indigo: 'text-indigo-300',
  emerald: 'text-emerald-300',
  amber: 'text-amber-300',
  rose: 'text-rose-300',
}
</script>

<template>
  <div
    :class="[
      'min-w-0 cursor-pointer rounded-2xl border border-t-4 border-slate-700 bg-slate-800 p-4 transition hover:bg-slate-700/60',
      EDGE[accent],
    ]"
    :data-testid="testid"
    @click="$emit('click')"
  >
    <div class="text-xs font-semibold tracking-widest text-slate-400 uppercase">
      {{ label }} <span aria-hidden="true">🔍</span>
    </div>
    <div :class="['mt-1 font-mono text-3xl font-bold', TEXT[accent]]" data-testid="cc-kpi-value">
      {{ value }}
    </div>
    <div class="mt-1 text-sm text-slate-400" data-testid="cc-kpi-sub">{{ sub }}</div>
  </div>
</template>
