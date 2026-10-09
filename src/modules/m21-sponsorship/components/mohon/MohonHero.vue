<script setup lang="ts">
/** S6 gradient hero (FN-M21-4.2.1; B-01 blue-to-transparent gradient, left aligned, INFERRED from screenshot): H1 24 px at every width and the lead line. */
import { MOHON_COPY } from './mohon-copy'
</script>

<template>
  <section
    class="rounded-2xl bg-linear-to-r from-blue-600 to-transparent px-5 py-6 text-left text-white"
    data-testid="mohon-hero"
  >
    <h1 class="text-2xl font-bold text-slate-900">{{ MOHON_COPY.title }}</h1>
    <p class="mt-1 text-sm text-white">{{ MOHON_COPY.heroLead }}</p>
  </section>
</template>
