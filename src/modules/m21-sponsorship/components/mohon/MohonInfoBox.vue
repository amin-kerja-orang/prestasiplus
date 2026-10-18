<script setup lang="ts">
/** S6 static info box (FN-M21-4.2.6, FR-M21-48): exact copy. */
import { DsIconChip } from '@/ds'

import { MOHON_COPY } from './mohon-copy'
</script>

<template>
  <section
    class="flex flex-col gap-2 rounded-card bg-friend/16 p-4 text-body text-default"
    data-testid="mohon-info"
  >
    <h2 class="flex items-center gap-2 text-subheading text-highlighted">
      <DsIconChip icon="list-checks" accent="friend" size="sm" />
      {{ MOHON_COPY.afterTitle }}
    </h2>
    <ol class="flex flex-col gap-1 ps-4">
      <li v-for="(step, i) in MOHON_COPY.afterSteps" :key="step">{{ i + 1 }}. {{ step }}</li>
    </ol>
    <h2 class="mt-2 flex items-center gap-2 text-subheading text-highlighted">
      <DsIconChip icon="users" accent="friend" size="sm" />
      {{ MOHON_COPY.whoTitle }}
    </h2>
    <ul class="flex flex-col gap-1 ps-4">
      <li v-for="w in MOHON_COPY.who" :key="w.strong">
        <strong>{{ w.strong }}</strong
        >{{ w.rest }}
      </li>
    </ul>
  </section>
</template>
