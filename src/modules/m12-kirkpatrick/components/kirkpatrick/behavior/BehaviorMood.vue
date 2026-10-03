<script setup lang="ts">
/**
 * Mood empty card (FN-M12-5.7.1; FR-M12-47; BR-M12-15): shown while the mood check-in count in scope is 0 (always
 * in the prototype: the mood store owner, M26, is not built). The populated mood analysis is unverified on live
 * and not built, so a count above 0 renders nothing.
 */
import { CARD } from '../common/kirkpatrick-format'

defineProps<{ moodCount: number }>()
</script>

<template>
  <section v-if="moodCount === 0" :class="[CARD, 'min-w-0 p-6 text-center']" data-testid="beh-mood">
    <p class="text-3xl">💭</p>
    <p class="mt-1 font-heading text-sm font-bold text-slate-700">Data Mood Belum Mencukupi</p>
    <p class="mt-1 text-xs text-slate-400">
      Pelajar perlu check-in mood harian untuk analisis kesejahteraan vs prestasi.
    </p>
  </section>
</template>
