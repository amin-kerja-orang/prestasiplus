<script setup lang="ts">
/** Stat card with a coloured top edge (live S4 / S7); `clickTitle` makes it a button (S7 "Jumlah Jawapan 🔍"). */
import { computed } from 'vue'

type Accent = 'indigo' | 'emerald' | 'amber' | 'rose' | 'cyan'

const props = defineProps<{
  label: string
  value: string
  accent: Accent
  /** Appends the 🔍 and makes the card a button with this `title`. */
  clickTitle?: string
}>()
defineEmits<{ click: [] }>()

const EDGE: Record<Accent, string> = {
  indigo: 'border-t-indigo-500',
  emerald: 'border-t-emerald-500',
  amber: 'border-t-amber-500',
  rose: 'border-t-rose-500',
  cyan: 'border-t-cyan-500',
}
const TEXT: Record<Accent, string> = {
  indigo: 'text-indigo-300',
  emerald: 'text-emerald-300',
  amber: 'text-amber-300',
  rose: 'text-rose-300',
  cyan: 'text-cyan-300',
}
const classes = computed(() => [
  'min-w-0 rounded-2xl border border-t-4 border-slate-700 bg-slate-800 p-4 text-left',
  EDGE[props.accent],
])
</script>

<template>
  <div
    v-if="clickTitle"
    :title="clickTitle"
    :class="[classes, 'cursor-pointer transition hover:bg-slate-700/60']"
    data-testid="cc-stat"
    @click="$emit('click')"
  >
    <div class="text-xs font-semibold tracking-wider text-slate-400 uppercase">
      {{ label }} <span aria-hidden="true">🔍</span>
    </div>
    <div :class="['mt-1 font-mono text-3xl font-bold', TEXT[accent]]" data-testid="cc-stat-value">
      {{ value }}
    </div>
  </div>
  <div v-else :class="classes" data-testid="cc-stat">
    <div class="text-xs font-semibold tracking-wider text-slate-400 uppercase">{{ label }}</div>
    <div :class="['mt-1 font-mono text-3xl font-bold', TEXT[accent]]" data-testid="cc-stat-value">
      {{ value }}
    </div>
  </div>
</template>
