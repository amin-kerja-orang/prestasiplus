<script setup lang="ts">
/** S6 gradient hero (FN-M21-4.2.1): H1 24 px at every width and the lead line. */
import { MOHON_COPY } from './mohon-copy'
</script>

<template>
  <section
    class="rounded-2xl bg-linear-to-br from-pink-500 to-purple-600 px-5 py-6 text-center text-white shadow-lg"
    data-testid="mohon-hero"
  >
    <h1 class="text-2xl font-bold">{{ MOHON_COPY.title }}</h1>
    <p class="mt-1 text-sm text-white/90">{{ MOHON_COPY.heroLead }}</p>
  </section>
</template>
