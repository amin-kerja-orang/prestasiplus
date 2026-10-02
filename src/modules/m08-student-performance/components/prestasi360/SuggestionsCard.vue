<script setup lang="ts">
/**
 * S6 "Cadangan" (FR-M08-44): the BR-M08-13 sentences in order, rows alternating blue-50 / amber-50 with an
 * icon bubble (the icon per kind is INFERRED).
 */
import { BookOpen, Lightbulb, Star, Target } from '@lucide/vue'
import type { Component } from 'vue'

import type { StudentPerformance } from '../../api/types'

defineProps<{ items: StudentPerformance['suggestions'] }>()

const ICON: Record<string, Component> = {
  inactive: Star,
  'no-sessions': Star,
  start: Star,
  subject: BookOpen,
  topic: Target,
  headcount: Target,
}
</script>

<template>
  <section class="min-w-0 rounded-2xl bg-white p-5 shadow" data-testid="suggestions">
    <h2 class="mb-4 flex items-center gap-2 text-base font-bold text-slate-800">
      <Lightbulb class="h-5 w-5 text-amber-500" />Cadangan
    </h2>
    <ul class="space-y-2">
      <li
        v-for="(s, i) in items"
        :key="`${s.kind}-${String(i)}`"
        :class="[
          'flex items-center gap-3 rounded-xl p-3 text-sm text-slate-700',
          i % 2 === 0 ? 'bg-blue-50' : 'bg-amber-50',
        ]"
        data-testid="suggestion"
      >
        <span
          :class="[
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
            i % 2 === 0 ? 'bg-blue-100 text-blue-600' : 'bg-amber-100 text-amber-600',
          ]"
        >
          <component :is="ICON[s.kind] ?? Star" class="h-4 w-4" />
        </span>
        <p class="min-w-0 break-words">{{ s.text }}</p>
      </li>
    </ul>
  </section>
</template>
