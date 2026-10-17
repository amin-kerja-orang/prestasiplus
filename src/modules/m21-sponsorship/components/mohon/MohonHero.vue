<script setup lang="ts">
/** S6 hero (FN-M21-4.2.1): A1 gradient card, H1 and the lead line. */
import { MOHON_COPY } from './mohon-copy'
</script>

<template>
  <section
    class="rounded-3xl bg-gradient-primary px-5 py-6 text-left text-primary-on shadow-hero"
    data-testid="mohon-hero"
  >
    <h1 class="font-display text-title font-extrabold break-words">{{ MOHON_COPY.title }}</h1>
    <p class="mt-1 text-body">{{ MOHON_COPY.heroLead }}</p>
  </section>
</template>
