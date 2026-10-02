<script setup lang="ts">
/**
 * One expandable S1 card (FN-M11-2.2.2…2.2.6): icon tile, big value, title, sub-lines (slot) and the
 * "Klik untuk ..." hint with a chevron that turns 180° when open. A `div` with a click handler, as live
 * (D10: no role, no tabindex). The open card gets `ring-2 ring-{tone}-400`.
 */
import { ChevronDown } from '@lucide/vue'
import type { Component } from 'vue'

export type CardTone = 'blue' | 'emerald' | 'purple' | 'amber'

const TONES: Record<
  CardTone,
  { card: string; tile: string; value: string; title: string; hint: string; ring: string }
> = {
  blue: {
    card: 'from-blue-50 to-blue-100 border-blue-200',
    tile: 'bg-blue-500',
    value: 'text-blue-900',
    title: 'text-blue-800',
    hint: 'text-blue-500',
    ring: 'ring-2 ring-blue-400',
  },
  emerald: {
    card: 'from-emerald-50 to-emerald-100 border-emerald-200',
    tile: 'bg-emerald-500',
    value: 'text-emerald-900',
    title: 'text-emerald-800',
    hint: 'text-emerald-500',
    ring: 'ring-2 ring-emerald-400',
  },
  purple: {
    card: 'from-purple-50 to-purple-100 border-purple-200',
    tile: 'bg-purple-500',
    value: 'text-purple-900',
    title: 'text-purple-800',
    hint: 'text-purple-400',
    ring: 'ring-2 ring-purple-400',
  },
  amber: {
    card: 'from-amber-50 to-amber-100 border-amber-200',
    tile: 'bg-amber-500',
    value: 'text-amber-900',
    title: 'text-amber-800',
    hint: 'text-amber-500',
    ring: 'ring-2 ring-amber-400',
  },
}

const props = defineProps<{
  tone: CardTone
  icon: Component
  value: string
  title: string
  hint: string
  open: boolean
  testId: string
}>()
defineEmits<{ toggle: [] }>()

const t = TONES[props.tone]
</script>

<template>
  <div
    :class="[
      'min-w-0 cursor-pointer rounded-2xl border bg-linear-to-br p-4 shadow-sm transition',
      t.card,
      open ? t.ring : '',
    ]"
    :data-testid="testId"
    :data-open="open ? 'true' : 'false'"
    @click="$emit('toggle')"
  >
    <div class="flex items-center justify-between gap-2">
      <span
        :class="[
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white',
          t.tile,
        ]"
      >
        <component :is="icon" class="h-5 w-5" />
      </span>
      <span :class="['font-heading text-2xl font-bold', t.value]" data-testid="card-value">{{
        value
      }}</span>
    </div>
    <p :class="['mt-2 text-sm leading-snug font-semibold', t.title]" data-testid="card-title">
      {{ title }}
    </p>
    <slot />
    <p :class="['mt-2 flex items-center gap-1 text-xs', t.hint]">
      <ChevronDown :class="['h-3 w-3 shrink-0 transition-transform', open ? 'rotate-180' : '']" />
      {{ hint }}
    </p>
  </div>
</template>
