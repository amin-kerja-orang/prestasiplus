<script setup lang="ts">
/** S6 static info box (FN-M21-4.2.6, FR-M21-48): exact copy. */
import { MOHON_COPY } from './mohon-copy'
</script>

<template>
  <section
    class="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-slate-700"
    data-testid="mohon-info"
  >
    <h2 class="font-bold text-blue-800">{{ MOHON_COPY.afterTitle }}</h2>
    <ol class="mt-2 list-decimal space-y-1 pl-5">
      <li v-for="step in MOHON_COPY.afterSteps" :key="step">{{ step }}</li>
    </ol>
    <h2 class="mt-4 font-bold text-blue-800">{{ MOHON_COPY.whoTitle }}</h2>
    <ul class="mt-2 list-disc space-y-1 pl-5">
      <li v-for="w in MOHON_COPY.who" :key="w.strong">
        <strong>{{ w.strong }}</strong
        >{{ w.rest }}
      </li>
    </ul>
  </section>
</template>
